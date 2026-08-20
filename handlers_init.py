"""
Handlers: CAPA LÓGICA DE FLUJO (Telegram + Contexto)
Handlers que interactúan con Telegram y el contexto del flujo.
"""
from .obstetric_handlers import (
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
)
from .gyne_handlers import (
    decide_if_ask_frequency,
    combine_irregular_cycle_info,
    combine_regular_cycle_info,
    combine_dysmenorrhea_info,
)
from .functional_handlers import (
    combine_dispareunia_info,
    combine_leg_pain_info,
    combine_dischezia_info,
    combine_urinary_pain_info,
    check_functional_exam_enabled,
    combine_surgery_info,
)
from .habits_handlers import (
    combine_activity_info,
)
from .lifecycle_handlers import (
    finish_preconsultation,
    check_if_pregnant_for_fertility,
)

__all__ = [
    'decide_obstetric_flow',
    'prepare_obstetric_flow',
    'prepare_prenatal_flow',
    'prepare_single_prenatal_record',
    'finalize_single_prenatal_record',
    'calculate_ho_action',
    'process_obstetric_history_from_table',
    'prepare_birth_details_loop',
    'prepare_pregnancy_type_loop',
    'prepare_children_loops',
    'prepare_children_sub_loop',
    'ask_child_data_step',
    'prepare_children_details_loop',
    'start_children_details_loop',
    'decide_if_ask_frequency',
    'combine_irregular_cycle_info',
    'combine_regular_cycle_info',
    'combine_dysmenorrhea_info',
    'combine_dispareunia_info',
    'combine_leg_pain_info',
    'combine_dischezia_info',
    'combine_urinary_pain_info',
    'check_functional_exam_enabled',
    'combine_surgery_info',
    'combine_activity_info',
    'finish_preconsultation',
    'check_if_pregnant_for_fertility',
]

