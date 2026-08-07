import os
import sys
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import insert
import math

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.config import settings
from app.db.models.cost360 import CostItem

def sync_ia_data(csv_path: str, chunk_size: int = 1000):
    if not os.path.exists(csv_path):
        print(f"Error: No se encontró el archivo CSV en la ruta: {csv_path}")
        return

    print(f"Iniciando sincronización desde {csv_path}...")
    engine = create_engine(str(settings.DATABASE_URL))

    # Read CSV in chunks, using semicolon as separator
    chunks = pd.read_csv(csv_path, chunksize=chunk_size, sep=';', on_bad_lines='skip')
    total_processed = 0

    with engine.begin() as conn:
        for i, df in enumerate(chunks):
            # Limpiar datos: reemplazar NaN con None para que SQLAlchemy maneje los NULLs correctamente
            df = df.where(pd.notnull(df), None)
            
            # Map CSV columns to Database columns
            # Asumimos que la columna 'Referencia' del CSV mapea a 'CodPar'
            if 'Referencia' not in df.columns:
                print("Error: El CSV no contiene la columna 'Referencia'.")
                return

            records = []
            for _, row in df.iterrows():
                # Preparar diccionario con campos. Usamos .get para no fallar si falta alguna columna
                record = {
                    'CodPar': str(row['Referencia']).strip(),
                    'disciplina': str(row.get('DISCIPLINA', '')) if pd.notnull(row.get('DISCIPLINA')) else None,
                    'diametro_pulg': str(row.get('DIAMETRO_PULG', '')) if pd.notnull(row.get('DIAMETRO_PULG')) else None,
                    'resistencia_fc': float(row.get('RESISTENCIA_FC', 0.0)) if pd.notnull(row.get('RESISTENCIA_FC')) else None,
                    'material': str(row.get('MATERIAL', '')) if pd.notnull(row.get('MATERIAL')) else None,
                    'preparacion': str(row.get('PREPARACION', '')) if pd.notnull(row.get('PREPARACION')) else None,
                    'desc_limpia': str(row.get('desc_limpia', '')) if 'desc_limpia' in df.columns and pd.notnull(row.get('desc_limpia')) else None,
                }
                
                def safe_float(val):
                    try:
                        if pd.isnull(val): return 0.0
                        return float(str(val).replace('.', '').replace(',', '.'))
                    except ValueError:
                        return 0.0

                # Si el CSV también trae campos originales requeridos por si el registro es nuevo
                if 'Descripción' in df.columns: record['Descri'] = str(row['Descripción'])
                if 'Unidad' in df.columns: record['UniPar'] = str(row['Unidad'])
                if 'Código' in df.columns: record['CovPar'] = str(row['Código'])
                if 'RENDIMIENTO' in df.columns: record['RenPar'] = safe_float(row.get('RENDIMIENTO'))
                if 'CATEGORIA' in df.columns: record['Categoria'] = str(row['CATEGORIA'])
                if 'SUB CATEGORIA' in df.columns: record['TipoActividad'] = str(row['SUB CATEGORIA'])

                records.append(record)

            if not records:
                continue

            # Construir UPSERT (ON CONFLICT DO UPDATE)
            stmt = insert(CostItem).values(records)
            
            # Qué columnas actualizar si ya existe (Excluyendo CodPar)
            update_dict = {
                'disciplina': stmt.excluded.disciplina,
                'diametro_pulg': stmt.excluded.diametro_pulg,
                'resistencia_fc': stmt.excluded.resistencia_fc,
                'material': stmt.excluded.material,
                'preparacion': stmt.excluded.preparacion,
                'desc_limpia': stmt.excluded.desc_limpia
            }
            
            # Si el CSV trae los campos base, actualizarlos también
            for key in ['Descri', 'UniPar', 'CovPar', 'PreUni', 'RenPar', 'Categoria', 'TipoActividad']:
                if key in df.columns:
                    update_dict[key] = getattr(stmt.excluded, key)

            stmt = stmt.on_conflict_do_update(
                index_elements=['CodPar'],
                set_=update_dict
            )

            # Ejecutar chunk
            conn.execute(stmt)
            total_processed += len(records)
            print(f"Procesados {total_processed} registros...")

    print(f"Sincronización completada. Total procesados: {total_processed}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Sincronizar base de datos IA Cost360')
    parser.add_argument('--csv', type=str, default=r'C:\Users\pablo\Desktop\BD_COST360\Base_Datos_IA.csv',
                        help='Ruta al archivo CSV')
    args = parser.parse_args()
    
    sync_ia_data(args.csv)
