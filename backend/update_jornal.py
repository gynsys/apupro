import pandas as pd
from sqlalchemy import create_engine, text
from app.core.config import settings

engine = create_engine(str(settings.DATABASE_URL))
df = pd.read_csv('/app/cost360/Export2024_ObraMano.csv', dtype=str, on_bad_lines='skip', engine='python', encoding='utf-8')
df['Salari'] = df['Salari'].astype(str).str.replace(',', '.', regex=False)
df['Salari'] = pd.to_numeric(df['Salari'], errors='coerce').fillna(0.0)

with engine.begin() as conn:
    for index, row in df.iterrows():
        cod = row['CodMan']
        sal = row['Salari']
        conn.execute(text('UPDATE cost360_labor SET "Jornal" = :sal WHERE "CodMan" = :cod'), {'sal': sal, 'cod': cod})
print('Salarios actualizados correctamente.')
