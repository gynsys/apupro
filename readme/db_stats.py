import pandas as pd
import json
from sqlalchemy import create_engine, text

def main():
    print("Conectando a la base de datos...")
    engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')
    
    # Cargar las categorías exactas de la interfaz
    tree_path = r'c:\Users\pablo\Documents\apupro_platform\frontend\src\modules\cost360\data\covenin_tree.json'
    with open(tree_path, 'r', encoding='utf-8') as f:
        covenin_tree = json.load(f)
        
    # El usuario indicó que "Hidráulica" falta en la interfaz (covenin_tree.json) 
    # pero debe incluirse en el conteo. La agregamos manualmente para el reporte.
    covenin_tree.append({"code": "H", "name": "HIDRÁULICA"})
    
    reporte = []
    
    with engine.connect() as conn:
        print("Calculando estadísticas por categoría...")
        
        for cat in covenin_tree:
            code = cat.get('code')
            name = cat.get('name')
            full_name = f"{code} - {name}"
            
            # Total Partidas de esta especialidad
            total = conn.execute(text('''
                SELECT COUNT(*) FROM cost360_items 
                WHERE "CovPar" LIKE :prefix
            '''), {"prefix": f"{code}%"}).scalar()
            
            # Codificadas (COVENIN Completo)
            codificadas = conn.execute(text(r'''
                SELECT COUNT(*) FROM cost360_items 
                WHERE "CovPar" LIKE :prefix 
                AND "CovPar" ~ '^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$'
            '''), {"prefix": f"{code}%"}).scalar()
            
            # Incompletas
            incompletas = total - codificadas
            
            reporte.append({
                "Especialidad": full_name,
                "Total Partidas": total,
                "Codificadas COVENIN": codificadas,
                "Incompletas o S/C": incompletas
            })
            
    df = pd.DataFrame(reporte)
    
    # Calculate OTRAS / SIN CLASIFICAR
    with engine.connect() as conn:
        total_db = conn.execute(text('SELECT COUNT(*) FROM cost360_items')).scalar()
        codificadas_db = conn.execute(text(r'''
            SELECT COUNT(*) FROM cost360_items 
            WHERE "CovPar" ~ '^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$'
        ''')).scalar()
        
    sum_categorized_total = df["Total Partidas"].sum()
    sum_categorized_cod = df["Codificadas COVENIN"].sum()
    
    otras_total = total_db - sum_categorized_total
    otras_cod = codificadas_db - sum_categorized_cod
    otras_inc = otras_total - otras_cod
    
    df.loc[len(df)] = ["OTRAS / SIN CLASIFICAR", otras_total, otras_cod, otras_inc]
    
    # Sumatoria total global
    total_gral = df["Total Partidas"].sum()
    total_cod = df["Codificadas COVENIN"].sum()
    total_inc = df["Incompletas o S/C"].sum()
    
    df.loc[len(df)] = ["TOTAL GLOBAL (BD)", total_gral, total_cod, total_inc]
    
    # Consulta específica: Insumos que empiezan con MAT (usando CodMat en cost360_materials)
    with engine.connect() as conn:
        insumos_mat = conn.execute(text('''
            SELECT COUNT(*) FROM cost360_materials 
            WHERE "CodMat" LIKE 'MAT%'
        ''')).scalar()
        
        # Análisis de duplicados: ver ejemplos de insumos MAT
        ejemplos_mat = conn.execute(text('''
            SELECT "CodMat", "Descri", "UniMat", "CosMat" 
            FROM cost360_materials 
            WHERE "CodMat" LIKE 'MAT%'
            LIMIT 10
        ''')).fetchall()
        
        print("\nEjemplos de insumos MAT:")
        for ej in ejemplos_mat:
            print(f"  Código: {ej[0]}, Descripción: {ej[1]}, Unidad: {ej[2]}, Precio: {ej[3]}")
        
        # Buscar duplicados por similitud de descripción (ignorando mayúsculas/minúsculas)
        duplicados_similares = conn.execute(text('''
            SELECT m1."CodMat" as cod_mat, m1."Descri" as descri_mat, m1."CosMat" as precio_mat,
                   m2."CodMat" as cod_otro, m2."Descri" as descri_otro, m2."CosMat" as precio_otro
            FROM cost360_materials m1
            INNER JOIN cost360_materials m2 
                ON LOWER(TRIM(m1."Descri")) = LOWER(TRIM(m2."Descri"))
            WHERE m1."CodMat" LIKE 'MAT%'
            AND m2."CodMat" NOT LIKE 'MAT%'
            LIMIT 10
        ''')).fetchall()
        
        print("\nDuplicados exactos por descripción (MAT vs otros códigos):")
        for dup in duplicados_similares:
            print(f"  MAT: {dup[0]} - {dup[1]} - ${dup[2]}")
            print(f"  OTRO: {dup[3]} - {dup[4]} - ${dup[5]}")
            print(f"  Diferencia precio: ${abs(dup[2] - dup[5]):.2f}")
            print()
        
        # Análisis de precios: rangos y estadísticas
        stats_mat = conn.execute(text('''
            SELECT 
                COUNT(*) as total,
                MIN("CosMat") as min_precio,
                MAX("CosMat") as max_precio,
                AVG("CosMat") as avg_precio,
                STDDEV("CosMat") as stddev_precio
            FROM cost360_materials 
            WHERE "CodMat" LIKE 'MAT%'
        ''')).fetchone()
        
        print("\nEstadísticas de precios MAT:")
        print(f"  Total: {stats_mat[0]}")
        print(f"  Precio mínimo: ${stats_mat[1]:.2f}")
        print(f"  Precio máximo: ${stats_mat[2]:.2f}")
        print(f"  Precio promedio: ${stats_mat[3]:.2f}")
        print(f"  Desviación estándar: ${stats_mat[4]:.2f}")
        
        # Ver precios que parecen anómalos (muy bajos o muy altos)
        precios_anomalos = conn.execute(text('''
            SELECT "CodMat", "Descri", "CosMat"
            FROM cost360_materials 
            WHERE "CodMat" LIKE 'MAT%'
            AND ("CosMat" < 0.01 OR "CosMat" > 10000)
            ORDER BY "CosMat"
            LIMIT 10
        ''')).fetchall()
        
        if precios_anomalos:
            print("\nPrecios anómalos (< $0.01 o > $10,000):")
            for anom in precios_anomalos:
                print(f"  {anom[0]} - {anom[1]} - ${anom[2]}")
        else:
            print("\nNo se encontraron precios anómalos en el rango verificado.")
        
        # ==========================================
        # ANÁLISIS DE MIGRACIÓN DE REFERENCIAS MAT
        # ==========================================
        
        print("\n" + "="*80)
        print("ANÁLISIS DE MIGRACIÓN DE REFERENCIAS MAT")
        print("="*80)
        
        # 1. Encontrar todos los materiales duplicados (MAT vs otros códigos)
        duplicados_completos = conn.execute(text('''
            SELECT 
                m1."CodMat" as cod_mat, 
                m1."Descri" as descri, 
                m1."CosMat" as precio_mat,
                m2."CodMat" as cod_reemplazo, 
                m2."CosMat" as precio_reemplazo,
                m2."UniMat" as unidad
            FROM cost360_materials m1
            INNER JOIN cost360_materials m2 
                ON LOWER(TRIM(m1."Descri")) = LOWER(TRIM(m2."Descri"))
            WHERE m1."CodMat" LIKE 'MAT%'
            AND m2."CodMat" NOT LIKE 'MAT%'
            ORDER BY m1."Descri"
        ''')).fetchall()
        
        print(f"\nTotal de materiales duplicados (MAT vs otros códigos): {len(duplicados_completos)}")
        
        # Guardar en CSV para análisis
        import csv
        with open('migracion_mat_analisis.csv', 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow(['Cod_MAT', 'Descripcion', 'Precio_MAT', 'Cod_Reemplazo', 'Precio_Reemplazo', 'Unidad'])
            for dup in duplicados_completos:
                writer.writerow([dup[0], dup[1], dup[2], dup[3], dup[4], dup[5]])
        
        print("Análisis guardado en: migracion_mat_analisis.csv")
        
        # 2. Ver estructura de tablas APU para entender relaciones
        print("\nEstructura de tablas relacionadas con APU:")
        tablas = conn.execute(text('''
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        ''')).fetchall()
        
        tablas_apu = [t for t in tablas if 'apu' in t[0].lower() or 'budget' in t[0].lower()]
        for tabla in tablas_apu:
            print(f"  - {tabla[0]}")
        
        # 3. Ver columnas de las tablas de materiales en APU
        columns_apu_materials = conn.execute(text('''
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'cost360_apu_materials'
        ''')).fetchall()
        print("\nColumnas en cost360_apu_materials:")
        for col in columns_apu_materials:
            print(f"  - {col[0]}")
        
        columns_budget_materials = conn.execute(text('''
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'budget_apu_materials'
        ''')).fetchall()
        print("\nColumnas en budget_apu_materials:")
        for col in columns_budget_materials:
            print(f"  - {col[0]}")
        
        # 4. Ejemplo: Ver qué APU usan un material MAT específico
        ejemplo_mat = duplicados_completos[0][0] if duplicados_completos else None
        if ejemplo_mat:
            print(f"\nEjemplo: APU que usan el material {ejemplo_mat}:")
            apus_con_mat = conn.execute(text('''
                SELECT * FROM cost360_apu_materials 
                WHERE "CodIns" = :cod_mat
                LIMIT 5
            '''), {"cod_mat": ejemplo_mat}).fetchall()
            
            if apus_con_mat:
                print(f"  Se encontraron {len(apus_con_mat)} registros en cost360_apu_materials")
                for apu in apus_con_mat[:3]:
                    print(f"  - Partida (CodPar): {apu[0]}, Insumo (CodIns): {apu[1]}, Cantidad: {apu[2]}")
            else:
                print("  No se encontraron usos en APU maestros")
            
            # Ver también en budgets (APU de usuarios) - usando columna 'codigo'
            budgets_con_mat = conn.execute(text('''
                SELECT * FROM budget_apu_materials 
                WHERE codigo = :cod_mat
                LIMIT 5
            '''), {"cod_mat": ejemplo_mat}).fetchall()
            
            if budgets_con_mat:
                print(f"  Se encontraron {len(budgets_con_mat)} registros en budget_apu_materials (usuarios)")
                for budget in budgets_con_mat[:3]:
                    print(f"  - ID: {budget[0]}, Código: {budget[2]}, Descripción: {budget[3]}, Cantidad: {budget[6]}")
            else:
                print("  No se encontraron usos en budgets de usuarios")
        
        # 5. Análisis completo: todos los MAT usados en APU maestros
        print(f"\nAnálisis de uso de materiales MAT en APU maestros:")
        total_mat_en_apu = conn.execute(text('''
            SELECT COUNT(DISTINCT "CodIns") FROM cost360_apu_materials 
            WHERE "CodIns" LIKE 'MAT%'
        ''')).scalar()
        
        total_registros_mat = conn.execute(text('''
            SELECT COUNT(*) FROM cost360_apu_materials 
            WHERE "CodIns" LIKE 'MAT%'
        ''')).scalar()
        
        print(f"  - Materiales MAT distintos usados en APU: {total_mat_en_apu}")
        print(f"  - Total de registros MAT en APU: {total_registros_mat}")
        
        # 6. Crear script de migración
        print(f"\n" + "="*80)
        print("PLAN DE MIGRACIÓN")
        print("="*80)
        
        print("\nEstrategia:")
        print("1. Para cada material MAT con duplicado:")
        print("   - Identificar el código de reemplazo (no-MAT)")
        print("   - Actualizar cost360_apu_materials.CodIns = nuevo_código")
        print("   - Actualizar budget_apu_materials.codigo = nuevo_código")
        print("2. Verificar que las cantidades y desperdicios se mantengan")
        print("3. Opcional: Eliminar los materiales MAT de cost360_materials")
        
        print(f"\nTablas a modificar:")
        print("  - cost360_apu_materials (APU maestros)")
        print("  - budget_apu_materials (APU de usuarios)")
        print("  - cost360_materials (catálogo de materiales - opcional)")
        
        # ==========================================
        # INVESTIGACIÓN DE PRECIOS CORRECTOS EN BD
        # ==========================================
        
        print("\n" + "="*80)
        print("BÚSQUEDA DE PRECIOS CORRECTOS EN BASE DE DATOS")
        print("="*80)
        
        # 1. Ver si hay materiales con descripciones similares que tengan mejores precios
        print("\n1. Buscando materiales con misma descripción pero precios diferentes...")
        mismos_descri_precio_diferente = conn.execute(text('''
            SELECT 
                m1."CodMat" as cod1, 
                m1."Descri" as descri, 
                m1."CosMat" as precio1,
                m2."CodMat" as cod2, 
                m2."CosMat" as precio2,
                ABS(m1."CosMat" - m2."CosMat") as diferencia
            FROM cost360_materials m1
            INNER JOIN cost360_materials m2 
                ON LOWER(TRIM(m1."Descri")) = LOWER(TRIM(m2."Descri"))
                AND m1."CodMat" != m2."CodMat"
            WHERE m1."CodMat" LIKE 'MAT%'
            ORDER BY diferencia DESC
            LIMIT 15
        ''')).fetchall()
        
        print(f"Se encontraron {len(mismos_descri_precio_diferente)} materiales con misma descripción y precios diferentes")
        for mat in mismos_descri_precio_diferente[:5]:
            print(f"  {mat[1]}: MAT {mat[0]}=${mat[2]:.2f} vs {mat[3]}=${mat[4]:.2f} (diff: ${mat[5]:.2f})")
        
        # 2. Ver si hay alguna tabla de precios históricos o actualizados
        print("\n2. Buscando tablas con 'price' o 'costo' en el nombre...")
        tablas_precios = [t for t in tablas if 'price' in t[0].lower() or 'costo' in t[0].lower() or 'precio' in t[0].lower()]
        for tabla in tablas_precios:
            print(f"  - {tabla[0]}")
            
        # 3. Ver columnas de material_prices que podría tener precios actualizados
        if any('price' in t[0].lower() for t in tablas):
            columns_material_prices = conn.execute(text('''
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'material_prices'
            ''')).fetchall()
            if columns_material_prices:
                print("\nColumnas en material_prices:")
                for col in columns_material_prices:
                    print(f"  - {col[0]}")
                
                # Ver si hay datos en material_prices
                count_material_prices = conn.execute(text('''
                    SELECT COUNT(*) FROM material_prices
                ''')).scalar()
                print(f"Total registros en material_prices: {count_material_prices}")
                
                if count_material_prices > 0:
                    sample_material_prices = conn.execute(text('''
                        SELECT * FROM material_prices LIMIT 5
                    ''')).fetchall()
                    print("Ejemplo de datos en material_prices:")
                    for sample in sample_material_prices:
                        print(f"  {sample}")
        
        # 4. Revisar si hay campos de actualización de precios en cost360_materials
        print("\n3. Revisando si hay campos de fecha de actualización en cost360_materials...")
        columns_mat_check = conn.execute(text('''
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'cost360_materials'
        ''')).fetchall()
        
        for col in columns_mat_check:
            if 'date' in col[0].lower() or 'fecha' in col[0].lower() or 'update' in col[0].lower():
                print(f"  - {col[0]}")
        
        # 5. Sugerencia de estrategia basada en duplicados
        print("\n" + "="*80)
        print("ESTRATEGIA SUGERIDA")
        print("="*80)
        
        if mismos_descri_precio_diferente:
            print("\nPara los 22 duplicados MAT vs no-MAT:")
            print("  - Usar el precio del código no-MAT como 'correcto'")
            print("  - Actualizar cost360_materials.CosMat del MAT con ese valor")
        
        # 5. Análisis de material_prices para match con MAT
        print("\n4. Analizando material_prices para match con materiales MAT...")
        matches_material_prices = conn.execute(text('''
            SELECT 
                mp.nombre as mp_nombre,
                mp.precio_usd as mp_precio,
                cm."CodMat" as cm_cod,
                cm."Descri" as cm_descri,
                cm."CosMat" as cm_precio
            FROM material_prices mp
            INNER JOIN cost360_materials cm 
                ON LOWER(TRIM(mp.nombre)) = LOWER(TRIM(cm."Descri"))
            WHERE cm."CodMat" LIKE 'MAT%'
        ''')).fetchall()
        
        print(f"Se encontraron {len(matches_material_prices)} matches entre material_prices y MAT")
        for match in matches_material_prices:
            print(f"  {match[0]}: MP=${match[1]:.2f} vs MAT {match[2]}=${match[4]:.2f}")
        
        # 6. Sugerencia de estrategia
        print("\n" + "="*80)
        print("ESTRATEGIA SUGERIDA")
        print("="*80)
        
        if mismos_descri_precio_diferente:
            print("\nOPCIÓN 1: Para los 22 duplicados MAT vs no-MAT:")
            print("  - Usar el precio del código no-MAT como 'correcto'")
            print("  - Actualizar cost360_materials.CosMat del MAT con ese valor")
        
        if matches_material_prices:
            print(f"\nOPCIÓN 2: Para los {len(matches_material_prices)} MAT con match en material_prices:")
            print("  - Usar el precio de material_prices como 'correcto'")
            print("  - Actualizar cost360_materials.CosMat con ese valor")
        
        print(f"\nOPCIÓN 3: Para los restantes MAT sin fuente clara:")
        print("  - ¿Tienes alguna regla o criterio para actualizar sus precios?")
        
        # ==========================================
        # ANÁLISIS DE SIMILITUD DE DESCRIPCIONES
        # ==========================================
        
        print("\n" + "="*80)
        print("ANÁLISIS DE SIMILITUD ENTRE MAT Y MATERIALES CORRECTOS")
        print("="*80)
        
        # Total de materiales en BD
        total_materiales_bd = conn.execute(text('''
            SELECT COUNT(*) FROM cost360_materials
        ''')).scalar()
        
        print(f"\nTotal materiales en cost360_materials: {total_materiales_bd}")
        print(f"Materiales MAT: 1,732")
        print(f"Materiales no-MAT: {total_materiales_bd - 1732}")
        
        # Buscar similitudes usando approach más eficiente por muestra
        print("\nBuscando coincidencias parciales en descripciones (muestra de 50 MAT)...")
        
        # Primero obtener una muestra de MAT
        muestra_mat = conn.execute(text('''
            SELECT "CodMat", "Descri", "CosMat"
            FROM cost360_materials 
            WHERE "CodMat" LIKE 'MAT%'
            LIMIT 50
        ''')).fetchall()
        
        matches_parciales = []
        for mat in muestra_mat:
            # Buscar coincidencias para este MAT específico
            coincidencias = conn.execute(text('''
                SELECT 
                    :cod_mat as cod_mat,
                    :descri_mat as descri_mat,
                    :precio_mat as precio_mat,
                    no_mat."CodMat" as cod_no_mat,
                    no_mat."Descri" as descri_no_mat,
                    no_mat."CosMat" as precio_no_mat
                FROM cost360_materials no_mat
                WHERE no_mat."CodMat" NOT LIKE 'MAT%'
                AND (
                    LOWER(no_mat."Descri") LIKE '%' || LOWER(:descri_mat) || '%'
                    OR LOWER(:descri_mat) LIKE '%' || LOWER(no_mat."Descri") || '%'
                )
                LIMIT 3
            '''), {
                "cod_mat": mat[0],
                "descri_mat": mat[1], 
                "precio_mat": mat[2]
            }).fetchall()
            
            matches_parciales.extend(coincidencias)
        
        print(f"Se encontraron {len(matches_parciales)} coincidencias parciales")
        for match in matches_parciales[:10]:
            print(f"  MAT {match[0]}: {match[1][:50]}... ${match[2]:.2f}")
            print(f"  -> {match[3]}: {match[4][:50]}... ${match[5]:.2f}")
            print()
        
        # Si no hay suficientes coincidencias, probar approach diferente
        if len(matches_parciales) < 10:
            print("Buscando coincidencias por palabras clave...")
            matches_palabras = conn.execute(text('''
                SELECT 
                    mat."CodMat" as cod_mat,
                    mat."Descri" as descri_mat,
                    mat."CosMat" as precio_mat,
                    no_mat."CodMat" as cod_no_mat,
                    no_mat."Descri" as descri_no_mat,
                    no_mat."CosMat" as precio_no_mat
            FROM cost360_materials mat
            CROSS JOIN cost360_materials no_mat
            WHERE mat."CodMat" LIKE 'MAT%'
            AND no_mat."CodMat" NOT LIKE 'MAT%'
            AND mat."Descri" != no_mat."Descri"
            -- Buscar coincidencia de al menos 3 palabras clave
            AND (
                SELECT COUNT(*) 
                FROM unnest(string_to_array(mat."Descri", ' ')) palabra_mat
                WHERE palabra_mat != ''
                AND LENGTH(palabra_mat) > 3
                AND LOWER(no_mat."Descri") LIKE '%' || LOWER(palabra_mat) || '%'
            ) >= 3
            LIMIT 10
            ''')).fetchall()
            
            print(f"Se encontraron {len(matches_palabras)} coincidencias por palabras clave")
            for match in matches_palabras[:5]:
                print(f"  MAT {match[0]}: {match[1][:40]}... ${match[2]:.2f}")
                print(f"  -> {match[3]}: {match[4][:40]}... ${match[5]:.2f}")
                print()
    
    print(f"\n\n{'='*60}")
    print(f"INSUMOS CON REFERENCIA QUE EMPIEZAN CON 'MAT': {insumos_mat}")
    print(f"{'='*60}")
    
    # Consulta adicional: Total MAT actual en BD
    total_mat_bd = conn.execute(text('''
        SELECT COUNT(*) FROM cost360_materials 
        WHERE "CodMat" LIKE 'MAT%'
    ''')).scalar()
    
    print(f"\nTotal MAT actual en base de datos: {total_mat_bd}")
    
    csv_filename = "reporte_base_datos_cost360_v3.csv"
    df.to_csv(csv_filename, index=False, encoding='utf-8-sig')
    
    print(f"\nReporte generado con éxito en: {csv_filename}")
    print("\nResumen:")
    print(df.to_string(index=False))

if __name__ == '__main__':
    main()
