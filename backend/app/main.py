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
logger = logging.getLogger(__name__)

from sqlalchemy import text
import app.db.models

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
