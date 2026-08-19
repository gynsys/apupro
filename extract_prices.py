import pandas as pd
import json

def extract_equ_prices():
    try:
        df = pd.read_excel(r'C:\Users\pablo\Desktop\Insumos.xlsx', sheet_name='Equipos')
        col_codigo = df.columns[0] # Código
        col_costo = df.columns[3]  # Costo
        
        # Filtrar donde Código empiece por EQU y Costo no sea nulo
        df_equ = df[df[col_codigo].astype(str).str.startswith('EQU', na=False)]
        
        update_data = []
        for index, row in df_equ.iterrows():
            codigo = str(row[col_codigo]).strip()
            try:
                costo = float(row[col_costo])
                update_data.append({'codigo': codigo, 'costo': costo})
            except (ValueError, TypeError):
                continue
                
        with open('equ_update.json', 'w') as f:
            json.dump(update_data, f)
            
        print(f"Extraídos {len(update_data)} precios de EQU.")
        if len(update_data) > 0:
            print("Primeros 5:", update_data[:5])
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    extract_equ_prices()
