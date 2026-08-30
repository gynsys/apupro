"""
Script para completar dimensiones faltantes en materiales usando IA
Basado en las partidas APU donde se utilizan
"""
import pandas as pd
from sqlalchemy import create_engine, text
import requests
import json

# Configuración de base de datos
DB_URL = "postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db"

# API de IA (usando el endpoint existente)
AI_API_URL = "http://localhost:8001/api/v1/arko/chat"

# Leer el Excel con los 13 materiales
df = pd.read_excel('C:/Users/pablo/Downloads/lista1.xlsx')
materiales = df.to_dict('records')

print(f"Procesando {len(materiales)} materiales...")

# Conectar a la base de datos
engine = create_engine(DB_URL)

for mat in materiales:
    codigo = mat['Codigo']
    descripcion = mat['Descripcion']
    
    print(f"\nProcesando: {codigo} - {descripcion}")
    
    # Buscar partidas donde se usa este material
    with engine.connect() as conn:
        query = text("""
            SELECT DISTINCT i."CodPar", i."Descri"
            FROM cost360_apu_materials am
            JOIN cost360_items i ON am."CodPar" = i."CodPar"
            WHERE am."CodIns" = :codigo
            LIMIT 10
        """)
        result = conn.execute(query, {"codigo": codigo}).fetchall()
    
    if not result:
        print(f"   [!] No se encontraron partidas para este material")
        continue

    partidas = [{"codigo": row[0], "descripcion": row[1]} for row in result]
    print(f"   [OK] Encontrado en {len(partidas)} partidas:")
    for p in partidas[:3]:
        print(f"      - {p['codigo']}: {p['descripcion']}")
    
    # Consultar a la IA si necesita dimensión y cuál
    prompt = f"""
Eres un experto en construcción y materiales eléctricos.

Material actual: {codigo} - {descripcion}

Este material se usa en las siguientes partidas APU:
{chr(10).join([f"- {p['codigo']}: {p['descripcion']}" for p in partidas])}

Analiza si a este material LE FALTA especificar una dimensión (diámetro, calibre, medida) en su nombre.

Responde SOLO en formato JSON:
{{
    "necesita_dimension": true/false,
    "dimension_sugerida": "texto de la dimensión si aplica" o null,
    "nombre_completo_sugerido": "nombre completo con dimensión" o null,
    "razonamiento": "breve explicación"
}}

Reglas:
- Si es un TUBO, CABLE, ABRAZADERA: probablemente necesita dimensión
- Si es ACCESORIO, FIJACIÓN, CINTA: probablemente NO necesita dimensión
- Extrae la dimensión de las partidas si es claro (ej: "2 PLG", "1/2 pulgada", "51 mm")
- Si no está claro, devuelve null en dimension_sugerida
"""
    
    try:
        response = requests.post(AI_API_URL, json={"message": prompt}, timeout=30)
        ai_response = response.json()
        
        # Extraer la respuesta JSON de la IA
        response_text = ai_response.get('response', '')
        # Intentar extraer JSON del texto
        start_idx = response_text.find('{')
        end_idx = response_text.rfind('}') + 1
        if start_idx != -1 and end_idx > start_idx:
            json_response = json.loads(response_text[start_idx:end_idx])
            
            if json_response.get('necesita_dimension'):
                dimension = json_response.get('dimension_sugerida')
                nombre_completo = json_response.get('nombre_completo_sugerido')
                razonamiento = json_response.get('razonamiento')
                
                print(f"   [OK] IA sugiere agregar dimensión: {dimension}")
                print(f"   [INFO] Nombre completo: {nombre_completo}")
                print(f"   [INFO] Razonamiento: {razonamiento}")

                # Actualizar en base de datos
                if nombre_completo:
                    with engine.connect() as conn:
                        update_query = text("""
                            UPDATE cost360_materials
                            SET "Descri" = :nuevo_nombre
                            WHERE "CodMat" = :codigo
                        """)
                        conn.execute(update_query, {
                            "nuevo_nombre": nombre_completo,
                            "codigo": codigo
                        })
                        conn.commit()
                    print(f"   [OK] Actualizado en base de datos")
            else:
                print(f"   [INFO] IA indica que NO necesita dimension")
                print(f"   [INFO] Razonamiento: {json_response.get('razonamiento')}")
    except Exception as e:
        print(f"   [ERROR] Error consultando IA: {e}")

print("\n[OK] Proceso completado")
