from sqlalchemy import create_engine, text

def main():
    engine = create_engine('postgresql://apupro_user:apupro_password@costbase.arko360.net:5440/apupro_db')
    
    with engine.connect() as conn:
        print("Categorias:")
        results = conn.execute(text("SELECT \"Categoria\", COUNT(*) FROM cost360_items GROUP BY \"Categoria\"")).fetchall()
        for r in results:
            print(r)
            
        print("\nDisciplinas:")
        results2 = conn.execute(text("SELECT disciplina, COUNT(*) FROM cost360_items GROUP BY disciplina")).fetchall()
        for r in results2:
            print(r)

if __name__ == '__main__':
    main()
