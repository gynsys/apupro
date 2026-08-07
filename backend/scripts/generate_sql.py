import pandas as pd
import os

def generate_sql():
    excel_path = 'C:/Users/pablo/Desktop/mano de obra.xlsx'
    df = pd.read_excel(excel_path)
    
    # Clean up Jornal and Bono strings to floats
    def clean_num(val):
        if pd.isna(val):
            return 0.0
        if isinstance(val, str):
            val = val.replace(',', '.')
        try:
            return float(val)
        except:
            return 0.0
            
    df['Jornal_float'] = df['Jornal'].apply(clean_num)
    df['Bono_float'] = df['Bono'].apply(clean_num)
    
    sql_lines = []
    
    for idx, row in df.iterrows():
        ref = str(row['Referencia']).strip()
        j = row['Jornal_float']
        b = row['Bono_float']
        
        # Base maestra
        sql_lines.append(f"UPDATE cost360_labor SET \"Jornal\" = {j}, \"Bono\" = {b} WHERE \"CodMan\" = '{ref}';")
        
        # Budget snapshots
        sql_lines.append(f"UPDATE budget_items_labor SET jornal = {j}, bono = {b} WHERE codigo = '{ref}';")
        
    with open('update_labor.sql', 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_lines))
        
    print("Generated update_labor.sql")

if __name__ == "__main__":
    generate_sql()
