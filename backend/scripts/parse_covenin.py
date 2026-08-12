import pandas as pd
import json
import math
import re

# Read the excel
excel_path = r'C:\Users\pablo\Desktop\BD_COST360\codificacion de partidas.xlsx'
df = pd.read_excel(excel_path)

# Columns to parse: Unnamed: 1 through Unnamed: 5 (which correspond to levels 0 to 4)
# The hierarchy goes left to right.

tree = []
current_nodes = {0: tree, 1: None, 2: None, 3: None, 4: None, 5: None}

def parse_cell(value):
    if pd.isna(value):
        return None
    val_str = str(value).strip()
    if not val_str:
        return None
    
    # Split by the first space to get code and name
    parts = val_str.split(' ', 1)
    code = parts[0]
    name = parts[1] if len(parts) > 1 else ""
    return {"code": code, "name": name, "children": []}

for index, row in df.iterrows():
    # Iterate through columns to find which level this row belongs to
    for col_idx in range(1, 10):
        try:
            col_name = df.columns[col_idx]
            val = row[col_name]
            node = parse_cell(val)
            if node:
                level = col_idx - 1 # 0-indexed level
                
                # Append to the parent's children
                parent_level = level - 1
                if parent_level < 0:
                    tree.append(node)
                else:
                    parent_node = current_nodes.get(parent_level)
                    if parent_node is not None:
                        parent_node["children"].append(node)
                    else:
                        tree.append(node)
                
                # Update current_nodes for this level
                current_nodes[level] = node
                
                # Clear all deeper levels
                for i in range(level + 1, 10):
                    current_nodes[i] = None
                    
                break # Only one node per row
        except IndexError:
            break

# Save to JSON
out_path = r'C:\Users\pablo\Documents\apupro_platform\frontend\src\modules\cost360\data\covenin_tree.json'
import os
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(tree, f, ensure_ascii=False, indent=2)

print(f"Successfully generated {out_path}")
