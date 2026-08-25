import pandas as pd
from sqlalchemy import create_engine, text
import datetime

def main():
    print("="*80)
    print("RENOMBRADO DE 112 MAT A MATR")
    print("="*80)
    
    # ==========================================
    # 1. LEER DATOS DE MATR
    # ==========================================
    print("\n1. Leyendo datos de MATR...")
    
    archivo_matr = "mat_triple_diferencia_20260825_073217.xlsx"
    df_matr = pd.read_excel(archivo_matr)
    
    print(f"   MAT a renombrar a MATR: {len(df_matr)}")
    
    # Mapeo MAT -> MATR
    mapeo_renombrar = {}
    for idx, row in df_matr.iterrows():
        cod_mat = str(row['codigo'])
        cod_matr = cod_mat.replace('MAT', 'MATR')
        mapeo_renombrar[cod_mat] = cod_matr
    
    print(f"   Mapeo MAT -> MATR: {len(mapeo_renombrar)}")
    
    # ==========================================
    # 2. CONECTAR A BD Y BACKUP
    # ==========================================
    print("\n2. Conectando a base de datos...")
    
    engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')
    
    with engine.connect() as conn:
        # Backup antes de renombrar
        backup_table = f"cost360_materials_backup_renombrar_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            conn.execute(text(f'''
                CREATE TABLE {backup_table} AS 
                SELECT * FROM cost360_materials 
                WHERE "CodMat" LIKE 'MAT%'
            '''))
            conn.commit()
            print(f"   Backup creado: {backup_table}")
        except Exception as e:
            print(f"   Error creando backup: {e}")
            return
        
        # ==========================================
        # 3. ELIMINAR MAT ORIGINALES (referencias ya apuntan a MATR)
        # ==========================================
        print("\n3. Eliminando MAT originales (referencias ya apuntan a MATR)...")
        
        mat_eliminados = 0
        for cod_mat in mapeo_renombrar.keys():
            try:
                result = conn.execute(text('''
                    DELETE FROM cost360_materials 
                    WHERE "CodMat" = :cod_mat
                '''), {"cod_mat": cod_mat})
                
                mat_eliminados += result.rowcount
                
            except Exception as e:
                print(f"   Error eliminando MAT {cod_mat}: {e}")
        
        conn.commit()
        print(f"   MAT originales eliminados: {mat_eliminados}")
        
        # ==========================================
        # 5. RENOMBRAR EN budget_apu_materials
        # ==========================================
        print("\n5. Renombrando MAT a MATR en budget_apu_materials (presupuestos usuarios)...")
        
        cambios_budget = 0
        for cod_mat, cod_matr in mapeo_renombrar.items():
            try:
                result = conn.execute(text('''
                    UPDATE budget_apu_materials 
                    SET codigo = :cod_matr
                    WHERE codigo = :cod_mat
                '''), {"cod_matr": cod_matr, "cod_mat": cod_mat})
                
                cambios_budget += result.rowcount
                
            except Exception as e:
                print(f"   Error renombrando {cod_mat} en budgets: {e}")
        
        conn.commit()
        print(f"   Cambios en budgets: {cambios_budget}")
        
        # ==========================================
        # 6. VERIFICAR RESULTADO
        # ==========================================
        print("\n6. Verificando resultado...")
        
        total_mat_actual = conn.execute(text('''
            SELECT COUNT(*) FROM cost360_materials 
            WHERE "CodMat" LIKE 'MAT%'
        ''')).scalar()
        
        total_matr_actual = conn.execute(text('''
            SELECT COUNT(*) FROM cost360_materials 
            WHERE "CodMat" LIKE 'MATR%'
        ''')).scalar()
        
        print(f"   Total MAT actual en BD: {total_mat_actual}")
        print(f"   Total MATR actual en BD: {total_matr_actual}")
        print(f"   Esperado: 1431 - 112 = 1319 MAT + 112 MATR")
        
        # ==========================================
        # 7. REPORTE FINAL
        # ==========================================
        print("\n" + "="*80)
        print("PROCESO COMPLETADO")
        print("="*80)
        print(f"\nResumen:")
        print(f"  - MAT originales eliminados: {mat_eliminados}")
        print(f"  - MAT renombrados en budgets: {cambios_budget}")
        print(f"  - Total MAT restantes: {total_mat_actual}")
        print(f"  - Total MATR: {total_matr_actual}")
        print(f"\nBackup disponible: {backup_table}")
        
        # ==========================================
        # 8. GUARDAR REPORTE
        # ==========================================
        print("\n8. Generando reporte...")
        
        reporte_data = []
        for cod_mat, cod_matr in mapeo_renombrar.items():
            reporte_data.append({
                'MAT_original': cod_mat,
                'MATR_nuevo': cod_matr
            })
        
        df_reporte = pd.DataFrame(reporte_data)
        filename = f"reporte_renombrar_matr_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        df_reporte.to_excel(filename, index=False)
        print(f"   Reporte guardado: {filename}")

if __name__ == '__main__':
    main()
