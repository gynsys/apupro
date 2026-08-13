from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from pathlib import Path
from datetime import datetime
import uuid

def style_cell(cell, bold=False, size=11, align="left", border=False, number_format=None):
    cell.font = Font(bold=bold, size=size, name="Calibri")
    cell.alignment = Alignment(horizontal=align, vertical="center", wrap_text=True)
    if border:
        thin = Side(style='thin')
        cell.border = Border(left=thin, right=thin, top=thin, bottom=thin)
    if number_format:
        cell.number_format = number_format

def generate_excel_workbook(item, mat_rows, eq_rows, mo_rows, settings=None):
    """Genera Excel con el formato original (apu_formulas.py) usando diccionarios"""
    if settings is None:
        settings = {}
        
    rendimiento = float(item.get("RenPar", 1.0) or 1.0)
    admin_gg = float(settings.get("admin_percent", 15.0))
    imprevisto_ut = float(settings.get("profit_percent", 10.0))
    financiamiento = float(settings.get("financiamiento", 0.0))
    iva = float(settings.get("iva_percent", 16.0))
    otros_imp = float(settings.get("otros_imp", 0.0))
    prestaciones = float(settings.get("fcas_percent", 435.0))

    wb = Workbook()
    ws = wb.active
    ws.title = f"APU_{item.get('CodPar', 'Custom')}"

    # HEADER
    ws.merge_cells("B1:H1")
    ws["B1"] = "ANÁLISIS DE PRECIO UNITARIO"
    style_cell(ws["B1"], bold=True, size=14, align="center")
    
    ws.merge_cells("B2:H2")
    ws["B2"] = ""
    
    ws["B3"] = f"Obra: {settings.get('project_name') or ''}"
    ws["B4"] = f"Contratante: {settings.get('client_name') or ''}"
    ws["E5"] = "Part. No.:"
    ws["F5"] = "1"
    ws["G5"] = "Fecha:"
    ws["H5"] = datetime.now().strftime("%d/%m/%Y")
    ws["B6"] = "Descripción:"
    ws.merge_cells("C6:H6")
    ws["C6"] = item.get("Descri", 'N/A')
    ws["G8"] = "Rendimiento:"
    ws["H8"] = rendimiento
    ws["B9"] = "Código:"
    ws["C9"] = item.get("CovPar") or item.get("CodPar", "CUSTOM")
    ws["E9"] = "Unidad:"
    ws["F9"] = item.get("UniPar", "UND")
    ws["G9"] = "Cantidad:"
    ws["H9"] = "1"

    # MATERIALES
    mat_start = 11
    ws.merge_cells(f"B{mat_start}:H{mat_start}")
    ws[f"B{mat_start}"] = "MATERIALES"
    style_cell(ws[f"B{mat_start}"], bold=True, size=12)
    
    headers = ["No.", "Descripción", "Und.", "Cant.", "Desp.", "Precio", "Total"]
    for i, h in enumerate(headers):
        col = get_column_letter(i + 2)
        ws[f"{col}{mat_start+1}"] = h
        style_cell(ws[f"{col}{mat_start+1}"], bold=True, border=True)
    
    row = mat_start + 2
    for i, m in enumerate(mat_rows):
        ws[f"B{row}"] = i + 1
        ws[f"C{row}"] = m.get("Descri") or m.get("descripcion", "")
        ws[f"D{row}"] = m.get("UniMat") or m.get("unidad", "")
        ws[f"E{row}"] = float(m.get("CanIns") or m.get("cantidad") or 0)
        ws[f"F{row}"] = float(m.get("Desper") or m.get("desperdicio") or 0)
        ws[f"G{row}"] = float(m.get("CosMat") or m.get("precio_unitario") or m.get("precio") or 0)
        ws[f"H{row}"] = f"=ROUND((G{row}*E{row})*((F{row}/100)+1),2)"
        style_cell(ws[f"H{row}"], number_format='#,##0.00')
        row += 1
    
    total_mat_row = row
    ws[f"F{total_mat_row}"] = "Total Materiales:"
    first_data = mat_start + 2
    last_data = total_mat_row - 1 if row > mat_start + 2 else mat_start + 2
    ws[f"H{total_mat_row}"] = f"=SUM(H{first_data}:H{last_data})"
    style_cell(ws[f"H{total_mat_row}"], bold=True, number_format='#,##0.00')

    # EQUIPOS
    eq_start = total_mat_row + 2
    ws.merge_cells(f"B{eq_start}:H{eq_start}")
    ws[f"B{eq_start}"] = "EQUIPOS"
    style_cell(ws[f"B{eq_start}"], bold=True, size=12)
    
    headers = ["No.", "Descripción", "", "Cant.", "Cop/Dep", "Precio", "Total"]
    for i, h in enumerate(headers):
        col = get_column_letter(i + 2)
        ws[f"{col}{eq_start+1}"] = h
        style_cell(ws[f"{col}{eq_start+1}"], bold=True, border=True)
    
    row = eq_start + 2
    for i, e in enumerate(eq_rows):
        ws[f"B{row}"] = i + 1
        ws[f"C{row}"] = e.get("Descri") or e.get("descripcion", "")
        ws[f"E{row}"] = float(e.get("CanIns") or e.get("cantidad") or 0)
        ws[f"F{row}"] = float(e.get("Deprec") or e.get("depreciacion") or 1)
        ws[f"G{row}"] = float(e.get("CosDia") or e.get("precio_unitario") or e.get("precio") or 0)
        ws[f"H{row}"] = f"=ROUND((G{row}*E{row})*(F{row}),2)"
        style_cell(ws[f"H{row}"], number_format='#,##0.00')
        row += 1
    
    total_eq_row = row
    ws[f"F{total_eq_row}"] = "Total Equipos:"
    first_data = eq_start + 2
    last_data = total_eq_row - 1 if row > eq_start + 2 else eq_start + 2
    ws[f"H{total_eq_row}"] = f"=SUM(H{first_data}:H{last_data})"
    style_cell(ws[f"H{total_eq_row}"], bold=True, number_format='#,##0.00')
    
    cuo_row = total_eq_row + 1
    ws[f"E{cuo_row}"] = "Costo Unitarios Equipos:"
    ws[f"H{cuo_row}"] = f"=ROUND(H{total_eq_row}/H9,2)"
    style_cell(ws[f"H{cuo_row}"], bold=True, number_format='#,##0.00')

    # MANO DE OBRA
    mo_start = cuo_row + 2
    ws.merge_cells(f"B{mo_start}:H{mo_start}")
    ws[f"B{mo_start}"] = "MANO DE OBRA"
    style_cell(ws[f"B{mo_start}"], bold=True, size=12)
    
    headers = ["No.", "Descripción", "Cant.", "Jornal", "Bono", "Total Jornal", "Total Bono"]
    for i, h in enumerate(headers):
        col = get_column_letter(i + 2)
        ws[f"{col}{mo_start+1}"] = h
        style_cell(ws[f"{col}{mo_start+1}"], bold=True, border=True)
    
    row = mo_start + 2
    for i, l in enumerate(mo_rows):
        ws[f"B{row}"] = i + 1
        ws[f"C{row}"] = l.get("Descri") or l.get("descripcion", "")
        ws[f"D{row}"] = float(l.get("CanIns") or l.get("cantidad") or 0)
        ws[f"E{row}"] = float(l.get("Jornal") or l.get("jornal") or 0)
        ws[f"F{row}"] = float(l.get("Bono") or l.get("bono") or 0)
        ws[f"G{row}"] = f"=ROUND((D{row}*E{row}),2)"
        ws[f"H{row}"] = f"=ROUND((D{row}*F{row}),2)"
        style_cell(ws[f"G{row}"], number_format='#,##0.00')
        style_cell(ws[f"H{row}"], number_format='#,##0.00')
        row += 1
    
    sub_row = row
    first_data = mo_start + 2
    last_data = sub_row - 1 if row > mo_start + 2 else mo_start + 2
    ws[f"D{sub_row}"] = "SubTotal Mano de Obra:"
    ws[f"G{sub_row}"] = f"=SUM(G{first_data}:G{last_data})"
    ws[f"H{sub_row}"] = f"=SUM(H{first_data}:H{last_data})"
    style_cell(ws[f"G{sub_row}"], bold=True, number_format='#,##0.00')
    style_cell(ws[f"H{sub_row}"], bold=True, number_format='#,##0.00')
    
    ps_row = sub_row + 1
    ws[f"C{ps_row}"] = prestaciones
    style_cell(ws[f"C{ps_row}"], number_format='#,##0.00')
    ws[f"D{ps_row}"] = "Prestaciones Sociales:"
    ws[f"G{ps_row}"] = f"=ROUND((C{ps_row}/100)*G{sub_row},2)"
    ws[f"H{ps_row}"] = 0
    style_cell(ws[f"G{ps_row}"], number_format='#,##0.00')
    
    tg_row = ps_row + 1
    ws[f"D{tg_row}"] = "Total General Mano de Obra:"
    ws[f"H{tg_row}"] = f"=G{ps_row}+H{ps_row}+G{sub_row}+H{sub_row}"
    style_cell(ws[f"H{tg_row}"], bold=True, number_format='#,##0.00')
    
    cuo_mo_row = tg_row + 1
    ws[f"D{cuo_mo_row}"] = "Costo Unitario de Mano de Obra:"
    ws[f"H{cuo_mo_row}"] = f"=ROUND(H{tg_row}/H9,2)"
    style_cell(ws[f"H{cuo_mo_row}"], bold=True, number_format='#,##0.00')

    # RESUMEN
    resumen_start = cuo_mo_row + 2
    cd_row = resumen_start + 1
    ws[f"E{cd_row}"] = "COSTO DIRECTO SUBTOTAL A:"
    ws[f"H{cd_row}"] = f"=ROUND(H{total_mat_row}+H{total_eq_row}+H{cuo_mo_row},2)"
    style_cell(ws[f"H{cd_row}"], bold=True, number_format='#,##0.00')
    
    ad_row = cd_row + 1
    ws[f"C{ad_row}"] = admin_gg
    style_cell(ws[f"C{ad_row}"], number_format='#,##0.00')
    ws[f"D{ad_row}"] = "Administración y Gastos Generales:"
    ws[f"H{ad_row}"] = f"=ROUND((H{cd_row}*C{ad_row})/100,2)"
    style_cell(ws[f"H{ad_row}"], number_format='#,##0.00')
    
    sb_row = ad_row + 1
    ws[f"D{sb_row}"] = "SUBTOTAL B:"
    ws[f"H{sb_row}"] = f"=H{cd_row}+H{ad_row}"
    style_cell(ws[f"H{sb_row}"], bold=True, number_format='#,##0.00')
    
    iu_row = sb_row + 1
    ws[f"B{iu_row}"] = ""
    ws[f"E{iu_row}"] = imprevisto_ut
    style_cell(ws[f"E{iu_row}"], number_format='#,##0.00')
    ws[f"F{iu_row}"] = "Imprevisto Utilidad:"
    ws[f"H{iu_row}"] = f"=ROUND((H{sb_row}*E{iu_row})/100,2)"
    style_cell(ws[f"H{iu_row}"], number_format='#,##0.00')
    
    sc_row = iu_row + 1
    ws[f"D{sc_row}"] = "SUBTOTAL C:"
    ws[f"H{sc_row}"] = f"=H{sb_row}+H{iu_row}"
    style_cell(ws[f"H{sc_row}"], bold=True, number_format='#,##0.00')
    
    fin_row = sc_row + 1
    ws[f"E{fin_row}"] = financiamiento
    style_cell(ws[f"E{fin_row}"], number_format='#,##0.00')
    ws[f"F{fin_row}"] = "Financiamiento:"
    ws[f"H{fin_row}"] = f"=ROUND((H{sc_row}*E{fin_row})/100,2)"
    style_cell(ws[f"H{fin_row}"], number_format='#,##0.00')
    
    ps_row2 = fin_row + 1
    ws[f"D{ps_row2}"] = "PRECIO UNITARIO SIN IMPUESTO:"
    ws[f"H{ps_row2}"] = f"=H{sc_row}+H{fin_row}"
    style_cell(ws[f"H{ps_row2}"], bold=True, number_format='#,##0.00')
    
    iva_row = ps_row2 + 1
    ws[f"E{iva_row}"] = iva
    style_cell(ws[f"E{iva_row}"], number_format='#,##0.00')
    ws[f"F{iva_row}"] = "Impuesto (I.V.A.):"
    ws[f"H{iva_row}"] = f"=ROUND((H{ps_row2}*E{iva_row})/100,2)"
    style_cell(ws[f"H{iva_row}"], number_format='#,##0.00')
    
    oi_row = iva_row + 1
    ws[f"E{oi_row}"] = otros_imp
    style_cell(ws[f"E{oi_row}"], number_format='#,##0.00')
    ws[f"F{oi_row}"] = "Otros Impuestos:"
    ws[f"H{oi_row}"] = f"=ROUND((H{ps_row2}*E{oi_row})/100,2)"
    style_cell(ws[f"H{oi_row}"], number_format='#,##0.00')
    
    pf_row = oi_row + 2
    ws[f"D{pf_row}"] = "PRECIO UNITARIO (Bs.F.):"
    ws[f"H{pf_row}"] = f"=H{ps_row2}+H{iva_row}+H{oi_row}"
    style_cell(ws[f"H{pf_row}"], bold=True, number_format='#,##0.00')
    
    ws.column_dimensions['A'].width = 3
    ws.column_dimensions['B'].width = 6
    ws.column_dimensions['C'].width = 45
    ws.column_dimensions['D'].width = 12
    ws.column_dimensions['E'].width = 12
    ws.column_dimensions['F'].width = 12
    ws.column_dimensions['G'].width = 16
    ws.column_dimensions['H'].width = 18

    # Guardar
    temp_dir = Path("temp")
    temp_dir.mkdir(exist_ok=True)
    filename = f"APU_{item.get('CovPar') or item.get('CodPar', 'Custom')}_{uuid.uuid4().hex[:6]}.xlsx"
    file_path = temp_dir / filename
    wb.save(file_path)

    return file_path, filename
