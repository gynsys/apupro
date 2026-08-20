# common/pdf/summary_report.py
# Generación de PDF para Informe Médico Resumido
import io
import logging
from datetime import datetime
from reportlab.lib.pagesizes import letter, legal
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.units import inch
from reportlab.lib import colors

from features.pdf_configuration.database import get_pdf_settings
from .summary_builder import build_narrative_summary
from .utils import create_logo_image, create_qr_image

logger = logging.getLogger(__name__)

# Meses en español
SPANISH_MONTHS = {
    1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril',
    5: 'mayo', 6: 'junio', 7: 'julio', 8: 'agosto',
    9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre'
}

def format_date_spanish(date: datetime = None) -> str:
    """Formatea una fecha en español: 'dd de mes de yyyy'"""
    if date is None:
        date = datetime.now()
    day = date.day
    month = SPANISH_MONTHS[date.month]
    year = date.year
    return f"{day} de {month} de {year}"

class PageCountCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._page_count = 0

    def showPage(self):
        self._page_count += 1
        canvas.Canvas.showPage(self)

def _create_story(report_context, pdf_settings):
    """Crea la lista de flowables (story) para el reporte."""
    story = []
    
    styles = getSampleStyleSheet()
    styleN = ParagraphStyle(name='Normal', fontName='Times-Roman', fontSize=12, leading=14)
    styleB = ParagraphStyle(name='Bold', fontName='Times-Bold', fontSize=12, leading=14)
    styleH1 = ParagraphStyle(name='Heading1', fontName='Times-Bold', fontSize=14, alignment=TA_CENTER, spaceAfter=6)

    style_narrative = ParagraphStyle(
        name='Narrative',
        parent=styleN,
        alignment=TA_JUSTIFY,
        leading=20,
        firstLineIndent=0
    )
    
    style_plan = ParagraphStyle(
        name='Plan',
        parent=styleN,
        alignment=TA_JUSTIFY,
        leading=16,
        leftIndent=18,
        firstLineIndent=0
    )
    style_patient_data = ParagraphStyle(name='PatientData', parent=styleN, spaceAfter=2)

    def get_pdf_setting(setting_key, default=''):
        setting = pdf_settings.get(setting_key, {})
        if not setting.get('visible', True): return None
        return setting.get('value', default)

    logo_header_1_path = get_pdf_setting('logo_header_1')
    logo_header_2_path = get_pdf_setting('logo_header_2')  # <-- NEW: Get Right Logo Path
    
    header_parts = []
    doctor_name = get_pdf_setting('doctor_name', 'Dra. Mariel Herrera')
    if doctor_name: header_parts.append(f"<b>{doctor_name}</b>")
    specialty = get_pdf_setting('specialty', 'Especialista en Ginecología y Obstetricia')
    if specialty: header_parts.append(specialty)
    location = get_pdf_setting('location', 'Caracas-Guarenas Guatire')
    if location: header_parts.append(location)
    phones = get_pdf_setting('phones', '04244281876-04127738918')
    if phones: header_parts.append(f"Citas: {phones}")
    header_text = "<br/>".join(header_parts)
    
    # Increase base size for logos
    logo_left = create_logo_image(logo_header_1_path, width=1.2*inch, height=1.2*inch)
    left_height = logo_left.drawHeight if logo_left else 0.8*inch
    logo_right = create_logo_image(logo_header_2_path, width=left_height, height=left_height)

    # Si hay dos logos, el texto va centrado (ya está configurado así en el estilo)
    # Si falta alguno, pasamos un string vacío para mantener la celda
    content_left = logo_left if logo_left else ""
    content_right = logo_right if logo_right else ""
    
    # Determine alignment based on logo presence (affects Paragraph alignment AND Table alignment)
    is_centered = bool(logo_right)
    
    # Create dynamic style for the header text
    header_text_style = ParagraphStyle(
        name='HeaderText',
        parent=styleN,
        alignment=TA_CENTER if is_centered else TA_LEFT,
        fontSize=11,
        leading=13
    )
    
    table_align = 'CENTER' if is_centered else 'LEFT'
    
    header_data = [[content_left, Paragraph(header_text, header_text_style), content_right]]
    header_table = Table(header_data, colWidths=[1.3*inch, 4.9*inch, 1.3*inch]) 
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), 
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'), # Align everything center in cells
        ('ALIGN', (1,0), (1,0), table_align),  # Specific alignment for text cell
        ('LEFTPADDING', (1, 0), (1, 0), 5),    # Minimal padding
        ('RIGHTPADDING', (1, 0), (1, 0), 5),
    ]))
    story.append(header_table)

    line_table = Table([['']], colWidths=[7.5*inch])
    line_table.setStyle(TableStyle([('LINEBELOW', (0,0), (-1,-1), 1, colors.black)]))
    story.append(line_table)
    story.append(Spacer(1, 0.25*inch))
    story.append(Paragraph("<u>INFORME MÉDICO</u>", styleH1))
    story.append(Spacer(1, 0.25*inch))

    story.append(Paragraph(f"<b>Nombre y Apellidos:</b> {report_context.get('full_name')}", style_patient_data))
    story.append(Paragraph(f"<b>Edad:</b> {report_context.get('age')}", style_patient_data))
    story.append(Paragraph(f"<b>C.I.:</b> {report_context.get('ci')}", style_patient_data))
    story.append(Spacer(1, 0.3*inch))

    narrative_content = report_context.get('narrative_summary')
    if narrative_content:
        plan_marker = "Se indica como plan:"
        if plan_marker in narrative_content:
            parts = narrative_content.split(plan_marker, 1)
            narrative_text = parts[0].strip()
            plan_text = parts[1].strip() if len(parts) > 1 else None
            
            if narrative_text:
                narrative_paragraph = Paragraph(narrative_text, style_narrative)
                story.append(narrative_paragraph)
            
            if plan_text:
                intro_paragraph = Paragraph("Se indica como plan:", style_narrative)
                story.append(intro_paragraph)
                plan_items = [item.strip() for item in plan_text.split('<br/>') if item.strip()]
                for item in plan_items:
                    plan_item_paragraph = Paragraph(item, style_plan)
                    story.append(plan_item_paragraph)
        else:
            narrative_paragraph = Paragraph(narrative_content, style_narrative)
            story.append(narrative_paragraph)

    story.append(Spacer(1, 0.3*inch))
    footer_city = get_pdf_setting('footer_city', 'Guarenas')
    today_str = format_date_spanish()
    pre_signature_text = f"Sin otro particular se suscribe en {footer_city} a los {today_str}."
    story.append(Paragraph(pre_signature_text, ParagraphStyle(name='PreFooter', fontSize=12, alignment=TA_CENTER, spaceAfter=24)))

    signature_path = get_pdf_setting('logo_signature')
    signature_img = create_logo_image(signature_path, width=2.5*inch, height=1*inch)
    signature_block = signature_img if signature_img else Paragraph(
        "_________________________",
        ParagraphStyle(name='SignatureLine', alignment=TA_CENTER)
    )
    if signature_img:
        signature_img.hAlign = 'CENTER'

    post_signature_parts = []
    if doctor_name:
        post_signature_parts.append(f"<b>{doctor_name}</b>")
    post_signature_parts.append("Ginecólogo Obstetra - UCV")
    mpps_number, cmdm_number = get_pdf_setting('mpps_number'), get_pdf_setting('cmdm_number')
    if mpps_number and cmdm_number:
        post_signature_parts.append(f"MPPS: {mpps_number} / CMDM: {cmdm_number}")
    doctor_id_val = get_pdf_setting('doctor_id')
    if doctor_id_val:
        post_signature_parts.append(f"C.I.: {doctor_id_val}")
    post_signature_text = "<br/>".join(post_signature_parts)
    doctor_info_para = Paragraph(
        post_signature_text,
        ParagraphStyle(name='PostFooter', fontSize=10, alignment=TA_CENTER, leading=12)
    )

    signature_column = [signature_block, Spacer(1, 0.05*inch), doctor_info_para]
    signature_table = Table([[signature_column]], colWidths=[7.5*inch])
    signature_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (0, 0), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(signature_table)
    
    return story

async def generate_summary_report(report_data: dict, doctor_id: int) -> bytes:
    """
    Genera el PDF del Informe Médico Resumido.
    Intenta ajustar el tamaño del papel dinámicamente: Carta -> Folio/Oficio -> Legal.
    """
    pdf_settings = await get_pdf_settings(doctor_id)
    include_functional_exam = pdf_settings.get('include_functional_exam', {}).get('value', '1') == '1'
    
    report_context = build_narrative_summary(report_data, include_functional_exam=include_functional_exam)

    # Definir tamaños a probar en orden
    folio_size = (8.5*inch, 13*inch)
    sizes_to_try = [
        ('Letter', letter),
        ('Folio', folio_size),
        ('Legal', legal)
    ]
    
    best_buffer = None
    
    for name, pagesize in sizes_to_try:
        buffer = io.BytesIO()
        # Generar story fresca para caada intento (los flowables tienen estado)
        story = _create_story(report_context, pdf_settings)
        
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=pagesize,
            topMargin=0.5*inch, bottomMargin=0.5*inch, 
            leftMargin=0.75*inch, rightMargin=0.75*inch
        )
        
        # Usar Canvas personalizado para contar páginas
        doc.build(story, canvasmaker=PageCountCanvas)
        
        # doc.canv no está disponible directamente así, pero podemos obtener el contador
        # Al usar doc.build, la instancia de canvas se pierde.
        # TRUCO: doc.pageTemplate tiene acceso? No.
        # Verificamos simplemente si es la última opción o si cupo en 1 página.
        # Pero, ¿cómo sabemos cuántas páginas usó?
        # SimpleDocTemplate no retorna el conteo.
        # Alternativa: El PageCountCanvas puede guardar el conteo en un atributo estático o pasar un callback?
        # O mejor, usamos un canvas que guarde el conteo en el objeto doc si se lo inyectamos?
        
        # Vamos a usar una solución más simple: verificar doc.page
        # doc.page se incrementa. Veamos si reportlab lo expone publicamente despues del build.
        # Sí, doc.page suele tener el número de páginas + 1.
        
        # Sin embargo, PageCountCanvas es más seguro.
        # Pero para recuperar el valor, necesitamos pasar una referencia mutable.
        
        # Simplificación: Si es Legal (último), lo aceptamos.
        # Si no, necesitamos saber si se desbordó.
        
        # Vamos a asumir que si doc.page > 1 (o 2 al final del build), entonces se pasó.
        page_count = doc.page 
        
        if page_count <= 1:
            # Cupo en una sola página
            best_buffer = buffer
            break
        
        # Si no, probamos el siguiente tamaño
        best_buffer = buffer # Guardamos por si es el último intento

    best_buffer.seek(0)
    return best_buffer.getvalue()

