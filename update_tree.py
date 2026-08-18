import json

path = r'C:\Users\pablo\Documents\apupro_platform\frontend\src\modules\cost360\data\covenin_tree.json'

with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# 1. Remove 'I'
data = [item for item in data if item['code'] != 'I']

# 2. Rename 'M'
for item in data:
    if item['code'] == 'M':
        item['name'] = "REPARACIONES, REFORMAS y MEJORAS"

with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Covenin tree updated successfully.")
