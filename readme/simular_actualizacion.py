import pandas as pd
import psycopg2
import sys

# Archivo Excel local
archivo_excel = r"C:\Users\pablo\Desktop\euipos_precios_locos.xlsx"

# Configuracion de la base de datos de produccion
DATABASE_URL = "postgresql://apupro_user:apupro_password@167.172.115.154:5440/apupro_db"

def simular_actualizacion():
    """Simular actualizacion de precios para revision (no aplica cambios)"""
    
    try:
        # Leer archivo Excel
        df = pd.read_excel(archivo_excel)
        print("Archivo Excel leido exitosamente")
        print(f"Total de equipos en Excel: {len(df)}")
        
        # Conectar a la base de datos
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # Para cada equipo en el Excel, buscar en la base de datos
        encontrados = []
        no_encontrados = []
        
        for index, row in df.iterrows():
            codigo = row['Código']
            precio_local = row['Precio']
            descripcion = row['Descripción']
            
            # Buscar equipo en la base de datos
            query = """
            SELECT CodPar, Descri, PreUni 
            FROM cost360_equipment 
            WHERE CodPar = %s
            """
            
            cursor.execute(query, (codigo,))
            resultado = cursor.fetchone()
            
            if resultado:
                cod_bd, descri_bd, precio_bd = resultado
                encontrados.append({
                    'codigo': codigo,
                    'descripcion_excel': descripcion,
                    'descripcion_bd': descri_bd,
                    'precio_bd': precio_bd,
                    'precio_local': precio_local,
                    'diferencia': precio_local - precio_bd
                })
            else:
                no_encontrados.append({
                    'codigo': codigo,
                    'descripcion': descripcion,
                    'precio_local': precio_local
                })
        
        cursor.close()
        conn.close()
        
        print(f"\n" + "="*60)
        print(f"SIMULACION DE ACTUALIZACION (SIN CAMBIOS REALES)")
        print(f"="*60)
        print(f"\nEquipos encontrados en BD: {len(encontrados)}")
        print(f"Equipos no encontrados: {len(no_encontrados)}")
        
        print(f"\n" + "-"*60)
        print(f"EQUIPOS QUE SE ACTUALIZARAN:")
        print(f"-"*60)
        
        for item in encontrados:
            print(f"\nCodigo: {item['codigo']}")
            print(f"  Descripcion Excel: {item['descripcion_excel']}")
            print(f"  Descripcion BD: {item['descripcion_bd']}")
            print(f"  Precio actual BD: ${item['precio_bd']}")
            print(f"  Precio nuevo: ${item['precio_local']}")
            print(f"  Diferencia: ${item['diferencia']}")
        
        if no_encontrados:
            print(f"\n" + "-"*60)
            print(f"EQUIPOS NO ENCONTRADOS:")
            print(f"-"*60)
            for item in no_encontrados:
                print(f"\nCodigo: {item['codigo']}")
                print(f"  Descripcion: {item['descripcion']}")
                print(f"  Precio local: ${item['precio_local']}")
        
        print(f"\n" + "="*60)
        print(f"Para aplicar cambios reales, confirma la ejecucion")
        print(f"="*60)
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    simular_actualizacion()
