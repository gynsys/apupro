import pandas as pd
import psycopg2
import sys

# Archivo Excel local
archivo_excel = r"C:\Users\pablo\Desktop\euipos_precios_locos.xlsx"

# Configuracion de la base de datos de produccion
DATABASE_URL = "postgresql://apupro_user:apupro_password@167.172.115.154:5440/apupro_db"

def actualizar_precios_equipos():
    """Actualizar precios de equipos en la base de datos con datos del Excel"""
    
    try:
        # Leer archivo Excel
        df = pd.read_excel(archivo_excel)
        print("Archivo Excel leido exitosamente")
        print(f"Total de equipos en Excel: {len(df)}")
        
        # Conectar a la base de datos
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # Mostrar estructura del Excel
        print("\nEstructura del Excel:")
        print(df.head(10))
        print(f"\nColumnas: {df.columns.tolist()}")
        
        # Para cada equipo en el Excel, buscar en la base de datos
        actualizados = 0
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
                print(f"\nEncontrado: {cod_bd}")
                print(f"  Descripcion BD: {descri_bd}")
                print(f"  Descripcion Excel: {descripcion}")
                print(f"  Precio BD: ${precio_bd}")
                print(f"  Precio Local: ${precio_local}")
                
                # Actualizar precio
                update_query = """
                UPDATE cost360_equipment 
                SET PreUni = %s 
                WHERE CodPar = %s
                """
                cursor.execute(update_query, (precio_local, codigo))
                conn.commit()
                print(f"  -> Precio actualizado a ${precio_local}")
                actualizados += 1
            else:
                print(f"\nNo encontrado: {codigo} - {descripcion}")
                no_encontrados.append(codigo)
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"\n" + "="*50)
        print(f"RESUMEN:")
        print(f"Equipos actualizados: {actualizados}")
        print(f"Equipos no encontrados: {len(no_encontrados)}")
        
        if no_encontrados:
            print(f"\nCodigos no encontrados: {no_encontrados}")
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    actualizar_precios_equipos()
