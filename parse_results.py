import json
with open('local_results.json', encoding='utf-16') as f:
    d = json.load(f)

print(f"Total materiales: {d['total_materials']}")
print(f"Optimo K: {d['optimal_k']} familias")
print("\nTop 15 Familias:")
for f in d['families'][:15]:
    print(f"[{f['size']} mat] Líder: {f['leader_desc']} | Tags: {f['top_words']}")
