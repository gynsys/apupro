from sqlalchemy import create_engine, text
from app.core.config import settings

def run_migrations():
    print(f"Running migrations on {settings.DATABASE_URL}")
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        print("Adding subscription columns...")
        conn.execute(text("ALTER TABLE arko_users ADD COLUMN IF NOT EXISTS plan_expiration_date TIMESTAMP WITH TIME ZONE NULL;"))
        conn.execute(text("ALTER TABLE arko_users ADD COLUMN IF NOT EXISTS max_ai_apus INTEGER DEFAULT 0;"))
        conn.execute(text("ALTER TABLE arko_users ADD COLUMN IF NOT EXISTS ai_apus_generated INTEGER DEFAULT 0;"))
        
        print("Creating notifications table...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES arko_users(id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                type VARCHAR(50) DEFAULT 'system',
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))
        
        print("Creating index...")
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_notifications_user_id_is_read ON notifications(user_id, is_read);"))
        
        conn.commit()
        print("Done!")

if __name__ == "__main__":
    run_migrations()
