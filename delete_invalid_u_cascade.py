from sqlalchemy import create_engine, text
import re

def main():
    print("Conectando a la base de datos de producción...")
    engine = create_engine('postgresql://apupro_user:apupro_password@costbase.arko360.net:5440/apupro_db')
    
    with engine.connect() as conn:
        with conn.begin():
            print("Buscando registros 'U' inválidos...")
            
            # Obtener todos los registros U
            u_items = conn.execute(text("SELECT \"CodPar\", \"CovPar\" FROM cost360_items WHERE \"CovPar\" LIKE 'U%'")).fetchall()
            
            pattern = re.compile(r"^U\d{9}$")
            invalid_codpars = []
            invalid_covpars = []
            
            for item in u_items:
                codpar = item[0]
                covpar = item[1].strip()
                if not pattern.match(covpar):
                    invalid_codpars.append(codpar)
                    invalid_covpars.append(covpar)
            
            if invalid_codpars:
                print(f"Se encontraron {len(invalid_codpars)} registros inválidos:")
                for c in invalid_covpars:
                    print(f"  - {c}")
                    
                in_clause = "'" + "', '".join(invalid_codpars) + "'"
                
                tables = ['cost360_apu_equipment', 'cost360_apu_materials', 'cost360_apu_labor']
                for table in tables:
                    try:
                        res = conn.execute(text(f'DELETE FROM {table} WHERE "CodPar" IN ({in_clause})'))
                        print(f"Borradas {res.rowcount} dependencias en {table}")
                    except Exception as e:
                        print(f"Error o tabla no existe: {table}. {e}")
                
                # Borrar de la tabla principal
                res = conn.execute(text(f'DELETE FROM cost360_items WHERE "CodPar" IN ({in_clause})'))
                print(f"Eliminados {res.rowcount} registros de cost360_items.")
            else:
                print("No se encontraron registros 'U' inválidos.")

            # Verificación
            remaining = conn.execute(text("SELECT COUNT(*) FROM cost360_items WHERE \"CovPar\" LIKE 'U%'")).scalar()
            print(f"Total registros que empiezan por 'U' restantes en la DB: {remaining}")

if __name__ == '__main__':
    main()
