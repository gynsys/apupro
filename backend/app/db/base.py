"""
Database base configuration and session management.
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Create database engine
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    echo=False  # Set to True for SQL query logging
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base for models
Base = declarative_base()

# Import all models so Alembic can detect them
# Import all models so Alembic can detect them
from app.db.models.arko import ArkoPost, ArkoProject, ArkoAdmin
from app.db.models.cost360 import CostItem, CostMaterial, CostEquipment, CostLabor, CostAPUMaterial, CostAPUEquipment, CostAPULabor
from app.db.models.cost360_database import Cost360Database
from app.db.models.budget import Budget, BudgetItem, BudgetAPUMaterial, BudgetAPUEquipment, BudgetAPULabor


def get_db():
    """
    Dependency function to get database session.
    Yields a database session and ensures it's closed after use.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
