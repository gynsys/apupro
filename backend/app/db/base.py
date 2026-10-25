"""
Database base configuration and session management.
"""
from contextlib import contextmanager
from typing import Any, Dict, Generator
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

_is_sqlite: bool = "sqlite" in settings.DATABASE_URL
_engine_kwargs: Dict[str, Any] = {
    "connect_args": {"check_same_thread": False} if _is_sqlite else {},
    "echo": False,
}
if not _is_sqlite:
    _engine_kwargs.update(
        {
            "pool_size": settings.DB_POOL_SIZE,
            "max_overflow": settings.DB_MAX_OVERFLOW,
            "pool_timeout": settings.DB_POOL_TIMEOUT,
            "pool_recycle": settings.DB_POOL_RECYCLE,
            "pool_pre_ping": True,
            "pool_use_lifo": True,
        }
    )

# Create database engine
engine = create_engine(settings.DATABASE_URL, **_engine_kwargs)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base for models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Dependency function to get database session.
    Yields a database session and ensures it's closed after use.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """
    Context manager for background tasks or non-FastAPI threads.
    Usage:
        with get_db_session() as db:
            db.execute(...)
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
