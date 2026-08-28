import sys
import os
import re
import pandas as pd
from sqlalchemy import text

sys.path.append('/app')
from app.db.base import SessionLocal

def expandir_abreviaturas(desc):
    """
    Expande patrones típicos de LuloWin/Maprex.
    Ej: CONSTREVESEXTPAREDC/MORTERO -> CONSTRUCCION REVESTIMIENTO EXTERIOR PARED CON MORTERO
    """
    if not desc:
        return ""
    
    reemplazos = {
        "CONST": "CONSTRUCCION ",
        "PROV": "PROVISIONAL ",
        "CONV": "CONVENCIONAL ",
        "DEPOSITOS": "DEPOSITOS ",
        "INC": "INCLUYE ",
        "ACOMETIDA": "ACOMETIDA ",
        "REVES": "REVESTIMIENTO ",
        "EXT": "EXTERIOR ",
        "INT": "INTERIOR ",
        "PARED": "PARED ",
        "C/": "CON ",
        "BLOQ": "BLOQUE ",
        "CONCR": "CONCRETO ",
        "CORRIENTE": "CORRIENTE ",
        "PISOS": "PISOS ",
        "MORTERO": "MORTERO ",
        "CEMENTO": "CEMENTO ",
        "A.LISO": "ACABADO LISO",
        "A. LISO": "ACABADO LISO",
        "A.RUSTICO": "ACABADO RUSTICO",
        "A. RUSTICO": "ACABADO RUSTICO",
        "E=": "ESPESOR= ",
        "CMS": "CM",
        "SUM": "SUMINISTRO ",
        "INST": "INSTALACION ",
        "EXCAV": "EXCAVACION ",
        "ACER": "ACERO ",
        "REF": "REFUERZO "
    }

    limpia = desc
    for clave, valor in reemplazos.items():
        limpia = limpia.replace(clave, valor)
    
    limpia = re.sub(r',([^\s])', r', \1', limpia)
    limpia = " ".join(limpia.split())
    
    return limpia

def generar_excel():
    db = SessionLocal()
    try:
        query = text("""
            SELECT "CodMat" as codigo, "Descri" as descripcion, 'Material' as tipo 
            FROM cost360_materials 
            WHERE "Descri" LIKE 'CONST%' OR "Descri" LIKE 'SUM%' OR "Descri" LIKE 'INST%' OR "Descri" LIKE 'EXCAV%'
            UNION ALL
            SELECT "CodPar" as codigo, "Descri" as descripcion, 'Partida' as tipo 
            FROM cost360_items 
            WHERE "Descri" LIKE 'CONST%' OR "Descri" LIKE 'SUM%' OR "Descri" LIKE 'INST%' OR "Descri" LIKE 'EXCAV%'
        """)
        registros = db.execute(query).fetchall()

        datos = []
        for reg in registros:
            codigo = reg[0]
            desc_original = reg[1]
            tipo = reg[2]
            desc_limpia = expandir_abreviaturas(desc_original)
            
            datos.append({
                "Tipo": tipo,
                "Codigo": codigo,
                "Descripcion Original": desc_original,
                "Propuesta (A Revisar)": desc_limpia
            })

        if not datos:
            print("No se encontraron registros.")
            return

        df = pd.DataFrame(datos)
        archivo_salida = "/app/propuesta_limpieza_textos.xlsx"
        
        try:
            writer = pd.ExcelWriter(archivo_salida, engine='xlsxwriter')
            df.to_excel(writer, index=False, sheet_name='Saneamiento')
            workbook = writer.book
            worksheet = writer.sheets['Saneamiento']
            
            worksheet.set_column('A:A', 12)
            worksheet.set_column('B:B', 15)
            worksheet.set_column('C:C', 60)
            worksheet.set_column('D:D', 60)
            
            header_format = workbook.add_format({'bold': True, 'bg_color': '#D7E4BC', 'border': 1})
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_format)

            writer.close()
        except Exception as e:
            # Fallback to simple to_excel without formatting if xlsxwriter fails
            print("Warning: xlsxwriter failed, using default pandas excel writer")
            df.to_excel(archivo_salida, index=False)
            
        print(f"Exito: Excel generado con exito ({len(datos)} registros)")

    except Exception as e:
        print(f"Error conectando a la BD: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    generar_excel()
