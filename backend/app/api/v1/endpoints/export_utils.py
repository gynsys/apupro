from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter
from pathlib import Path
from datetime import datetime
import uuid

def generate_excel_workbook(item, mat_rows, eq_rows, mo_rows, settings=None):
    """
    Genera el archivo Excel de APU con fórmulas de OpenPyXL.
    
    item: dict con claves (CodPar, Descri, UniPar, RenPar)
    mat_rows: lista de dicts (Descri, UniMat, CanIns, Desper, CosMat)
    eq_rows: lista de dicts (Descri, CanIns, Deprec, CosDia)
    mo_rows: lista de dicts (Descri, CanIns, Jornal, Bono)
    settings: dict con (fcas_percent, admin_percent, profit_percent, iva_percent)
    """
    if settings is None:
        settings = {}
        
    rendimiento = float(item.get("RenPar", 1.0) or 1.0)
    admin_gg = float(settings.get("admin_percent", 15.0))
    imprevisto_ut = float(settings.get("profit_percent", 10.0))
    financiamiento = float(settings.get("financiamiento", 0.0))
    iva = float(settings.get("iva_percent", 16.0))
    otros_imp = float(settings.get("otros_imp", 0.0))
    prestaciones = float(settings.get("fcas_percent", 417.0))

    wb = Workbook()
    ws = wb.active
    ws.title = f"APU_{item.get('CodPar', 'Custom')}"

    thin = Side(style='thin')
    border_all = Border(left=thin, right=thin, top=thin, bottom=thin)
    fmt_money = '#,##0.00'

    green_fill = PatternFill(start_color="4CAF50", end_color="4CAF50", fill_type="solid")
    orange_fill = PatternFill(start_color="FFA726", end_color="FFA726", fill_type="solid")
    total_fill = PatternFill(start_color="E8F5E9", end_color="E8F5E9", fill_type="solid")

    def sty(cell, bold=False, size=11, align="left", border=False, number_format=None, fill=None, color=None):
        cell.font = Font(bold=bold, size=size, name="Calibri", color=color if color else "000000")
        cell.alignment = Alignment(horizontal=align, vertical="center", wrap_text=True)
        if border:
            cell.border = border_all
        if number_format:
            cell.number_format = number_format
        if fill:
            cell.fill = fill

    def hdr_cell(cell, text=None):
        if text is not None:
            cell.value = text
        sty(cell, bold=True, size=11, align="center", border=True, fill=green_fill, color="FFFFFF")

    # ENCABEZADO
    ws.merge_cells("B1:H1")
    ws["B1"] = "ANÁLISIS DE PRECIO UNITARIO"
    sty(ws["B1"], bold=True, size=14, align="center", fill=green_fill, color="FFFFFF")

    ws.merge_cells("B2:H2")
    ws["B2"] = f"Obra: {item.get('Obra', 'N/A')}"

    ws["B8"] = "Rendimiento:"
    ws["H8"] = rendimiento
    sty(ws["H8"], number_format="0.00")

    ws["B9"] = "Código:"
    ws["C9"] = item.get("CovPar") or item.get("CodPar", "CUSTOM-001")
    ws["E9"] = "Unidad:"
    ws["F9"] = item.get("UniPar", "UND")
    ws["G9"] = "Fecha:"
    ws["H9"] = datetime.now().strftime("%d/%m/%Y")

    ws["B11"] = "Descripción:"
    ws.merge_cells("C11:H11")
    ws["C11"] = item.get("Descri", "")
    sty(ws["C11"], size=10, align="left")

    # MATERIALES
    mat_start = 14
    ws.merge_cells(f"B{mat_start}:H{mat_start}")
    ws[f"B{mat_start}"] = "1. MATERIALES"
    sty(ws[f"B{mat_start}"], bold=True, size=12, fill=orange_fill, color="FFFFFF")
    
    headers_mat = ["No.", "Descripción", "Unidad", "Cantidad", "Desperdicio %", "Costo Unit.", "Total"]
    for i, h in enumerate(headers_mat):
        hdr_cell(ws.cell(mat_start + 1, i + 2), text=h)
        
    row = mat_start + 2
    for i, m in enumerate(mat_rows):
        ws.cell(row, 2, i + 1)
        ws.cell(row, 3, m.get("Descri", ""))
        ws.cell(row, 4, m.get("UniMat", ""))
        ws.cell(row, 5, float(m.get("CanIns", 0)))
        ws.cell(row, 6, float(m.get("Desper", 0)))
        ws.cell(row, 7, float(m.get("CosMat", 0)))
        ws.cell(row, 8, f"=ROUND((G{row}*E{row})*((F{row}/100)+1),2)")
        sty(ws.cell(row, 7), number_format=fmt_money)
        sty(ws.cell(row, 8), number_format=fmt_money)
        row += 1

    total_mat_row = row
    ws.cell(total_mat_row, 6, "Total Materiales:")
    ws.cell(total_mat_row, 8, f"=SUM(H{mat_start+2}:H{total_mat_row-1})" if row > mat_start + 2 else 0)
    sty(ws.cell(total_mat_row, 8), bold=True, number_format=fmt_money, fill=total_fill)

    # EQUIPOS
    eq_start = total_mat_row + 2
    ws.merge_cells(f"B{eq_start}:H{eq_start}")
    ws[f"B{eq_start}"] = "2. EQUIPOS"
    sty(ws[f"B{eq_start}"], bold=True, size=12, fill=orange_fill, color="FFFFFF")

    headers_eq = ["No.", "Descripción", "", "Cantidad", "Depreciación", "Costo Diario", "Total"]
    for i, h in enumerate(headers_eq):
        hdr_cell(ws.cell(eq_start + 1, i + 2), text=h)

    row = eq_start + 2
    for i, e in enumerate(eq_rows):
        ws.cell(row, 2, i + 1)
        ws.cell(row, 3, e.get("Descri", ""))
        ws.cell(row, 5, float(e.get("CanIns", 0)))
        ws.cell(row, 6, float(e.get("Deprec", 1)))
        ws.cell(row, 7, float(e.get("CosDia", 0)))
        ws.cell(row, 8, f"=ROUND((G{row}*E{row})*(F{row}),2)")
        sty(ws.cell(row, 7), number_format=fmt_money)
        sty(ws.cell(row, 8), number_format=fmt_money)
        row += 1

    total_eq_row = row
    ws.cell(total_eq_row, 6, "Total Equipos:")
    ws.cell(total_eq_row, 8, f"=SUM(H{eq_start+2}:H{total_eq_row-1})" if row > eq_start + 2 else 0)
    sty(ws.cell(total_eq_row, 8), bold=True, number_format=fmt_money, fill=total_fill)

    cuo_eq_row = total_eq_row + 1
    ws.cell(cuo_eq_row, 6, "Costo Unitario Equipos:")
    ws.cell(cuo_eq_row, 8, f"=ROUND(H{total_eq_row}/H8,2)")
    sty(ws.cell(cuo_eq_row, 8), bold=True, number_format=fmt_money)

    # MANO DE OBRA
    mo_start = cuo_eq_row + 2
    ws.merge_cells(f"B{mo_start}:H{mo_start}")
    ws[f"B{mo_start}"] = "3. MANO DE OBRA"
    sty(ws[f"B{mo_start}"], bold=True, size=12, fill=orange_fill, color="FFFFFF")

    headers_mo = ["No.", "Descripción", "Cantidad", "Jornal", "Bono", "Total Jornal", "Total Bono"]
    for i, h in enumerate(headers_mo):
        hdr_cell(ws.cell(mo_start + 1, i + 2), text=h)

    row = mo_start + 2
    for i, m in enumerate(mo_rows):
        ws.cell(row, 2, i + 1)
        ws.cell(row, 3, m.get("Descri", ""))
        ws.cell(row, 4, float(m.get("CanIns", 0)))
        ws.cell(row, 5, float(m.get("Jornal", 0)))
        ws.cell(row, 6, float(m.get("Bono", 0)))
        ws.cell(row, 7, f"=ROUND((D{row}*E{row}),2)")
        ws.cell(row, 8, f"=ROUND((D{row}*F{row}),2)")
        sty(ws.cell(row, 5), number_format=fmt_money)
        sty(ws.cell(row, 6), number_format=fmt_money)
        sty(ws.cell(row, 7), number_format=fmt_money)
        sty(ws.cell(row, 8), number_format=fmt_money)
        row += 1

    sub_mo_row = row
    ws.cell(sub_mo_row, 4, "SubTotal Mano de Obra:")
    ws.cell(sub_mo_row, 7, f"=SUM(G{mo_start+2}:G{sub_mo_row-1})" if row > mo_start + 2 else 0)
    ws.cell(sub_mo_row, 8, f"=SUM(H{mo_start+2}:H{sub_mo_row-1})" if row > mo_start + 2 else 0)
    sty(ws.cell(sub_mo_row, 7), bold=True, number_format=fmt_money)
    sty(ws.cell(sub_mo_row, 8), bold=True, number_format=fmt_money)

    ps_row = sub_mo_row + 1
    ws.cell(ps_row, 3, f"{prestaciones}%")
    ws.cell(ps_row, 4, "FCAS (Prestaciones Sociales):")
    ws.cell(ps_row, 7, f"=ROUND((C{ps_row}/100)*G{sub_mo_row},2)")
    ws.cell(ps_row, 8, 0)
    sty(ws.cell(ps_row, 7), number_format=fmt_money)

    tg_mo_row = ps_row + 1
    ws.cell(tg_mo_row, 4, "Total General Mano de Obra:")
    ws.cell(tg_mo_row, 8, f"=G{sub_mo_row}+H{sub_mo_row}+G{ps_row}")
    sty(ws.cell(tg_mo_row, 8), bold=True, number_format=fmt_money, fill=total_fill)

    cuo_mo_row = tg_mo_row + 1
    ws.cell(cuo_mo_row, 4, "Costo Unitario de Mano de Obra:")
    ws.cell(cuo_mo_row, 8, f"=ROUND(H{tg_mo_row}/H8,2)")
    sty(ws.cell(cuo_mo_row, 8), bold=True, number_format=fmt_money)

    # RESUMEN
    resumen_start = cuo_mo_row + 2
    
    cd_row = resumen_start + 1
    ws.cell(cd_row, 5, "COSTO DIRECTO SUBTOTAL A:")
    ws.cell(cd_row, 8, f"=ROUND(H{total_mat_row}+H{cuo_eq_row}+H{cuo_mo_row},2)")
    sty(ws.cell(cd_row, 8), bold=True, number_format=fmt_money)

    ad_row = cd_row + 1
    ws.cell(ad_row, 3, f"{admin_gg}%")
    ws.cell(ad_row, 4, "Administración y Gastos Generales:")
    ws.cell(ad_row, 8, f"=ROUND((H{cd_row}*C{ad_row}/100),2)")
    sty(ws.cell(ad_row, 8), number_format=fmt_money)

    sb_row = ad_row + 1
    ws.cell(sb_row, 4, "SUBTOTAL B:")
    sty(ws.cell(sb_row, 4), bold=True)
    ws.cell(sb_row, 8, f"=H{cd_row}+H{ad_row}")
    sty(ws.cell(sb_row, 8), bold=True, number_format=fmt_money, fill=total_fill)

    iu_row = sb_row + 1
    ws.cell(iu_row, 5, f"{imprevisto_ut}%")
    ws.cell(iu_row, 6, "Imprevisto Utilidad:")
    ws.cell(iu_row, 8, f"=ROUND((H{sb_row}*E{iu_row}/100),2)")
    sty(ws.cell(iu_row, 8), number_format=fmt_money)

    sc_row = iu_row + 1
    ws.cell(sc_row, 4, "SUBTOTAL C:")
    sty(ws.cell(sc_row, 4), bold=True)
    ws.cell(sc_row, 8, f"=H{sb_row}+H{iu_row}")
    sty(ws.cell(sc_row, 8), bold=True, number_format=fmt_money, fill=total_fill)

    fin_row = sc_row + 1
    ws.cell(fin_row, 5, f"{financiamiento}%")
    ws.cell(fin_row, 6, "Financiamiento:")
    ws.cell(fin_row, 8, f"=ROUND((H{sc_row}*E{fin_row}/100),2)")
    sty(ws.cell(fin_row, 8), number_format=fmt_money)

    ps2_row = fin_row + 1
    ws.cell(ps2_row, 4, "PRECIO UNITARIO SIN IMPUESTO:")
    sty(ws.cell(ps2_row, 4), bold=True)
    ws.cell(ps2_row, 8, f"=H{sc_row}+H{fin_row}")
    sty(ws.cell(ps2_row, 8), bold=True, number_format=fmt_money, fill=total_fill)

    iva_row = ps2_row + 1
    ws.cell(iva_row, 5, f"{iva}%")
    ws.cell(iva_row, 6, "Impuesto (I.V.A.):")
    ws.cell(iva_row, 8, f"=ROUND((H{ps2_row}*E{iva_row}/100),2)")
    sty(ws.cell(iva_row, 8), number_format=fmt_money)

    oi_row = iva_row + 1
    ws.cell(oi_row, 5, f"{otros_imp}%")
    ws.cell(oi_row, 6, "Otros Impuestos:")
    ws.cell(oi_row, 8, f"=ROUND((H{ps2_row}*E{oi_row}/100),2)")
    sty(ws.cell(oi_row, 8), number_format=fmt_money)

    pf_row = oi_row + 2
    ws.cell(pf_row, 4, "PRECIO UNITARIO TOTAL:")
    sty(ws.cell(pf_row, 4), bold=True, size=12)
    ws.cell(pf_row, 8, f"=H{ps2_row}+H{iva_row}+H{oi_row}")
    sty(ws.cell(pf_row, 8), bold=True, size=12, number_format=fmt_money, fill=total_fill)

    # Anchos de columna
    ws.column_dimensions['A'].width = 4
    ws.column_dimensions['B'].width = 8
    ws.column_dimensions['C'].width = 50
    ws.column_dimensions['D'].width = 14
    ws.column_dimensions['E'].width = 14
    ws.column_dimensions['F'].width = 18
    ws.column_dimensions['G'].width = 16
    ws.column_dimensions['H'].width = 18

    # Guardar archivo
    temp_dir = Path("temp")
    temp_dir.mkdir(exist_ok=True)
    filename = f"APU_{item.get('CodPar', 'Custom')}_{uuid.uuid4().hex[:8]}.xlsx"
    file_path = temp_dir / filename
    wb.save(file_path)

    return file_path, filename
