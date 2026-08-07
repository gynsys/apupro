import pandas as pd
import os

def generate_delete_sql():
    excel_path = 'C:/Users/pablo/Desktop/mano de obra.xlsx'
    df = pd.read_excel(excel_path)
    
    # Get all valid references
    valid_refs = []
    for idx, row in df.iterrows():
        ref = str(row['Referencia']).strip()
        valid_refs.append(f"'{ref}'")
        
    refs_str = ", ".join(valid_refs)
    
    sql_lines = []
    sql_lines.append(f"DELETE FROM cost360_labor WHERE \"CodMan\" NOT IN ({refs_str});")
    
    with open('delete_labor.sql', 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_lines))
        
    print(f"Generated delete_labor.sql to delete anything NOT IN the {len(valid_refs)} excel references.")

if __name__ == "__main__":
    generate_delete_sql()
