# common/pdf/medical_history.py
# Generación de PDF para Historia Médica Completa
import os
import io
import logging
from datetime import datetime
from reportlab.lib.pagesizes import legal
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.units import inch
from reportlab.lib import colors

from features.pdf_configuration.database import get_pdf_settings
from .utils import format_simple_antecedente, format_family_history, create_logo_image, create_qr_image

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


async def generate_medical_report(report_data: dict, doctor_id: int) -> bytes:
    """
    Genera el PDF de la Historia Médica Completa (tamaño oficio).
    """
    buffer = io.BytesIO()
    # Historia médica usa tamaño OFICIO (legal)
    doc = SimpleDocTemplate(buffer, pagesize=legal, topMargin=0.5*inch, bottomMargin=0.5*inch, leftMargin=0.75*inch, rightMargin=0.75*inch)
    story = []

    styleN = ParagraphStyle(name='Normal', fontName='Times-Roman', fontSize=10, leading=12)
    styleB = ParagraphStyle(name='Bold', fontName='Times-Bold', fontSize=10, leading=12)
    styleH1 = ParagraphStyle(name='Heading1', fontName='Times-Bold', fontSize=14, alignment=TA_CENTER, spaceAfter=6)
    styleJustify = ParagraphStyle(name='Justify', parent=styleN, alignment=TA_JUSTIFY)

    def get_str(key, default=''):
        value = report_data.get(key)
        if value is None:
            return default
        # Si el valor es la cadena 'None', también retornar default
        if str(value).strip() == 'None':
            return default
        return str(value) if value else default

    # --- OBTENER CONFIGURACIÓN DINÁMICA ---
    pdf_settings = await get_pdf_settings(doctor_id)
    
    # Verificar si el examen funcional está habilitado para este doctor
    include_functional_exam = pdf_settings.get('include_functional_exam', {}).get('value', '1') == '1'

    def get_pdf_setting(setting_key, default=''):
        """Obtiene valor de configuración respetando visibilidad"""
        setting = pdf_settings.get(setting_key, {})
        if not setting.get('visible', True):
            return None  # No mostrar si no es visible
        return setting.get('value', default)

    logo_header_1_path = get_pdf_setting('logo_header_1')
    logo_header_2_path = get_pdf_setting('logo_header_2')
    signature_path = get_pdf_setting('logo_signature')

    # LOGS DE DEPURACIÓN
    logger.info("🔄 Generando PDF de Historia Médica con configuración:")
    logger.info(f"   Logo izquierdo: {logo_header_1_path} - Existe: {os.path.exists(logo_header_1_path) if logo_header_1_path else 'No'}")
    logger.info(f"   Logo derecho: {logo_header_2_path} - Existe: {os.path.exists(logo_header_2_path) if logo_header_2_path else 'No'}")
    logger.info(f"   Firma: {signature_path} - Existe: {os.path.exists(signature_path) if signature_path else 'No'}")

    logger.info(f"   👁️ Logo 1 visible: {pdf_settings.get('logo_header_1', {}).get('visible', True)}")
    logger.info(f"   👁️ Logo 2 visible: {pdf_settings.get('logo_header_2', {}).get('visible', True)}")
    logger.info(f"   👁️ Firma visible: {pdf_settings.get('logo_signature', {}).get('visible', True)}")
    
    # Construir texto del encabezado dinámicamente
    header_parts = []

    doctor_name = get_pdf_setting('doctor_name', 'Dra. Mariel Herrera')
    if doctor_name:
        header_parts.append(f"<b>{doctor_name}</b>")

    specialty = get_pdf_setting('specialty', 'Especialista en Ginecología y Obstetricia')
    if specialty:
        header_parts.append(specialty)

    location = get_pdf_setting('location', 'Caracas-Guarenas Guatire')
    if location:
        header_parts.append(location)

    phones = get_pdf_setting('phones', '04244281876-04127738918')
    if phones:
        header_parts.append(f"Citas: {phones}")

    header_text = "<br/>".join(header_parts)

    # Logos del encabezado
    logo_left = create_logo_image(logo_header_1_path, width=1.2*inch, height=1.2*inch)
    left_height = logo_left.drawHeight if logo_left else 0.8*inch
    logo_right = create_logo_image(logo_header_2_path, width=left_height, height=left_height)
    signature_img = create_logo_image(signature_path, width=2.5*inch, height=1*inch)
    
    # Columna derecha del encabezado: solamente el logo derecho (configurado en la interfaz)
    right_column_elements = []
    if logo_right:
        right_column_elements.append(logo_right)
    
    # Si no hay logo derecho, usar espacio vacío
    right_column_content = right_column_elements if right_column_elements else [""]
    
    # Tabla de encabezado: [logo_left, header_text, right_column]
    header_data = [[logo_left, Paragraph(header_text, styleN), right_column_content]]
    header_table = Table(header_data, colWidths=[1*inch, 5.5*inch, 1*inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (1,0), (1,0), 'CENTER'),
        ('LEFTPADDING', (1, 0), (1, 0), 0.197*inch),  # Mover bloque de datos del doctor 5mm a la derecha
        ('ALIGN', (2, 0), (2, 0), 'CENTER'),         # Centrar la columna derecha
    ]))
    story.append(header_table)

    # Título del informe (dinámico)
    report_title = get_pdf_setting('report_title', 'INFORME v MÉDICO')
    if report_title:
        story.append(Paragraph(f"<u>{report_title}</u>", styleH1))

    line_table = Table([['']], colWidths=[7.5*inch])
    line_table.setStyle(TableStyle([('LINEBELOW', (0,0), (-1,-1), 1, colors.black)]))
    story.append(line_table)
    story.append(Spacer(1, 0.2*inch))

    # --- TABLA DE PACIENTE ---
    patient_table_data = [
        [Paragraph("<b>Nombre y Apellidos:</b>", styleB), Paragraph(get_str('full_name').title(), styleN),
         Paragraph("<b>Edad:</b>", styleB), Paragraph(get_str('age'), styleN)],
        [Paragraph("<b>C.I.:</b>", styleB), Paragraph(get_str('ci'), styleN),
         Paragraph("<b>TLF:</b>", styleB), Paragraph(get_str('phone'), styleN)],
        [Paragraph("<b>Dirección:</b>", styleB), Paragraph(get_str('address').title(), styleN),
         Paragraph("<b>Ocupación:</b>", styleB), Paragraph(get_str('occupation').title(), styleN)],
    ]
    patient_table = Table(patient_table_data, colWidths=[1.8*inch, 2.7*inch, 1.0*inch, 2.0*inch])
    patient_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LINEBELOW', (0,-1), (-1,-1), 0.5, colors.Color(0.8, 0.8, 0.8))
    ]))
    story.append(patient_table)
    story.append(Spacer(1, 0.2*inch))

    # --- CUERPO DEL INFORME ---
    body_rows = []

    family_history_formatted = format_family_history(get_str('family_history_mother'), get_str('family_history_father'))
    personal_history_formatted = format_simple_antecedente(get_str('personal_history'))
    supplements_formatted = format_simple_antecedente(get_str('supplements'))
    surgical_history = get_str('surgical_history')
    surgery_year = get_str('surgery_year')
    if surgical_history.lower() not in ['no', '', 'niega']:
        if surgery_year:
            surgical_history = f"{surgical_history} (Año: {surgery_year})"
    surgical_history_formatted = format_simple_antecedente(surgical_history)

    sections = [
        ("Motivo de consulta", get_str('reason_for_visit'), styleN),
        ("Antecedentes Familiares", family_history_formatted, styleN),
        ("Antecedentes Personales", personal_history_formatted, styleN),
        ("Suplementos", supplements_formatted, styleN),
        ("Antecedentes quirúrgicos", surgical_history_formatted, styleN),
        ("Antecedentes Obstétricos y Ginecológicos", get_str('summary_gyn_obstetric'), styleJustify),
    ]
    
    # Examen Funcional: solo incluir si está habilitado en la configuración actual
    if include_functional_exam:
        sections.append(("Examen Funcional", get_str('summary_functional_exam'), styleJustify))
    
    sections.extend([
        ("Hábitos psicobiológicos", get_str('summary_habits'), styleJustify),
        ("Examen Físico", get_str('admin_physical_exam'), styleJustify),
        ("Ultrasonido transvaginal", get_str('admin_ultrasound'), styleJustify),
        ("Diagnóstico", get_str('admin_diagnosis'), 'numbered'),
        ("Plan", get_str('admin_plan'), 'bullet'),
        ("Observaciones", get_str('admin_observations'), styleJustify),
    ])

    for section_data in sections:
        # Todas las secciones ahora son tuplas de 3 elementos (label, content, style_or_type)
        label, content, style_or_type = section_data
        
        if not content or content.isspace():
            continue
        label_p = Paragraph(f"<b>{label}:</b>", styleB)
        value_p_list = []
        if isinstance(style_or_type, ParagraphStyle):
            paragraphs = content.strip().split('<br/>')
            for p_text in paragraphs:
                if p_text.strip():
                    value_p_list.append(Paragraph(p_text, style_or_type))
        else:
            items = [item.strip() for item in content.strip().split('\n') if item.strip()]
            list_style = ParagraphStyle(name='ListItem', parent=styleN, leftIndent=12)
            for i, item_text in enumerate(items):
                prefix = f"{i+1})&nbsp;" if style_or_type == 'numbered' else "•&nbsp;&nbsp;"
                value_p_list.append(Paragraph(f"{prefix}{item_text}", list_style))
        body_rows.append([label_p, value_p_list])

    if body_rows:
        body_table = Table(body_rows, colWidths=[2.2*inch, 5.3*inch])
        body_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LINEBELOW', (0, 0), (-1, -1), 0.25, colors.Color(0.8, 0.8, 0.8)),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6)
        ]))
        story.append(body_table)

    # --- PIE DE PÁGINA CON CONFIGURACIÓN DINÁMICA ---
    story.append(Spacer(1, 0.3*inch))

    # Ciudad del pie de página (dinámica)
    footer_city = get_pdf_setting('footer_city', 'Guarenas')
    today_str = format_date_spanish()
    pre_signature_text = f"Sin otro particular se suscribe en {footer_city} a los {today_str}."
    story.append(Paragraph(pre_signature_text, ParagraphStyle(name='PreFooter', fontSize=8, alignment=TA_CENTER, spaceAfter=12)))

    # Firma + QR
    signature_block = signature_img if signature_img else Paragraph(
        "_________________________",
        ParagraphStyle(name='SignatureLine', alignment=TA_CENTER)
    )
    if signature_img:
        signature_img.hAlign = 'CENTER'

    post_signature_parts = []

    if doctor_name:
        post_signature_parts.append(f"<b>{doctor_name}</b>")

    specialty_line = "Ginecólogo Obstetra - UCV"
    post_signature_parts.append(specialty_line)

    mpps_number = get_pdf_setting('mpps_number')
    cmdm_number = get_pdf_setting('cmdm_number')
    if mpps_number and cmdm_number:
        post_signature_parts.append(f"MPPS: {mpps_number} / CMDM: {cmdm_number}")

    doctor_id_setting = get_pdf_setting('doctor_id')
    if doctor_id_setting:
        post_signature_parts.append(f"C.I.: {doctor_id_setting}")

    post_signature_text = "<br/>".join(post_signature_parts)
    doctor_info_para = Paragraph(
        post_signature_text,
        ParagraphStyle(name='PostFooter', fontSize=8, alignment=TA_CENTER, leading=10)
    )

    # Solo la firma y datos del médico (sin QR, ya está en el encabezado)
    signature_column = [signature_block, Spacer(1, 0.05*inch), doctor_info_para]

    # Firma y datos del médico centrados (sin wrapper que desplaza a la derecha)
    signature_table = Table(
        [[signature_column]],
        colWidths=[7.5*inch]
    )
    signature_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (0, 0), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(signature_table)

    # Construir el PDF
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()

