from app.db.base import Base, engine
# This will create all tables that don't exist yet, including LandingSitePost
Base.metadata.create_all(bind=engine)
print("Database schema updated successfully!")
