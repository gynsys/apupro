import pandas as pd
import difflib
import re
import csv

def extract_numbers(text):
    return set(re.findall(r'\d+(?:[.,]\d+)?(?:/\d+)?', str(text)))

def normalize(text):
    text = str(text).lower()
    text = text.replace('  ', ' ').strip()
    return text

print("Loading data...")
df_master_m = pd.read_csv('master_materials.csv')
df_staging_m = pd.read_csv('staging_materials_u.csv')

master_dict = df_master_m.set_index('CodMat').to_dict('index')
master_desc_dict = {normalize(row['Descri']): (cod, row['CosMat']) for cod, row in master_dict.items()}
master_desc_list = list(master_desc_dict.keys())

matches_out = []
sql_commands = ["SET search_path TO temp_m;"]

print("Matching materials...")
for idx, row in df_staging_m.iterrows():
    cod = row['CodMat']
    desc = row['Descri']
    old_price = row['CosMat']
    
    match_found = False
    
    # 1. Exact Code Match
    if cod in master_dict:
        m_desc = master_dict[cod]['Descri']
        new_price = master_dict[cod]['CosMat']
        matches_out.append([cod, desc, f"[EXACT CODE] {m_desc}", old_price, new_price])
        sql_commands.append(f"UPDATE cost360_materials SET \"CosMat\" = {new_price} WHERE \"CodMat\" = '{cod}';")
        match_found = True
        continue
        
    # 2. Exact Description Match
    norm_desc = normalize(desc)
    if norm_desc in master_desc_dict:
        m_cod, new_price = master_desc_dict[norm_desc]
        m_desc = master_dict[m_cod]['Descri']
        matches_out.append([cod, desc, f"[EXACT DESC] {m_desc}", old_price, new_price])
        sql_commands.append(f"UPDATE cost360_materials SET \"CosMat\" = {new_price} WHERE \"CodMat\" = '{cod}';")
        match_found = True
        continue
        
    # 3. Fuzzy Match with Number Constraint
    nums_staging = extract_numbers(desc)
    close_matches = difflib.get_close_matches(norm_desc, master_desc_list, n=5, cutoff=0.8)
    
    for cm in close_matches:
        nums_master = extract_numbers(cm)
        if nums_staging == nums_master:
            m_cod, new_price = master_desc_dict[cm]
            m_desc = master_dict[m_cod]['Descri']
            matches_out.append([cod, desc, f"[FUZZY] {m_desc}", old_price, new_price])
            sql_commands.append(f"UPDATE cost360_materials SET \"CosMat\" = {new_price} WHERE \"CodMat\" = '{cod}';")
            match_found = True
            break
            
    if not match_found:
        matches_out.append([cod, desc, "[NO MATCH]", old_price, old_price])


df_master_e = pd.read_csv('master_equipment.csv')
df_staging_e = pd.read_csv('staging_equipments_u.csv')

master_e_dict = df_master_e.set_index('CodEqu').to_dict('index')
master_e_desc_dict = {normalize(row['Descri']): (cod, row['CosDia']) for cod, row in master_e_dict.items()}
master_e_desc_list = list(master_e_desc_dict.keys())

print("Matching equipment...")
for idx, row in df_staging_e.iterrows():
    cod = row['CodEqu']
    desc = row['Descri']
    old_price = row['CosDia']
    
    match_found = False
    
    if cod in master_e_dict:
        m_desc = master_e_dict[cod]['Descri']
        new_price = master_e_dict[cod]['CosDia']
        matches_out.append([cod, desc, f"[EXACT CODE] {m_desc}", old_price, new_price])
        sql_commands.append(f"UPDATE cost360_equipment SET \"CosDia\" = {new_price} WHERE \"CodEqu\" = '{cod}';")
        match_found = True
        continue
        
    norm_desc = normalize(desc)
    if norm_desc in master_e_desc_dict:
        m_cod, new_price = master_e_desc_dict[norm_desc]
        m_desc = master_e_dict[m_cod]['Descri']
        matches_out.append([cod, desc, f"[EXACT DESC] {m_desc}", old_price, new_price])
        sql_commands.append(f"UPDATE cost360_equipment SET \"CosDia\" = {new_price} WHERE \"CodEqu\" = '{cod}';")
        match_found = True
        continue
        
    nums_staging = extract_numbers(desc)
    close_matches = difflib.get_close_matches(norm_desc, master_e_desc_list, n=5, cutoff=0.8)
    
    for cm in close_matches:
        nums_master = extract_numbers(cm)
        if nums_staging == nums_master:
            m_cod, new_price = master_e_desc_dict[cm]
            m_desc = master_e_dict[m_cod]['Descri']
            matches_out.append([cod, desc, f"[FUZZY] {m_desc}", old_price, new_price])
            sql_commands.append(f"UPDATE cost360_equipment SET \"CosDia\" = {new_price} WHERE \"CodEqu\" = '{cod}';")
            match_found = True
            break
            
    if not match_found:
        matches_out.append([cod, desc, "[NO MATCH]", old_price, old_price])

print("Writing output files...")
with open('matches_review_u.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['Code', 'Staging Description', 'Matched Master Description', 'Staging Price', 'New Master Price'])
    writer.writerows(matches_out)
    
with open('sync_prices_u.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_commands))
    
print("Done! Check matches_review_u.csv and sync_prices_u.sql")
