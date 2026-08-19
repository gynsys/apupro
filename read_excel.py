import pandas as pd
import json

def extract_codes():
    try:
        df = pd.read_excel(r'C:\Users\pablo\Desktop\partidas_M2.xlsx')
        col_name = df.columns[2] # 3rd column
        codes = df[col_name].dropna().astype(str).tolist()
        
        with open('m2_codes.json', 'w') as f:
            json.dump(codes, f)
            
        print(f"Extraídos {len(codes)} códigos.")
        print("Primeros 5 códigos:", codes[:5])
    except Exception as e:
        print(f"Error leyendo excel: {e}")

if __name__ == '__main__':
    extract_codes()
