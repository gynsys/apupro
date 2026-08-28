from app.db.base import engine, Base
from app.db.models.cost360 import MaterialSynonym
import logging

logging.basicConfig(level=logging.INFO)

def create_table():
    try:
        # Create specifically this table
        MaterialSynonym.__table__.create(engine, checkfirst=True)
        logging.info("Tabla cost360_material_synonyms creada exitosamente.")
    except Exception as e:
        logging.error(f"Error creando tabla: {e}")

if __name__ == "__main__":
    create_table()
