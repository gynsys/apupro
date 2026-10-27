"""
Generador de Informe Diario de Inspección y Memoria Fotográfica en Excel (.xlsx).
Formato: Carta Orientación Horizontal (Letter Landscape).
Diseño Side-by-Side:
  - LADO IZQUIERDO (Columnas B a E): Ficha Técnica y Actividades en Ejecución.
  - LADO DERECHO (Columnas G a J): Memoria Fotográfica (Fotos 2x2 en alta definición).
"""
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import openpyxl
from openpyxl.drawing.image import Image as OpenpyxlImage
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from PIL import Image as PILImage


def _create_temp_resized_image(src_path: str, max_w_px: int = 280, max_h_px: int = 175) -> Optional[str]:
    """Redimensiona proporcionalmente la imagen para que encaje limpia en la celda de Excel."""
    if not os.path.exists(src_path):
        return None

    try:
        with PILImage.open(src_path) as img:
            orig_w, orig_h = img.size
            if orig_w <= 0 or orig_h <= 0:
                return None

            ratio = min(max_w_px / orig_w, max_h_px / orig_h)
            new_w = max(1, int(orig_w * ratio))
            new_h = max(1, int(orig_h * ratio))

            resized = img.resize((new_w, new_h), PILImage.Resampling.LANCZOS)

            temp_dir = Path(src_path).parent / "temp_excel"
            temp_dir.mkdir(parents=True, exist_ok=True)
            temp_path = temp_dir / f"xl_{Path(src_path).name}"
            resized.save(temp_path, quality=85)
            return str(temp_path)
    except Exception as exc:
        print(f"Error optimizando imagen para Excel: {exc}")
        return None


def generate_inspection_excel(
    report_data: Dict[str, Any],
    photos: List[Dict[str, Any]],
    output_excel_path: str,
) -> str:
    """
    Genera un libro de Excel (.xlsx) en Carta Horizontal con diseño Side-by-Side.
    """
    os.makedirs(os.path.dirname(os.path.abspath(output_excel_path)), exist_ok=True)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Ficha de Inspección"
    ws.views.sheetView[0].showGridLines = True

    # Configuración de página: Carta Horizontal (Letter Landscape)
    ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
    ws.page_setup.paperSize = ws.PAPERSIZE_LETTER
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0

    # Paleta de colores
    COLOR_PRIMARY_NAVY = "1E3A8A"     # Azul Marino Encabezado
    COLOR_SECONDARY_AMBER = "B45309"  # Ámbar Actividades
    COLOR_TEAL = "0F766E"             # Verde Fotos
    COLOR_SLATE_HEADER = "334155"     # Gris Encabezado Ficha
    COLOR_BORDER = "CBD5E1"           # Borde sutil

    font_title = Font(name="Calibri", size=13, bold=True, color="FFFFFF")
    font_subtitle = Font(name="Calibri", size=9, bold=True, color="78350F")
    font_sec_header = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    font_field_label = Font(name="Calibri", size=9, bold=True, color="1E293B")
    font_field_value = Font(name="Calibri", size=9, color="0F172A")
    font_photo_header = Font(name="Calibri", size=8.5, bold=True, color="1E293B")
    font_photo_caption = Font(name="Calibri", size=8, italic=True, color="475569")

    thin_border_side = Side(style="thin", color=COLOR_BORDER)
    full_border = Border(
        left=thin_border_side,
        right=thin_border_side,
        top=thin_border_side,
        bottom=thin_border_side,
    )

    fill_title = PatternFill(start_color=COLOR_PRIMARY_NAVY, end_color=COLOR_PRIMARY_NAVY, fill_type="solid")
    fill_subtitle = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    fill_sec_ficha = PatternFill(start_color=COLOR_SLATE_HEADER, end_color=COLOR_SLATE_HEADER, fill_type="solid")
    fill_sec_act = PatternFill(start_color=COLOR_SECONDARY_AMBER, end_color=COLOR_SECONDARY_AMBER, fill_type="solid")
    fill_sec_foto = PatternFill(start_color=COLOR_TEAL, end_color=COLOR_TEAL, fill_type="solid")
    fill_row_label = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    fill_card_header = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")

    align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    align_left = Alignment(horizontal="left", vertical="center", wrap_text=True)

    # Anchos de columna en formato horizontal
    col_widths = {
        "A": 2,
        # LADO IZQUIERDO (TEXTO)
        "B": 18,
        "C": 22,
        "D": 18,
        "E": 22,
        # SEPARADOR CENTRAL
        "F": 3,
        # LADO DERECHO (FOTOS)
        "G": 18,
        "H": 20,
        "I": 18,
        "J": 20,
        "K": 2,
    }
    for col_letter, width in col_widths.items():
        ws.column_dimensions[col_letter].width = width

    # 1. ENCABEZADO BANNER HORIZONTAL (B2 a J2)
    ws.merge_cells("B2:J2")
    ws["B2"] = "INFORME DIARIO DE INSPECCIÓN TÉCNICA DE OBRA"
    ws["B2"].font = font_title
    ws["B2"].fill = fill_title
    ws["B2"].alignment = align_center
    ws.row_dimensions[2].height = 24

    ws.merge_cells("B3:J3")
    ws["B3"] = "CONTROL DE AVANCE FÍSICO Y MEMORIA FOTOGRÁFICA • FORMATO CARTA HORIZONTAL"
    ws["B3"].font = font_subtitle
    ws["B3"].fill = fill_subtitle
    ws["B3"].alignment = align_center
    ws.row_dimensions[3].height = 18

    # ==========================================
    # LADO IZQUIERDO (TEXTO: FILAS 5 EN ADELANTE)
    # ==========================================
    ws.merge_cells("B5:E5")
    cell_sec1 = ws["B5"]
    cell_sec1.value = "FICHA TÉCNICA GENERAL DEL PROYECTO"
    cell_sec1.font = font_sec_header
    cell_sec1.fill = fill_sec_ficha
    cell_sec1.alignment = align_center
    ws.row_dimensions[5].height = 20

    # Obra
    ws["B6"] = "OBRA / PROYECTO:"
    ws["B6"].font = font_field_label
    ws["B6"].fill = fill_row_label
    ws["B6"].border = full_border

    ws.merge_cells("C6:E6")
    cell_obra = ws["C6"]
    cell_obra.value = report_data.get("obra", "SIN ESPECIFICAR").upper()
    cell_obra.font = font_field_value
    cell_obra.alignment = align_left
    cell_obra.border = full_border
    ws.row_dimensions[6].height = 36

    # Fecha y Empresa
    ws["B7"] = "FECHA:"
    ws["B7"].font = font_field_label
    ws["B7"].fill = fill_row_label
    ws["B7"].border = full_border
    ws["C7"] = report_data.get("fecha", datetime.now().strftime("%d/%m/%Y"))
    ws["C7"].font = font_field_value
    ws["C7"].alignment = align_left
    ws["C7"].border = full_border

    ws["D7"] = "EMPRESA:"
    ws["D7"].font = font_field_label
    ws["D7"].fill = fill_row_label
    ws["D7"].border = full_border
    ws["E7"] = report_data.get("empresa", "No indicada")
    ws["E7"].font = font_field_value
    ws["E7"].alignment = align_left
    ws["E7"].border = full_border
    ws.row_dimensions[7].height = 18

    # Residente e Inspectores
    inspectores_list = report_data.get("ing_inspectores", [])
    inspectores_str = ", ".join(inspectores_list) if inspectores_list else "No indicados"

    ws["B8"] = "RESIDENTE:"
    ws["B8"].font = font_field_label
    ws["B8"].fill = fill_row_label
    ws["B8"].border = full_border
    ws["C8"] = report_data.get("ing_residente", "No indicado")
    ws["C8"].font = font_field_value
    ws["C8"].alignment = align_left
    ws["C8"].border = full_border

    ws["D8"] = "INSPECTORES:"
    ws["D8"].font = font_field_label
    ws["D8"].fill = fill_row_label
    ws["D8"].border = full_border
    ws["E8"] = inspectores_str
    ws["E8"].font = font_field_value
    ws["E8"].alignment = align_left
    ws["E8"].border = full_border
    ws.row_dimensions[8].height = 18

    # Caporal y Personal
    obreros_text = report_data.get("obreros", "No especificado")
    caporal_obra_num = report_data.get("caporal_obra", "")
    personal_str = f"{obreros_text}"
    if caporal_obra_num:
        personal_str += f" • Caporal: {caporal_obra_num}"

    ws["B9"] = "CAPORAL:"
    ws["B9"].font = font_field_label
    ws["B9"].fill = fill_row_label
    ws["B9"].border = full_border
    ws["C9"] = report_data.get("caporal", "No indicado")
    ws["C9"].font = font_field_value
    ws["C9"].alignment = align_left
    ws["C9"].border = full_border

    ws["D9"] = "PERSONAL:"
    ws["D9"].font = font_field_label
    ws["D9"].fill = fill_row_label
    ws["D9"].border = full_border
    ws["E9"] = personal_str
    ws["E9"].font = font_field_value
    ws["E9"].alignment = align_left
    ws["E9"].border = full_border
    ws.row_dimensions[9].height = 18

    # Actividades en Ejecución
    ws.merge_cells("B11:E11")
    cell_sec2 = ws["B11"]
    cell_sec2.value = "ACTIVIDADES EJECUTADAS Y EN DESARROLLO"
    cell_sec2.font = font_sec_header
    cell_sec2.fill = fill_sec_act
    cell_sec2.alignment = align_center
    ws.row_dimensions[11].height = 20

    actividades = report_data.get("actividades", [])
    act_row = 12
    if actividades:
        for idx, act in enumerate(actividades, 1):
            ws.merge_cells(f"B{act_row}:E{act_row}")
            cell_act = ws[f"B{act_row}"]
            cell_act.value = f"  {idx}.  {act}"
            cell_act.font = font_field_value
            cell_act.alignment = align_left
            cell_act.border = full_border
            ws.row_dimensions[act_row].height = 20
            act_row += 1
    else:
        ws.merge_cells(f"B{act_row}:E{act_row}")
        cell_none = ws[f"B{act_row}"]
        cell_none.value = "  Sin actividades reportadas para la fecha."
        cell_none.font = Font(name="Calibri", size=9, italic=True)
        cell_none.alignment = align_left
        cell_none.border = full_border
        ws.row_dimensions[act_row].height = 18
        act_row += 1

    # ==========================================
    # LADO DERECHO (IMÁGENES: COLUMNAS G A J)
    # ==========================================
    num_photos = len(photos)
    ws.merge_cells("G5:J5")
    cell_sec3 = ws["G5"]
    cell_sec3.value = f"MEMORIA FOTOGRÁFICA DE LA JORNADA ({num_photos} FOTOGRAFÍAS)"
    cell_sec3.font = font_sec_header
    cell_sec3.fill = fill_sec_foto
    cell_sec3.alignment = align_center

    r_row = 6
    if photos:
        for i in range(0, len(photos), 2):
            batch = photos[i : i + 2]

            # Fila de encabezado de tarjeta
            h_row = r_row
            ws.merge_cells(f"G{h_row}:H{h_row}")
            ws[f"G{h_row}"] = f"FOTOGRAFÍA N° {i + 1}"
            ws[f"G{h_row}"].font = font_photo_header
            ws[f"G{h_row}"].fill = fill_card_header
            ws[f"G{h_row}"].alignment = align_center
            ws[f"G{h_row}"].border = full_border

            if len(batch) > 1:
                ws.merge_cells(f"I{h_row}:J{h_row}")
                ws[f"I{h_row}"] = f"FOTOGRAFÍA N° {i + 2}"
                ws[f"I{h_row}"].font = font_photo_header
                ws[f"I{h_row}"].fill = fill_card_header
                ws[f"I{h_row}"].alignment = align_center
                ws[f"I{h_row}"].border = full_border

            ws.row_dimensions[h_row].height = 16

            # Fila imagen
            img_row = h_row + 1
            ws.row_dimensions[img_row].height = 120

            # Insertar Foto 1 (Columna G)
            p1 = batch[0]
            opt_p1 = _create_temp_resized_image(p1.get("path", ""), max_w_px=270, max_h_px=150)
            if opt_p1 and os.path.exists(opt_p1):
                img1 = OpenpyxlImage(opt_p1)
                ws.add_image(img1, f"G{img_row}")

            # Insertar Foto 2 (Columna I)
            if len(batch) > 1:
                p2 = batch[1]
                opt_p2 = _create_temp_resized_image(p2.get("path", ""), max_w_px=270, max_h_px=150)
                if opt_p2 and os.path.exists(opt_p2):
                    img2 = OpenpyxlImage(opt_p2)
                    ws.add_image(img2, f"I{img_row}")

            # Fila pie de foto
            cap_row = img_row + 1
            cap1 = p1.get("caption", "").strip() or f"Avance en fecha {report_data.get('fecha', '')}"
            ws.merge_cells(f"G{cap_row}:H{cap_row}")
            ws[f"G{cap_row}"] = cap1
            ws[f"G{cap_row}"].font = font_photo_caption
            ws[f"G{cap_row}"].alignment = align_center
            ws[f"G{cap_row}"].border = full_border

            if len(batch) > 1:
                cap2 = batch[1].get("caption", "").strip() or f"Avance en fecha {report_data.get('fecha', '')}"
                ws.merge_cells(f"I{cap_row}:J{cap_row}")
                ws[f"I{cap_row}"] = cap2
                ws[f"I{cap_row}"].font = font_photo_caption
                ws[f"I{cap_row}"].alignment = align_center
                ws[f"I{cap_row}"].border = full_border

            ws.row_dimensions[cap_row].height = 20
            r_row = cap_row + 1
    else:
        ws.merge_cells("G6:J7")
        ws["G6"] = "Sin fotografías registradas para la fecha."
        ws["G6"].font = Font(name="Calibri", size=9, italic=True)
        ws["G6"].alignment = align_center

    wb.save(output_excel_path)
    return output_excel_path
