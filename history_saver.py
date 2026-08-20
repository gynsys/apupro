"""
Construcción del diccionario de datos de historia y guardado.
Lógica pura de construcción de datos, sin interacción con Telegram.
"""
import json
import logging

logger = logging.getLogger(__name__)


def build_history_data(user_data: dict, user_id: int, doctor_id: int) -> dict:
    """
    Construye el diccionario de datos para guardar en la base de datos.
    
    Args:
        user_data: Diccionario con todos los datos del usuario
        user_id: ID del usuario
        doctor_id: ID del doctor
    
    Returns:
        dict: Diccionario con los datos formateados para guardar
    """
    history_data = {
        'doctor_id': doctor_id,
        'user_id': user_id,
        'full_name': user_data.get('full_name'),
        'age': user_data.get('age'),
        'ci': user_data.get('ci'),
        'phone': user_data.get('phone'),
        'address': user_data.get('address'),
        'occupation': user_data.get('occupation'),
        'family_history_mother': user_data.get('family_history_mother'),
        'family_history_father': user_data.get('family_history_father'),
        'personal_history': user_data.get('personal_history'),
        'supplements': user_data.get('supplements'),
        'surgical_history': user_data.get('surgical_history'),
        'consultation_type': user_data.get('consultation_type'),
        'reason_for_visit': user_data.get('reason_for_visit'),
        'gyn_menarche': user_data.get('gyn_menarche'),
        'gyn_sexarche': user_data.get('gyn_sexarche'),
        'gyn_cycles': user_data.get('gyn_cycles'),
        'gyn_dysmenorrhea': user_data.get('gyn_dysmenorrhea'),
        'gyn_fum': user_data.get('gyn_fum'),
        'gyn_mac': user_data.get('gyn_mac'),
        'gyn_previous_checkups': user_data.get('gyn_previous_checkups'),
        'gyn_last_pap_smear': user_data.get('gyn_last_pap_smear'),
        'sexually_active': user_data.get('sexually_active'),
        'gyn_fertility_intent': user_data.get('gyn_fertility_intent'),
        'gyn_ho': user_data.get('gyn_ho'),
        'functional_dispareunia': user_data.get('functional_dispareunia'),
        'functional_leg_pain': user_data.get('functional_leg_pain'),
        'functional_gastro_before': user_data.get('functional_gastro_before'),
        'functional_gastro_during': user_data.get('functional_gastro_during'),
        'functional_dischezia': user_data.get('functional_dischezia'),
        'functional_bowel_freq': user_data.get('functional_bowel_freq'),
        'functional_urinary_problem': user_data.get('functional_urinary_problem'),
        'functional_urinary_pain': user_data.get('functional_urinary_pain'),
        'functional_urinary_irritation': user_data.get('functional_urinary_irritation'),
        'functional_urinary_incontinence': user_data.get('functional_urinary_incontinence'),
        'functional_urinary_nocturia': user_data.get('functional_urinary_nocturia'),
        'habits_physical_activity': user_data.get('habits_physical_activity'),
        'habits_smoking': user_data.get('habits_smoking'),
        'habits_alcohol': user_data.get('habits_alcohol'),
        'habits_substance_use': user_data.get('habits_substance_use'),
        'status': 'pending',
        'summary_functional_exam': user_data.get('summary_functional_exam'),
        'summary_gyn_obstetric': user_data.get('summary_gyn_obstetric'),
        'summary_habits': user_data.get('summary_habits')
    }

    # Agregar detalles prenatales si existen
    if 'birth_details' in user_data:
        history_data['prenatal_details'] = json.dumps(
            user_data['birth_details'],
            indent=2,
            ensure_ascii=False
        )

    # Filtrar valores None
    history_data = {k: v for k, v in history_data.items() if v is not None}

    logger.info(f"Historia construida para usuario {user_id} con doctor {doctor_id}")
    return history_data

