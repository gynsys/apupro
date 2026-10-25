"""
Database base configuration and session management for Arko360.
"""
import os
from typing import Any, Dict, Generator
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from app.db.base import engine as primary_engine

# Determine Arko Database URL
# If ARKO_DATABASE_URL is not set or equals DATABASE_URL, share the primary engine pool
ARKO_DATABASE_URL: str = os.getenv(
    "ARKO_DATABASE_URL",
    settings.DATABASE_URL,
)

if ARKO_DATABASE_URL == settings.DATABASE_URL:
    arko_engine = primary_engine
else:
    _is_sqlite: bool = "sqlite" in ARKO_DATABASE_URL
    _arko_kwargs: Dict[str, Any] = {
        "connect_args": {"check_same_thread": False} if _is_sqlite else {},
        "echo": False,
    }
    if not _is_sqlite:
        _arko_kwargs.update(
            {
                "pool_size": settings.DB_POOL_SIZE,
                "max_overflow": settings.DB_MAX_OVERFLOW,
                "pool_timeout": settings.DB_POOL_TIMEOUT,
                "pool_recycle": settings.DB_POOL_RECYCLE,
                "pool_pre_ping": True,
                "pool_use_lifo": True,
            }
        )
    arko_engine = create_engine(ARKO_DATABASE_URL, **_arko_kwargs)

# Create session factory
ArkoSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=arko_engine)

# Declarative base for models
ArkoBase = declarative_base()


def get_arko_db() -> Generator[Session, None, None]:
    """
    Dependency function to get database session for Arko360.
    Yields a database session and ensures it's closed after use.
    """
    db = ArkoSessionLocal()
    try:
        yield db
    finally:
        db.close()
