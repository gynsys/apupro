import pandas as pd
import datetime
import subprocess

df = pd.read_excel('analisis_mat_v3_20260824_190453.xlsx')
matches = df[df['Tipo Match'] != 'SIN MATCH'].copy()

# Ordenar: primero EXACTO, luego FUZZY, luego KEYWORDS
orden = {'EXACTO': 0, 'FUZZY': 1, 'KEYWORDS': 2}
matches['_orden'] = matches['Tipo Match'].map(orden)
matches = matches.sort_values(['_orden', 'Tipo Match']).drop(columns=['_orden'])

ts = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
fname = f'matches_para_revision_{ts}.xlsx'

with pd.ExcelWriter(fname, engine='openpyxl') as writer:
    matches.to_excel(writer, sheet_name='Matches', index=False)

    # Hoja resumen
    resumen = matches.groupby('Tipo Match').size().reset_index(name='Cantidad')
    resumen.to_excel(writer, sheet_name='Resumen', index=False)

print(f"Total matches: {len(matches)}")
print(f"  EXACTO:   {len(matches[matches['Tipo Match']=='EXACTO'])}")
print(f"  FUZZY:    {len(matches[matches['Tipo Match']=='FUZZY'])}")
print(f"  KEYWORDS: {len(matches[matches['Tipo Match']=='KEYWORDS'])}")
print(f"Archivo: {fname}")

subprocess.Popen(['start', fname], shell=True)
