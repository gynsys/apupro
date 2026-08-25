from sqlalchemy import create_engine, text
import datetime

def main():
    print("="*80)
    print("ACTUALIZACIÓN MANUAL DE PRECIOS")
    print("="*80)
    
    # Precios a actualizar
    precios_actualizar = {
        'MAT0975': 1400,
        'MAT0976': 6800,
        'MAT0977': 9500,
        'MAT0978': 2100,
        'MAT0979': 2800,
        'MAT0980': 3400,
        'MAT0981': 5200
    }
    
    print(f"\nMateriales a actualizar: {len(precios_actualizar)}")
    for cod, precio in precios_actualizar.items():
        print(f"  {cod}: ${precio}")
    
    # Conectar a BD
    print("\nConectando a base de datos...")
    engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')
    
    with engine.connect() as conn:
        # Backup antes de actualizar
        backup_table = f"cost360_materials_backup_precios_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            conn.execute(text(f'''
                CREATE TABLE {backup_table} AS 
                SELECT * FROM cost360_materials 
                WHERE "CodMat" IN :codigos
            '''), {"codigos": tuple(precios_actualizar.keys())})
            conn.commit()
            print(f"Backup creado: {backup_table}")
        except Exception as e:
            print(f"Error creando backup: {e}")
            return
        
        # Actualizar precios
        print("\nActualizando precios...")
        cambios = 0
        for cod_mat, nuevo_precio in precios_actualizar.items():
            try:
                # Verificar precio actual
                precio_actual = conn.execute(text('''
                    SELECT "CosMat" FROM cost360_materials 
                    WHERE "CodMat" = :cod_mat
                '''), {"cod_mat": cod_mat}).scalar()
                
                # Actualizar precio
                conn.execute(text('''
                    UPDATE cost360_materials 
                    SET "CosMat" = :nuevo_precio
                    WHERE "CodMat" = :cod_mat
                '''), {"nuevo_precio": nuevo_precio, "cod_mat": cod_mat})
                
                cambios += 1
                print(f"  {cod_mat}: ${precio_actual} -> ${nuevo_precio}")
                
            except Exception as e:
                print(f"  Error actualizando {cod_mat}: {e}")
        
        conn.commit()
        print(f"\nTotal cambios: {cambios}")
        
        # Verificar cambios
        print("\nVerificando cambios...")
        for cod_mat, nuevo_precio in precios_actualizar.items():
            precio_verificado = conn.execute(text('''
                SELECT "CosMat" FROM cost360_materials 
                WHERE "CodMat" = :cod_mat
            '''), {"cod_mat": cod_mat}).scalar()
            print(f"  {cod_mat}: ${precio_verificado} (esperado: ${nuevo_precio})")
    
    print("\n" + "="*80)
    print("ACTUALIZACIÓN COMPLETADA")
    print("="*80)

if __name__ == '__main__':
    main()
