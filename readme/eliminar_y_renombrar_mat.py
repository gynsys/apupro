import pandas as pd
from sqlalchemy import create_engine, text
import datetime

def main():
    print("="*80)
    print("ELIMINACIÓN DE 301 MAT Y RENOMBRADO EN PARTIDAS")
    print("="*80)
    
    # ==========================================
    # 1. LEER DATOS DE FUSIÓN
    # ==========================================
    print("\n1. Leyendo datos de fusión...")
    
    archivo_primera = "PRIMERA_LISTA_A_ FUSIONAR.xlsx"
    df_primera = pd.read_excel(archivo_primera)
    
    print(f"   MAT a eliminar y renombrar: {len(df_primera)}")
    
    # Mapeo de MAT a código equivalente
    mapeo_eliminar = {}
    for idx, row in df_primera.iterrows():
        cod_mat = str(row['Codigo MAT'])
        cod_equivalente = str(row['Cod Propuesto']) if pd.notna(row['Cod Propuesto']) else ''
        
        if cod_equivalente:
            mapeo_eliminar[cod_mat] = cod_equivalente
    
    print(f"   Mapeo MAT -> equivalente: {len(mapeo_eliminar)}")
    
    # ==========================================
    # 2. CONECTAR A BD Y BACKUP
    # ==========================================
    print("\n2. Conectando a base de datos...")
    
    engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')
    
    with engine.connect() as conn:
        # Backup antes de eliminar
        backup_table = f"cost360_materials_backup_eliminar_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
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
        # 3. RENOMBRAR EN cost360_apu_materials
        # ==========================================
        print("\n3. Renombrando MAT en cost360_apu_materials (APU maestros)...")
        
        cambios_apu_maestros = 0
        for cod_mat, cod_equivalente in mapeo_eliminar.items():
            try:
                result = conn.execute(text('''
                    UPDATE cost360_apu_materials 
                    SET "CodIns" = :cod_equivalente
                    WHERE "CodIns" = :cod_mat
                '''), {"cod_equivalente": cod_equivalente, "cod_mat": cod_mat})
                
                cambios_apu_maestros += result.rowcount
                
            except Exception as e:
                print(f"   Error renombrando {cod_mat} en APU maestros: {e}")
        
        conn.commit()
        print(f"   Cambios en APU maestros: {cambios_apu_maestros}")
        
        # ==========================================
        # 4. RENOMBRAR EN budget_apu_materials
        # ==========================================
        print("\n4. Renombrando MAT en budget_apu_materials (presupuestos usuarios)...")
        
        cambios_budget = 0
        for cod_mat, cod_equivalente in mapeo_eliminar.items():
            try:
                result = conn.execute(text('''
                    UPDATE budget_apu_materials 
                    SET codigo = :cod_equivalente
                    WHERE codigo = :cod_mat
                '''), {"cod_equivalente": cod_equivalente, "cod_mat": cod_mat})
                
                cambios_budget += result.rowcount
                
            except Exception as e:
                print(f"   Error renombrando {cod_mat} en budgets: {e}")
        
        conn.commit()
        print(f"   Cambios en budgets: {cambios_budget}")
        
        # ==========================================
        # 5. ELIMINAR MAT DE cost360_materials
        # ==========================================
        print("\n5. Eliminando MAT de cost360_materials...")
        
        eliminados = 0
        for cod_mat in mapeo_eliminar.keys():
            try:
                result = conn.execute(text('''
                    DELETE FROM cost360_materials 
                    WHERE "CodMat" = :cod_mat
                '''), {"cod_mat": cod_mat})
                
                eliminados += result.rowcount
                
            except Exception as e:
                print(f"   Error eliminando {cod_mat}: {e}")
        
        conn.commit()
        print(f"   MAT eliminados: {eliminados}")
        
        # ==========================================
        # 6. VERIFICAR RESULTADO
        # ==========================================
        print("\n6. Verificando resultado...")
        
        total_mat_actual = conn.execute(text('''
            SELECT COUNT(*) FROM cost360_materials 
            WHERE "CodMat" LIKE 'MAT%'
        ''')).scalar()
        
        print(f"   Total MAT actual en BD: {total_mat_actual}")
        print(f"   Esperado: 1732 - 301 = 1431")
        
        # ==========================================
        # 7. REPORTE FINAL
        # ==========================================
        print("\n" + "="*80)
        print("PROCESO COMPLETADO")
        print("="*80)
        print(f"\nResumen:")
        print(f"  - MAT renombrados en APU maestros: {cambios_apu_maestros}")
        print(f"  - MAT renombrados en budgets: {cambios_budget}")
        print(f"  - MAT eliminados de cost360_materials: {eliminados}")
        print(f"  - Total MAT restantes: {total_mat_actual}")
        print(f"\nBackup disponible: {backup_table}")
        
        # ==========================================
        # 8. GUARDAR REPORTE
        # ==========================================
        print("\n8. Generando reporte...")
        
        reporte_data = []
        for cod_mat, cod_equivalente in mapeo_eliminar.items():
            reporte_data.append({
                'MAT_eliminado': cod_mat,
                'Equivalente': cod_equivalente
            })
        
        df_reporte = pd.DataFrame(reporte_data)
        filename = f"reporte_eliminacion_renombrado_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        df_reporte.to_excel(filename, index=False)
        print(f"   Reporte guardado: {filename}")

if __name__ == '__main__':
    main()