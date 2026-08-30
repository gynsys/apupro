import os
from bs4 import BeautifulSoup
import re

file_path = r"C:\Users\pablo\Downloads\Listado_Materiales_2026-08-29 (2).xls"

print("Reading XML Spreadsheet...")
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

soup = BeautifulSoup(content, 'xml')
worksheets = soup.find_all('Worksheet')
if worksheets:
    sheet = worksheets[0]
    rows = sheet.find_all('Row')
    
    print(f"Total rows: {len(rows)}")
    
    for i, row in enumerate(rows[:5]):
        cells = row.find_all('Cell')
        row_data = []
        for cell in cells:
            data = cell.find('Data')
            if data:
                row_data.append(data.text)
            else:
                row_data.append("")
        print(f"Row {i}: {row_data}")
