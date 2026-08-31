from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router
from app.db.arko_base import ArkoBase, arko_engine
from app.db.base import Base, engine
from app.core.config import settings
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import logging
logger = logging.getLogger(__name__)

import app.db.models

# Rate limiting setup
limiter = Limiter(key_func=get_remote_address)

# Configurar Base de Datos para Arko
logger.info("Initializing Arko360 database tables...")
try:
    ArkoBase.metadata.create_all(bind=arko_engine)
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created successfully.")
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

@app.on_event("startup")
async def startup_event():
    logger.info("Application starting up... Loading AI brain")
    ai_engine.load_brain()

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
