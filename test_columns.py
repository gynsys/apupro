from sqlalchemy import create_engine, text

def main():
    engine = create_engine('postgresql://apupro_user:apupro_password@costbase.arko360.net:5440/apupro_db')
    
    with engine.connect() as conn:
        print(conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'cost360_items'")).fetchall())

if __name__ == '__main__':
    main()
