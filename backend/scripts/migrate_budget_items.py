import os
import sys
from sqlalchemy import create_engine, text

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.config import settings

def apply_migration():
    print(f"Connecting to database: {settings.DATABASE_URL}")
    engine = create_engine(settings.DATABASE_URL)
    
    # Use raw SQL to add columns and set default values
    sql_commands = [
        "ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS \"order\" INTEGER DEFAULT 0 NOT NULL;",
        "ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS is_chapter BOOLEAN DEFAULT FALSE NOT NULL;"
    ]
    
    with engine.begin() as conn:
        for cmd in sql_commands:
            print(f"Executing: {cmd}")
            conn.execute(text(cmd))
            
        # Optional: update order based on existing insertion order
        print("Migrating initial order values...")
        # Since we don't have created_at on budget_items, we'll just assign sequential numbers per budget
        update_query = """
        WITH numbered_items AS (
            SELECT id, row_number() OVER (PARTITION BY budget_id ORDER BY id) as new_order
            FROM budget_items
        )
        UPDATE budget_items
        SET "order" = numbered_items.new_order
        FROM numbered_items
        WHERE budget_items.id = numbered_items.id AND budget_items."order" = 0;
        """
        conn.execute(text(update_query))
        
    print("Migration applied successfully!")

if __name__ == "__main__":
    apply_migration()
