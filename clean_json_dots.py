import json
import sys

def remove_dots(items):
    new_items = []
    for item in items:
        new_item = item.copy()
        if 'code' in new_item:
            new_item['code'] = new_item['code'].replace('.', '')
        if 'children' in new_item and new_item['children']:
            new_item['children'] = remove_dots(new_item['children'])
        new_items.append(new_item)
    return new_items

def main():
    path = 'frontend/src/modules/cost360/data/covenin_tree.json'
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    cleaned = remove_dots(data)
    
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(cleaned, f, indent=2, ensure_ascii=False)
    print("JSON dots removed successfully!")

if __name__ == '__main__':
    main()
