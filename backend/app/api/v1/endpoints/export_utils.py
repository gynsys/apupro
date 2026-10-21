from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.drawing.image import Image as OpenpyxlImage
from PIL import Image as PILImage
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
import uuid
import base64
import io
import re
import math
from app.core.logging import logger

# Eliminamos numero_a_letras ya que vendrá del frontend

def style_cell(
    cell: Any,
    bold: bool = False,
    size: int = 11,
    align: str = "left",
    valign: str = "center",
    border: bool = False,
    number_format: Optional[str] = None,
    fill: Optional[Any] = None,
    font_color: str = "000000"
) -> None:
    cell.font = Font(bold=bold, size=size, name="Calibri", color=font_color)
    cell.alignment = Alignment(horizontal=align, vertical=valign, wrap_text=True)
    if border:
        thin = Side(style='thin', color='CBD5E1')
        cell.border = Border(left=thin, right=thin, top=thin, bottom=thin)
    if number_format:
        cell.number_format = number_format
    if fill:
        cell.fill = fill

def numero_a_letras(numero: float) -> str:
    """Convierte un monto numérico a su representación en letras en español."""
    unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"]
    decenas = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"]
    diez_diecinueve = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"]
    veintes = ["VEINTE", "VEINTIÚN", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"]
    centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"]

    def leer_decenas(n: int) -> str:
        if n < 10:
            return unidades[n]
        if n < 20:
            return diez_diecinueve[n - 10]
        if n < 30:
            return veintes[n - 20]
        u = n % 10
        if u == 0:
            return decenas[n // 10]
        return f"{decenas[n // 10]} Y {unidades[u]}"

    def leer_centenas(n: int) -> str:
        if n == 100:
            return "CIEN"
        return f"{centenas[n // 100]} {leer_decenas(n % 100)}".strip()

    def leer_miles(n: int) -> str:
        if n == 0:
            return ""
        if n == 1:
            return "MIL"
        return f"{leer_centenas(n)} MIL".strip()

    def leer_millones(n: int) -> str:
        if n == 0:
            return ""
        if n == 1:
            return "UN MILLÓN"
        if n > 1:
            return f"{leer_centenas(n)} MILLONES".strip()
        return ""

    entero = int(numero)
    decimales = int(round((numero - entero) * 100))

    if entero == 0:
        return f"CERO CON {decimales:02d}/100"

    millones = entero // 1000000
    miles = (entero // 1000) % 1000
    cientos = entero % 1000

    partes = []
    if millones > 0:
        partes.append(leer_millones(millones))
    if miles > 0:
        partes.append(leer_miles(miles))
    if cientos > 0:
        partes.append(leer_centenas(cientos))

    letras = " ".join(partes).strip()
    return f"{letras} CON {decimales:02d}/100"


def sanitize_sheet_title(raw_title: str, existing_titles: set, fallback_index: int = 1) -> str:
    """Sanitiza y acorta un título para cumplir las reglas de nombres de hoja de Excel (máx 31 caracteres, sin caracteres ilegales)."""
    cleaned = re.sub(r'[\\/*?:[\]]', '', str(raw_title or "")).strip()
    cleaned = cleaned.strip("'")
    if not cleaned:
        cleaned = f"APU {fallback_index}"
    if len(cleaned) > 28:
        cleaned = cleaned[:28].strip()

    candidate = cleaned
    counter = 1
    while candidate.upper() in [t.upper() for t in existing_titles]:
        suffix = f"_{counter}"
        candidate = f"{cleaned[:31-len(suffix)]}{suffix}"
        counter += 1

    existing_titles.add(candidate)
    return candidate


def build_apu_sheet(
    ws: Any,
    item: Dict[str, Any],
    mat_rows: List[Dict[str, Any]],
    eq_rows: List[Dict[str, Any]],
    mo_rows: List[Dict[str, Any]],
    settings: Optional[Dict[str, Any]] = None,
    part_num: int = 1,
) -> None:
    """Rellena y formatea una hoja de Excel individual con la estructura completa de un APU."""
    if settings is None:
        settings = {}

    rendimiento = float(item.get("RenPar") or item.get("rendimiento") or item.get("performance") or 1.0)
    cantidad = float(item.get("CanPar") or item.get("cantidad") or item.get("quantity") or 1.0)
    descripcion = item.get("DesPar") or item.get("descripcion") or item.get("description") or item.get("Descri") or ""
    codigo = item.get("cov_par") or item.get("CovPar") or item.get("codigo_covenin") or item.get("CodPar") or item.get("codigo") or item.get("code") or ""
    cod_par = str(
        item.get("CodPar")
        or item.get("cod_par")
        or item.get("CovPar")
        or item.get("cov_par")
        or codigo
        or ""
    ).strip()
    unidad = item.get("UniPar") or item.get("unidad") or item.get("unit") or "UND"
    admin_gg = float(settings.get("admin_percent", 15.0))
    imprevisto_ut = float(settings.get("profit_percent", 10.0))
    financiamiento = float(settings.get("financiamiento", 0.0))
    iva = float(settings.get("iva_percent", 16.0))
    otros_imp = float(settings.get("otros_imp", 0.0))
    prestaciones = float(settings.get("fcas_percent", 417.0))
    raw_bono_in_fcas = settings.get("bono_in_fcas")
    if raw_bono_in_fcas is None:
        raw_bono_in_fcas = item.get("bono_in_fcas")
    bono_in_fcas = raw_bono_in_fcas is True or (raw_bono_in_fcas is not False and prestaciones >= 1000)

    default_labor_bonus = 0.0 if bono_in_fcas else float(
        settings.get("labor_bonus")
        or settings.get("fcasLaborBonus")
        or settings.get("laborBonus")
        or item.get("labor_bonus")
        or item.get("laborBonus")
        or 0.0
    )

    if hasattr(ws, 'views') and ws.views and hasattr(ws.views, 'sheetView') and ws.views.sheetView:
        ws.views.sheetView[0].showGridLines = True

    # HEADER
    ws.merge_cells("B1:H1")
    ws["B1"] = "ANÁLISIS DE PRECIO UNITARIO"
    style_cell(ws["B1"], bold=True, size=14, align="center")

    ws.merge_cells("B2:H2")
    ws["B2"] = ""

    ws.column_dimensions['B'].width = 10

    ws["B3"] = f"Obra: {settings.get('project_name') or settings.get('obra') or ''}"
    ws["B4"] = f"Contratante: {settings.get('client_name') or settings.get('contratante') or ''}"
    ws["E5"] = "Part. No.:"
    ws["F5"] = str(part_num)
    ws["G5"] = "Fecha:"
    ws["H5"] = datetime.now().strftime("%d/%m/%Y")
    ws["B6"] = "Descripción:"
    ws.merge_cells("C6:H7")
    ws["C6"] = descripcion or item.get("Descri", 'N/A')
    style_cell(ws["C6"], align="left", valign="top")
    ws["G8"] = "Rendimiento:"
    ws["H8"] = rendimiento
    ws["B9"] = "Código:"
    ws["C9"] = codigo
    ws["E9"] = "Unidad:"
    ws["F9"] = unidad
    ws["G9"] = "Cantidad:"
    ws["H9"] = cantidad if cantidad > 0 else 1.0

    # MATERIALES
    mat_start = 11
    ws.merge_cells(f"B{mat_start}:H{mat_start}")
    ws[f"B{mat_start}"] = "MATERIALES"
    style_cell(ws[f"B{mat_start}"], bold=True, size=12)

    headers = ["", "Descripción", "Und.", "Cant.", "Desp.", "Precio", "Total"]
    for i, h in enumerate(headers):
        col = get_column_letter(i + 2)
        ws[f"{col}{mat_start+1}"] = h
        style_cell(ws[f"{col}{mat_start+1}"], bold=True, border=True)

    row = mat_start + 2
    for m in mat_rows:
        ws[f"A{row}"] = str(m.get("codigo") or m.get("CodIns") or "")
        style_cell(ws[f"A{row}"], align="center")
        ws[f"B{row}"] = cod_par
        style_cell(ws[f"B{row}"], align="center")
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
    if mat_rows:
        first_data = mat_start + 2
        last_data = total_mat_row - 1
        ws[f"H{total_mat_row}"] = f"=SUM(H{first_data}:H{last_data})"
    else:
        ws[f"H{total_mat_row}"] = 0.0
    style_cell(ws[f"H{total_mat_row}"], bold=True, number_format='#,##0.00')

    # EQUIPOS
    eq_start = total_mat_row + 2
    ws.merge_cells(f"B{eq_start}:H{eq_start}")
    ws[f"B{eq_start}"] = "EQUIPOS"
    style_cell(ws[f"B{eq_start}"], bold=True, size=12)

    headers = ["", "Descripción", "", "Cant.", "Cop/Dep", "Precio", "Total"]
    for i, h in enumerate(headers):
        col = get_column_letter(i + 2)
        ws[f"{col}{eq_start+1}"] = h
        style_cell(ws[f"{col}{eq_start+1}"], bold=True, border=True)

    row = eq_start + 2
    for e in eq_rows:
        ws[f"A{row}"] = str(e.get("codigo") or e.get("CodIns") or "")
        style_cell(ws[f"A{row}"], align="center")
        ws[f"B{row}"] = cod_par
        style_cell(ws[f"B{row}"], align="center")
        ws[f"C{row}"] = e.get("Descri") or e.get("descripcion", "")
        ws[f"E{row}"] = float(e.get("CanIns") or e.get("cantidad") or 0)
        ws[f"F{row}"] = float(e.get("Deprec") or e.get("depreciacion") or 1)
        ws[f"G{row}"] = float(e.get("CosDia") or e.get("precio_unitario") or e.get("precio") or 0)
        ws[f"H{row}"] = f"=ROUND((G{row}*E{row})*(F{row}),2)"
        style_cell(ws[f"H{row}"], number_format='#,##0.00')
        row += 1

    total_eq_row = row
    ws[f"F{total_eq_row}"] = "Total Equipos:"
    if eq_rows:
        first_data = eq_start + 2
        last_data = total_eq_row - 1
        ws[f"H{total_eq_row}"] = f"=SUM(H{first_data}:H{last_data})"
    else:
        ws[f"H{total_eq_row}"] = 0.0
    style_cell(ws[f"H{total_eq_row}"], bold=True, number_format='#,##0.00')

    cuo_row = total_eq_row + 1
    ws[f"E{cuo_row}"] = "Costo Unitarios Equipos:"
    ws[f"H{cuo_row}"] = f"=ROUND(H{total_eq_row}/H8,2)"
    style_cell(ws[f"H{cuo_row}"], bold=True, number_format='#,##0.00')

    # MANO DE OBRA
    mo_start = cuo_row + 2
    ws.merge_cells(f"B{mo_start}:H{mo_start}")
    ws[f"B{mo_start}"] = "MANO DE OBRA"
    style_cell(ws[f"B{mo_start}"], bold=True, size=12)

    headers = ["", "Descripción", "Cant.", "Jornal", "Bono", "Total Jornal", "Total Bono"]
    for i, h in enumerate(headers):
        col = get_column_letter(i + 2)
        ws[f"{col}{mo_start+1}"] = h
        style_cell(ws[f"{col}{mo_start+1}"], bold=True, border=True)

    row = mo_start + 2
    for l in mo_rows:
        ws[f"A{row}"] = str(l.get("codigo") or l.get("CodIns") or "")
        style_cell(ws[f"A{row}"], align="center")
        ws[f"B{row}"] = cod_par
        style_cell(ws[f"B{row}"], align="center")
        ws[f"C{row}"] = l.get("Descri") or l.get("descripcion", "")
        ws[f"D{row}"] = float(l.get("CanIns") or l.get("cantidad") or 0)
        ws[f"E{row}"] = float(l.get("Jornal") or l.get("jornal") or 0)

        raw_b = (
            l.get("bono")
            if l.get("bono") is not None
            else (
                l.get("Bono")
                if l.get("Bono") is not None
                else (
                    l.get("labor_bonus")
                    if l.get("labor_bonus") is not None
                    else l.get("bonus")
                )
            )
        )
        try:
            val_b = float(raw_b) if raw_b is not None and str(raw_b).strip() != "" else 0.0
        except (ValueError, TypeError):
            val_b = 0.0

        if bono_in_fcas:
            final_bono = 0.0
        elif val_b > 0:
            final_bono = val_b
        else:
            final_bono = default_labor_bonus

        ws[f"F{row}"] = final_bono
        ws[f"G{row}"] = f"=ROUND((D{row}*E{row}),2)"
        ws[f"H{row}"] = f"=ROUND((D{row}*F{row}),2)"
        style_cell(ws[f"D{row}"], number_format='#,##0.00')
        style_cell(ws[f"E{row}"], number_format='#,##0.00')
        style_cell(ws[f"F{row}"], number_format='#,##0.00')
        style_cell(ws[f"G{row}"], number_format='#,##0.00')
        style_cell(ws[f"H{row}"], number_format='#,##0.00')
        row += 1

    sub_row = row
    ws[f"D{sub_row}"] = "SubTotal Mano de Obra:"
    if mo_rows:
        first_data = mo_start + 2
        last_data = sub_row - 1
        ws[f"G{sub_row}"] = f"=SUM(G{first_data}:G{last_data})"
        ws[f"H{sub_row}"] = f"=SUM(H{first_data}:H{last_data})"
    else:
        ws[f"G{sub_row}"] = 0.0
        ws[f"H{sub_row}"] = 0.0
    style_cell(ws[f"G{sub_row}"], bold=True, number_format='#,##0.00')
    style_cell(ws[f"H{sub_row}"], bold=True, number_format='#,##0.00')

    ps_row = sub_row + 1
    ws[f"C{ps_row}"] = prestaciones
    style_cell(ws[f"C{ps_row}"], number_format='#,##0.00', align="right")
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
    ws[f"H{cuo_mo_row}"] = f"=ROUND(H{tg_row}/H8,2)"
    style_cell(ws[f"H{cuo_mo_row}"], bold=True, number_format='#,##0.00')

    # RESUMEN
    resumen_start = cuo_mo_row + 2
    cd_row = resumen_start + 1
    ws[f"E{cd_row}"] = "COSTO DIRECTO SUBTOTAL A:"
    ws[f"H{cd_row}"] = f"=ROUND(H{total_mat_row}+H{cuo_row}+H{cuo_mo_row},2)"
    style_cell(ws[f"H{cd_row}"], bold=True, number_format='#,##0.00')

    ad_row = cd_row + 1
    ws[f"C{ad_row}"] = admin_gg
    style_cell(ws[f"C{ad_row}"], number_format='#,##0.00', align="right")
    ws[f"D{ad_row}"] = "Administración y Gastos Generales:"
    ws[f"H{ad_row}"] = f"=ROUND((H{cd_row}*C{ad_row})/100,2)"
    style_cell(ws[f"H{ad_row}"], number_format='#,##0.00')

    sb_row = ad_row + 1
    ws[f"D{sb_row}"] = "SUBTOTAL B:"
    ws[f"H{sb_row}"] = f"=H{cd_row}+H{ad_row}"
    style_cell(ws[f"H{sb_row}"], bold=True, number_format='#,##0.00')

    iu_row = sb_row + 1
    ws[f"E{iu_row}"] = imprevisto_ut
    style_cell(ws[f"E{iu_row}"], number_format='#,##0.00', align="right")
    ws[f"F{iu_row}"] = "Imprevisto Utilidad:"
    ws[f"H{iu_row}"] = f"=ROUND((H{sb_row}*E{iu_row})/100,2)"
    style_cell(ws[f"H{iu_row}"], number_format='#,##0.00')

    sc_row = iu_row + 1
    ws[f"D{sc_row}"] = "SUBTOTAL C:"
    ws[f"H{sc_row}"] = f"=H{sb_row}+H{iu_row}"
    style_cell(ws[f"H{sc_row}"], bold=True, number_format='#,##0.00')

    fin_row = sc_row + 1
    ws[f"E{fin_row}"] = financiamiento
    style_cell(ws[f"E{fin_row}"], number_format='#,##0.00', align="right")
    ws[f"F{fin_row}"] = "Financiamiento:"
    ws[f"H{fin_row}"] = f"=ROUND((H{sc_row}*E{fin_row})/100,2)"
    style_cell(ws[f"H{fin_row}"], number_format='#,##0.00')

    ps_row2 = fin_row + 1
    ws[f"D{ps_row2}"] = "PRECIO UNITARIO SIN IMPUESTO:"
    ws[f"H{ps_row2}"] = f"=H{sc_row}+H{fin_row}"
    style_cell(ws[f"H{ps_row2}"], bold=True, number_format='#,##0.00')

    iva_row = ps_row2 + 1
    ws[f"E{iva_row}"] = iva
    style_cell(ws[f"E{iva_row}"], number_format='#,##0.00', align="right")
    ws[f"F{iva_row}"] = "Impuesto (I.V.A.):"
    ws[f"H{iva_row}"] = f"=ROUND((H{ps_row2}*E{iva_row})/100,2)"
    style_cell(ws[f"H{iva_row}"], number_format='#,##0.00')

    oi_row = iva_row + 1
    ws[f"E{oi_row}"] = otros_imp
    style_cell(ws[f"E{oi_row}"], number_format='#,##0.00', align="right")
    ws[f"F{oi_row}"] = "Otros Impuestos:"
    ws[f"H{oi_row}"] = f"=ROUND((H{ps_row2}*E{oi_row})/100,2)"
    style_cell(ws[f"H{oi_row}"], number_format='#,##0.00')

    pf_row = oi_row + 2
    curr_code = str(settings.get("currency") or "USD").strip().upper()
    unit_curr = "USD" if ("USD" in curr_code or "$" in curr_code) else "Bs."
    ws[f"D{pf_row}"] = f"PRECIO UNITARIO ({unit_curr}):"
    ws[f"H{pf_row}"] = f"=H{ps_row2}+H{iva_row}+H{oi_row}"
    style_cell(ws[f"H{pf_row}"], bold=True, number_format='#,##0.00')

    ws.column_dimensions['A'].width = 14
    ws.column_dimensions['B'].width = 12
    ws.column_dimensions['C'].width = 45
    ws.column_dimensions['D'].width = 12
    ws.column_dimensions['E'].width = 12
    ws.column_dimensions['F'].width = 12
    ws.column_dimensions['G'].width = 16
    ws.column_dimensions['H'].width = 18

    def _resolve_lab_bono(l_dict):
        if bono_in_fcas:
            return 0.0
        raw = (
            l_dict.get("bono")
            if l_dict.get("bono") is not None
            else (
                l_dict.get("Bono")
                if l_dict.get("Bono") is not None
                else (
                    l_dict.get("labor_bonus")
                    if l_dict.get("labor_bonus") is not None
                    else l_dict.get("bonus")
                )
            )
        )
        try:
            v = float(raw) if raw is not None and str(raw).strip() != "" else 0.0
        except (ValueError, TypeError):
            v = 0.0
        return v if v > 0 else default_labor_bonus

    total_mat = round(sum( round((float(m.get("CosMat") or m.get("precio_unitario") or m.get("precio") or 0) * float(m.get("CanIns") or m.get("cantidad") or 0)) * (float(m.get("Desper") or m.get("desperdicio") or 0)/100.0 + 1), 2) for m in mat_rows ), 2)
    total_eq = round(sum( round((float(e.get("CosDia") or e.get("precio_unitario") or e.get("precio") or 0) * float(e.get("CanIns") or e.get("cantidad") or 0)) * float(e.get("Deprec") or e.get("depreciacion") or 1), 2) for e in eq_rows ), 2)
    total_mo_jornal = sum( round(float(l.get("CanIns") or l.get("cantidad") or 0) * float(l.get("Jornal") or l.get("jornal") or 0), 2) for l in mo_rows )
    total_mo_bono = sum( round(float(l.get("CanIns") or l.get("cantidad") or 0) * _resolve_lab_bono(l), 2) for l in mo_rows )
    mo_ps = round((prestaciones/100.0) * total_mo_jornal, 2)
    total_mo = total_mo_jornal + total_mo_bono + mo_ps

    cuo_eq = round(total_eq / rendimiento, 2)
    cuo_mo = round(total_mo / rendimiento, 2)

    cd_val = round(total_mat + cuo_eq + cuo_mo, 2)
    ad_val = round((cd_val * admin_gg)/100, 2)
    sb_val = cd_val + ad_val
    iu_val = round((sb_val * imprevisto_ut)/100, 2)
    sc_val = sb_val + iu_val
    fin_val = round((sc_val * financiamiento)/100, 2)
    ps_val = sc_val + fin_val
    iva_val = round((ps_val * iva)/100, 2)
    oi_val = round((ps_val * otros_imp)/100, 2)
    precio_final = ps_val + iva_val + oi_val

    son_letras = settings.get("son_letras")
    if not son_letras or son_letras == "SON: ( NO DISPONIBLE )":
        currency_word = "DÓLARES" if ("USD" in curr_code or "$" in curr_code) else "Bs."
        son_letras = f"SON: ( {numero_a_letras(precio_final)} {currency_word} ctms )"

    ws.merge_cells(f"B{iva_row}:C{pf_row-1}")
    ws[f"B{iva_row}"] = son_letras
    style_cell(ws[f"B{iva_row}"], align="center", valign="bottom", bold=True)

    for r in range(1, pf_row + 1):
        cell = ws[f"H{r}"]
        if cell.value is not None:
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)


def generate_excel_workbook(
    item: Dict[str, Any],
    mat_rows: List[Dict[str, Any]],
    eq_rows: List[Dict[str, Any]],
    mo_rows: List[Dict[str, Any]],
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[Path, str]:
    """Genera un archivo Excel (.xlsx) con un APU individual usando diccionarios."""
    if settings is None:
        settings = {}

    wb = Workbook()
    wb.calculation.calcMode = 'auto'
    ws = wb.active
    ws.title = sanitize_sheet_title(item.get('CodPar') or 'Custom', set())

    build_apu_sheet(ws, item, mat_rows, eq_rows, mo_rows, settings, part_num=1)

    temp_dir = Path("temp")
    temp_dir.mkdir(exist_ok=True)
    filename = f"APU_{item.get('CovPar') or item.get('CodPar', 'Custom')}_{uuid.uuid4().hex[:6]}.xlsx"
    file_path = temp_dir / filename
    wb.save(file_path)

    return file_path, filename


def generate_budget_all_apus_excel_workbook(
    budget_dict: Dict[str, Any],
    items_data: List[Dict[str, Any]],
    settings: Optional[Dict[str, Any]] = None,
) -> Tuple[Path, str]:
    """Genera un libro de Excel (.xlsx) donde cada hoja corresponde al APU de una partida del presupuesto."""
    if settings is None:
        settings = {}

    wb = Workbook()
    wb.calculation.calcMode = 'auto'
    existing_titles: set = set()

    # Filtrar solo partidas con APU (excluir capítulos)
    apus_items: List[Dict[str, Any]] = []
    for entry in items_data:
        item_info = entry.get("item") if isinstance(entry.get("item"), dict) else entry
        if not item_info.get("is_chapter", False):
            apus_items.append(entry)

    if not apus_items:
        ws = wb.active
        ws.title = "APUs"
        ws["B2"] = "No hay partidas con APU en este presupuesto."
        style_cell(ws["B2"], bold=True, size=12)
    else:
        for idx, entry in enumerate(apus_items, start=1):
            item_info = entry.get("item") if isinstance(entry.get("item"), dict) else entry
            mats = entry.get("materials") or []
            eqs = entry.get("equipments") or []
            mos = entry.get("labors") or []

            code = str(item_info.get("CovPar") or item_info.get("cov_par") or item_info.get("CodPar") or item_info.get("cod_par") or "").strip()
            if code:
                raw_sheet_title = f"P{idx} - {code}"
            else:
                raw_sheet_title = f"Partida {idx}"

            sheet_title = sanitize_sheet_title(raw_sheet_title, existing_titles, fallback_index=idx)

            if idx == 1:
                ws = wb.active
                ws.title = sheet_title
            else:
                ws = wb.create_sheet(title=sheet_title)

            build_apu_sheet(ws, item_info, mats, eqs, mos, settings, part_num=idx)

    temp_dir = Path("temp")
    temp_dir.mkdir(exist_ok=True)
    clean_name = re.sub(r'[^A-Za-z0-9_]+', '_', str(budget_dict.get("project_name") or budget_dict.get("name") or "Presupuesto")).strip('_')[:30]
    filename = f"APUS_{clean_name}_{uuid.uuid4().hex[:6]}.xlsx"
    file_path = temp_dir / filename
    wb.save(file_path)

    return file_path, filename
def generate_budget_excel_workbook(
    budget: Dict[str, Any],
    items: List[Dict[str, Any]],
    settings: Optional[Dict[str, Any]] = None
) -> Tuple[Path, str]:
    """Genera un archivo Excel (.xlsx) completo para el presupuesto, respetando configuraciones, capítulos, logo y fórmulas."""
    if not isinstance(budget, dict):
        raise ValueError("budget debe ser un diccionario válido")
    if not isinstance(items, list):
        raise ValueError("items debe ser una lista válida")

    if settings is None:
        settings = {}

    wb = Workbook()
    ws = wb.active
    ws.title = "Presupuesto"
    ws.views.sheetView[0].showGridLines = True

    # 1. Definir anchos de columna
    ws.column_dimensions['A'].width = 3
    ws.column_dimensions['B'].width = 8    # # / N°
    ws.column_dimensions['C'].width = 18   # Código
    ws.column_dimensions['D'].width = 60   # Descripción
    ws.column_dimensions['E'].width = 10   # Unidad
    ws.column_dimensions['F'].width = 14   # Cantidad
    ws.column_dimensions['G'].width = 18   # P.U.
    ws.column_dimensions['H'].width = 20   # Total

    # 2. LOGO (si está activo y presente en base64)
    logo_b64 = budget.get("logo_base64") or settings.get("logo_base64")
    has_logo = False
    if logo_b64:
        try:
            raw_b64 = str(logo_b64)
            if "," in raw_b64:
                raw_b64 = raw_b64.split(",", 1)[1]
            img_bytes = base64.b64decode(raw_b64)
            pil_img = PILImage.open(io.BytesIO(img_bytes))
            orig_w, orig_h = pil_img.size
            if orig_h > 0 and orig_w > 0:
                max_h = 52
                aspect = orig_w / orig_h
                new_h = min(orig_h, max_h)
                new_w = int(new_h * aspect)

                output_buf = io.BytesIO()
                pil_img.convert("RGBA").save(output_buf, format="PNG")
                output_buf.seek(0)

                xl_img = OpenpyxlImage(output_buf)
                xl_img.width = new_w
                xl_img.height = new_h
                ws.add_image(xl_img, 'B2')
                has_logo = True
        except Exception as e:
            logger.error(f"Error procesando logo para Excel: {e}", exc_info=True)

    # 3. BLOQUE DE DATOS DE CABECERA
    info_col = "D" if has_logo else "B"
    header_row = 2

    obra = (budget.get("obra") or budget.get("project_name") or budget.get("name") or "").strip()
    if obra:
        ws[f"{info_col}{header_row}"] = f"Obra: {obra}"
        ws[f"{info_col}{header_row}"].font = Font(bold=True, size=14, name="Calibri")
        ws[f"{info_col}{header_row}"].alignment = Alignment(vertical="center")
        ws.row_dimensions[header_row].height = 24
        header_row += 1
    else:
        ws["B2"].font = Font(bold=True, size=14, name="Calibri")
        ws["B2"].alignment = Alignment(vertical="center")

    ubicacion = (budget.get("ubicacion") or settings.get("ubicacion") or "").strip()
    if ubicacion:
        ws[f"{info_col}{header_row}"] = f"Ubicación: {ubicacion}"
        ws[f"{info_col}{header_row}"].font = Font(size=10, name="Calibri", color="475569")
        header_row += 1

    contratante = (budget.get("contratante") or budget.get("client_name") or "").strip()
    if contratante:
        ws[f"{info_col}{header_row}"] = f"Contratante: {contratante}"
        ws[f"{info_col}{header_row}"].font = Font(size=10, name="Calibri", color="475569")
        header_row += 1

    company_rif = (budget.get("company_rif") or "").strip()
    if company_rif:
        ws[f"{info_col}{header_row}"] = f"RIF: {company_rif}"
        ws[f"{info_col}{header_row}"].font = Font(size=10, name="Calibri", color="475569")
        header_row += 1

    ws[f"{info_col}{header_row}"] = f"Fecha: {datetime.now().strftime('%d/%m/%Y')}"
    ws[f"{info_col}{header_row}"].font = Font(size=9, name="Calibri", color="64748B")
    header_row += 1

    if has_logo and header_row < 6:
        header_row = 6

    # 4. TÍTULO CENTRADO
    title_row = header_row + 1
    title_text = (budget.get("title") or "PRESUPUESTO").strip().upper()
    ws.merge_cells(f"B{title_row}:H{title_row}")
    ws[f"B{title_row}"] = title_text
    ws[f"B{title_row}"].font = Font(bold=True, size=14, name="Calibri", color="0F172A")
    ws[f"B{title_row}"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[title_row].height = 26

    # Moneda
    raw_curr = str(budget.get("currency") or "USD").strip().upper()
    currency_label = "Bs." if ("BS" in raw_curr) else "USD"

    # 5. ENCABEZADOS DE LA TABLA
    th_row = title_row + 2
    headers = [
        ("B", "#", "center"),
        ("C", "CÓDIGO", "center"),
        ("D", "DESCRIPCIÓN", "left"),
        ("E", "UNIDAD", "center"),
        ("F", "CANTIDAD", "right"),
        ("G", f"P.U. ({currency_label})", "right"),
        ("H", f"TOTAL ({currency_label})", "right")
    ]
    th_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    for col, text, align in headers:
        cell = ws[f"{col}{th_row}"]
        cell.value = text
        style_cell(cell, bold=True, size=11, align=align, border=True, fill=th_fill, font_color="1E293B")
    ws.row_dimensions[th_row].height = 24

    # 6. FILAS DE DATOS (PARTIDAS Y CAPÍTULOS)
    curr_r = th_row + 1
    first_data_r = curr_r
    item_num = 1
    chap_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

    for it in items:
        is_chapter = bool(it.get("is_chapter"))
        desc = str(it.get("description") or "").strip()

        if is_chapter:
            ws.merge_cells(f"B{curr_r}:H{curr_r}")
            cell = ws[f"B{curr_r}"]
            cell.value = desc.upper()
            style_cell(cell, bold=True, size=11, align="left", valign="center", border=True, fill=chap_fill, font_color="0F172A")
            for c in ["C", "D", "E", "F", "G", "H"]:
                style_cell(ws[f"{c}{curr_r}"], valign="center", border=True, fill=chap_fill)
            chap_lines = max(1, math.ceil(len(desc) / 90.0))
            ws.row_dimensions[curr_r].height = max(24.0, float(chap_lines * 18.0 + 6.0))
        else:
            style_cell(ws[f"B{curr_r}"], align="center", valign="center", border=True)
            ws[f"B{curr_r}"] = item_num

            style_cell(ws[f"C{curr_r}"], align="center", valign="center", border=True)
            ws[f"C{curr_r}"] = str(it.get("cov_par") or it.get("cod_par") or "")

            style_cell(ws[f"D{curr_r}"], align="left", valign="center", border=True)
            ws[f"D{curr_r}"] = desc

            style_cell(ws[f"E{curr_r}"], align="center", valign="center", border=True)
            ws[f"E{curr_r}"] = str(it.get("unit") or "")

            qty = float(it.get("quantity") or 0.0)
            style_cell(ws[f"F{curr_r}"], align="right", valign="center", border=True, number_format="#,##0.00")
            ws[f"F{curr_r}"] = qty

            pu = float(it.get("pu") or it.get("unit_price") or 0.0)
            style_cell(ws[f"G{curr_r}"], align="right", valign="center", border=True, number_format="#,##0.00")
            ws[f"G{curr_r}"] = pu

            style_cell(ws[f"H{curr_r}"], align="right", valign="center", border=True, number_format="#,##0.00")
            ws[f"H{curr_r}"] = f"=ROUND(F{curr_r}*G{curr_r}, 2)"

            item_num += 1

            # Calcular altura adecuada de la fila para que la descripción se vea completa sin superponerse
            desc_lines = desc.split("\n")
            total_desc_lines = 0
            for dl in desc_lines:
                clean_dl = dl.strip()
                if not clean_dl:
                    total_desc_lines += 1
                else:
                    # Con ancho de columna 60, caben aprox 45 caracteres por línea en 11pt Calibri
                    total_desc_lines += max(1, math.ceil(len(clean_dl) / 45.0))
            total_desc_lines = max(1, total_desc_lines)
            row_h = max(24.0, float(total_desc_lines * 17.0 + 8.0))
            ws.row_dimensions[curr_r].height = row_h

        curr_r += 1

    last_data_r = max(first_data_r, curr_r - 1)

    # 7. TOTALES AL PIE
    tot_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    highlight_fill = PatternFill(start_color="ECFDF5", end_color="ECFDF5", fill_type="solid")

    # Subtotal
    sub_r = curr_r
    ws.merge_cells(f"B{sub_r}:G{sub_r}")
    ws[f"B{sub_r}"] = f"Subtotal ({currency_label}):"
    style_cell(ws[f"B{sub_r}"], bold=True, size=11, align="right", valign="center", border=True, fill=tot_fill)
    for c in ["C", "D", "E", "F", "G"]:
        style_cell(ws[f"{c}{sub_r}"], valign="center", border=True, fill=tot_fill)
    style_cell(ws[f"H{sub_r}"], bold=True, size=11, align="right", valign="center", border=True, number_format="#,##0.00", fill=tot_fill)
    ws[f"H{sub_r}"] = f"=SUM(H{first_data_r}:H{last_data_r})"
    ws.row_dimensions[sub_r].height = 24

    # IVA
    iva_r = sub_r + 1
    iva_pct = float(budget.get("iva_percent") if budget.get("iva_percent") is not None else 16.0)
    iva_display = f"{int(iva_pct)}%" if iva_pct.is_integer() else f"{iva_pct}%"
    ws.merge_cells(f"B{iva_r}:G{iva_r}")
    ws[f"B{iva_r}"] = f"IVA {iva_display} ({currency_label}):"
    style_cell(ws[f"B{iva_r}"], bold=True, size=11, align="right", valign="center", border=True, fill=tot_fill)
    for c in ["C", "D", "E", "F", "G"]:
        style_cell(ws[f"{c}{iva_r}"], valign="center", border=True, fill=tot_fill)
    style_cell(ws[f"H{iva_r}"], bold=True, size=11, align="right", valign="center", border=True, number_format="#,##0.00", fill=tot_fill)
    ws[f"H{iva_r}"] = f"=ROUND(H{sub_r}*({iva_pct}/100), 2)"
    ws.row_dimensions[iva_r].height = 24

    # Total Presupuesto
    total_r = iva_r + 1
    ws.merge_cells(f"B{total_r}:G{total_r}")
    ws[f"B{total_r}"] = f"Total Presupuesto ({currency_label}):"
    style_cell(ws[f"B{total_r}"], bold=True, size=12, align="right", valign="center", border=True, fill=highlight_fill, font_color="0F172A")
    for c in ["C", "D", "E", "F", "G"]:
        style_cell(ws[f"{c}{total_r}"], valign="center", border=True, fill=highlight_fill)
    style_cell(ws[f"H{total_r}"], bold=True, size=12, align="right", valign="center", border=True, number_format="#,##0.00", fill=highlight_fill, font_color="0F172A")
    ws[f"H{total_r}"] = f"=H{sub_r}+H{iva_r}"

    double_bottom = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='double', color='0F172A')
    )
    for c in ["B", "C", "D", "E", "F", "G", "H"]:
        ws[f"{c}{total_r}"].border = double_bottom
    ws.row_dimensions[total_r].height = 28

    # 8. NOTAS DEL PRESUPUESTO (si existen)
    notes_text = str(budget.get("notes") or "").strip()
    if notes_text:
        note_title_r = total_r + 2
        ws[f"B{note_title_r}"] = "NOTAS:"
        ws[f"B{note_title_r}"].font = Font(bold=True, size=11, name="Calibri", color="1E293B")
        ws.row_dimensions[note_title_r].height = 20

        note_box_r = note_title_r + 1
        ws.merge_cells(f"B{note_box_r}:H{note_box_r}")
        note_cell = ws[f"B{note_box_r}"]
        note_cell.value = notes_text
        note_cell.font = Font(size=10, name="Calibri", color="334155")
        note_cell.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)

        thin_border = Side(style='thin', color='CBD5E1')
        box_border = Border(left=thin_border, right=thin_border, top=thin_border, bottom=thin_border)
        note_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

        for col in ["B", "C", "D", "E", "F", "G", "H"]:
            c = ws[f"{col}{note_box_r}"]
            c.border = box_border
            c.fill = note_fill

        # Altura dinámica para el recuadro de notas
        note_lines = notes_text.split("\n")
        total_note_lines = 0
        for nl in note_lines:
            clean_nl = nl.strip()
            if not clean_nl:
                total_note_lines += 1
            else:
                total_note_lines += max(1, math.ceil(len(clean_nl) / 100.0))
        total_note_lines = max(1, total_note_lines)
        ws.row_dimensions[note_box_r].height = max(36.0, float(total_note_lines * 16.0 + 12.0))

    # 9. GUARDAR ARCHIVO TEMPORAL
    temp_dir = Path("temp")
    temp_dir.mkdir(exist_ok=True)
    raw_name = obra or budget.get("name") or "Presupuesto"
    safe_slug = re.sub(r'[^a-zA-Z0-9_\-]', '_', raw_name).strip('_')[:40] or "Presupuesto"
    filename = f"Presupuesto_{safe_slug}_{uuid.uuid4().hex[:6]}.xlsx"
    file_path = temp_dir / filename
    wb.save(file_path)

    return file_path, filename
