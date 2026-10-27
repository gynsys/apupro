"""
Generador de Ficha Técnica de Inspección y Memoria Fotográfica en PDF.
Formato: Carta Orientación Horizontal (Letter Landscape 11" x 8.5").
Diseño: Dashboard Side-by-Side:
  - LADO IZQUIERDO: Ficha Técnica y Actividades en Ejecución.
  - LADO DERECHO: Memoria Fotográfica (Cuadrícula 2x2 de fotos en alta definición).
Todo integrado armónicamente en formato horizontal sin espacios vacíos.
"""
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

PAGE_W, PAGE_H = landscape(letter)  # 792 pt x 612 pt


class NumberedCanvas(canvas.Canvas):
    """Canvas de dos pasadas para numerar páginas con 'Página X de Y' en Carta Horizontal."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748b"))

        # Línea sutil superior de pie de página
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(28, 22, PAGE_W - 28, 22)

        footer_text = f"Ficha de Inspección Técnica de Obra • Página {self._pageNumber} de {page_count}"
        self.drawRightString(PAGE_W - 28, 12, footer_text)

        now_str = datetime.now().strftime("%d/%m/%Y %H:%M")
        self.drawString(28, 12, f"Generado vía Bot Inspector • Carta Horizontal • {now_str}")
        self.restoreState()


def _optimize_and_resize_image(img_path: str, max_w: float = 175, max_h: float = 120) -> Optional[Image]:
    """Carga y redimensiona proporcionalmente una imagen para encajar en el panel de fotos."""
    if not os.path.exists(img_path):
        return None

    try:
        with PILImage.open(img_path) as pil_img:
            orig_w, orig_h = pil_img.size

        if orig_w <= 0 or orig_h <= 0:
            return None

        ratio = min(max_w / orig_w, max_h / orig_h)
        target_w = max(1, orig_w * ratio)
        target_h = max(1, orig_h * ratio)

        return Image(img_path, width=target_w, height=target_h)
    except Exception as exc:
        print(f"Error procesando imagen {img_path}: {exc}")
        return None


def generate_inspection_pdf(
    report_data: Dict[str, Any],
    photos: List[Dict[str, Any]],
    output_pdf_path: str,
) -> str:
    """
    Genera el informe en formato CARTA HORIZONTAL (Landscape Letter).
    Layout: Lado izquierdo Texto (Ficha + Actividades + Firmas), Lado derecho Imágenes.
    """
    os.makedirs(os.path.dirname(os.path.abspath(output_pdf_path)), exist_ok=True)

    # Márgenes compactos de 28pt para maximizar el área útil horizontal
    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=landscape(letter),
        leftMargin=28,
        rightMargin=28,
        topMargin=20,
        bottomMargin=26,
    )

    styles = getSampleStyleSheet()

    # Estilos tipográficos
    title_style = ParagraphStyle(
        "DocTitle",
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=14,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=1,
    )

    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#b45309"),
        spaceAfter=5,
    )

    sec_header_style = ParagraphStyle(
        "SectionHeader",
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#ffffff"),
    )

    cell_label_style = ParagraphStyle(
        "CellLabel",
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=8.5,
        textColor=colors.HexColor("#1e293b"),
    )

    cell_value_style = ParagraphStyle(
        "CellValue",
        fontName="Helvetica",
        fontSize=7,
        leading=8.5,
        textColor=colors.HexColor("#0f172a"),
    )

    activity_style = ParagraphStyle(
        "ActivityItem",
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#1e293b"),
    )

    photo_num_style = ParagraphStyle(
        "PhotoNumber",
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=8.5,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#1e293b"),
    )

    photo_caption_style = ParagraphStyle(
        "PhotoCaption",
        fontName="Helvetica",
        fontSize=6.5,
        leading=8,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#475569"),
    )

    total_width = PAGE_W - 56  # 736 pt
    col_left_w = 360           # 360 pt Lado Izquierdo (Texto)
    gap_w = 12                 # 12 pt Separador central
    col_right_w = 364          # 364 pt Lado Derecho (Imágenes)

    story = []

    # 1. ENCABEZADO SUPERIOR BANNER (Ancho completo 736 pt)
    header_content = [
        [Paragraph("INFORME DIARIO DE INSPECCIÓN TÉCNICA DE OBRA", title_style)],
        [Paragraph("CONTROL DE AVANCE FÍSICO Y MEMORIA FOTOGRÁFICA • FORMATO CARTA HORIZONTAL", subtitle_style)],
    ]
    t_header = Table(header_content, colWidths=[total_width])
    t_header.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(t_header)
    story.append(Spacer(1, 4))

    # ==========================================
    # CONSTRUCCIÓN DEL LADO IZQUIERDO (TEXTO)
    # ==========================================
    left_elements = []

    obra_text = report_data.get("obra", "SIN ESPECIFICAR").upper()
    empresa_text = report_data.get("empresa", "SIN ESPECIFICAR")
    fecha_text = report_data.get("fecha", datetime.now().strftime("%d/%m/%Y"))
    residente_text = report_data.get("ing_residente", "No especificado")

    inspectores_list = report_data.get("ing_inspectores", [])
    inspectores_text = ", ".join(inspectores_list) if inspectores_list else "No especificado"

    caporal_text = report_data.get("caporal", "No especificado")
    obreros_text = report_data.get("obreros", "No especificado")
    caporal_obra_num = report_data.get("caporal_obra", "")
    personal_resumen = f"{obreros_text}"
    if caporal_obra_num:
        personal_resumen += f" • Caporal: {caporal_obra_num}"

    # Ficha Técnica
    sec_title_p = Paragraph("FICHA TÉCNICA GENERAL DEL PROYECTO", sec_header_style)
    lbl_w = 100
    val_w = col_left_w - lbl_w

    ficha_data = [
        [sec_title_p, ""],
        [Paragraph("<b>OBRA / PROYECTO:</b>", cell_label_style), Paragraph(obra_text, cell_value_style)],
        [Paragraph("<b>FECHA DEL REPORTE:</b>", cell_label_style), Paragraph(fecha_text, cell_value_style)],
        [Paragraph("<b>EMPRESA CONTRATISTA:</b>", cell_label_style), Paragraph(empresa_text, cell_value_style)],
        [Paragraph("<b>ING. RESIDENTE:</b>", cell_label_style), Paragraph(residente_text, cell_value_style)],
        [Paragraph("<b>ING. INSPECTOR(ES):</b>", cell_label_style), Paragraph(inspectores_text, cell_value_style)],
        [Paragraph("<b>CAPORAL:</b>", cell_label_style), Paragraph(caporal_text, cell_value_style)],
        [Paragraph("<b>FUERZA LABORAL:</b>", cell_label_style), Paragraph(personal_resumen, cell_value_style)],
    ]

    t_ficha = Table(ficha_data, colWidths=[lbl_w, val_w])
    t_ficha.setStyle(
        TableStyle(
            [
                ("SPAN", (0, 0), (1, 0)),
                ("BACKGROUND", (0, 0), (1, 0), colors.HexColor("#1e3a8a")),
                ("ALIGN", (0, 0), (1, 0), "CENTER"),
                ("TOPPADDING", (0, 0), (1, 0), 2.5),
                ("BOTTOMPADDING", (0, 0), (1, 0), 2.5),
                ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#f8fafc")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 1), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 2),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    left_elements.append(t_ficha)
    left_elements.append(Spacer(1, 5))

    # Actividades en Ejecución
    actividades = report_data.get("actividades", [])
    sec_act_p = Paragraph("ACTIVIDADES EJECUTADAS Y EN DESARROLLO", sec_header_style)
    act_rows = [[sec_act_p]]
    if actividades:
        for idx, act in enumerate(actividades, 1):
            act_p = Paragraph(f"<b>{idx}.</b> {act}", activity_style)
            act_rows.append([act_p])
    else:
        act_rows.append([Paragraph("<i>Sin actividades reportadas para la fecha.</i>", activity_style)])

    t_act = Table(act_rows, colWidths=[col_left_w])
    t_act.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#b45309")),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, 0), 3),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 3),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 1), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    left_elements.append(t_act)

    # ==========================================
    # CONSTRUCCIÓN DEL LADO DERECHO (IMÁGENES)
    # ==========================================
    right_elements = []

    num_photos = len(photos)
    sec_foto_p = Paragraph(f"MEMORIA FOTOGRÁFICA DE LA JORNADA ({num_photos} FOTOGRAFÍAS)", sec_header_style)
    t_foto_header = Table([[sec_foto_p]], colWidths=[col_right_w])
    t_foto_header.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, 0), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 2.5),
            ]
        )
    )
    right_elements.append(t_foto_header)
    right_elements.append(Spacer(1, 4))

    # Ancho por tarjeta de foto: 2 columnas en el lado derecho = (364 - 6) / 2 = 179 pt
    card_w = (col_right_w - 6) / 2
    # Alto adaptativo de imagen: 110pt para que 2 filas quepan con total elegancia en la misma página
    card_img_h = 110

    photo_cards = []
    for i, photo_info in enumerate(photos, 1):
        p_path = photo_info.get("path")
        caption_raw = photo_info.get("caption", "").strip()

        rl_img = _optimize_and_resize_image(p_path, max_w=card_w - 8, max_h=card_img_h)
        if not rl_img:
            continue

        caption_display = caption_raw if caption_raw else f"Registro de avance en fecha {fecha_text}"
        if len(caption_display) > 55:
            caption_display = caption_display[:52] + "..."

        cell_content = [
            [rl_img],
            [Paragraph(f"<b>FOTOGRAFÍA N° {i}</b>", photo_num_style)],
            [Paragraph(caption_display, photo_caption_style)],
        ]

        card_table = Table(cell_content, colWidths=[card_w])
        card_table.setStyle(
            TableStyle(
                [
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 1),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
                ]
            )
        )
        photo_cards.append(card_table)

    # Si hay fotos, organizarlas en cuadrícula 2x2
    if photo_cards:
        grid_rows = []
        for j in range(0, len(photo_cards), 2):
            pair = photo_cards[j : j + 2]
            if len(pair) == 1:
                grid_rows.append([pair[0], ""])
            else:
                grid_rows.append([pair[0], pair[1]])

        t_styles = [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 1),
            ("RIGHTPADDING", (0, 0), (-1, -1), 1),
            ("TOPPADDING", (0, 0), (-1, -1), 1.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
        ]
        if len(photo_cards) % 2 != 0:
            last_row_idx = len(grid_rows) - 1
            t_styles.append(("SPAN", (0, last_row_idx), (1, last_row_idx)))
            t_styles.append(("ALIGN", (0, last_row_idx), (1, last_row_idx), "CENTER"))

        grid_table = Table(grid_rows, colWidths=[card_w, card_w])
        grid_table.setStyle(TableStyle(t_styles))
        right_elements.append(grid_table)
    else:
        right_elements.append(Paragraph("<i>Sin fotografías registradas en este reporte.</i>", activity_style))

    # ==============================================================
    # TABLA MAESTRA DASHBOARD: LADO IZQUIERDO Y LADO DERECHO PARALELOS
    # ==============================================================
    dashboard_table = Table([[left_elements, "", right_elements]], colWidths=[col_left_w, gap_w, col_right_w])
    dashboard_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    story.append(dashboard_table)

    doc.build(story, canvasmaker=NumberedCanvas)
    return output_pdf_path
