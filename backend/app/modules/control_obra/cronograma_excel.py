"""Generador de libro Excel para Cronograma General de Obras y Curva S.

Replica con fidelidad el estándar de 4 hojas interconectadas dinámicamente con fórmulas:
1. 'Cronograma General': Vista ejecutiva, desembolsos semanales, Gantt visual y Curva S.
2. 'Cronograma Mensual': Prorrateo a meses calendario con SUMPRODUCT y Curva S mensual.
3. 'Partidas': Presupuesto desglosado con distribución uniforme S1..Sn y pesos %.
4. 'Ponderación': Nombres definidos (START, FIN, IVA), duraciones y fechas por capítulo.
"""
from __future__ import annotations

import math
from datetime import date, timedelta
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

SPANISH_MONTHS = [
    "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


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
        month_ranges=month_ranges,
        week_ranges=dataset.get("week_ranges", []),
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
        chapter_rows=_general_chapter_rows(chapters, items),
        start_date=start_date,
        end_date=end_date,
        budget_name=budget_name,
        contractor_name=contractor_name,
        contractee_name=contractee_name,
        location=location,
    )

    # Ajustar anchos de columnas en las hojas de detalle; las hojas ejecutivas
    # conservan el ancho fijo del modelo.
    for ws in wb.worksheets:
        if ws.title not in ("Cronograma General", "Cronograma Mensual"):
            _auto_adjust_columns(ws)

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def _normalize_text(value: Any) -> str:
    text = str(value or "").upper()
    replacements = {
        "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U", "Ü": "U", "Ñ": "N",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return " ".join(text.split())


_ACTIVITY_KEYWORDS = [
    (("ESTUDIO", "GEOTECN", "PATOLOG", "VERTICAL"), "Estudios y diagnósticos"),
    (("REPLANTEO",), "Replanteo"),
    (("LIMPIEZA", "DESMALEZ"), "Limpieza y desmalezamiento"),
    (("PODA", "TALA", "DESRAIZ"), "Poda y tala"),
    (("DEMOLICION", "REMOCION", "DESMONTAJE", "APUNTALAMIENTO"), "Demoliciones y desmontajes"),
    (("EXCAVACION",), "Excavación"),
    (("FUNDACION", "RIOSTRA", "ZAPATA"), "Fundaciones"),
    (("CONCRETO",), "Concreto"),
    (("ACERO", "CABILLA", "MALLA"), "Acero de refuerzo"),
    (("ENCOFRADO",), "Encofrado"),
    (("PARED", "BLOQUE", "MAMPOST"), "Paredes y mampostería"),
    (("FRISO", "REVOQUE", "ENLUCIDO", "RESANE"), "Frisos y revoques"),
    (("PINTURA", "BARNIZ"), "Pintura"),
    (("IMPERMEAB", "MANTO"), "Impermeabilización"),
    (("ELECTRIC", "CABLE", "LUMINARIA", "TABLERO"), "Instalaciones eléctricas"),
    (("SANITAR", "AGUA", "DESAG", "TUBERIA"), "Instalaciones sanitarias"),
    (("AIRE", "CLIMAT", "SPLIT"), "Climatización"),
    (("CCTV", "CAMARA", "SEGURIDAD"), "CCTV y seguridad"),
    (("INCENDIO", "DETECC"), "Detección de incendios"),
    (("PUERTA", "VENTANA", "CARPINTER"), "Carpintería y ventanería"),
    (("TECHO", "LAMINA", "CIELO RASO"), "Techos y cielo raso"),
    (("PISO", "CERAMICA", "GRANITO"), "Pisos y acabados"),
    (("CARGA", "BOTE", "ESCOMBRO"), "Carga y bote"),
]


def _activity_name(description: str) -> str:
    normalized = _normalize_text(description)
    for keywords, label in _ACTIVITY_KEYWORDS:
        if any(keyword in normalized for keyword in keywords):
            return label
    words = description.strip().split()
    return " ".join(words[:6]).title() if words else "Actividades"


def _group_chapter_items(chapter_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Agrupa partidas consecutivas en bloques de actividad para el desglose.

    El modelo UKATIRA usa pocas filas de detalle por capítulo. Se conserva ese
    nivel de detalle agrupando las partidas en bloques contiguos de tamaño
    equilibrado, sin crear una fila por cada partida.
    """
    if not chapter_items:
        return []

    total = len(chapter_items)
    target_groups = max(1, math.ceil(total / 7))
    chunk_size = max(1, math.ceil(total / target_groups))
    groups: List[Dict[str, Any]] = []

    for start in range(0, total, chunk_size):
        block = chapter_items[start:start + chunk_size]
        if not block:
            continue
        activity_counts: Dict[str, int] = {}
        for item in block:
            activity = _activity_name(item.get("description", ""))
            activity_counts[activity] = activity_counts.get(activity, 0) + 1
        activity = max(activity_counts, key=activity_counts.get)
        groups.append({"activity": activity, "items": block})
    return groups


def _general_chapter_rows(chapters: List[Dict[str, Any]], items: List[Dict[str, Any]]) -> List[int]:
    """Devuelve la fila de cada capítulo en 'Cronograma General'."""
    rows: List[int] = []
    current = 10
    for chap in chapters:
        rows.append(current)
        chapter_items = [
            item for item in items
            if _normalize_text(item.get("chapter")) == _normalize_text(chap["name"])
        ]
        current += 1 + len(_group_chapter_items(chapter_items))
    return rows


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

    for rng in ("B1:K1", "B2:K2", "A3:K3", "B4:K4"):
        ws.merge_cells(rng)

    # Constantes globales (START, FIN, IVA)
    ws["B5"] = "Inicio de obra"
    ws["C5"] = start_date
    ws["C5"].alignment = ALIGN_CENTER
    ws["C5"].number_format = "DD/MM/YYYY"

    ws["B6"] = "Culminación"
    ws["C6"] = end_date
    ws["C6"].alignment = ALIGN_CENTER
    ws["C6"].number_format = "DD/MM/YYYY"

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

    for rng in ("A1:O1", "C2:P2", "C3:O3"):
        ws.merge_cells(rng)

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
    month_ranges: List[Dict[str, Any]],
    week_ranges: List[Any],
    budget_name: str,
    contractor_name: str,
    contractee_name: str,
    location: str,
) -> None:
    ws.views.sheetView[0].showGridLines = False

    # Encabezado
    ws["A1"] = contractor_name
    ws["A1"].font = Font(name="Arial", size=16, bold=True, color="374151")
    ws["A1"].alignment = ALIGN_CENTER
    ws["A2"] = budget_name
    ws["A2"].font = FONT_TITLE
    ws["A2"].alignment = ALIGN_CENTER
    ws["B3"] = f"{location} · Contratante: {contractee_name} · Contratista: {contractor_name}"
    ws["B3"].font = Font(name="Arial", size=12, bold=False, color="6B7280")
    ws["B3"].alignment = ALIGN_CENTER

    status_text = f"CRONOGRAMA GENERAL DE EJECUCIÓN  ·  Inicio {start_date.strftime('%d/%m/%Y')}  ·  Culminación {end_date.strftime('%d/%m/%Y')}  ·  {total_weeks} semanas"
    ws["A4"] = status_text
    ws["A4"].font = FONT_STATUS
    ws["A4"].alignment = ALIGN_CENTER

    last_sheet_col = get_column_letter(4 + total_weeks)
    for rng in (f"A1:{last_sheet_col}1", f"A2:{last_sheet_col}2", f"B3:{last_sheet_col}3", f"A4:{last_sheet_col}4"):
        ws.merge_cells(rng)

    # Cabeceras de semanas (Filas 6 a 9)
    ws["A6"] = "N°"
    ws["B7"] = "ACTIVIDAD / CAPÍTULO"
    ws["C6"] = "Monto $"
    ws["D6"] = "Peso %"

    for rng in ("A6:A9", "C6:C9", "D6:D9"):
        ws.merge_cells(rng)

    for row, col in ((6, 1), (7, 2), (6, 3), (6, 4)):
        cell = ws.cell(row, col)
        cell.font = FONT_TH
        cell.fill = FILL_HEADER
        cell.alignment = ALIGN_HEADER

    # Banda de meses: cada semana se asigna al mes que contiene la mayoría de sus días.
    week_end_months = []
    for w_start, w_end in week_ranges:
        day_counts: Dict[tuple, int] = {}
        for offset in range((w_end - w_start).days + 1):
            current = w_start + timedelta(days=offset)
            key = (current.year, current.month)
            day_counts[key] = day_counts.get(key, 0) + 1
        week_end_months.append(max(day_counts, key=day_counts.get))
    month_bands = []
    for m in month_ranges:
        indices = [
            idx for idx, (year, month) in enumerate(week_end_months)
            if year == m["year"] and month == m["month"]
        ]
        if indices:
            month_bands.append((m, min(indices), max(indices)))

    if month_bands:
        first_band_month, _, _ = month_bands[0]
        first_col = 5
        first_label = first_band_month["code"].split("-")[0].upper()
        ws.cell(6, first_col, first_label)
        ws.cell(6, first_col).font = FONT_TH
        ws.cell(6, first_col).fill = FILL_HEADER
        ws.cell(6, first_col).alignment = ALIGN_HEADER

        previous_end_col = first_col
        for m, start_idx, end_idx in month_bands[1:]:
            start_col = 5 + start_idx
            end_col = 5 + end_idx
            if start_col <= previous_end_col:
                start_col = previous_end_col + 1
            if end_col < start_col:
                continue
            if end_col > start_col:
                ws.merge_cells(start_row=6, start_column=start_col, end_row=6, end_column=end_col)
            cell = ws.cell(6, start_col, m["code"].upper())
            cell.font = FONT_TH
            cell.fill = FILL_HEADER
            cell.alignment = ALIGN_HEADER
            previous_end_col = end_col

    if week_ranges:
        first_week_start, first_week_end = week_ranges[0]
        ws.cell(
            8,
            2,
            f"Semana 1 = {first_week_start.strftime('%d')} al {first_week_end.strftime('%d')} de {SPANISH_MONTHS[first_week_end.month]} de {first_week_end.year}",
        )
        ws.cell(8, 2).font = FONT_DESC
        ws.cell(8, 2).alignment = ALIGN_LEFT

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
        c_f_ini.number_format = "DD/MM/YYYY"

        c_f_fin = ws.cell(9, col_idx, f'=IF({w}>={total_weeks},FIN,START+7*{w}-1)')
        c_f_fin.alignment = ALIGN_CENTER
        c_f_fin.font = FONT_DESC
        c_f_fin.number_format = "DD/MM/YYYY"

    ws.row_dimensions[1].height = 21.75
    ws.row_dimensions[2].height = 18
    ws.row_dimensions[3].height = 18
    ws.row_dimensions[4].height = 18

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
        c_num.border = BORDER_THIN

        c_name = ws.cell(curr_row, 2, chap["name"])
        c_name.alignment = ALIGN_LEFT
        c_name.font = FONT_CHAPTER
        c_name.fill = FILL_CHAPTER
        c_name.border = BORDER_THIN

        c_amt = ws.cell(curr_row, 3, f'=SUMIF(Partidas!$H$6:$H${last_item_row},B{curr_row},Partidas!$G$6:$G${last_item_row})')
        c_amt.alignment = ALIGN_RIGHT
        c_amt.font = FONT_CHAPTER
        c_amt.fill = FILL_CHAPTER
        c_amt.number_format = FMT_CURRENCY
        c_amt.border = BORDER_THIN

        c_pct = ws.cell(curr_row, 4, f'=C{curr_row}/Partidas!$G${partidas_total_row}')
        c_pct.alignment = ALIGN_RIGHT
        c_pct.font = FONT_CHAPTER
        c_pct.fill = FILL_CHAPTER
        c_pct.number_format = FMT_PERCENT
        c_pct.border = BORDER_THIN

        # Semanas vinculadas con SUMIF a la columna respectiva de la hoja Partidas
        for w in range(1, total_weeks + 1):
            col_idx = 4 + w
            col_letter = get_column_letter(11 + w)
            c_w = ws.cell(
                curr_row,
                col_idx,
                f'=SUMIF(Partidas!$H$6:$H${last_item_row},$B{curr_row},Partidas!{col_letter}$6:{col_letter}${last_item_row})'
            )
            c_w.alignment = ALIGN_CENTER
            c_w.font = FONT_CHAPTER
            c_w.fill = FILL_CHAPTER
            c_w.border = BORDER_THIN
            c_w.number_format = ";;;"

        curr_row += 1

        # Filas de detalle: agrupa partidas consecutivas por tipo de actividad.
        chapter_items = [
            item for item in items
            if _normalize_text(item.get("chapter")) == _normalize_text(chap["name"])
        ]
        for group in _group_chapter_items(chapter_items):
            group_items = group["items"]
            first_num = min(int(item.get("num") or 0) for item in group_items)
            last_num = max(int(item.get("num") or 0) for item in group_items)
            range_label = str(first_num) if first_num == last_num else f"{first_num}–{last_num}"
            detail_font = Font(name="Arial", size=10, color="111827")
            ws.row_dimensions[curr_row].height = 25.5

            ws.cell(curr_row, 1, range_label).font = detail_font
            ws.cell(curr_row, 1).alignment = ALIGN_CENTER
            ws.cell(curr_row, 1).border = BORDER_THIN

            ws.cell(curr_row, 2, group["activity"]).font = detail_font
            ws.cell(curr_row, 2).alignment = ALIGN_LEFT
            ws.cell(curr_row, 2).border = BORDER_THIN

            c_detail_amt = ws.cell(
                curr_row,
                3,
                f'=SUMIFS(Partidas!$G$6:$G${last_item_row},Partidas!$A$6:$A${last_item_row},">="&{first_num},Partidas!$A$6:$A${last_item_row},"<="&{last_num})',
            )
            c_detail_amt.font = detail_font
            c_detail_amt.alignment = ALIGN_RIGHT
            c_detail_amt.number_format = FMT_CURRENCY
            c_detail_amt.border = BORDER_THIN

            c_detail_pct = ws.cell(curr_row, 4, f"=C{curr_row}/Partidas!$G${partidas_total_row}")
            c_detail_pct.font = detail_font
            c_detail_pct.alignment = ALIGN_RIGHT
            c_detail_pct.number_format = FMT_PERCENT
            c_detail_pct.border = BORDER_THIN

            for w in range(1, total_weeks + 1):
                col_idx = 4 + w
                col_letter = get_column_letter(11 + w)
                c_detail_week = ws.cell(
                    curr_row,
                    col_idx,
                    f'=SUMIFS(Partidas!{col_letter}$6:{col_letter}${last_item_row},Partidas!$A$6:$A${last_item_row},">="&{first_num},Partidas!$A$6:$A${last_item_row},"<="&{last_num})',
                )
                c_detail_week.font = detail_font
                c_detail_week.alignment = ALIGN_CENTER
                c_detail_week.number_format = ";;;"
                c_detail_week.border = BORDER_THIN

            curr_row += 1

    end_gantt_row = curr_row - 1

    # Filas de control y Curva S, con el mismo orden del modelo UKATIRA.
    footer_fill = PatternFill("solid", fgColor="E5E7EB")
    r_fis = curr_row
    r_fis_cum = curr_row + 1
    r_inv = curr_row + 2
    r_inv_cum = curr_row + 3

    ws.cell(r_fis, 2, "Avance físico programado en la semana (%)")
    ws.cell(r_fis_cum, 2, "Avance físico acumulado programado (%)")
    ws.cell(r_inv, 2, "Inversión programada en la semana ($, sin IVA)")
    ws.cell(r_inv_cum, 2, "Inversión acumulada ($, sin IVA)")

    for w in range(1, total_weeks + 1):
        col_idx = 4 + w
        col_letter = get_column_letter(col_idx)

        c_fis = ws.cell(
            r_fis,
            col_idx,
            f"=Partidas!{get_column_letter(11 + w)}{partidas_total_row}/Partidas!$G${partidas_total_row}",
        )
        c_fis.number_format = FMT_PERCENT

        c_fis_cum = ws.cell(r_fis_cum, col_idx, f"=SUM($E{r_fis}:{col_letter}{r_fis})")
        c_fis_cum.number_format = FMT_PERCENT

        c_inv = ws.cell(r_inv, col_idx, f"=Partidas!{get_column_letter(11 + w)}{partidas_total_row}")
        c_inv.number_format = FMT_CURRENCY

        c_inv_cum = ws.cell(r_inv_cum, col_idx, f"=SUM($E{r_inv}:{col_letter}{r_inv})")
        c_inv_cum.number_format = FMT_CURRENCY

    for row in (r_fis, r_fis_cum, r_inv, r_inv_cum):
        for c_idx in range(1, 5 + total_weeks):
            cell = ws.cell(row, c_idx)
            cell.font = FONT_DATA_BOLD
            cell.fill = footer_fill
            cell.border = BORDER_THIN
            cell.alignment = ALIGN_CENTER if c_idx >= 5 else ALIGN_LEFT

    # Regla de Formato Condicional (Gantt visual activo)
    first_week_col = get_column_letter(5)
    last_week_col = get_column_letter(4 + total_weeks)
    gantt_range = f"{first_week_col}10:{last_week_col}{end_gantt_row}"

    rule_chapter = FormulaRule(
        formula=[f'AND({first_week_col}10>0,$A10<>"",ISNUMBER($A10))'],
        stopIfTrue=True,
        fill=PatternFill(bgColor="374151"),
        font=Font(name="Arial", size=9, bold=True, color="374151"),
    )
    rule_detail = FormulaRule(
        formula=[f'AND({first_week_col}10>0,ISTEXT($A10))'],
        stopIfTrue=True,
        fill=PatternFill(bgColor="D97706"),
        font=Font(name="Arial", size=9, bold=True, color="D97706"),
    )
    ws.conditional_formatting.add(gantt_range, rule_chapter)
    ws.conditional_formatting.add(gantt_range, rule_detail)

    # Presentación de impresión y navegación.
    ws.freeze_panes = "E10"
    ws.print_area = f"A1:{get_column_letter(4 + total_weeks)}{r_inv_cum}"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.column_dimensions["A"].width = 8
    ws.column_dimensions["B"].width = 52
    ws.column_dimensions["C"].width = 12
    ws.column_dimensions["D"].width = 8
    for w in range(1, total_weeks + 1):
        ws.column_dimensions[get_column_letter(4 + w)].width = 13


def _build_sheet_cronograma_mensual(
    ws: Any,
    chapters: List[Dict[str, Any]],
    items: List[Dict[str, Any]],
    total_weeks: int,
    month_ranges: List[Dict[str, Any]],
    chapter_rows: List[int],
    start_date: date,
    end_date: date,
    budget_name: str,
    contractor_name: str,
    contractee_name: str,
    location: str,
) -> None:
    ws.views.sheetView[0].showGridLines = True

    # Encabezado
    ws["C1"] = contractor_name
    ws["C1"].font = FONT_SUBTITLE
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

    col_pct_start = col_tot + 1
    for m_idx, m in enumerate(month_ranges):
        col_pct = col_pct_start + m_idx
        c_pct = ws.cell(6, col_pct, f"{m['code'].split('-')[0]} %cap.")
        c_pct.font = FONT_TH
        c_pct.fill = FILL_HEADER
        c_pct.alignment = ALIGN_CENTER
    col_pct_end = col_pct_start + num_months - 1

    # Filas de prorrateo al pie de la hoja para alimentar el SUMPRODUCT
    # Calculamos la posición donde iniciará la tabla auxiliar de fracciones
    frac_table_start_row = 15 + len(chapters) + len(month_ranges) + 5
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
        cg_row = chapter_rows[idx - 1] if idx - 1 < len(chapter_rows) else 9 + idx
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

        # Total fila
        first_m_letter = get_column_letter(3)
        last_m_letter = get_column_letter(2 + num_months)

        c_tot = ws.cell(curr_row, col_tot, f'=SUM({first_m_letter}{curr_row}:{last_m_letter}{curr_row})')
        c_tot.alignment = ALIGN_RIGHT
        c_tot.number_format = FMT_CURRENCY

        for m_idx in range(num_months):
            c_p = ws.cell(
                curr_row,
                col_pct_start + m_idx,
                f'={get_column_letter(3 + m_idx)}{curr_row}/${get_column_letter(col_tot)}{curr_row}',
            )
            c_p.alignment = ALIGN_RIGHT
            c_p.number_format = FMT_PERCENT

        fill = FILL_ZEBRA_EVEN if idx % 2 == 0 else FILL_ZEBRA_ODD
        for c_idx in range(1, col_pct_end + 1):
            cell = ws.cell(curr_row, c_idx)
            cell.font = FONT_DATA
            cell.border = BORDER_THIN
            cell.fill = fill

        curr_row += 1

    # Fila de Totales Mensuales
    last_chap_row = curr_row - 1
    r_tot_m = curr_row

    ws.cell(r_tot_m, 2, "TOTAL MENSUAL ($, sin IVA)").font = FONT_TOTAL
    for m_idx in range(num_months):
        col_idx = 3 + m_idx
        col_letter = get_column_letter(col_idx)
        c_sum = ws.cell(r_tot_m, col_idx, f'=SUM({col_letter}7:{col_letter}{last_chap_row})')
        c_sum.number_format = FMT_CURRENCY

    tot_letter = get_column_letter(col_tot)
    ws.cell(r_tot_m, col_tot, f'=SUM({tot_letter}7:{tot_letter}{last_chap_row})').number_format = FMT_CURRENCY

    for c_idx in range(1, col_pct_end + 1):
        ws.cell(r_tot_m, c_idx).font = FONT_TOTAL
        ws.cell(r_tot_m, c_idx).fill = FILL_TOTAL
        ws.cell(r_tot_m, c_idx).border = BORDER_TOTAL

    # Avance físico del mes, acumulado e inversión con IVA.
    r_fis_m = r_tot_m + 1
    r_fis_cum_m = r_tot_m + 2
    r_inv_iva_m = r_tot_m + 3
    ws.cell(r_fis_m, 2, "Avance físico del mes (% del contrato)")
    ws.cell(r_fis_cum_m, 2, "Avance físico acumulado (%)")
    ws.cell(r_inv_iva_m, 2, "Inversión del mes con IVA ($)")

    first_month_letter = get_column_letter(3)
    for m_idx in range(num_months):
        col_idx = 3 + m_idx
        col_letter = get_column_letter(col_idx)
        ws.cell(r_fis_m, col_idx, f"={col_letter}{r_tot_m}/${tot_letter}${r_tot_m}").number_format = FMT_PERCENT
        ws.cell(r_fis_cum_m, col_idx, f"=SUM(${first_month_letter}{r_fis_m}:{col_letter}{r_fis_m})").number_format = FMT_PERCENT
        ws.cell(r_inv_iva_m, col_idx, f"={col_letter}{r_tot_m}*(1+IVA)").number_format = FMT_CURRENCY

    ws.cell(r_fis_m, col_tot, f"={tot_letter}{r_tot_m}/${tot_letter}${r_tot_m}").number_format = FMT_PERCENT
    ws.cell(r_fis_cum_m, col_tot, f"={tot_letter}{r_fis_m}").number_format = FMT_PERCENT
    ws.cell(r_inv_iva_m, col_tot, f"={tot_letter}{r_tot_m}*(1+IVA)").number_format = FMT_CURRENCY

    for row in (r_fis_m, r_fis_cum_m, r_inv_iva_m):
        for c_idx in range(1, col_pct_end + 1):
            ws.cell(row, c_idx).font = FONT_DATA_BOLD
            ws.cell(row, c_idx).fill = FILL_TOTAL
            ws.cell(row, c_idx).border = BORDER_THIN

    # Hitos principales por mes, generados con los capítulos activos.
    r_hitos_title = r_inv_iva_m + 2
    ws.cell(r_hitos_title, 2, "HITOS PRINCIPALES POR MES").font = FONT_STATUS
    ws.merge_cells(start_row=r_hitos_title, start_column=2, end_row=r_hitos_title, end_column=11)

    for m_idx, m in enumerate(month_ranges):
        r_hito = r_hitos_title + 1 + m_idx
        ws.cell(r_hito, 2, m["label"]).font = FONT_DATA_BOLD

        active = [
            chap for chap in chapters
            if chap.get("start_date") and chap.get("end_date")
            and chap["start_date"] <= m["last_day"]
            and chap["end_date"] >= m["first_day"]
        ]
        starts = [chap["name"] for chap in active if m["first_day"] <= chap["start_date"] <= m["last_day"]]
        ends = [chap["name"] for chap in active if m["first_day"] <= chap["end_date"] <= m["last_day"]]
        ongoing = active

        parts = []
        if starts:
            parts.append("Inicio: " + "; ".join(starts[:3]))
        if ends:
            parts.append("Cierre: " + "; ".join(ends[:3]))
        if ongoing and not starts and not ends:
            parts.append("En ejecución: " + "; ".join(ongoing[:4]))
        text = ". ".join(parts) if parts else "Sin actividades programadas."
        cell = ws.cell(r_hito, 3, text)
        cell.font = FONT_DATA
        cell.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
        ws.merge_cells(start_row=r_hito, start_column=3, end_row=r_hito, end_column=11)
        ws.row_dimensions[r_hito].height = 30

    # Escala de calor condicional para el cronograma mensual
    if num_months > 0:
        cs_first_col = get_column_letter(col_pct_start)
        cs_last_col = get_column_letter(col_pct_end)
        cs_range = f"{cs_first_col}7:{cs_last_col}{last_chap_row}"
        rule_cs = ColorScaleRule(start_type="min", start_color="FFFFFF", end_type="max", end_color="93C5FD")
        ws.conditional_formatting.add(cs_range, rule_cs)

    ws.freeze_panes = "C7"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.column_dimensions["A"].width = 6
    ws.column_dimensions["B"].width = 44
    for m_idx in range(num_months):
        ws.column_dimensions[get_column_letter(3 + m_idx)].width = 15
    ws.column_dimensions[get_column_letter(col_tot)].width = 14
    for m_idx in range(num_months):
        ws.column_dimensions[get_column_letter(col_pct_start + m_idx)].width = 13


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
