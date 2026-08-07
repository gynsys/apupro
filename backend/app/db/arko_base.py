"""
Database base configuration and session management for Arko360.
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Determine Arko Database URL
# If ARKO_DATABASE_URL is not set, we default to the GynSys database with a different DB name
import os
ARKO_DATABASE_URL = os.getenv(
    "ARKO_DATABASE_URL", 
    settings.DATABASE_URL
)

# Create database engine
arko_engine = create_engine(
    ARKO_DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in ARKO_DATABASE_URL else {},
    echo=False
)

# Create session factory
ArkoSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=arko_engine)

# Declarative base for models
ArkoBase = declarative_base()

def get_arko_db():
    """
    Dependency function to get database session for Arko360.
    Yields a database session and ensures it's closed after use.
    """
    db = ArkoSessionLocal()
    try:
        yield db
    finally:
        db.close()
