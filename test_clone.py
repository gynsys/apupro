from app.db.base import SessionLocal
from app.crud.crud_cost360 import create_database, delete_database
from app.schemas.cost360 import Cost360DatabaseCreate
from sqlalchemy import text

def test_clone():
    db = SessionLocal()
    
    payload = Cost360DatabaseCreate(
        name="Proyecto Aislado",
        description="Prueba de clonacion aislada",
        material_inflation=15.0,
        labor_inflation=0.0,
        equipment_inflation=5.0,
        source_database_id="master"
    )
    
    try:
        # Create database clone
        print("Clonando base de datos...")
        new_db = create_database(db, payload)
        print(f"Base clonada exitosamente con ID: {new_db.id}")
        
        # Verify schema exists
        schema_exists = db.execute(text(f"SELECT schema_name FROM information_schema.schemata WHERE schema_name = '{new_db.id}'")).scalar()
        if schema_exists:
            print(f"El esquema físico '{new_db.id}' EXISTE en PostgreSQL.")
        else:
            print("ERROR: El esquema físico no se creó.")
            
        # Verify tables in schema
        db.execute(text(f'SET LOCAL search_path TO "{new_db.id}", public'))
        item_count = db.execute(text("SELECT COUNT(*) FROM cost360_items")).scalar()
        mat_count = db.execute(text("SELECT COUNT(*) FROM cost360_materials")).scalar()
        print(f"Items en el clon: {item_count}")
        print(f"Materiales en el clon: {mat_count}")
        
        # Now clean up
        print("Borrando la base clonada...")
        delete_database(db, new_db.id)
        
        schema_exists_after = db.execute(text(f"SELECT schema_name FROM information_schema.schemata WHERE schema_name = '{new_db.id}'")).scalar()
        if not schema_exists_after:
            print(f"El esquema físico '{new_db.id}' fue ELIMINADO correctamente.")
        else:
            print("ERROR: El esquema físico NO se eliminó.")
            
    except Exception as e:
        print(f"Error durante la prueba: {e}")
    finally:
        db.close()

if __name__ == '__main__':
    test_clone()
