import os
import sys
import pandas as pd
from sqlalchemy import create_engine

# Add the parent directory to sys.path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.config import settings
from app.db.models.cost360 import (
    CostItem, CostMaterial, CostLabor, CostEquipment,
    CostAPUMaterial, CostAPULabor, CostAPUEquipment
)

# This assumes the CSV files are in the 'cost360' directory at the root of the project
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_DIR = os.path.join(BASE_DIR, 'cost360')

def get_csv_path(filename):
    return os.path.join(CSV_DIR, f"Export2024_{filename}.csv")

def run_etl():
    print(f"Iniciando ETL hacia PostgreSQL: {settings.DATABASE_URL}")
    engine = create_engine(settings.DATABASE_URL)
    
    tables_to_import = {
        'ObraMano': CostLabor.__tablename__,
        'ObraMate': CostMaterial.__tablename__,
        'ObraEqui': CostEquipment.__tablename__,
        'ObraPart': CostItem.__tablename__,
    }
    
    for lulo_table, new_table in tables_to_import.items():
        csv_file = get_csv_path(lulo_table)
        if os.path.exists(csv_file):
            print(f"-> Procesando {lulo_table} desde {csv_file}...")
            try:
                # Read using python engine to handle complex quotes, skipping bad lines
                df = pd.read_csv(csv_file, dtype=str, on_bad_lines='skip', engine='python', encoding='utf-8')
                
                # Cleanup numbers
                for col in df.columns:
                    if col in ['CosMat', 'PreUni', 'RenPar', 'CanPar', 'Cantid', 'Costo', 'Jornal', 'Bono', 'CosDia', 'CostEq', 'CanIns', 'Salari']:
                        df[col] = df[col].astype(str).str.replace(',', '.', regex=False)
                        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)
                
                # If equipment, and column is CosDia, ensure it maps if missing
                if lulo_table == 'ObraEqui' and 'CosDia' not in df.columns and 'CostEq' in df.columns:
                    df['CosDia'] = df['CostEq']
                
                # Map Salari to Jornal for ObraMano
                if lulo_table == 'ObraMano' and 'Jornal' not in df.columns and 'Salari' in df.columns:
                    df['Jornal'] = df['Salari']
                    
                # Ensure Bono exists
                if 'Bono' not in df.columns:
                    df['Bono'] = 0.0
                
                from sqlalchemy import text, inspect
                
                # Filter dataframe to match only the columns that exist in the table
                inspector = inspect(engine)
                valid_columns = [col['name'] for col in inspector.get_columns(new_table)]
                df = df[[c for c in df.columns if c in valid_columns]]

                # First, clear the table
                with engine.begin() as conn:
                    conn.execute(text(f"TRUNCATE TABLE {new_table} CASCADE;"))
                
                df.to_sql(new_table, engine, if_exists='append', index=False)
                print(f"   [OK] {len(df)} registros insertados en -> {new_table}")
            except Exception as e:
                print(f"   [ERROR] Falló importación de {lulo_table}: {e}")
        else:
            print(f"-> [!] No se encontró el archivo CSV: {csv_file}")

if __name__ == "__main__":
    run_etl()
