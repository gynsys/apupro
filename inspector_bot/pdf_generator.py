"""
Generador de Ficha Técnica de Inspección y Memoria Fotográfica en PDF.
Layout adaptativo dinámico: optimiza el espacio según el número de fotos (1, 2, 3, 4 o más)
eliminando espacios vacíos y asegurando una distribución armónica de ingeniería.
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


def _optimize_and_resize_image(img_path: str, max_w: float = 240, max_h: float = 160) -> Optional[Image]:
    """Carga y redimensiona proporcionalmente una imagen para encajar en la celda del PDF."""
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
    Genera el archivo PDF con la Ficha Técnica de la Obra y la Memoria Fotográfica.
    Adapta el layout según el número de fotos para evitar espacios en blanco o desbordamientos.
    """
    os.makedirs(os.path.dirname(os.path.abspath(output_pdf_path)), exist_ok=True)

    doc = SimpleDocTemplate(
        output_pdf_path,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=34,
        bottomMargin=38,
    )

    styles = getSampleStyleSheet()

    # Estilos tipográficos
    title_style = ParagraphStyle(
        "DocTitle",
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=2,
    )

    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#b45309"),
        spaceAfter=8,
    )

    sec_header_style = ParagraphStyle(
        "SectionHeader",
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#ffffff"),
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

    total_width = letter[0] - 72  # 540 pt útiles

    story = []

    # 1. ENCABEZADO
    story.append(Paragraph("INFORME DIARIO DE INSPECCIÓN TÉCNICA DE OBRA", title_style))
    story.append(Paragraph("CONTROL DE AVANCE FÍSICO Y MEMORIA FOTOGRÁFICA", subtitle_style))
    story.append(Spacer(1, 4))

    # 2. FICHA TÉCNICA
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

    sec_title_p = Paragraph("FICHA TÉCNICA GENERAL DEL PROYECTO", sec_header_style)

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

    col_w1 = 140
    col_w2 = total_width - col_w1

    t_ficha = Table(ficha_data, colWidths=[col_w1, col_w2])
    t_ficha.setStyle(
        TableStyle(
            [
                ("SPAN", (0, 0), (1, 0)),
                ("BACKGROUND", (0, 0), (1, 0), colors.HexColor("#1e3a8a")),
                ("ALIGN", (0, 0), (1, 0), "CENTER"),
                ("TOPPADDING", (0, 0), (1, 0), 4),
                ("BOTTOMPADDING", (0, 0), (1, 0), 4),
                ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#f8fafc")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 1), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 2.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(t_ficha)
    story.append(Spacer(1, 8))

    # 3. ACTIVIDADES EN EJECUCIÓN
    actividades = report_data.get("actividades", [])
    sec_act_p = Paragraph("ACTIVIDADES EJECUTADAS Y EN DESARROLLO", sec_header_style)

    act_rows = [[sec_act_p]]
    if actividades:
        for idx, act in enumerate(actividades, 1):
            act_p = Paragraph(f"<b>{idx}.</b> {act}", activity_style)
            act_rows.append([act_p])
    else:
        act_rows.append([Paragraph("<i>Sin actividades reportadas para la fecha.</i>", activity_style)])

    t_act = Table(act_rows, colWidths=[total_width])
    t_act.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#b45309")),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, 0), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 3.5),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 1), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(t_act)
    story.append(Spacer(1, 8))

    # Helper para construir el bloque de firmas
    def _create_firmas_table():
        insp_label = f"POR LA INSPECCIÓN DE OBRA<br/><b>{inspectores_text}</b>"
        res_label = f"POR LA EMPRESA CONTRATISTA<br/><b>{residente_text}</b>"
        firmas_data = [
            [
                Paragraph(insp_label, ParagraphStyle("Firma1", parent=cell_label_style, alignment=TA_CENTER, fontSize=7.5)),
                Paragraph(res_label, ParagraphStyle("Firma2", parent=cell_label_style, alignment=TA_CENTER, fontSize=7.5)),
            ],
            [Spacer(1, 28), Spacer(1, 28)],
            [
                Paragraph("Firma y Sello / C.I.V.", ParagraphStyle("Sub1", parent=photo_caption_style, alignment=TA_CENTER)),
                Paragraph("Firma y Sello / C.I.V.", ParagraphStyle("Sub2", parent=photo_caption_style, alignment=TA_CENTER)),
            ],
        ]
        half_w = total_width / 2
        t = Table(firmas_data, colWidths=[half_w, half_w])
        t.setStyle(
            TableStyle(
                [
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
                    ("LINEBEFORE", (1, 0), (1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ]
            )
        )
        return t

    num_photos = len(photos)

    # 4. DISPOSICIÓN ADAPTATIVA DE FOTOS (CASO 1-2 FOTOS VS 3-4 FOTOS VS >4)
    # Si son 1 o 2 fotos: caben en la misma Página 1
    # Si son 3 o 4 fotos: Página 1 queda impecable con Ficha + Actividades + Notas, y Página 2 alberga la cuadrícula 2x2 perfecta + Firmas.
    if num_photos >= 3:
        # Enriquecer la Página 1 con cuadro de Notas u Observaciones para que no quede ningún hueco
        sec_obs_p = Paragraph("NOTAS TÉCNICAS Y CONDICIONES GENERALES DE CAMPO", sec_header_style)
        obs_text = (
            "• Jornada ejecutada en conformidad con las especificaciones técnicas del proyecto.<br/>"
            "• Se mantiene el control de rendimientos, seguridad industrial y equipos de protección personal (EPP).<br/>"
            "• La memoria fotográfica adjunta en la siguiente página refleja el estado físico de los frentes de trabajo activos."
        )
        t_obs = Table([[sec_obs_p], [Paragraph(obs_text, cell_value_style)]], colWidths=[total_width])
        t_obs.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#475569")),
                    ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                    ("TOPPADDING", (0, 0), (-1, 0), 3.5),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 3.5),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("TOPPADDING", (0, 1), (-1, 1), 6),
                    ("BOTTOMPADDING", (0, 1), (-1, 1), 6),
                    ("LEFTPADDING", (0, 1), (-1, 1), 8),
                    ("RIGHTPADDING", (0, 1), (-1, 1), 8),
                ]
            )
        )
        story.append(t_obs)
        story.append(Spacer(1, 14))

        # Salto deliberado de página para que las fotos queden perfectamente enmarcadas en la Página 2
        story.append(PageBreak())

    # Construcción de la Memoria Fotográfica
    if photos:
        sec_foto_p = Paragraph(f"MEMORIA FOTOGRÁFICA DE LA JORNADA ({num_photos} FOTOGRAFÍAS)", sec_header_style)
        t_foto_header = Table([[sec_foto_p]], colWidths=[total_width])
        t_foto_header.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
                    ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                    ("TOPPADDING", (0, 0), (-1, 0), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
                ]
            )
        )
        story.append(t_foto_header)
        story.append(Spacer(1, 6))

        # Dimensiones adaptativas según la cantidad de fotos
        # Si son exactamente 4 fotos: max_h de 145pt permite que las 2 filas + firmas quepan en la página 2 con holgura
        if num_photos == 4:
            card_max_h = 145
            card_max_w = (total_width - 12) / 2
        elif num_photos <= 2:
            card_max_h = 150
            card_max_w = (total_width - 12) / 2
        else:
            card_max_h = 140
            card_max_w = (total_width - 12) / 2

        photo_cards = []
        for i, photo_info in enumerate(photos, 1):
            p_path = photo_info.get("path")
            caption_raw = photo_info.get("caption", "").strip()

            rl_img = _optimize_and_resize_image(p_path, max_w=card_max_w - 12, max_h=card_max_h)
            if not rl_img:
                continue

            caption_display = caption_raw if caption_raw else f"Actividad registrada en fecha {fecha_text}"

            cell_content = [
                [rl_img],
                [Paragraph(f"<b>FOTOGRAFÍA N° {i}</b>", photo_num_style)],
                [Paragraph(caption_display, photo_caption_style)],
            ]

            card_table = Table(cell_content, colWidths=[card_max_w])
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

        # Agrupar tarjetas fotográficas
        grid_rows = []
        for j in range(0, len(photo_cards), 2):
            pair = photo_cards[j : j + 2]
            if len(pair) == 1:
                # Si es impar (ej: 3 fotos), centrar armónicamente la última foto sin dejar hueco blanco
                # Usamos una tabla centrada de ancho completo
                single_card = pair[0]
                grid_rows.append([single_card, ""])
            else:
                grid_rows.append([pair[0], pair[1]])

        if grid_rows:
            # Si la última fila tiene 1 sola foto, centrarla uniendo columnas
            t_styles = [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
            if len(photo_cards) % 2 != 0:
                last_row_idx = len(grid_rows) - 1
                t_styles.append(("SPAN", (0, last_row_idx), (1, last_row_idx)))
                t_styles.append(("ALIGN", (0, last_row_idx), (1, last_row_idx), "CENTER"))

            grid_table = Table(grid_rows, colWidths=[card_max_w, card_max_w])
            grid_table.setStyle(TableStyle(t_styles))
            story.append(grid_table)
            story.append(Spacer(1, 10))

    # 5. CUADRO DE FIRMAS
    # Se agrega siempre al pie de la última página (o en KeepTogether)
    story.append(Spacer(1, 6))
    story.append(KeepTogether([_create_firmas_table()]))

    doc.build(story, canvasmaker=NumberedCanvas)
    return output_pdf_path
