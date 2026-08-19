from app.db.base import SessionLocal
from sqlalchemy import text
from app.db.models.cost360 import CostItem

def test_schema_isolation():
    db = SessionLocal()
    
    try:
        # Create a test schema
        db.execute(text("CREATE SCHEMA IF NOT EXISTS test_clone_123"))
        db.execute(text("CREATE TABLE IF NOT EXISTS test_clone_123.cost360_items (LIKE public.cost360_items INCLUDING ALL)"))
        db.execute(text("INSERT INTO test_clone_123.cost360_items SELECT * FROM public.cost360_items LIMIT 5"))
        
        # Now modify one item in public to test isolation
        # First let's just query using SQLAlchemy with search_path
        db.execute(text("SET search_path TO test_clone_123"))
        
        # SQLAlchemy should now query from test_clone_123 instead of public
        items = db.query(CostItem).all()
        print(f"Items found in test_clone_123: {len(items)}")
        
        # Reset search_path
        db.execute(text("SET search_path TO public"))
        items_public = db.query(CostItem).count()
        print(f"Items found in public: {items_public}")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        # Cleanup
        db.execute(text("DROP SCHEMA IF EXISTS test_clone_123 CASCADE"))
        db.commit()
        db.close()

if __name__ == '__main__':
    test_schema_isolation()
