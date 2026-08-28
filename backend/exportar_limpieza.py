import sys
import os
import io
import pandas as pd
from sqlalchemy import text

# Añadir el path del backend para importar los módulos
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.db.base import SessionLocal

def generar_excel():
    db = SessionLocal()
    try:
        # Buscar materiales que empiecen por CONST, SUM, INST, o tengan palabras pegadas (sin espacios en los primeros 10 chars)
        query = text("""
            SELECT "CodMat", "Descri" 
            FROM cost360_materials 
            WHERE "Descri" LIKE 'CONST%' 
               OR "Descri" LIKE 'SUM%' 
               OR "Descri" LIKE 'INST%'
               OR "Descri" LIKE 'EXCAV%'
        """)
        materiales = db.execute(query).fetchall()
        
        # Si no encontramos en materiales, busquemos en partidas (APUs) por si acaso
        query_items = text("""
            SELECT "CodPar", "Descri" 
            FROM cost360_items 
            WHERE "Descri" LIKE 'CONST%' 
               OR "Descri" LIKE 'SUM%' 
               OR "Descri" LIKE 'INST%'
               OR "Descri" LIKE 'EXCAV%'
        """)
        partidas = db.execute(query_items).fetchall()

        datos = []
        
        # Diccionario básico de reemplazos comunes en este tipo de BD (LuloWin/Maprex)
        reemplazos = {
            "CONST": "CONSTRUCCION ",
            "PROV": "PROVISIONAL ",
            "CONV": "CONVENCIONAL ",
            "REVES": "REVESTIMIENTO ",
            "EXT": "EXTERIOR ",
            "PARED": "PARED ",
            "C/": "CON ",
            "BLOQ": "BLOQUE ",
            "CONCR": "CONCRETO ",
            "A.LISO": "ACABADO LISO",
            "A. LISO": "ACABADO LISO",
            "A.RUSTICO": "ACABADO RUSTICO",
            "A. RUSTICO": "ACABADO RUSTICO",
            "CMS": "CM",
            "SUM": "SUMINISTRO ",
            "INST": "INSTALACION ",
            "EXCAV": "EXCAVACION ",
            "INC": "INCLUYE ",
            "ACER": "ACERO ",
            "REF": "REFUERZO "
        }

        def proponer_limpieza(desc):
            limpia = desc
            for clave, valor in reemplazos.items():
                limpia = limpia.replace(clave, valor)
            # Limpiar espacios dobles
            limpia = " ".join(limpia.split())
            return limpia

        for mat in materiales:
            datos.append({
                "Tipo": "Material",
                "Codigo": mat[0],
                "Descripcion_Original": mat[1],
                "Propuesta_Limpieza": proponer_limpieza(mat[1])
            })
            
        for item in partidas:
            datos.append({
                "Tipo": "Partida (APU)",
                "Codigo": item[0],
                "Descripcion_Original": item[1],
                "Propuesta_Limpieza": proponer_limpieza(item[1])
            })

        if not datos:
            print("No se encontraron registros que coincidan con el patrón.")
            return

        df = pd.DataFrame(datos)
        archivo_salida = "propuesta_saneamiento.xlsx"
        df.to_excel(archivo_salida, index=False)
        print(f"¡Éxito! Se generó el archivo {archivo_salida} con {len(datos)} registros.")

    except Exception as e:
        print(f"Error de base de datos: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    generar_excel()
