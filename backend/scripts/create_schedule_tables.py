import sys
import os
sys.path.insert(0, os.path.abspath("."))
import logging
from sqlalchemy import create_engine, text
from app.db.base import Base
from app.db.models.schedule import ScheduleProject, ScheduleActivity, ScheduleDependency

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DB_URL = "postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db"

def create_tables():
    engine = create_engine(DB_URL)
    logger.info("Creando tablas para el módulo de cronograma...")
    Base.metadata.create_all(bind=engine, tables=[
        ScheduleProject.__table__,
        ScheduleActivity.__table__,
        ScheduleDependency.__table__
    ])
    logger.info("Tablas creadas exitosamente en apupro_db:")
    logger.info(f"- {ScheduleProject.__tablename__}")
    logger.info(f"- {ScheduleActivity.__tablename__}")
    logger.info(f"- {ScheduleDependency.__tablename__}")

if __name__ == "__main__":
    create_tables()
