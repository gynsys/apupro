import os
import sys

# Add the parent directory to sys.path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.arko_base import ArkoSessionLocal, ArkoBase, arko_engine
from app.db.models.arko import ArkoAdmin
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def init_db():
    print("Initializing Arko DB tables...")
    ArkoBase.metadata.create_all(bind=arko_engine)

    print("Seeding Arko Admin...")
    db = ArkoSessionLocal()
    try:
        admin = db.query(ArkoAdmin).filter(ArkoAdmin.email == "admin@arko360.com").first()
        if not admin:
            admin = ArkoAdmin(
                email="admin@arko360.com",
                hashed_password=get_password_hash("admin123"), # Change this in production
                full_name="Arko Administrator"
            )
            db.add(admin)
            db.commit()
            print("Admin user created: admin@arko360.com / admin123")
        else:
            print("Admin user already exists.")
    except Exception as e:
        print(f"Error seeding DB: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
