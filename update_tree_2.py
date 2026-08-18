import json

path = r'C:\Users\pablo\Documents\apupro_platform\frontend\src\modules\cost360\data\covenin_tree.json'

with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

for item in data:
    if item['code'] == 'M':
        item['name'] = "Obras Menores / Mantenimiento"
    if item['code'] == 'R':
        item['name'] = "Reparaciones Generales - Reforzamiento Estructural"

with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Covenin tree updated successfully.")
