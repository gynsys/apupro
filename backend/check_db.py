import os
from sqlalchemy import create_engine, text
import psycopg2

DATABASE_URL = "postgresql://apupro_user:apupro_password@localhost:5440/apupro_db"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    total_apus = conn.execute(text("SELECT COUNT(*) FROM cost360_items")).scalar()
    valid_apus = conn.execute(text("SELECT COUNT(*) FROM cost360_items WHERE \"CodPar\" ~ '^[A-Z][0-9]{9}$'")).scalar()
    
    print(f"Total APUs: {total_apus}")
    print(f"Valid APUs (COVENIN format): {valid_apus}")
    
    total_materials = conn.execute(text("SELECT COUNT(*) FROM cost360_materials")).scalar()
    
    materials_in_valid = conn.execute(text("""
        SELECT COUNT(DISTINCT m."CodMat")
        FROM cost360_materials m
        JOIN cost360_apu_materials am ON m."CodMat" = am."CodIns"
        JOIN cost360_items i ON am."CodPar" = i."CodPar"
        WHERE i."CodPar" ~ '^[A-Z][0-9]{9}$'
    """)).scalar()
    
    print(f"Total Materials: {total_materials}")
    print(f"Materials used in VALID APUs: {materials_in_valid}")
