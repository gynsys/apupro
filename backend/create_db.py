import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add the parent directory to sys.path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.config import settings

def create_database():
    print("Checking if arko360 database exists...")
    
    # We must connect to the default 'postgres' or 'gynsys' database to run CREATE DATABASE
    # Ensure isolation level is AUTOCOMMIT to run CREATE DATABASE
    engine = create_engine(settings.DATABASE_URL, isolation_level="AUTOCOMMIT")
    
    try:
        with engine.connect() as conn:
            # Check if exists
            result = conn.execute("SELECT 1 FROM pg_database WHERE datname = 'arko360'")
            if not result.fetchone():
                print("Creating arko360 database...")
                conn.execute("CREATE DATABASE arko360")
                print("Database created successfully.")
            else:
                print("Database arko360 already exists.")
    except Exception as e:
        print(f"Error creating database: {e}")

if __name__ == "__main__":
    create_database()
