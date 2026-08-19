import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.base import SessionLocal
from app.db.models.cost360 import CostMaterial, CostItem, CostAPUMaterial

def main():
    print("=== INICIANDO ANÁLISIS DE DISPERSIÓN Y ANOMALÍAS ===")
    
    # 1. Leer Excel
    print("\n1. Leyendo Excel...")
    df = pd.read_excel('/app/insumos_familia.xlsx')
    print(f"Total filas en Excel: {len(df)}")
    
    db = SessionLocal()
    
    # 2. Análisis de Anomalías
    print("\n2. Revisando anomalías...")
    # MAT1255
    mat1255 = db.query(CostMaterial).filter(CostMaterial.CodMat == 'MAT1255').first()
    if mat1255:
        print(f"Anomalía MAT1255 encontrada en BD:")
        print(f"  Desc: {mat1255.Descri}")
        print(f"  Unidad: {mat1255.UniMat}")
        print(f"  Precio base: {mat1255.CosMat}")
    else:
        # Check in excel
        excel_mat = df[df['Referencia'] == 'MAT1255']
        if not excel_mat.empty:
            print(f"Anomalía MAT1255 encontrada en Excel: Precio {excel_mat.iloc[0]['Precio']}")
        else:
            print("MAT1255 no encontrado.")

    # 512 y 654 en Partidas
    for ref in ['512', '654']:
        print(f"\nBuscando dónde se usa el material {ref}...")
        items = db.query(CostAPUMaterial).filter(CostAPUMaterial.CodIns == ref).all()
        if not items:
            print(f"  El material {ref} NO se usa en ninguna partida.")
        else:
            print(f"  El material {ref} se usa en {len(items)} partidas. Ejemplo de las primeras 5:")
            for item in items[:5]:
                analysis = db.query(CostItem).filter(CostItem.CodPar == item.CodPar).first()
                desc = analysis.Descri if analysis else "Desconocida"
                print(f"    - Partida {item.CodPar}: {desc[:60]}...")

    # 3. Cruzar Excel con BD y detectar materiales nuevos (M y U)
    print("\n3. Cruzando datos para ver familias...")
    db_materials = db.query(CostMaterial).all()
    db_refs = set(m.CodMat for m in db_materials)
    excel_refs = set(df['Referencia'].astype(str).tolist())
    
    nuevos_en_bd = db_refs - excel_refs
    print(f"Materiales en BD: {len(db_refs)}")
    print(f"Materiales en Excel: {len(excel_refs)}")
    print(f"Materiales NUEVOS en BD sin familia en Excel: {len(nuevos_en_bd)}")
    
    # 4. Estrategia de Dispersión
    print("\n4. Ejemplo de Cálculo de Dispersión (Familia: C.-Cementos, Cales y Otros)...")
    # Filtrar excel por una familia
    cementos = df[df['Familia'] == 'C.-Cementos, Cales y Otros'].copy()
    if not cementos.empty:
        # Supongamos que el material fuerte es el de mayor precio o uno representativo
        # Para el ejemplo, busquemos "CEMENTO PORTLAND"
        lideres = cementos[cementos['Descripción'].str.contains('CEMENTO PORTLAND', case=False, na=False)]
        if not lideres.empty:
            lider = lideres.iloc[0]
            precio_lider = float(lider['Precio']) if pd.notnull(lider['Precio']) and float(lider['Precio']) > 0 else 1.0
            print(f"  Líder seleccionado: [{lider['Referencia']}] {lider['Descripción']} - Precio: ${precio_lider}")
            
            print("  Dispersión de otros materiales vs Líder:")
            for idx, row in cementos.head(10).iterrows():
                precio_hijo = float(row['Precio']) if pd.notnull(row['Precio']) else 0.0
                factor = precio_hijo / precio_lider
                print(f"    - [{row['Referencia']}] {row['Descripción'][:40]} | Precio: ${precio_hijo} | Factor: {factor:.4f}")
        else:
            print("No se encontró Cemento Portland para el ejemplo.")
            
    db.close()
    print("\n=== FIN ANÁLISIS ===")

if __name__ == '__main__':
    main()
