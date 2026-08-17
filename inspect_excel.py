import pandas as pd
import json

try:
    df = pd.read_excel(r'C:\Users\pablo\Desktop\partidas_M.xlsx', sheet_name=None)
    info = {}
    for sheet_name, sheet_df in df.items():
        info[sheet_name] = {
            'columns': list(sheet_df.columns),
            'shape': sheet_df.shape,
            'preview': sheet_df.head(2).to_dict('records')
        }
    print(json.dumps(info, indent=2, default=str))
except Exception as e:
    print(f"Error: {e}")
