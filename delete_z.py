from sqlalchemy import create_engine, text

def main():
    engine = create_engine('postgresql://apupro_user:apupro_password@costbase.arko360.net:5440/apupro_db')
    
    with engine.connect() as conn:
        with conn.begin():
            # Contar antes de borrar
            count = conn.execute(text("SELECT COUNT(*) FROM cost360_items WHERE \"CovPar\" LIKE 'Z%'")).scalar()
            print(f"Borrando {count} partidas Z...")
            
            # Borrar
            conn.execute(text("DELETE FROM cost360_items WHERE \"CovPar\" LIKE 'Z%'"))
            
            print("Partidas eliminadas correctamente.")

if __name__ == '__main__':
    main()
