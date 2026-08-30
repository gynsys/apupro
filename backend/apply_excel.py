import os
from bs4 import BeautifulSoup
from sqlalchemy import create_engine, text

file_path = r"C:\Users\pablo\Downloads\Listado_Materiales_2026-08-29 (2).xls"

# Read file
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
except UnicodeDecodeError:
    with open(file_path, 'r', encoding='windows-1252') as f:
        content = f.read()

soup = BeautifulSoup(content, 'xml')
worksheets = soup.find_all('Worksheet')

excel_data = {}
if worksheets:
    sheet = worksheets[0]
    rows = sheet.find_all('Row')
    
    # Skip header
    for row in rows[1:]:
        cells = row.find_all('Cell')
        row_data = []
        for cell in cells:
            data = cell.find('Data')
            if data:
                row_data.append(data.text.strip())
            else:
                row_data.append("")
                
        if len(row_data) >= 3:
            cod = row_data[1]
            desc = row_data[2]
            if cod and desc:
                excel_data[cod] = desc

print(f"Loaded {len(excel_data)} items from Excel.")

DATABASE_URL = "postgresql://apupro_user:apupro_password@apupro-db:5432/apupro_db"
engine = create_engine(DATABASE_URL)

updated_count = 0
with engine.connect() as conn:
    # Obtener todos
    db_items = conn.execute(text("SELECT \"CodMat\", \"Descri\" FROM cost360_materials")).fetchall()
    
    for row in db_items:
        cod = row[0]
        db_desc = row[1]
        
        if cod in excel_data:
            excel_desc = excel_data[cod]
            if db_desc != excel_desc:
                # Update DB
                conn.execute(text("UPDATE cost360_materials SET \"Descri\" = :desc WHERE \"CodMat\" = :cod"), {"desc": excel_desc, "cod": cod})
                updated_count += 1

    conn.commit()
    
print(f"Updated {updated_count} materials from Excel.")
