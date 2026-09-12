import os
import re
import time
import shutil
import asyncio
import logging
from datetime import datetime, timezone
from typing import Callable, Any, Dict, Optional, Tuple

import httpx
from fastapi import FastAPI, Request, Response, status
from fastapi.responses import PlainTextResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.api.v1.api import api_router
from app.db.arko_base import ArkoBase, arko_engine
from app.db.base import Base, engine
from app.core.config import settings
from app.core.limiter import limiter
from app.services.ai_search import ai_engine
from app.services.redis_cache_service import redis_cache
from app.api.v1.endpoints.users import process_plan_expirations
from app.db.models.arko import ArkoAdmin
import app.db.models

logger = logging.getLogger(__name__)

APP_START_TIME: float = time.time()

CRON_HEALTH: Dict[str, Any] = {
    "status": "idle",
    "last_run_at": None,
    "last_run_timestamp": 0.0,
    "last_success_at": None,
    "last_duration_ms": 0.0,
    "total_runs": 0,
    "total_errors": 0,
    "last_error": None,
    "last_result": None,
}


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
            "ALTER TABLE arko_admins ADD COLUMN IF NOT EXISTS username VARCHAR(100);",
            "CREATE INDEX IF NOT EXISTS idx_arko_admins_plan ON arko_admins(plan);",
            "CREATE INDEX IF NOT EXISTS idx_arko_admins_plan_expires ON arko_admins(plan_expires_at);",
            "UPDATE arko_admins SET username = LOWER(TRIM(full_name)) WHERE (username IS NULL OR username = '') AND full_name IS NOT NULL AND TRIM(full_name) != '';",
            "UPDATE arko_admins SET username = LOWER(SPLIT_PART(email, '@', 1)) WHERE (username IS NULL OR username = '') AND email IS NOT NULL;",
            "CREATE INDEX IF NOT EXISTS idx_arko_admins_username ON arko_admins(LOWER(username));",
            "UPDATE arko_admins SET max_ai_apus = 20 WHERE plan IN ('Básico', 'basico', 'basic') AND (max_ai_apus = 10 OR max_ai_apus IS NULL);",
            "UPDATE arko_admins SET max_ai_apus = 50 WHERE plan IN ('Profesional', 'profesional', 'pro') AND (max_ai_apus = 25 OR max_ai_apus IS NULL);",
            "UPDATE arko_admins SET max_ai_apus = 100 WHERE plan IN ('Experto', 'experto', 'expert') AND (max_ai_apus = 50 OR max_ai_apus IS NULL);",
            "UPDATE arko_admins SET max_ai_apus = 0 WHERE plan IN ('enterprise', 'corporativo', 'admin');"
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
    debug=settings.DEBUG,
    docs_url="/api/v1/arko/docs",
    openapi_url="/api/v1/arko/openapi.json",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.middleware("http")
async def add_security_headers(request: Request, call_next: Callable[[Request], Any]) -> Response:
    """Inyecta cabeceras HTTP de seguridad estándar y Content Security Policy (CSP)."""
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self' https:; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; "
        "style-src 'self' 'unsafe-inline' https:; "
        "img-src 'self' data: blob: https:; "
        "font-src 'self' data: https:; "
        "connect-src 'self' https: wss: ws:; "
        "frame-ancestors 'none';"
    )
    return response

async def run_expiration_cron() -> None:
    """Cron asíncrono para verificar vencimientos de suscripciones y alertar a Healthchecks.io."""
    class FakeUser:
        email = "system@costbase.net"

    while True:
        cycle_start = time.time()
        now_iso = datetime.now(timezone.utc).isoformat()
        CRON_HEALTH["status"] = "running"
        CRON_HEALTH["last_run_at"] = now_iso
        CRON_HEALTH["last_run_timestamp"] = cycle_start
        CRON_HEALTH["total_runs"] += 1

        try:
            logger.info("Corriendo cron de vencimientos de suscripciones...")
            result = process_plan_expirations(current_user=FakeUser())
            duration_ms = round((time.time() - cycle_start) * 1000, 2)
            CRON_HEALTH["status"] = "healthy"
            CRON_HEALTH["last_success_at"] = datetime.now(timezone.utc).isoformat()
            CRON_HEALTH["last_duration_ms"] = duration_ms
            CRON_HEALTH["last_result"] = result
            CRON_HEALTH["last_error"] = None

            # Ping heartbeat a Healthchecks.io si está configurado
            if settings.HEALTHCHECKS_PING_URL:
                try:
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        await client.get(settings.HEALTHCHECKS_PING_URL)
                except Exception as ping_ex:
                    logger.error(f"Error al enviar ping a Healthchecks.io: {ping_ex}", exc_info=True)

        except Exception as e:
            duration_ms = round((time.time() - cycle_start) * 1000, 2)
            CRON_HEALTH["status"] = "error"
            CRON_HEALTH["total_errors"] += 1
            CRON_HEALTH["last_error"] = str(e)
            CRON_HEALTH["last_duration_ms"] = duration_ms
            logger.error(f"Error en el cron de vencimientos: {e}", exc_info=True)

            # Ping fail a Healthchecks.io si está configurado
            if settings.HEALTHCHECKS_PING_URL:
                try:
                    fail_url = f"{settings.HEALTHCHECKS_PING_URL.rstrip('/')}/fail"
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        await client.post(fail_url, content=str(e)[:200])
                except Exception as ping_ex:
                    logger.error(f"Error al enviar ping de fallo a Healthchecks.io: {ping_ex}", exc_info=True)

        # Run every 5 minutes
        await asyncio.sleep(300)

@app.on_event("startup")
async def startup_event() -> None:
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

class SecureStaticFiles(StaticFiles):
    """
    Subclase de StaticFiles que inyecta cabeceras de seguridad estrictas
    (X-Content-Type-Options, X-Frame-Options) y Cache-Control en archivos servidos.
    """
    async def get_response(self, path: str, scope: Any) -> Response:
        response: Response = await super().get_response(path, scope)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Cache-Control"] = "public, max-age=86400"
        return response


upload_dir = settings.UPLOAD_DIR
if not os.path.exists(upload_dir):
    os.makedirs(upload_dir, exist_ok=True)
app.mount("/uploads", SecureStaticFiles(directory=upload_dir), name="uploads")


def check_system_health() -> Tuple[Dict[str, Any], int]:
    """
    Evalúa la salud de los componentes críticos del sistema:
    - Base de datos primaria (PostgreSQL)
    - Base de datos Arko (PostgreSQL)
    - Conectividad con Redis
    - Estado en RAM del Motor de Búsqueda Vectorial (AI Engine)
    - Estado de ejecución del Cron Job de suscripciones
    - Capacidad de almacenamiento en disco
    """
    now = datetime.now(timezone.utc)
    uptime_sec = round(time.time() - APP_START_TIME, 1)

    # 1. Base de datos primaria
    db_primary_status = "connected"
    db_primary_latency = 0.0
    db_primary_ok = True
    t0 = time.time()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_primary_latency = round((time.time() - t0) * 1000, 2)
    except Exception as ex:
        db_primary_latency = round((time.time() - t0) * 1000, 2)
        db_primary_status = f"error: {str(ex)[:100]}"
        db_primary_ok = False
        logger.error(f"Healthcheck: Error en DB primaria: {ex}", exc_info=True)

    # 2. Base de datos Arko
    db_arko_status = "connected"
    db_arko_latency = 0.0
    db_arko_ok = True
    t0 = time.time()
    try:
        with arko_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_arko_latency = round((time.time() - t0) * 1000, 2)
    except Exception as ex:
        db_arko_latency = round((time.time() - t0) * 1000, 2)
        db_arko_status = f"error: {str(ex)[:100]}"
        db_arko_ok = False
        logger.error(f"Healthcheck: Error en DB Arko: {ex}", exc_info=True)

    # 3. Redis
    redis_status = "disconnected"
    redis_latency = 0.0
    t0 = time.time()
    try:
        if redis_cache.redis_client is None:
            redis_cache._connect()
        if redis_cache.redis_client is not None:
            redis_cache.redis_client.ping()
            redis_latency = round((time.time() - t0) * 1000, 2)
            redis_status = "connected"
    except Exception as ex:
        redis_latency = round((time.time() - t0) * 1000, 2)
        redis_status = f"error: {str(ex)[:100]}"
        logger.error(f"Healthcheck: Error en Redis: {ex}", exc_info=True)

    # 4. Motor de IA
    ai_loaded = bool(getattr(ai_engine, "is_loaded", False))
    embeddings_count = (
        len(ai_engine.ids_mapping)
        if (ai_loaded and hasattr(ai_engine, "ids_mapping") and ai_engine.ids_mapping is not None)
        else 0
    )
    ai_status = "ready" if ai_loaded else "not_loaded"

    # 5. Cron Job
    cron_status = CRON_HEALTH.get("status", "idle")
    last_ts = CRON_HEALTH.get("last_run_timestamp", 0.0)
    minutes_since_run = round((time.time() - last_ts) / 60, 1) if last_ts > 0 else None

    if last_ts > 0 and minutes_since_run is not None and minutes_since_run > 15:
        cron_status = "stalled"
    elif CRON_HEALTH.get("total_runs", 0) == 0:
        cron_status = "initializing"

    # 6. Almacenamiento en Disco
    disk_total_gb = 0.0
    disk_used_gb = 0.0
    disk_free_gb = 0.0
    disk_percent = 0.0
    disk_status = "healthy"
    try:
        root_dir = os.path.abspath(os.sep)
        usage = shutil.disk_usage(root_dir)
        disk_total_gb = round(usage.total / (1024**3), 2)
        disk_used_gb = round(usage.used / (1024**3), 2)
        disk_free_gb = round(usage.free / (1024**3), 2)
        disk_percent = round((usage.used / usage.total) * 100, 1)
        if disk_percent >= 95:
            disk_status = "critical"
        elif disk_percent >= 85:
            disk_status = "warning"
        else:
            disk_status = "healthy"
    except Exception as ex:
        disk_status = f"error: {str(ex)[:100]}"
        logger.error(f"Healthcheck: Error al consultar uso de disco: {ex}", exc_info=True)

    # Estado Global y Código HTTP
    critical_failures = not db_primary_ok or not db_arko_ok
    degraded_conditions = (
        not ai_loaded
        or redis_status != "connected"
        or disk_status in ("warning", "critical")
        or cron_status in ("stalled", "error")
    )

    if critical_failures:
        overall_status = "unhealthy"
        http_code = status.HTTP_503_SERVICE_UNAVAILABLE
    elif degraded_conditions:
        overall_status = "degraded"
        http_code = status.HTTP_200_OK
    else:
        overall_status = "healthy"
        http_code = status.HTTP_200_OK

    health_data: Dict[str, Any] = {
        "status": overall_status,
        "timestamp": now.isoformat(),
        "uptime_seconds": uptime_sec,
        "environment": settings.ENVIRONMENT,
        "components": {
            "database_primary": {
                "status": db_primary_status,
                "latency_ms": db_primary_latency,
            },
            "database_arko": {
                "status": db_arko_status,
                "latency_ms": db_arko_latency,
            },
            "redis": {
                "status": redis_status,
                "latency_ms": redis_latency,
            },
            "ai_engine": {
                "status": ai_status,
                "is_loaded": ai_loaded,
                "embeddings_count": embeddings_count,
            },
            "cron_subscription_expirations": {
                "status": cron_status,
                "last_run_at": CRON_HEALTH.get("last_run_at"),
                "minutes_since_last_run": minutes_since_run,
                "total_runs": CRON_HEALTH.get("total_runs", 0),
                "total_errors": CRON_HEALTH.get("total_errors", 0),
                "last_error": CRON_HEALTH.get("last_error"),
                "last_result": CRON_HEALTH.get("last_result"),
                "healthchecks_ping_enabled": bool(settings.HEALTHCHECKS_PING_URL),
            },
            "system_resources": {
                "disk": {
                    "status": disk_status,
                    "total_gb": disk_total_gb,
                    "used_gb": disk_used_gb,
                    "free_gb": disk_free_gb,
                    "percent_used": disk_percent,
                }
            }
        }
    }
    return health_data, http_code


@app.get("/health", tags=["Monitoring"])
@app.get("/api/v1/health", tags=["Monitoring"])
@app.get("/api/v1/system/health", tags=["Monitoring"])
def get_system_health() -> Response:
    """
    Endpoint integral de salud del sistema para observabilidad y monitores externos
    (UptimeRobot, Better Uptime, Healthchecks.io).
    Retorna HTTP 200 si el sistema está operativo, o HTTP 503 si la base de datos no responde.
    """
    data, http_code = check_system_health()
    return JSONResponse(status_code=http_code, content=data)


@app.get("/api/v1/arko/health", tags=["Monitoring"])
def arko_health_check() -> Dict[str, Any]:
    """Endpoint de compatibilidad previa para chequeo rápido de arko_backend."""
    return {"status": "ok", "service": "arko_backend"}


@app.get("/robots.txt", response_class=PlainTextResponse)
def get_robots_txt() -> str:
    """Disallow search engine crawlers on backend API domain."""
    return "User-agent: *\nDisallow: /\n"


@app.get("/.well-known/security.txt", response_class=PlainTextResponse)
@app.get("/security.txt", response_class=PlainTextResponse)
def get_security_txt() -> str:
    """RFC 9116 security vulnerability reporting contact information."""
    return (
        "# Security Contact Information for CostBase & Arko360\n"
        "# RFC 9116 - A File Format to Aid in Security Vulnerability Disclosure\n\n"
        "Contact: mailto:security@costbase.net\n"
        "Contact: mailto:admin@arko360.net\n"
        "Expires: 2027-12-31T23:59:59.000Z\n"
        "Preferred-Languages: es, en\n"
        "Canonical: https://www.costbase.net/.well-known/security.txt\n"
        "Policy: https://www.costbase.net/security\n"
    )
