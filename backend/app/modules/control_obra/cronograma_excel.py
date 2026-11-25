"""Generador de libro Excel para Cronograma General de Obras y Curva S.

Replica con fidelidad el estándar de 4 hojas interconectadas dinámicamente con fórmulas:
1. 'Cronograma General': Vista ejecutiva, desembolsos semanales, Gantt visual y Curva S.
2. 'Cronograma Mensual': Prorrateo a meses calendario con SUMPRODUCT y Curva S mensual.
3. 'Partidas': Presupuesto desglosado con distribución uniforme S1..Sn y pesos %.
4. 'Ponderación': Nombres definidos (START, FIN, IVA), duraciones y fechas por capítulo.
"""
from __future__ import annotations

from datetime import date
from io import BytesIO
from typing import Any, Dict, List, Optional

import openpyxl
from openpyxl.formatting.rule import ColorScaleRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName

from app.core.logging import logger


# Estilos estándar ejecutivos
FONT_TITLE = Font(name="Arial", size=14, bold=True, color="374151")
FONT_SUBTITLE = Font(name="Arial", size=11, bold=True, color="374151")
FONT_DESC = Font(name="Arial", size=9, bold=False, color="6B7280")
FONT_STATUS = Font(name="Arial", size=10, bold=True, color="D97706")
FONT_TH = Font(name="Arial", size=9, bold=True, color="FFFFFF")
FONT_CHAPTER = Font(name="Arial", size=9, bold=True, color="FFFFFF")
FONT_DATA = Font(name="Arial", size=8, bold=False, color="111827")
FONT_DATA_BOLD = Font(name="Arial", size=8, bold=True, color="111827")
FONT_TOTAL = Font(name="Arial", size=9, bold=True, color="1E3A8A")

FILL_HEADER = PatternFill("solid", fgColor="374151")
FILL_CHAPTER = PatternFill("solid", fgColor="4B5563")
FILL_ZEBRA_ODD = PatternFill("solid", fgColor="FFFFFF")
FILL_ZEBRA_EVEN = PatternFill("solid", fgColor="F9FAFB")
FILL_TOTAL = PatternFill("solid", fgColor="F3F4F6")
FILL_CURVE = PatternFill("solid", fgColor="FEF3C7")
FILL_GANTT_ACTIVE = PatternFill("solid", fgColor="3B82F6")

BORDER_THIN = Border(
    left=Side(style="thin", color="E5E7EB"),
    right=Side(style="thin", color="E5E7EB"),
    top=Side(style="thin", color="E5E7EB"),
    bottom=Side(style="thin", color="E5E7EB"),
)
BORDER_TOTAL = Border(
    left=Side(style="thin", color="D1D5DB"),
    right=Side(style="thin", color="D1D5DB"),
    top=Side(style="thin", color="9CA3AF"),
    bottom=Side(style="double", color="374151"),
)

ALIGN_LEFT = Alignment(horizontal="left", vertical="center")
ALIGN_CENTER = Alignment(horizontal="center", vertical="center")
ALIGN_RIGHT = Alignment(horizontal="right", vertical="center")
ALIGN_HEADER = Alignment(horizontal="center", vertical="center", wrap_text=True)

FMT_CURRENCY = '"$"#,##0.00'
FMT_PERCENT = "0.00%"
FMT_INTEGER = "#,##0"
FMT_DATE = "YYYY-MM-DD"


def generate_cronograma_workbook(
    dataset: Dict[str, Any],
    budget_name: str,
    contractor_name: str = "Constructora",
    contractee_name: str = "Propietario / Ente Contratante",
    location: str = "Ubicación de la obra",
) -> BytesIO:
    """Genera un libro Excel en memoria con las 4 hojas dinámicas."""
    if not isinstance(dataset, dict):
        raise ValueError("dataset debe ser un diccionario válido")
    if not budget_name:
        raise ValueError("budget_name no puede estar vacío")

    wb = openpyxl.Workbook()

    # 1. Crear hojas en el orden oficial
    ws_cronograma_gral = wb.active
    ws_cronograma_gral.title = "Cronograma General"
    ws_cronograma_men = wb.create_sheet("Cronograma Mensual")
    ws_partidas = wb.create_sheet("Partidas")
    ws_ponderacion = wb.create_sheet("Ponderación")

    items = dataset.get("items", [])
    chapters = dataset.get("chapters", [])
    total_weeks = dataset.get("total_weeks", 13)
    start_date = dataset.get("start_date", date.today())
    end_date = dataset.get("end_date", date.today())
    iva_rate = dataset.get("iva_rate", 0.16)
    month_ranges = dataset.get("month_ranges", [])

    # Construir Hoja Ponderación primero (define START, FIN, IVA)
    _build_sheet_ponderacion(
        ws=ws_ponderacion,
        chapters=chapters,
        items=items,
        start_date=start_date,
        end_date=end_date,
        iva_rate=iva_rate,
        total_weeks=total_weeks,
        budget_name=budget_name,
        contractor_name=contractor_name,
        contractee_name=contractee_name,
        location=location,
    )

    # Nombres definidos en el Workbook
    wb.defined_names.add(DefinedName("START", attr_text="'Ponderación'!$C$5"))
    wb.defined_names.add(DefinedName("FIN", attr_text="'Ponderación'!$C$6"))
    wb.defined_names.add(DefinedName("IVA", attr_text="'Ponderación'!$C$7"))

    # Construir Hoja Partidas
    _build_sheet_partidas(
        ws=ws_partidas,
        items=items,
        total_weeks=total_weeks,
        budget_name=budget_name,
        contractor_name=contractor_name,
        contractee_name=contractee_name,
        location=location,
    )

    # Construir Hoja Cronograma General
    _build_sheet_cronograma_general(
        ws=ws_cronograma_gral,
        chapters=chapters,
        items=items,
        total_weeks=total_weeks,
        start_date=start_date,
        end_date=end_date,
        budget_name=budget_name,
        contractor_name=contractor_name,
        contractee_name=contractee_name,
        location=location,
    )

    # Construir Hoja Cronograma Mensual
    _build_sheet_cronograma_mensual(
        ws=ws_cronograma_men,
        chapters=chapters,
        items=items,
        total_weeks=total_weeks,
        month_ranges=month_ranges,
        start_date=start_date,
        end_date=end_date,
        budget_name=budget_name,
        contractor_name=contractor_name,
        contractee_name=contractee_name,
        location=location,
    )

    # Ajustar anchos de columnas en todas las hojas
    for ws in wb.worksheets:
        _auto_adjust_columns(ws)

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def _build_sheet_ponderacion(
    ws: Any,
    chapters: List[Dict[str, Any]],
    items: List[Dict[str, Any]],
    start_date: date,
    end_date: date,
    iva_rate: float,
    total_weeks: int,
    budget_name: str,
    contractor_name: str,
    contractee_name: str,
    location: str,
) -> None:
    ws.views.sheetView[0].showGridLines = True

    # Encabezados institucionales
    ws["B1"] = contractor_name
    ws["B1"].font = FONT_SUBTITLE
    ws["B2"] = budget_name
    ws["B2"].font = FONT_TITLE
    ws["A3"] = f"{location} · Contratante: {contractee_name} · Contratista: {contractor_name}"
    ws["A3"].font = FONT_DESC

    ws["B4"] = "PONDERACIÓN DE CAPÍTULOS"
    ws["B4"].font = FONT_STATUS

    # Constantes globales (START, FIN, IVA)
    ws["B5"] = "Inicio de obra"
    ws["C5"] = start_date.strftime("%Y-%m-%d")
    ws["C5"].alignment = ALIGN_CENTER
    ws["C5"].number_format = FMT_DATE

    ws["B6"] = "Culminación"
    ws["C6"] = end_date.strftime("%Y-%m-%d")
    ws["C6"].alignment = ALIGN_CENTER
    ws["C6"].number_format = FMT_DATE

    ws["B7"] = "IVA"
    ws["C7"] = float(iva_rate)
    ws["C7"].alignment = ALIGN_RIGHT
    ws["C7"].number_format = FMT_PERCENT

    for r in range(5, 8):
        ws.cell(r, 2).font = FONT_DATA_BOLD

    # Encabezado de tabla
    headers = [
        "N°", "Capítulo", "N° partidas", "Monto $", "Peso %",
        "Sem. inicio", "Sem. fin", "Fecha inicio", "Fecha fin",
        "Duración (días)", "Peso acum. %"
    ]
    for col_idx, h in enumerate(headers, start=1):
        c = ws.cell(8, col_idx, h)
        c.font = FONT_TH
        c.fill = FILL_HEADER
        c.alignment = ALIGN_HEADER

    num_items = len(items)
    last_item_row = max(6, 5 + num_items)

    curr_row = 9
    for idx, chap in enumerate(chapters, start=1):
        c_num = ws.cell(curr_row, 1, idx)
        c_num.alignment = ALIGN_CENTER
        c_num.font = FONT_DATA

        c_name = ws.cell(curr_row, 2, chap["name"])
        c_name.alignment = ALIGN_LEFT
        c_name.font = FONT_DATA_BOLD

        # Fórmulas de resumen del capítulo referenciando la hoja 'Partidas'
        c_count = ws.cell(curr_row, 3, f'=COUNTIF(Partidas!$H$6:$H${last_item_row},B{curr_row})')
        c_count.alignment = ALIGN_CENTER
        c_count.font = FONT_DATA
        c_count.number_format = FMT_INTEGER

        c_amt = ws.cell(curr_row, 4, f'=SUMIF(Partidas!$H$6:$H${last_item_row},B{curr_row},Partidas!$G$6:$G${last_item_row})')
        c_amt.alignment = ALIGN_RIGHT
        c_amt.font = FONT_DATA
        c_amt.number_format = FMT_CURRENCY

        subtotal_row = 9 + len(chapters)
        c_weight = ws.cell(curr_row, 5, f'=D{curr_row}/$D${subtotal_row}')
        c_weight.alignment = ALIGN_RIGHT
        c_weight.font = FONT_DATA
        c_weight.number_format = FMT_PERCENT

        c_s_ini = ws.cell(curr_row, 6, f'=_xlfn.MINIFS(Partidas!$J$6:$J${last_item_row},Partidas!$H$6:$H${last_item_row},B{curr_row})')
        c_s_ini.alignment = ALIGN_CENTER
        c_s_ini.font = FONT_DATA
        c_s_ini.number_format = FMT_INTEGER

        c_s_fin = ws.cell(curr_row, 7, f'=_xlfn.MAXIFS(Partidas!$K$6:$K${last_item_row},Partidas!$H$6:$H${last_item_row},B{curr_row})')
        c_s_fin.alignment = ALIGN_CENTER
        c_s_fin.font = FONT_DATA
        c_s_fin.number_format = FMT_INTEGER

        c_f_ini = ws.cell(curr_row, 8, f'=START+7*(F{curr_row}-1)')
        c_f_ini.alignment = ALIGN_CENTER
        c_f_ini.font = FONT_DATA
        c_f_ini.number_format = FMT_DATE

        c_f_fin = ws.cell(curr_row, 9, f'=IF(G{curr_row}>={total_weeks},FIN,START+7*G{curr_row}-1)')
        c_f_fin.alignment = ALIGN_CENTER
        c_f_fin.font = FONT_DATA
        c_f_fin.number_format = FMT_DATE

        c_dur = ws.cell(curr_row, 10, f'=I{curr_row}-H{curr_row}+1')
        c_dur.alignment = ALIGN_CENTER
        c_dur.font = FONT_DATA
        c_dur.number_format = FMT_INTEGER

        c_cum = ws.cell(curr_row, 11, f'=SUM($E$9:E{curr_row})')
        c_cum.alignment = ALIGN_RIGHT
        c_cum.font = FONT_DATA_BOLD
        c_cum.number_format = FMT_PERCENT

        fill = FILL_ZEBRA_EVEN if idx % 2 == 0 else FILL_ZEBRA_ODD
        for c_idx in range(1, 12):
            cell = ws.cell(curr_row, c_idx)
            cell.border = BORDER_THIN
            cell.fill = fill

        curr_row += 1

    # Totales de Ponderación
    last_chap_row = curr_row - 1

    # Subtotal
    ws.cell(curr_row, 2, "SUBTOTAL").font = FONT_DATA_BOLD
    ws.cell(curr_row, 3, f'=SUM(C9:C{last_chap_row})').number_format = FMT_INTEGER
    ws.cell(curr_row, 4, f'=SUM(D9:D{last_chap_row})').number_format = FMT_CURRENCY
    ws.cell(curr_row, 5, f'=SUM(E9:E{last_chap_row})').number_format = FMT_PERCENT
    for c_idx in range(1, 12):
        ws.cell(curr_row, c_idx).font = FONT_DATA_BOLD
        ws.cell(curr_row, c_idx).fill = FILL_TOTAL
        ws.cell(curr_row, c_idx).border = BORDER_THIN

    # IVA
    curr_row += 1
    subtotal_row = curr_row - 1
    ws.cell(curr_row, 2, f"IVA ({int(iva_rate * 100)}%)").font = FONT_DATA_BOLD
    ws.cell(curr_row, 4, f'=$D${subtotal_row}*IVA').number_format = FMT_CURRENCY
    for c_idx in range(1, 12):
        ws.cell(curr_row, c_idx).font = FONT_DATA_BOLD
        ws.cell(curr_row, c_idx).fill = FILL_TOTAL
        ws.cell(curr_row, c_idx).border = BORDER_THIN

    # TOTAL CON IVA
    curr_row += 1
    iva_row = curr_row - 1
    ws.cell(curr_row, 2, "TOTAL").font = FONT_TOTAL
    ws.cell(curr_row, 4, f'=$D${subtotal_row}+$D${iva_row}').number_format = FMT_CURRENCY
    for c_idx in range(1, 12):
        cell = ws.cell(curr_row, c_idx)
        cell.font = FONT_TOTAL
        cell.fill = FILL_TOTAL
        cell.border = BORDER_TOTAL


def _build_sheet_partidas(
    ws: Any,
    items: List[Dict[str, Any]],
    total_weeks: int,
    budget_name: str,
    contractor_name: str,
    contractee_name: str,
    location: str,
) -> None:
    ws.views.sheetView[0].showGridLines = True

    # Encabezado
    ws["A1"] = contractor_name
    ws["A1"].font = FONT_SUBTITLE
    ws["C2"] = budget_name
    ws["C2"].font = FONT_TITLE
    ws["C3"] = f"{location} · Contratante: {contractee_name} · Contratista: {contractor_name}"
    ws["C3"].font = FONT_DESC
    ws["C4"] = "Presupuesto base y programación por partida"
    ws["C4"].font = FONT_STATUS

    # Cabecera de la tabla
    base_headers = [
        "N°", "Código", "Descripción", "Und", "Cantidad",
        "P. Unitario $", "Total $", "Capítulo", "Peso %",
        "Sem. ini", "Sem. fin"
    ]
    for col_idx, h in enumerate(base_headers, start=1):
        c = ws.cell(5, col_idx, h)
        c.font = FONT_TH
        c.fill = FILL_HEADER
        c.alignment = ALIGN_HEADER

    # Columnas de semanas S1..Sn
    for w in range(1, total_weeks + 1):
        col_idx = 11 + w
        c = ws.cell(5, col_idx, f"S{w}")
        c.font = FONT_TH
        c.fill = FILL_HEADER
        c.alignment = ALIGN_CENTER

    num_items = len(items)
    total_row = 6 + num_items

    # Partidas
    for idx, it in enumerate(items, start=1):
        row_num = 5 + idx
        ws.cell(row_num, 1, idx).alignment = ALIGN_CENTER
        ws.cell(row_num, 2, it.get("code") or "").alignment = ALIGN_CENTER
        ws.cell(row_num, 3, it.get("description") or "").alignment = ALIGN_LEFT
        ws.cell(row_num, 4, it.get("unit") or "UND").alignment = ALIGN_CENTER

        c_qty = ws.cell(row_num, 5, float(it.get("quantity") or 0.0))
        c_qty.alignment = ALIGN_RIGHT
        c_qty.number_format = "#,##0.00"

        c_pu = ws.cell(row_num, 6, float(it.get("unit_price") or 0.0))
        c_pu.alignment = ALIGN_RIGHT
        c_pu.number_format = FMT_CURRENCY

        c_total = ws.cell(row_num, 7, f'=ROUND(E{row_num}*F{row_num},2)')
        c_total.alignment = ALIGN_RIGHT
        c_total.number_format = FMT_CURRENCY

        ws.cell(row_num, 8, it.get("chapter") or "General").alignment = ALIGN_LEFT

        c_weight = ws.cell(row_num, 9, f'=G{row_num}/$G${total_row}')
        c_weight.alignment = ALIGN_RIGHT
        c_weight.number_format = FMT_PERCENT

        c_s_ini = ws.cell(row_num, 10, int(it.get("start_week") or 1))
        c_s_ini.alignment = ALIGN_CENTER
        c_s_ini.number_format = FMT_INTEGER

        c_s_fin = ws.cell(row_num, 11, int(it.get("end_week") or total_weeks))
        c_s_fin.alignment = ALIGN_CENTER
        c_s_fin.number_format = FMT_INTEGER

        # Semanas S1..Sn
        for w in range(1, total_weeks + 1):
            col_idx = 11 + w
            col_letter = get_column_letter(col_idx)
            # Fórmula: =IF(AND(week_num>=$J, week_num<=$K), $G/($K-$J+1), 0)
            c_week = ws.cell(
                row_num,
                col_idx,
                f'=IF(AND({w}>=$J{row_num},{w}<=$K{row_num}),$G{row_num}/($K{row_num}-$J{row_num}+1),0)'
            )
            c_week.alignment = ALIGN_RIGHT
            c_week.number_format = FMT_CURRENCY

        fill = FILL_ZEBRA_EVEN if idx % 2 == 0 else FILL_ZEBRA_ODD
        for c_idx in range(1, 12 + total_weeks):
            cell = ws.cell(row_num, c_idx)
            cell.font = FONT_DATA
            cell.border = BORDER_THIN
            cell.fill = fill

    # Fila de Totales
    ws.cell(total_row, 3, "TOTAL PRESUPUESTO").font = FONT_TOTAL
    ws.cell(total_row, 7, f'=SUM(G6:G{total_row - 1})').number_format = FMT_CURRENCY
    ws.cell(total_row, 9, f'=SUM(I6:I{total_row - 1})').number_format = FMT_PERCENT

    for w in range(1, total_weeks + 1):
        col_idx = 11 + w
        col_letter = get_column_letter(col_idx)
        c_tot = ws.cell(total_row, col_idx, f'=SUM({col_letter}6:{col_letter}{total_row - 1})')
        c_tot.number_format = FMT_CURRENCY

    for c_idx in range(1, 12 + total_weeks):
        cell = ws.cell(total_row, c_idx)
        cell.font = FONT_TOTAL
        cell.fill = FILL_TOTAL
        cell.border = BORDER_TOTAL


def _build_sheet_cronograma_general(
    ws: Any,
    chapters: List[Dict[str, Any]],
    items: List[Dict[str, Any]],
    total_weeks: int,
    start_date: date,
    end_date: date,
    budget_name: str,
    contractor_name: str,
    contractee_name: str,
    location: str,
) -> None:
    ws.views.sheetView[0].showGridLines = True

    # Encabezado
    ws["A1"] = contractor_name
    ws["A1"].font = FONT_SUBTITLE
    ws["A2"] = budget_name
    ws["A2"].font = FONT_TITLE
    ws["A3"] = f"{location} · Contratante: {contractee_name} · Contratista: {contractor_name}"
    ws["A3"].font = FONT_DESC

    status_text = f"CRONOGRAMA GENERAL DE EJECUCIÓN · Inicio {start_date.strftime('%d/%m/%Y')} · Culminación {end_date.strftime('%d/%m/%Y')} · {total_weeks} semanas"
    ws["A4"] = status_text
    ws["A4"].font = FONT_STATUS

    # Cabeceras de semanas (Filas 6 a 9)
    ws["A6"] = "N°"
    ws["B7"] = "ACTIVIDAD / CAPÍTULO"
    ws["C6"] = "Monto $"
    ws["D6"] = "Peso %"

    for r, c in [(6, 1), (6, 3), (6, 4)]:
        ws.cell(r, c).font = FONT_TH
        ws.cell(r, c).fill = FILL_HEADER
        ws.cell(r, c).alignment = ALIGN_HEADER

    ws.cell(7, 2).font = FONT_TH
    ws.cell(7, 2).fill = FILL_HEADER
    ws.cell(7, 2).alignment = ALIGN_LEFT

    for w in range(1, total_weeks + 1):
        col_idx = 4 + w
        c_s = ws.cell(7, col_idx, f"S{w}")
        c_s.font = FONT_TH
        c_s.fill = FILL_HEADER
        c_s.alignment = ALIGN_CENTER

        # Fechas de la semana
        c_f_ini = ws.cell(8, col_idx, f'=START+7*({w}-1)')
        c_f_ini.alignment = ALIGN_CENTER
        c_f_ini.font = FONT_DESC
        c_f_ini.number_format = FMT_DATE

        c_f_fin = ws.cell(9, col_idx, f'=IF({w}>={total_weeks},FIN,START+7*{w}-1)')
        c_f_fin.alignment = ALIGN_CENTER
        c_f_fin.font = FONT_DESC
        c_f_fin.number_format = FMT_DATE

    num_items = len(items)
    last_item_row = max(6, 5 + num_items)
    partidas_total_row = 6 + num_items

    curr_row = 10
    start_gantt_row = curr_row

    for idx, chap in enumerate(chapters, start=1):
        # Fila principal de capítulo
        c_num = ws.cell(curr_row, 1, idx)
        c_num.alignment = ALIGN_CENTER
        c_num.font = FONT_CHAPTER
        c_num.fill = FILL_CHAPTER

        c_name = ws.cell(curr_row, 2, chap["name"])
        c_name.alignment = ALIGN_LEFT
        c_name.font = FONT_CHAPTER
        c_name.fill = FILL_CHAPTER

        c_amt = ws.cell(curr_row, 3, f'=SUMIF(Partidas!$H$6:$H${last_item_row},B{curr_row},Partidas!$G$6:$G${last_item_row})')
        c_amt.alignment = ALIGN_RIGHT
        c_amt.font = FONT_CHAPTER
        c_amt.fill = FILL_CHAPTER
        c_amt.number_format = FMT_CURRENCY

        c_pct = ws.cell(curr_row, 4, f'=C{curr_row}/Partidas!$G${partidas_total_row}')
        c_pct.alignment = ALIGN_RIGHT
        c_pct.font = FONT_CHAPTER
        c_pct.fill = FILL_CHAPTER
        c_pct.number_format = FMT_PERCENT

        # Semanas vinculadas con SUMIF a la columna respectiva de la hoja Partidas
        for w in range(1, total_weeks + 1):
            col_idx = 4 + w
            col_letter = get_column_letter(11 + w)
            c_w = ws.cell(
                curr_row,
                col_idx,
                f'=SUMIF(Partidas!$H$6:$H${last_item_row},$B{curr_row},Partidas!{col_letter}$6:{col_letter}${last_item_row})'
            )
            c_w.alignment = ALIGN_RIGHT
            c_w.font = FONT_DATA
            c_w.border = BORDER_THIN
            c_w.number_format = FMT_CURRENCY

        curr_row += 1

    end_gantt_row = curr_row - 1

    # Filas de Totales y Curva S (Pie)
    # Fila: Inversión Semanal
    r_inv = curr_row
    ws.cell(r_inv, 2, "INVERSIÓN SEMANAL ($)").font = FONT_TOTAL
    ws.cell(r_inv, 3, f'=SUM(C10:C{end_gantt_row})').number_format = FMT_CURRENCY
    ws.cell(r_inv, 4, f'=SUM(D10:D{end_gantt_row})').number_format = FMT_PERCENT

    for w in range(1, total_weeks + 1):
        col_idx = 4 + w
        col_letter = get_column_letter(col_idx)
        c_sum = ws.cell(r_inv, col_idx, f'=SUM({col_letter}10:{col_letter}{end_gantt_row})')
        c_sum.number_format = FMT_CURRENCY

    for c_idx in range(1, 5 + total_weeks):
        ws.cell(r_inv, c_idx).font = FONT_TOTAL
        ws.cell(r_inv, c_idx).fill = FILL_TOTAL
        ws.cell(r_inv, c_idx).border = BORDER_THIN

    # Fila: % Semanal
    curr_row += 1
    r_pct = curr_row
    ws.cell(r_pct, 2, "% SEMANAL PROGRAMADO").font = FONT_DATA_BOLD
    ws.cell(r_pct, 4, f'=D{r_inv}').number_format = FMT_PERCENT

    for w in range(1, total_weeks + 1):
        col_idx = 4 + w
        col_letter = get_column_letter(col_idx)
        c_p = ws.cell(r_pct, col_idx, f'={col_letter}{r_inv}/$C${r_inv}')
        c_p.number_format = FMT_PERCENT
        c_p.font = FONT_DATA_BOLD

    for c_idx in range(1, 5 + total_weeks):
        ws.cell(r_pct, c_idx).fill = FILL_TOTAL
        ws.cell(r_pct, c_idx).border = BORDER_THIN

    # Fila: Curva S Programada (% Acumulado)
    curr_row += 1
    r_curva = curr_row
    ws.cell(r_curva, 2, "CURVA S (AVANCE PROGRAMADO ACUMULADO)").font = Font(name="Arial", size=9, bold=True, color="92400E")
    ws.cell(r_curva, 4, "100.00%").font = Font(name="Arial", size=9, bold=True, color="92400E")

    start_col_letter = get_column_letter(5)
    for w in range(1, total_weeks + 1):
        col_idx = 4 + w
        col_letter = get_column_letter(col_idx)
        c_c = ws.cell(r_curva, col_idx, f'=SUM(${start_col_letter}${r_pct}:{col_letter}${r_pct})')
        c_c.number_format = FMT_PERCENT
        c_c.font = Font(name="Arial", size=9, bold=True, color="92400E")

    for c_idx in range(1, 5 + total_weeks):
        ws.cell(r_curva, c_idx).fill = FILL_CURVE
        ws.cell(r_curva, c_idx).border = BORDER_TOTAL

    # Regla de Formato Condicional (Gantt visual activo)
    first_week_col = get_column_letter(5)
    last_week_col = get_column_letter(4 + total_weeks)
    gantt_range = f"{first_week_col}10:{last_week_col}{end_gantt_row}"

    rule_gantt = FormulaRule(
        formula=[f"AND({first_week_col}10>0,$A10<>'')"],
        stopIfTrue=True,
        fill=FILL_GANTT_ACTIVE,
        font=Font(name="Arial", size=8, bold=True, color="FFFFFF"),
    )
    ws.conditional_formatting.add(gantt_range, rule_gantt)


def _build_sheet_cronograma_mensual(
    ws: Any,
    chapters: List[Dict[str, Any]],
    items: List[Dict[str, Any]],
    total_weeks: int,
    month_ranges: List[Dict[str, Any]],
    start_date: date,
    end_date: date,
    budget_name: str,
    contractor_name: str,
    contractee_name: str,
    location: str,
) -> None:
    ws.views.sheetView[0].showGridLines = True

    # Encabezado
    ws["A1"] = contractor_name
    ws["A1"].font = FONT_SUBTITLE
    ws["C2"] = budget_name
    ws["C2"].font = FONT_TITLE
    ws["C3"] = f"{location} · Contratante: {contractee_name} · Contratista: {contractor_name}"
    ws["C3"].font = FONT_DESC
    ws["C4"] = "CRONOGRAMA GENERAL POR MES · Ejecución física y valorizada programada por mes calendario"
    ws["C4"].font = FONT_STATUS

    # Cabecera de tabla
    ws["A6"] = "N°"
    ws["B6"] = "Capítulo"
    for col_idx, cell_ref in enumerate([(6, 1), (6, 2)], start=1):
        ws.cell(cell_ref[0], cell_ref[1]).font = FONT_TH
        ws.cell(cell_ref[0], cell_ref[1]).fill = FILL_HEADER

    num_months = len(month_ranges)
    for m_idx, m in enumerate(month_ranges, start=1):
        col_idx = 2 + m_idx
        c = ws.cell(6, col_idx, m["label"])
        c.font = FONT_TH
        c.fill = FILL_HEADER
        c.alignment = ALIGN_CENTER

    col_tot = 3 + num_months
    ws.cell(6, col_tot, "Total $").font = FONT_TH
    ws.cell(6, col_tot).fill = FILL_HEADER
    ws.cell(6, col_tot).alignment = ALIGN_RIGHT

    col_pct = 4 + num_months
    ws.cell(6, col_pct, "Peso %").font = FONT_TH
    ws.cell(6, col_pct).fill = FILL_HEADER
    ws.cell(6, col_pct).alignment = ALIGN_RIGHT

    # Filas de prorrateo al pie de la hoja para alimentar el SUMPRODUCT
    # Calculamos la posición donde iniciará la tabla auxiliar de fracciones
    frac_table_start_row = 15 + len(chapters)
    ws.cell(frac_table_start_row - 2, 2, "Prorrateo de cada semana por mes calendario (días del mes en la semana ÷ días de la semana)").font = FONT_DATA_BOLD

    r_sem_desde = frac_table_start_row - 1
    r_sem_hasta = frac_table_start_row
    ws.cell(r_sem_desde, 2, "Semana desde").font = FONT_DATA_BOLD
    ws.cell(r_sem_hasta, 2, "Semana hasta").font = FONT_DATA_BOLD

    for w in range(1, total_weeks + 1):
        col_idx = 2 + w
        c_d = ws.cell(r_sem_desde, col_idx, f'=START+7*({w}-1)')
        c_d.number_format = FMT_DATE
        c_h = ws.cell(r_sem_hasta, col_idx, f'=IF({w}>={total_weeks},FIN,START+7*{w}-1)')
        c_h.number_format = FMT_DATE

    month_frac_rows: List[int] = []
    for m_idx, m in enumerate(month_ranges, start=1):
        f_row = frac_table_start_row + m_idx
        month_frac_rows.append(f_row)
        ws.cell(f_row, 2, f"Fracción {m['code']}").font = FONT_DATA

        m_y = m["year"]
        m_m = m["month"]
        first_d = m["calendar_first"].day
        last_d = m["calendar_last"].day

        for w in range(1, total_weeks + 1):
            col_idx = 2 + w
            col_letter = get_column_letter(col_idx)
            # Fórmula: =MAX(0, MIN(Sem_hasta, DATE(y,m,last)) - MAX(Sem_desde, DATE(y,m,first)) + 1) / (Sem_hasta - Sem_desde + 1)
            f_formula = (
                f'=MAX(0,MIN({col_letter}{r_sem_hasta},DATE({m_y},{m_m},{last_d}))'
                f'-MAX({col_letter}{r_sem_desde},DATE({m_y},{m_m},{first_d}))+1)'
                f'/({col_letter}{r_sem_hasta}-{col_letter}{r_sem_desde}+1)'
            )
            c_f = ws.cell(f_row, col_idx, f_formula)
            c_f.number_format = "0.0000"
            c_f.font = FONT_DATA

    # Rellenar tabla mensual de capítulos con SUMPRODUCT
    first_w_col = get_column_letter(5)
    last_w_col = get_column_letter(4 + total_weeks)
    first_frac_col = get_column_letter(3)
    last_frac_col = get_column_letter(2 + total_weeks)

    curr_row = 7
    for idx, chap in enumerate(chapters, start=1):
        cg_row = 9 + idx  # Fila correspondiente en Cronograma General
        ws.cell(curr_row, 1, idx).alignment = ALIGN_CENTER
        ws.cell(curr_row, 2, chap["name"]).alignment = ALIGN_LEFT

        for m_idx, _ in enumerate(month_ranges):
            col_idx = 3 + m_idx
            frac_row = month_frac_rows[m_idx]
            # Fórmula SUMPRODUCT: =SUMPRODUCT('Cronograma General'!E10:Q10, $C$58:$O$58)
            sp_formula = f"=SUMPRODUCT('Cronograma General'!{first_w_col}{cg_row}:{last_w_col}{cg_row},${first_frac_col}${frac_row}:${last_frac_col}${frac_row})"
            c_m = ws.cell(curr_row, col_idx, sp_formula)
            c_m.alignment = ALIGN_RIGHT
            c_m.number_format = FMT_CURRENCY

        # Total fila y porcentaje
        first_m_letter = get_column_letter(3)
        last_m_letter = get_column_letter(2 + num_months)
        subtotal_row = 7 + len(chapters)

        c_tot = ws.cell(curr_row, col_tot, f'=SUM({first_m_letter}{curr_row}:{last_m_letter}{curr_row})')
        c_tot.alignment = ALIGN_RIGHT
        c_tot.number_format = FMT_CURRENCY

        c_p = ws.cell(curr_row, col_pct, f'={get_column_letter(col_tot)}{curr_row}/$D${subtotal_row}')
        c_p.alignment = ALIGN_RIGHT
        c_p.number_format = FMT_PERCENT

        fill = FILL_ZEBRA_EVEN if idx % 2 == 0 else FILL_ZEBRA_ODD
        for c_idx in range(1, col_pct + 1):
            cell = ws.cell(curr_row, c_idx)
            cell.font = FONT_DATA
            cell.border = BORDER_THIN
            cell.fill = fill

        curr_row += 1

    # Fila de Totales Mensuales
    last_chap_row = curr_row - 1
    r_tot_m = curr_row

    ws.cell(r_tot_m, 2, "TOTAL MENSUAL ($)").font = FONT_TOTAL
    for m_idx in range(num_months):
        col_idx = 3 + m_idx
        col_letter = get_column_letter(col_idx)
        c_sum = ws.cell(r_tot_m, col_idx, f'=SUM({col_letter}7:{col_letter}{last_chap_row})')
        c_sum.number_format = FMT_CURRENCY

    tot_letter = get_column_letter(col_tot)
    ws.cell(r_tot_m, col_tot, f'=SUM({tot_letter}7:{tot_letter}{last_chap_row})').number_format = FMT_CURRENCY
    ws.cell(r_tot_m, col_pct, "100.00%").number_format = FMT_PERCENT

    for c_idx in range(1, col_pct + 1):
        ws.cell(r_tot_m, c_idx).font = FONT_TOTAL
        ws.cell(r_tot_m, c_idx).fill = FILL_TOTAL
        ws.cell(r_tot_m, c_idx).border = BORDER_TOTAL

    # Fila: % Mensual Programado
    curr_row += 1
    r_pct_m = curr_row
    ws.cell(r_pct_m, 2, "% MENSUAL PROGRAMADO").font = FONT_DATA_BOLD

    for m_idx in range(num_months):
        col_idx = 3 + m_idx
        col_letter = get_column_letter(col_idx)
        c_p = ws.cell(r_pct_m, col_idx, f'={col_letter}{r_tot_m}/${tot_letter}${r_tot_m}')
        c_p.number_format = FMT_PERCENT

    for c_idx in range(1, col_pct + 1):
        ws.cell(r_pct_m, c_idx).font = FONT_DATA_BOLD
        ws.cell(r_pct_m, c_idx).fill = FILL_TOTAL
        ws.cell(r_pct_m, c_idx).border = BORDER_THIN

    # Fila: Curva S Mensual
    curr_row += 1
    r_curva_m = curr_row
    ws.cell(r_curva_m, 2, "CURVA S MENSUAL (ACUMULADO)").font = Font(name="Arial", size=9, bold=True, color="92400E")

    start_m_letter = get_column_letter(3)
    for m_idx in range(num_months):
        col_idx = 3 + m_idx
        col_letter = get_column_letter(col_idx)
        c_cm = ws.cell(r_curva_m, col_idx, f'=SUM(${start_m_letter}${r_pct_m}:{col_letter}${r_pct_m})')
        c_cm.number_format = FMT_PERCENT
        c_cm.font = Font(name="Arial", size=9, bold=True, color="92400E")

    for c_idx in range(1, col_pct + 1):
        ws.cell(r_curva_m, c_idx).fill = FILL_CURVE
        ws.cell(r_curva_m, c_idx).border = BORDER_TOTAL

    # Escala de calor condicional para el cronograma mensual
    if num_months > 0:
        cs_first_col = get_column_letter(3)
        cs_last_col = get_column_letter(2 + num_months)
        cs_range = f"{cs_first_col}7:{cs_last_col}{last_chap_row}"
        rule_cs = ColorScaleRule(start_type="min", start_color="FFFFFF", end_type="max", end_color="93C5FD")
        ws.conditional_formatting.add(cs_range, rule_cs)


def _auto_adjust_columns(ws: Any) -> None:
    """Calcula el ancho óptimo de cada columna para que nada quede recortado."""
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val = str(cell.value or "")
            if val.startswith("="):
                # Para fórmulas estimamos un tamaño prudente
                val_len = 10
            else:
                val_len = len(val)
            if val_len > max_len:
                max_len = val_len
        # Limitar ancho razonable
        adjusted_width = min(60, max(max_len + 3, 10))
        ws.column_dimensions[col_letter].width = adjusted_width
