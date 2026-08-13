from sqlalchemy import create_engine, text

def main():
    engine = create_engine('postgresql://apupro_user:apupro_password@costbase.arko360.net:5440/apupro_db')
    
    with engine.connect() as conn:
        with conn.begin():
            print("Borrando dependencias de partidas Z...")
            
            # Borrar dependencias en tablas secundarias (equipment, materials, labor)
            # Primero obtenemos los CodPar
            z_items = conn.execute(text("SELECT \"CodPar\" FROM cost360_items WHERE \"CovPar\" LIKE 'Z%'")).fetchall()
            codpars = [item[0] for item in z_items]
            
            if codpars:
                # Format for IN clause
                in_clause = "'" + "', '".join(codpars) + "'"
                
                tables = ['cost360_apu_equipment', 'cost360_apu_materials', 'cost360_apu_labor']
                for table in tables:
                    try:
                        conn.execute(text(f'DELETE FROM {table} WHERE "CodPar" IN ({in_clause})'))
                        print(f"Borradas dependencias en {table}")
                    except Exception as e:
                        print(f"Error o tabla no existe: {table}. {e}")
                
                # Borrar de la tabla principal
                conn.execute(text(f'DELETE FROM cost360_items WHERE "CodPar" IN ({in_clause})'))
                print("Partidas Z eliminadas correctamente de cost360_items.")
            else:
                print("No se encontraron partidas Z.")

if __name__ == '__main__':
    main()
