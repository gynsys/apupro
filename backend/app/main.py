from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router
from app.db.arko_base import ArkoBase, arko_engine
from app.db.base import Base, engine
from app.core.config import settings
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.limiter import limiter
import logging
import re
logger = logging.getLogger(__name__)

from sqlalchemy import text
import app.db.models

def clean_fcas_description(desc: str) -> str:
    if not desc:
        return ""
    cleaned = desc
    cleaned = re.sub(r'Precio Unitario\s+Bs\.?\s*[\d.,]+', ' ', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'Rendimiento\s+[\d.,]+', ' ', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'[\d.,]+\s*%', ' ', cleaned)
    cleaned = re.sub(r'\bF\.?\s*C\.?\s*A\.?\s*S\.?\b|\bFCAS\b|F\.C\.A\.S\.?', ' ', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'Calculos por\s+Rendimiento', ' ', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    cleaned = re.sub(r'^[.\s,;:\-]+', '', cleaned).strip()
    return cleaned

# Configurar Base de Datos para Arko
logger.info("Initializing Arko360 database tables...")
try:
    ArkoBase.metadata.create_all(bind=arko_engine)
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created successfully.")

    # Auto-migración segura de columnas de planes en arko_admins si no existen
    with arko_engine.connect() as conn:
        schema_statements = [
            "ALTER TABLE arko_admins ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'free';",
            "ALTER TABLE arko_admins ADD COLUMN IF NOT EXISTS max_budgets INTEGER DEFAULT 1;",
            "ALTER TABLE arko_admins ADD COLUMN IF NOT EXISTS max_items_per_budget INTEGER DEFAULT 2;",
            "ALTER TABLE arko_admins ADD COLUMN IF NOT EXISTS has_ai_access BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE arko_admins ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMP;",
            "ALTER TABLE arko_admins ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP;",
            "ALTER TABLE arko_admins ADD COLUMN IF NOT EXISTS max_ai_apus INTEGER DEFAULT 0;",
            "ALTER TABLE arko_admins ADD COLUMN IF NOT EXISTS ai_apus_generated INTEGER DEFAULT 0;",
            "ALTER TABLE arko_admins ADD COLUMN IF NOT EXISTS costos_config JSONB;",
            "CREATE INDEX IF NOT EXISTS idx_arko_admins_plan ON arko_admins(plan);",
            "CREATE INDEX IF NOT EXISTS idx_arko_admins_plan_expires ON arko_admins(plan_expires_at);"
        ]
        for stmt in schema_statements:
            try:
                conn.execute(text(stmt))
            except Exception as ex:
                logger.warning(f"Aviso en auto-migración de esquema: {ex}")
        conn.commit()
    logger.info("Schema migrations for arko_admins verified successfully.")

    with engine.connect() as conn:
        budget_schema_statements = [
            "ALTER TABLE budgets ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);",
            "ALTER TABLE budgets ADD COLUMN IF NOT EXISTS notes TEXT;",
            "ALTER TABLE budgets ADD COLUMN IF NOT EXISTS share_token VARCHAR(255);",
            "ALTER TABLE budgets ADD COLUMN IF NOT EXISTS is_public_share BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE budgets ADD COLUMN IF NOT EXISTS ubicacion VARCHAR(255);",
            "UPDATE budgets SET user_id = '1' WHERE user_id IS NULL;"
        ]
        for stmt in budget_schema_statements:
            try:
                conn.execute(text(stmt))
            except Exception as ex:
                logger.warning(f"Aviso en auto-migración de esquema budgets: {ex}")
        conn.commit()

        # Limpieza automatica en produccion de descripciones parasitarias (F.C.A.S., etc.)
        try:
            dirty_items = conn.execute(text("""
                SELECT "CodPar", "Descri", "desc_limpia"
                FROM cost360_items
                WHERE "Descri" ILIKE '%F.C.A.S%' 
                   OR "Descri" ILIKE '%FCAS%' 
                   OR "Descri" ILIKE '%Calculos por Rendimiento%'
                   OR "Descri" ~ '^[.\\s,;:\\-]+'
                   OR "desc_limpia" ILIKE '%F.C.A.S%'
                   OR "desc_limpia" ILIKE '%FCAS%'
                   OR "desc_limpia" ~ '^[.\\s,;:\\-]+'
            """)).fetchall()
            
            if dirty_items:
                for row in dirty_items:
                    cod = row[0]
                    new_desc = clean_fcas_description(row[1] or "")
                    new_limpia = clean_fcas_description(row[2] or "") if row[2] else new_desc
                    conn.execute(
                        text('UPDATE cost360_items SET "Descri" = :d, "desc_limpia" = :l WHERE "CodPar" = :c'),
                        {"d": new_desc, "l": new_limpia, "c": cod}
                    )
                conn.commit()
                logger.info(f"Limpieza automatica de {len(dirty_items)} partidas con F.C.A.S. completada con exito.")
        except Exception as ex_fcas:
            logger.error(f"Error en auto-limpieza de descripciones F.C.A.S.: {ex_fcas}", exc_info=True)

        # Auto-migracion de codigos de Redes Aereas (RA1000 -> 1000RA)
        try:
            res_ra = conn.execute(text("""
                UPDATE cost360_items
                SET "CovPar" = SUBSTRING("CovPar" FROM 3) || 'RA'
                WHERE "CovPar" ~ '^RA[0-9]+'
            """))
            conn.commit()
            if res_ra.rowcount > 0:
                logger.info(f"Auto-migracion de {res_ra.rowcount} partidas de Redes Aereas a formato [numero]RA completada.")
        except Exception as ex_ra:
            logger.error(f"Error en auto-migracion de codigos RA: {ex_ra}", exc_info=True)

    logger.info("Schema and data migrations for cost360 verified successfully.")
except Exception as e:
    logger.error(f"Error creating Arko360 database tables: {e}", exc_info=True)

app = FastAPI(
    title="Arko360 Admin API",
    description="API for Arko360 Administration",
    version="1.0.0",
    docs_url="/api/v1/arko/docs",
    openapi_url="/api/v1/arko/openapi.json",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

from app.services.ai_search import ai_engine
import asyncio
from app.api.v1.endpoints.users import process_plan_expirations
from app.db.models.arko import ArkoAdmin

async def run_expiration_cron():
    while True:
        try:
            # Fake current_user to pass dependency check
            class FakeUser:
                email = "system@costbase.net"
            
            logger.info("Corriendo cron de vencimientos de suscripciones...")
            process_plan_expirations(current_user=FakeUser())
        except Exception as e:
            logger.error(f"Error en el cron de vencimientos: {e}")
        # Run every 5 minutes
        await asyncio.sleep(300)

@app.on_event("startup")
async def startup_event():
    logger.info("Application starting up... Loading AI brain")
    ai_engine.load_brain()
    # Iniciar Cron Job ligero en segundo plano
    asyncio.create_task(run_expiration_cron())

# Set all CORS enabled origins
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix="/api/v1")

import os
upload_dir = settings.UPLOAD_DIR
if not os.path.exists(upload_dir):
    os.makedirs(upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

@app.get("/api/v1/arko/health")
def health_check():
    return {"status": "ok", "service": "arko_backend"}
