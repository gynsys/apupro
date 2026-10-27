"""
Generador de Ficha Técnica de Inspección y Memoria Fotográfica en PDF.
Utiliza ReportLab y Pillow para crear documentos de ingeniería civil de alta calidad visual.
"""
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
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


class NumberedCanvas(canvas.Canvas):
    """Canvas de dos pasadas para numerar páginas con 'Página X de Y'."""

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
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Línea sutil superior de pie de página
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(36, 32, letter[0] - 36, 32)

        footer_text = f"Ficha de Inspección Técnica de Obra • Página {self._pageNumber} de {page_count}"
        self.drawRightString(letter[0] - 36, 20, footer_text)

        now_str = datetime.now().strftime("%d/%m/%Y %H:%M")
        self.drawString(36, 20, f"Generado vía Bot Inspector • {now_str}")
        self.restoreState()


def _optimize_and_resize_image(img_path: str, max_w: float = 240, max_h: float = 175) -> Optional[Image]:
    """Carga y redimensiona proporcionalmente una imagen para encajar en la celda del PDF."""
    if not os.path.exists(img_path):
        return None

    try:
        with PILImage.open(img_path) as pil_img:
            orig_w, orig_h = pil_img.size

        if orig_w <= 0 or orig_h <= 0:
            return None

        ratio = min(max_w / orig_w, max_h / orig_h)
        target_w = orig_w * ratio
        target_h = orig_h * ratio

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
    Genera el archivo PDF con la Ficha Técnica de la Obra y la Memoria Fotográfica.

    :param report_data: Diccionario con datos parseados (Obra, Empresa, Inspectores, Actividades...)
    :param photos: Lista de dicts [{'path': str, 'caption': str}]
    :param output_pdf_path: Ruta del archivo PDF a generar.
    :return: Ruta final del archivo PDF generado.
    """
    os.makedirs(os.path.dirname(os.path.abspath(output_pdf_path)), exist_ok=True)

    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=42,
    )

    styles = getSampleStyleSheet()

    # Estilos tipográficos personalizados
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=2,
    )

    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#b45309"),  # Ámbar de ingeniería
        spaceAfter=10,
    )

    sec_header_style = ParagraphStyle(
        "SectionHeader",
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#ffffff"),
        spaceBefore=0,
        spaceAfter=0,
    )

    cell_label_style = ParagraphStyle(
        "CellLabel",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1e293b"),
    )

    cell_value_style = ParagraphStyle(
        "CellValue",
        fontName="Helvetica",
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#0f172a"),
    )

    activity_style = ParagraphStyle(
        "ActivityItem",
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#1e293b"),
    )

    photo_num_style = ParagraphStyle(
        "PhotoNumber",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#1e293b"),
    )

    photo_caption_style = ParagraphStyle(
        "PhotoCaption",
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#475569"),
    )

    story = []

    # 1. ENCABEZADO INSTITUCIONAL
    story.append(Paragraph("INFORME DIARIO DE INSPECCIÓN TÉCNICA DE OBRA", title_style))
    story.append(Paragraph("CONTROL DE AVANCE FÍSICO Y MEMORIA FOTOGRÁFICA", subtitle_style))
    story.append(Spacer(1, 4))

    # 2. TABLA FICHA TÉCNICA
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

    # Fila de Título de Sección
    sec_title_p = Paragraph("FICHA TÉCNICA GENERAL DEL PROYECTO", sec_header_style)

    ficha_data = [
        [sec_title_p, ""],
        [
            Paragraph("<b>OBRA / PROYECTO:</b>", cell_label_style),
            Paragraph(obra_text, cell_value_style),
        ],
        [
            Paragraph("<b>FECHA DEL REPORTE:</b>", cell_label_style),
            Paragraph(fecha_text, cell_value_style),
        ],
        [
            Paragraph("<b>EMPRESA CONTRATISTA:</b>", cell_label_style),
            Paragraph(empresa_text, cell_value_style),
        ],
        [
            Paragraph("<b>ING. RESIDENTE:</b>", cell_label_style),
            Paragraph(residente_text, cell_value_style),
        ],
        [
            Paragraph("<b>ING. INSPECTOR(ES):</b>", cell_label_style),
            Paragraph(inspectores_text, cell_value_style),
        ],
        [
            Paragraph("<b>CAPORAL:</b>", cell_label_style),
            Paragraph(caporal_text, cell_value_style),
        ],
        [
            Paragraph("<b>FUERZA LABORAL:</b>", cell_label_style),
            Paragraph(personal_resumen, cell_value_style),
        ],
    ]

    col_w1 = 140
    col_w2 = letter[0] - 72 - col_w1

    t_ficha = Table(ficha_data, colWidths=[col_w1, col_w2])
    t_ficha.setStyle(
        TableStyle(
            [
                ("SPAN", (0, 0), (1, 0)),
                ("BACKGROUND", (0, 0), (1, 0), colors.HexColor("#1e3a8a")),  # Azul Marino Institucional
                ("ALIGN", (0, 0), (1, 0), "CENTER"),
                ("TOPPADDING", (0, 0), (1, 0), 4),
                ("BOTTOMPADDING", (0, 0), (1, 0), 4),
                ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#f8fafc")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 1), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(t_ficha)
    story.append(Spacer(1, 10))

    # 3. SECCIÓN ACTIVIDADES EN EJECUCIÓN
    actividades = report_data.get("actividades", [])
    sec_act_p = Paragraph("ACTIVIDADES EJECUTADAS Y EN DESARROLLO", sec_header_style)

    act_rows = [[sec_act_p]]
    if actividades:
        for idx, act in enumerate(actividades, 1):
            act_p = Paragraph(f"<b>{idx}.</b> {act}", activity_style)
            act_rows.append([act_p])
    else:
        act_rows.append([Paragraph("<i>Sin actividades reportadas para la fecha.</i>", activity_style)])

    t_act = Table(act_rows, colWidths=[letter[0] - 72])
    t_act.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#b45309")),  # Ámbar Construcción
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, 0), 4),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 1), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 3.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(t_act)
    story.append(Spacer(1, 12))

    # 4. MEMORIA FOTOGRÁFICA
    if photos:
        sec_foto_p = Paragraph(f"MEMORIA FOTOGRÁFICA DE LA JORNADA ({len(photos)} FOTOGRAFÍAS)", sec_header_style)
        t_foto_header = Table([[sec_foto_p]], colWidths=[letter[0] - 72])
        t_foto_header.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),  # Verde Teal Técnico
                    ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                    ("TOPPADDING", (0, 0), (-1, 0), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
                ]
            )
        )
        story.append(t_foto_header)
        story.append(Spacer(1, 8))

        # Cuadrícula 2 fotos por fila
        max_card_w = (letter[0] - 72 - 12) / 2  # ~264 pt

        photo_cards = []
        for i, photo_info in enumerate(photos, 1):
            p_path = photo_info.get("path")
            caption_raw = photo_info.get("caption", "").strip()

            rl_img = _optimize_and_resize_image(p_path, max_w=max_card_w - 12, max_h=165)
            if not rl_img:
                continue

            caption_display = caption_raw if caption_raw else f"Actividad registrada en fecha {fecha_text}"

            cell_content = [
                [rl_img],
                [Paragraph(f"<b>FOTOGRAFÍA N° {i}</b>", photo_num_style)],
                [Paragraph(caption_display, photo_caption_style)],
            ]

            card_table = Table(cell_content, colWidths=[max_card_w])
            card_table.setStyle(
                TableStyle(
                    [
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("TOPPADDING", (0, 0), (-1, -1), 2),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
                    ]
                )
            )
            photo_cards.append(card_table)

        # Agrupar de a 2 por fila
        grid_rows = []
        for j in range(0, len(photo_cards), 2):
            pair = photo_cards[j : j + 2]
            if len(pair) == 1:
                grid_rows.append([pair[0], ""])
            else:
                grid_rows.append([pair[0], pair[1]])

        if grid_rows:
            grid_table = Table(grid_rows, colWidths=[max_card_w, max_card_w])
            grid_table.setStyle(
                TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 3),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]
                )
            )
            story.append(grid_table)
            story.append(Spacer(1, 14))

    # 5. CUADRO DE FIRMAS
    insp_label = f"POR LA INSPECCIÓN DE OBRA<br/><b>{inspectores_text}</b>"
    res_label = f"POR LA EMPRESA CONTRATISTA<br/><b>{residente_text}</b>"

    firmas_data = [
        [
            Paragraph(insp_label, ParagraphStyle("Firma1", parent=cell_label_style, alignment=TA_CENTER, fontSize=7.5)),
            Paragraph(res_label, ParagraphStyle("Firma2", parent=cell_label_style, alignment=TA_CENTER, fontSize=7.5)),
        ],
        [
            Spacer(1, 35),
            Spacer(1, 35),
        ],
        [
            Paragraph("Firma y Sello / C.I.V.", ParagraphStyle("Sub1", parent=photo_caption_style, alignment=TA_CENTER)),
            Paragraph("Firma y Sello / C.I.V.", ParagraphStyle("Sub2", parent=photo_caption_style, alignment=TA_CENTER)),
        ],
    ]

    half_w = (letter[0] - 72) / 2
    t_firmas = Table(firmas_data, colWidths=[half_w, half_w])
    t_firmas.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
                ("LINEBEFORE", (1, 0), (1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )

    story.append(KeepTogether([t_firmas]))

    # Compilar documento
    doc.build(story, canvasmaker=NumberedCanvas)
    return output_pdf_path
