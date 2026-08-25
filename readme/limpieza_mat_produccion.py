import pandas as pd
from sqlalchemy import create_engine, text
import re
import datetime

def limpiar_descripcion(texto):
    """Aplica reglas de limpieza a descripciones MAT"""
    if not texto:
        return texto
    
    original = texto
    texto = texto.upper()
    
    # Reglas específicas identificadas:
    
    # 1. S/VIDRIO → SIN VIDRIO
    texto = re.sub(r'S/VIDRIO', 'SIN VIDRIO', texto)
    
    # 2. COMP. → COMPUERTA
    texto = re.sub(r'COMP\.?', 'COMPUERTA', texto)
    
    # 3. P.E.A.D → PEAD
    texto = re.sub(r'P\.E\.A\.D', 'PEAD', texto)
    
    # 4. Eliminar puntos entre letras (H.G. → HG, M.M → MM, W.C → WC)
    texto = re.sub(r'([A-Z])\.([A-Z])', r'\1\2', texto)
    
    # 5. Normalizar unidades (KGF. → KG, etc.)
    texto = re.sub(r'KGF\.?', 'KG', texto)
    texto = re.sub(r'KG\.?', 'KG', texto)
    
    # 6. Eliminar guiones innecesarios (pero mantener donde tenga sentido)
    texto = re.sub(r' - ', ' ', texto)  # guion con espacios
    texto = re.sub(r'-', ' ', texto)     # guiones simples
    
    # 7. Limpiar espacios múltiples
    texto = re.sub(r'\s+', ' ', texto)
    
    # 8. Eliminar espacios al inicio y final
    texto = texto.strip()
    
    return texto if texto != original else original

def main():
    print("="*80)
    print("LIMPIEZA DE MATERIALES MAT EN PRODUCCIÓN")
    print("="*80)
    
    print("\nConectando a la base de datos de producción...")
    engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')
    
    with engine.connect() as conn:
        # ==========================================
        # 1. BACKUP DE SEGURIDAD
        # ==========================================
        print("\n1. Creando backup de seguridad...")
        
        backup_table = f"cost360_materials_backup_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            conn.execute(text(f'''
                CREATE TABLE {backup_table} AS 
                SELECT * FROM cost360_materials 
                WHERE "CodMat" LIKE 'MAT%'
            '''))
            conn.commit()
            print(f"   [OK] Backup creado: {backup_table}")
        except Exception as e:
            print(f"   [ERROR] Error creando backup: {e}")
            return
        
        # ==========================================
        # 2. ANÁLISIS PREVIO
        # ==========================================
        print("\n2. Analizando datos antes de limpieza...")
        
        antes = conn.execute(text('''
            SELECT "CodMat", "Descri", "CosMat"
            FROM cost360_materials 
            WHERE "CodMat" LIKE 'MAT%'
            ORDER BY "CodMat"
        ''')).fetchall()
        
        print(f"   Total MAT a procesar: {len(antes)}")
        
        # ==========================================
        # 3. APLICAR LIMPIEZA
        # ==========================================
        print("\n3. Aplicando reglas de limpieza...")
        
        cambios_realizados = []
        cambios_por_regla = {
            'S/VIDRIO a SIN VIDRIO': 0,
            'COMP. a COMPUERTA': 0,
            'P.E.A.D a PEAD': 0,
            'Puntos entre letras': 0,
            'KGF. a KG': 0,
            'Guiones eliminados': 0
        }
        
        for cod_mat, descri_actual, precio in antes:
            descri_nueva = limpiar_descripcion(descri_actual)
            
            if descri_nueva != descri_actual:
                # Identificar qué regla se aplicó
                regla_aplicada = "Varias"
                if 'S/VIDRIO' in descri_actual and 'SIN VIDRIO' in descri_nueva:
                    regla_aplicada = 'S/VIDRIO a SIN VIDRIO'
                    cambios_por_regla['S/VIDRIO a SIN VIDRIO'] += 1
                elif 'COMP.' in descri_actual and 'COMPUERTA' in descri_nueva:
                    regla_aplicada = 'COMP. a COMPUERTA'
                    cambios_por_regla['COMP. a COMPUERTA'] += 1
                elif 'P.E.A.D' in descri_actual and 'PEAD' in descri_nueva:
                    regla_aplicada = 'P.E.A.D a PEAD'
                    cambios_por_regla['P.E.A.D a PEAD'] += 1
                elif re.search(r'[A-Z]\.[A-Z]', descri_actual):
                    regla_aplicada = 'Puntos entre letras'
                    cambios_por_regla['Puntos entre letras'] += 1
                elif 'KGF' in descri_actual or 'KG.' in descri_actual:
                    regla_aplicada = 'KGF. a KG'
                    cambios_por_regla['KGF. a KG'] += 1
                elif '-' in descri_actual:
                    regla_aplicada = 'Guiones eliminados'
                    cambios_por_regla['Guiones eliminados'] += 1
                
                cambios_realizados.append({
                    'codigo': cod_mat,
                    'antes': descri_actual,
                    'despues': descri_nueva,
                    'regla': regla_aplicada
                })
                
                # Aplicar cambio en BD
                conn.execute(text('''
                    UPDATE cost360_materials 
                    SET "Descri" = :nueva_descri
                    WHERE "CodMat" = :cod_mat
                '''), {"nueva_descri": descri_nueva, "cod_mat": cod_mat})
        
        conn.commit()
        
        print(f"   [OK] Total cambios aplicados: {len(cambios_realizados)}")
        
        # ==========================================
        # 4. REPORTE DE CAMBIOS
        # ==========================================
        print("\n4. Resumen de cambios por regla:")
        for regla, count in cambios_por_regla.items():
            if count > 0:
                print(f"   - {regla}: {count}")
        
        # ==========================================
        # 5. GUARDAR REPORTE EXCEL
        # ==========================================
        print("\n5. Generando reporte de cambios...")
        
        df_cambios = pd.DataFrame(cambios_realizados)
        filename = f"reporte_limpieza_mat_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        with pd.ExcelWriter(filename, engine='openpyxl') as writer:
            df_cambios.to_excel(writer, sheet_name='Cambios', index=False)
            
            # Hoja de resumen
            resumen_data = []
            for regla, count in cambios_por_regla.items():
                if count > 0:
                    resumen_data.append({'Regla': regla, 'Cantidad': count})
            
            df_resumen = pd.DataFrame(resumen_data)
            df_resumen.to_excel(writer, sheet_name='Resumen', index=False)
        
        print(f"   [OK] Reporte guardado: {filename}")
        
        # ==========================================
        # 6. VERIFICACIÓN
        # ==========================================
        print("\n6. Verificación de cambios...")
        
        # Ejemplos de cambios
        print("\n   Ejemplos de cambios aplicados:")
        for cambio in cambios_realizados[:10]:
            print(f"   - {cambio['codigo']}: '{cambio['antes'][:40]}...' → '{cambio['despues'][:40]}...'")
        
        if len(cambios_realizados) > 10:
            print(f"   ... y {len(cambios_realizados) - 10} cambios más")
        
        print("\n" + "="*80)
        print("LIMPIEZA COMPLETADA EXITOSAMENTE")
        print("="*80)
        print(f"\nBackup disponible: {backup_table}")
        print(f"Reporte detallado: {filename}")
        print(f"Total cambios: {len(cambios_realizados)}")
        print("\nPara revertir cambios si es necesario:")
        print(f"   DROP TABLE cost360_materials;")
        print(f"   ALTER TABLE {backup_table} RENAME TO cost360_materials;")

if __name__ == '__main__':
    main()