import pandas as pd
import json

def extract_materials():
    excel_path = 'C:/Users/pablo/Desktop/mate.xlsx'
    df = pd.read_excel(excel_path)
    
    # We want: Referencia, Descripción, Precio
    
    mat_list = []
    
    def clean_cost(val):
        if pd.isna(val): return 0.0
        if isinstance(val, str):
            val = val.replace('.', '') # Remove thousands separator
            val = val.replace(',', '.') # Replace decimal comma with dot
        try:
            return float(val)
        except:
            return 0.0
            
    for idx, row in df.iterrows():
        ref = str(row['Referencia']).strip()
        
        # some description columns might have weird encoding characters
        desc = ""
        for col in df.columns:
            if 'descripc' in col.lower():
                desc = str(row[col]).strip()
                break
                
        price = clean_cost(row['Precio'])
        
        mat_list.append({
            'code': ref,
            'desc': desc,
            'price': price
        })
        
    with open('excel_materials.json', 'w', encoding='utf-8') as f:
        json.dump(mat_list, f, ensure_ascii=False)
        
    print(f"Extracted {len(mat_list)} materials from Excel.")

if __name__ == "__main__":
    extract_materials()
