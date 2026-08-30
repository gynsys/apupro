import pandas as pd
import sys

# Necesitamos leer un archivo .xls antiguo, pandas usa xlrd
file_path = r"C:\Users\pablo\Downloads\Listado_Materiales_2026-08-29 (2).xls"
try:
    # A veces los exports de sistemas viejos son en realidad HTML! 
    # Intentemos leer con read_html si read_excel falla
    try:
        df = pd.read_excel(file_path)
    except Exception as e:
        print("Fallo read_excel, intentando read_html...", e)
        df = pd.read_html(file_path)[0]

    print("Columnas:", df.columns.tolist())
    print("\nPrimeras 5 filas:")
    print(df.head(5).to_string())
    
    # Busca ELE901
    print("\nBuscando ELE901:")
    print(df[df.iloc[:, 0] == 'ELE901'].to_string())
    
except Exception as e:
    print(f"Error reading file: {e}")
