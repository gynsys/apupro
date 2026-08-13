from sqlalchemy import create_engine, text

def main():
    engine = create_engine('postgresql://apupro_user:apupro_password@costbase.arko360.net:5440/apupro_db')
    
    with engine.connect() as conn:
        print("--- CONTEO POR CodPar vs CovPar ---")
        
        for prefix in ['U', 'C', 'V', 'Z', 'E', 'M', 'H']:
            count_cod = conn.execute(text(f"SELECT COUNT(*) FROM cost360_items WHERE \"CodPar\" LIKE '{prefix}%'")).scalar()
            count_cov = conn.execute(text(f"SELECT COUNT(*) FROM cost360_items WHERE \"CovPar\" LIKE '{prefix}%'")).scalar()
            print(f"Letra {prefix}: CodPar={count_cod} | CovPar={count_cov}")
            
if __name__ == '__main__':
    main()
