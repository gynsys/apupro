import pandas as pd
import json
import math

def prepare_equipos():
    excel_path = 'C:/Users/pablo/Desktop/equipos.xlsx'
    df = pd.read_excel(excel_path)
    
    cols = df.columns.tolist()
    ref_col = None
    cost_col = None
    for col in cols:
        if 'ref' in col.lower() or 'cod' in col.lower() or 'código' in col.lower():
            ref_col = col
        if 'diario' in col.lower():
            cost_col = col
            
    if not ref_col: ref_col = cols[0]
    if not cost_col: cost_col = cols[5]
    
    eq_dict = {}
    
    def clean_cost(val):
        if pd.isna(val): return 0.0
        if isinstance(val, str):
            val = val.replace(',', '.')
        try:
            return float(val)
        except:
            return 0.0

    for idx, row in df.iterrows():
        ref = str(row[ref_col]).strip()
        cost = clean_cost(row[cost_col])
        eq_dict[ref] = cost
        
    with open('excel_equipos_costs.json', 'w') as f:
        json.dump(eq_dict, f)
        
    print(f"Extracted {len(eq_dict)} equipments with costs")

if __name__ == "__main__":
    prepare_equipos()
