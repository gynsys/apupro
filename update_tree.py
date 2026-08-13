import json

tree_path = r'c:\Users\pablo\Documents\apupro_platform\frontend\src\modules\cost360\data\covenin_tree.json'

with open(tree_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Ensure they don't already exist to avoid duplicates
existing_codes = {d['code'] for d in data}

if 'V' not in existing_codes:
    data.append({
        "code": "V",
        "name": "TELECOMUNICACIONES",
        "children": []
    })

if 'H' not in existing_codes:
    data.append({
        "code": "H",
        "name": "HIDRÁULICA",
        "children": []
    })
    
# Remove Z if it exists
data = [d for d in data if d['code'] != 'Z']

with open(tree_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("covenin_tree.json actualizado correctamente.")
