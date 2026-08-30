import os
from bs4 import BeautifulSoup
import json

file_path = r"C:\Users\pablo\Downloads\Listado_Materiales_2026-08-29 (2).xls"

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
with open("excel_data.json", "w", encoding='utf-8') as f:
    json.dump(excel_data, f)
