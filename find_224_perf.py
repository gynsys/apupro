import json

for bname in ['budget_0efa568a.json', 'budget_dc7d17bd.json']:
    with open(bname, 'r') as f:
        b = json.load(f)
    print(f"\nChecking perf=1 vs perf=actual in {bname}:")
    for it in b['items']:
        if it.get('is_chapter'): continue
        for perf in [1.0, it.get('performance') or 1.0]:
            for fcas in [417.0, 1100.0, float(b.get('fcas_percent') or 417.0)]:
                ex = 1.0
                mat = sum(m['cantidad'] * m['precio_unitario'] * (1 + (m.get('desperdicio') or 0)/100.0) for m in it.get('materials', []))
                eq = sum(e['cantidad'] * e['precio_unitario'] * (e.get('depreciacion') if e.get('depreciacion') is not None else 1.0) for e in it.get('equipments', [])) / perf
                jornal = sum(l['cantidad'] * l['jornal'] for l in it.get('labors', []))
                bono = sum(l['cantidad'] * (l.get('bono') or 0) for l in it.get('labors', [])) if fcas < 1000 else 0
                lab = (jornal + bono + jornal * (fcas / 100.0)) / perf
                sub_a = mat + eq + lab
                sub_b = sub_a * 1.15
                sub_c = sub_b * 1.10
                pu = round(sub_c, 2)
                if abs(pu - 224.67) < 0.2:
                    print(f"MATCH 224.67! Item {it['cov_par']} {it['description'][:30]} | perf={perf} | fcas={fcas} | pu={pu}")
