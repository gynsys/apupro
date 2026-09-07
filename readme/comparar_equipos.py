import pandas as pd

# Archivo Excel local
archivo_excel = r"C:\Users\pablo\Desktop\euipos_precios_locos.xlsx"

def comparar_equipos_solo_excel():
    """Comparar equipos del Excel solo para mostrar estructura"""
    
    try:
        # Leer archivo Excel
        df = pd.read_excel(archivo_excel)
        print("Archivo Excel leido exitosamente")
        print(f"Total de equipos en Excel: {len(df)}")
        
        print(f"\nColumnas disponibles:")
        print(df.columns.tolist())
        
        print(f"\nPrimeros 15 equipos del Excel:")
        print(df.head(15))
        
        # Mostrar codigos especificos
        codigos_interes = ['EQU002', 'EQU-0022DD', 'EQU004', 'EQU-004053', 'EQU-007480']
        print(f"\nBuscando equipos especificos en Excel:")
        for codigo in codigos_interes:
            resultado = df[df['Código'] == codigo]
            if not resultado.empty:
                row = resultado.iloc[0]
                print(f"Encontrado: {codigo}")
                print(f"  Descripcion: {row['Descripción']}")
                print(f"  Precio local: ${row['Precio']}")
            else:
                print(f"No encontrado: {codigo}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    comparar_equipos_solo_excel()
