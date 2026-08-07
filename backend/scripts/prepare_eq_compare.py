import pandas as pd
import json

def compare_equipos():
    excel_path = 'C:/Users/pablo/Desktop/equipos.xlsx'
    
    try:
        df = pd.read_excel(excel_path)
        excel_refs = set()
        
        # Look for a reference column, it might be named "Referencia", "Codigo", "CodEqu", etc.
        # Let's check columns first
        cols = df.columns.tolist()
        ref_col = None
        for col in cols:
            if 'ref' in col.lower() or 'cod' in col.lower() or 'código' in col.lower():
                ref_col = col
                break
                
        if ref_col is None:
            # Assume first column is the code
            ref_col = cols[0]
            
        for val in df[ref_col].dropna():
            excel_refs.add(str(val).strip())
            
        print(f"EXCEL_COUNT={len(excel_refs)}")
        print(f"EXCEL_REF_COL={ref_col}")
        
        # Write out the list of excel refs to a file so we can compare it with the remote DB later
        with open('excel_equipos.json', 'w') as f:
            json.dump(list(excel_refs), f)
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    compare_equipos()
