import os
import sys
import pandas as pd
from sqlalchemy import create_engine, text

# Add the parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.config import settings

def run_update():
    print(f"Updating cost360_labor in {settings.DATABASE_URL}")
    engine = create_engine(settings.DATABASE_URL)
    
    excel_path = 'C:/Users/pablo/Desktop/mano de obra.xlsx'
    df = pd.read_excel(excel_path)
    
    # Clean up Jornal and Bono strings to floats
    def clean_num(val):
        if pd.isna(val):
            return 0.0
        if isinstance(val, str):
            val = val.replace(',', '.')
        try:
            return float(val)
        except:
            return 0.0
            
    df['Jornal_float'] = df['Jornal'].apply(clean_num)
    df['Bono_float'] = df['Bono'].apply(clean_num)
    
    with engine.begin() as conn:
        for idx, row in df.iterrows():
            ref = str(row['Referencia']).strip()
            jornal = row['Jornal_float']
            bono = row['Bono_float']
            
            # Update the base components table
            conn.execute(
                text('UPDATE cost360_labor SET "Jornal" = :j, "Bono" = :b WHERE "CodMan" = :ref'),
                {"j": jornal, "b": bono, "ref": ref}
            )
            
            # Update the budget instances (if any were already created)
            conn.execute(
                text('UPDATE budget_items_labor SET jornal = :j, bono = :b WHERE codigo = :ref'),
                {"j": jornal, "b": bono, "ref": ref}
            )
            
    print("Done updating!")

if __name__ == "__main__":
    run_update()
