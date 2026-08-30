import json
from sqlalchemy import create_engine, text

with open("excel_data.json", "r", encoding='utf-8') as f:
    excel_data = json.load(f)

DATABASE_URL = "postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db"
engine = create_engine(DATABASE_URL)

updated_count = 0
with engine.connect() as conn:
    db_items = conn.execute(text("SELECT \"CodMat\", \"Descri\" FROM cost360_materials")).fetchall()
    
    for row in db_items:
        cod = row[0]
        db_desc = row[1]
        
        if cod in excel_data:
            excel_desc = excel_data[cod]
            if db_desc != excel_desc:
                conn.execute(text("UPDATE cost360_materials SET \"Descri\" = :desc WHERE \"CodMat\" = :cod"), {"desc": excel_desc, "cod": cod})
                updated_count += 1

    conn.commit()
    
print(f"Updated {updated_count} materials from Excel.")
