import pandas as pd
import sys

# Leer el archivo Excel
archivo_excel = r"C:\Users\pablo\Desktop\euipos_precios_locos.xlsx"

try:
    df = pd.read_excel(archivo_excel)
    print("Archivo Excel leido exitosamente")
    print(f"\nEstructura del archivo:")
    print(df.head(10))
    print(f"\nColumnas disponibles:")
    print(df.columns.tolist())
    print(f"\nTotal de filas: {len(df)}")
    
    # Mostrar algunas filas para entender la estructura
    print(f"\nPrimeras filas:")
    print(df.head())
    
except Exception as e:
    print(f"Error al leer el archivo: {e}")
    sys.exit(1)
