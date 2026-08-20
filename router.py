"""
Router: Despachador de acciones (reemplaza la función 'render' gigante).
Mapea nombres de handlers a funciones específicas.
"""
import logging
from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler
from features.preconsulta.states import AWAITING_GENERIC_INPUT
from features.preconsulta.patient_flow.personal_info_handlers import show_personal_info_summary
from features.preconsulta.patient_flow.flow_actions import loop
from features.preconsulta.patient_flow.flow_actions import summaries
from .handlers import (
    # Obstétricos
    decide_obstetric_flow,
    prepare_obstetric_flow,
    prepare_prenatal_flow,
    prepare_single_prenatal_record,
    finalize_single_prenatal_record,
    calculate_ho_action,
    process_obstetric_history_from_table,
    prepare_birth_details_loop,
    prepare_pregnancy_type_loop,
    prepare_children_loops,
    prepare_children_sub_loop,
    ask_child_data_step,
    prepare_children_details_loop,
    start_children_details_loop,
    # Ginecológicos
    decide_if_ask_frequency,
    combine_irregular_cycle_info,
    combine_regular_cycle_info,
    combine_dysmenorrhea_info,
    # Funcionales
    combine_dispareunia_info,
    combine_leg_pain_info,
    combine_dischezia_info,
    combine_urinary_pain_info,
    check_functional_exam_enabled,
    combine_surgery_info,
    # Hábitos
    combine_activity_info,
    # Ciclo de vida
    finish_preconsultation,
    check_if_pregnant_for_fertility,
)
from .utils.logic_helpers import process_conditional, process_conditional_calc

logger = logging.getLogger(__name__)


async def render(update: Update, context: ContextTypes.DEFAULT_TYPE, node: dict):
    """
    Despachador para nodos de tipo 'action'.
    Mapea nombres de handlers a funciones específicas.
    """
    handler_name = node.get('handler')
    
    # Log especial para generate_summaries
    if handler_name == "generate_summaries":
        ho_data = context.user_data.get('gyn_ho')
        details_data = context.user_data.get('prenatal_details')
        log_message = (
            "\n" + "!"*20 + " PRUEBA PRECISA " + "!"*20 + "\n"
            f"Momento: Justo ANTES de llamar a generate_summaries.\n"
            f"Contenido de 'gyn_ho': {ho_data}\n"
            f"Contenido de 'prenatal_details': {details_data}\n"
            + "!"*56
        )
        print(log_message)
        logger.info(log_message)
    
    # Mapeo de handlers
    action_handlers = {
        "show_personal_info_summary": show_personal_info_summary,
        "loop_step": loop.step,
        "prepare_pregnancy_type_loop": prepare_pregnancy_type_loop,
        "prepare_children_loops": prepare_children_loops,
        "ask_child_data_step": ask_child_data_step,
        "prepare_children_sub_loop": prepare_children_sub_loop,
        "prepare_children_details_loop": prepare_children_details_loop,
        "start_children_details_loop": start_children_details_loop,
        "check_if_pregnant_for_fertility": check_if_pregnant_for_fertility,
        "decide_if_ask_frequency": decide_if_ask_frequency,
        "combine_irregular_cycle_info": combine_irregular_cycle_info,
        "combine_regular_cycle_info": combine_regular_cycle_info,
        "combine_dysmenorrhea_info": combine_dysmenorrhea_info,
        "combine_dispareunia_info": combine_dispareunia_info,
        "combine_leg_pain_info": combine_leg_pain_info,
        "combine_dischezia_info": combine_dischezia_info,
        "combine_urinary_pain_info": combine_urinary_pain_info,
        "combine_surgery_info": combine_surgery_info,
        "combine_activity_info": combine_activity_info,
        "prepare_prenatal_flow": prepare_prenatal_flow,
        "prepare_birth_details_loop": prepare_birth_details_loop,
        "prepare_obstetric_flow": prepare_obstetric_flow,
        "prepare_single_prenatal_record": prepare_single_prenatal_record,
        "finalize_single_prenatal_record": finalize_single_prenatal_record,
        "decide_obstetric_flow": decide_obstetric_flow,
        "calculate_ho_action": calculate_ho_action,
        "generate_summaries": summaries.generate_summaries,
        "finish_preconsultation": finish_preconsultation,
        "check_functional_exam_enabled": check_functional_exam_enabled,
    }

    if handler_name not in action_handlers:
        logger.error(f"Acción personalizada desconocida: {handler_name}")
        return ConversationHandler.END

    action_function = action_handlers[handler_name]

    # Handler especial que maneja su propio render
    if handler_name == "show_personal_info_summary":
        return await action_function(update, context, node)

    # Importar render_node localmente para evitar ciclos
    from features.preconsulta.patient_flow.generic_flow_engine import render_node

    # Ejecutar la acción
    next_node_id_or_signal = await action_function(update, context, node)

    # Procesar el resultado
    if isinstance(next_node_id_or_signal, int):
        return next_node_id_or_signal

    if next_node_id_or_signal == "END_CONVERSATION":
        context.user_data.clear()
        return ConversationHandler.END

    if next_node_id_or_signal:
        return await render_node(update, context, next_node_id_or_signal)

    return AWAITING_GENERIC_INPUT


async def process_conditional_handler(update: Update, context: ContextTypes.DEFAULT_TYPE, node: dict):
    """Procesa un nodo condicional y devuelve el ID del siguiente nodo."""
    result = process_conditional(
        context.user_data,
        node['variable1'],
        node['variable2'],
        node.get('op', '==')
    )
    return node['next_on_true'] if result else node['next_on_false']


async def process_conditional_calc_handler(update: Update, context: ContextTypes.DEFAULT_TYPE, node: dict):
    """Procesa un nodo condicional con cálculo y devuelve el ID del siguiente nodo."""
    next_node = node['next_on_false']
    result = process_conditional_calc(
        context.user_data,
        node['calc'],
        node.get('variable', 'gyn_gesta'),
        node.get('op', '==')
    )
    
    if result:
        if node.get('next_on_true') == 'PREPARE_CHILD_LOOP':
            context.user_data['gyn_abortion'] = 0
        next_node = node['next_on_true']
    
    return next_node

