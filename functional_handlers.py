"""
Handlers para examen funcional: Dolor, dispareunia, etc.
Interacción con Telegram y contexto del flujo.
"""
import logging
from telegram import Update
from telegram.ext import ContextTypes
from features.pdf_configuration import database as pdf_db
from utils.role_manager import RoleManager
from config import DB_PATH

logger = logging.getLogger(__name__)


async def combine_dispareunia_info(update: Update, context: ContextTypes.DEFAULT_TYPE, node: dict):
    """Formatea el texto para dispareunia."""
    pain_type = context.user_data.get('functional_dispareunia_type', 'Profunda')
    scale = context.user_data.get('functional_dispareunia_deep_scale', 'N/A')
    context.user_data['functional_dispareunia'] = f"Sí, de tipo {pain_type} (Intensidad: {scale}/10)"
    return node.get('next_node')


async def combine_leg_pain_info(update: Update, context: ContextTypes.DEFAULT_TYPE, node: dict):
    """Formatea el texto para dolor de piernas."""
    pain_type = context.user_data.get('functional_leg_pain_type', 'No especificado')
    zone = context.user_data.get('functional_leg_pain_zone', 'No especificada')
    context.user_data['functional_leg_pain'] = f"Sí (Tipo: {pain_type}, Zona: {zone})"
    return node.get('next_node')


async def combine_dischezia_info(update: Update, context: ContextTypes.DEFAULT_TYPE, node: dict):
    """Formatea el texto para disquecia."""
    scale = context.user_data.get('functional_dischezia_scale', 'N/A')
    context.user_data['functional_dischezia'] = f"Sí (Intensidad: {scale}/10)"
    return node.get('next_node')


async def combine_urinary_pain_info(update: Update, context: ContextTypes.DEFAULT_TYPE, node: dict):
    """Formatea el texto para dolor urinario."""
    scale = context.user_data.get('functional_urinary_pain_scale', 'N/A')
    context.user_data['functional_urinary_pain'] = f"Sí (Intensidad: {scale}/10)"
    return node.get('next_node')


async def check_functional_exam_enabled(update: Update, context: ContextTypes.DEFAULT_TYPE, node: dict):
    """
    Verifica si el examen funcional está habilitado para el doctor del paciente.
    Si está habilitado, continúa al examen funcional.
    Si no está habilitado, salta directamente a los hábitos.
    """
    user_id = update.effective_user.id
    role_manager = RoleManager(DB_PATH)
    assigned_doctor = await role_manager.get_assigned_doctor(user_id)
    
    if not assigned_doctor:
        logger.warning("No se pudo obtener el doctor asignado, asumiendo examen funcional habilitado por defecto")
        return node.get('next_if_enabled', 'ASK_DISPAREUNIA_BOOL')
    
    doctor_id = assigned_doctor[0]
    
    try:
        settings = await pdf_db.get_pdf_settings(doctor_id)
        include_functional = settings.get('include_functional_exam', {}).get('value', '1') == '1'
        
        if include_functional:
            logger.info(f"Examen funcional HABILITADO para doctor {doctor_id}, continuando con examen funcional")
            return node.get('next_if_enabled', 'ASK_DISPAREUNIA_BOOL')
        else:
            logger.info(f"Examen funcional DESHABILITADO para doctor {doctor_id}, saltando a hábitos")
            return node.get('next_if_disabled', 'ASK_PHYSICAL_ACTIVITY_BOOL')
    except Exception as e:
        logger.error(f"Error verificando configuración de examen funcional: {e}")
        return node.get('next_if_enabled', 'ASK_DISPAREUNIA_BOOL')

async def combine_surgery_info(update: Update, context: ContextTypes.DEFAULT_TYPE, node: dict):
    """Combina el año de la cirugía con los antecedentes quirúrgicos."""
    surgery_name = context.user_data.get('surgical_history', 'Sí')
    year = context.user_data.get('surgery_year', '')
    if year:
        context.user_data['surgical_history'] = f"{surgery_name} (Año: {year})"
    return node.get('next_node')

