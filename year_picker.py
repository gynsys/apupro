# features/preconsulta/patient_flow/flow_actions/year_picker.py

import logging
from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode
from telegram.error import BadRequest
from common import texts
from features.preconsulta.components import keyboards
from features.preconsulta.states import AWAITING_GENERIC_INPUT

try:
    from ..gyn_history_handlers import get_ordinal
except (ImportError, ModuleNotFoundError):
    def get_ordinal(n): return str(n)

logger = logging.getLogger(__name__)

async def render(update: Update, context: ContextTypes.DEFAULT_TYPE, node: dict, end_year: int = None):
    """Muestra el selector de año en formato de cuadrícula."""
    text_content = ""
    if 'text_template' in node:
        template_vars = {}
        if 'loop_variable' in context.user_data:
            loop_info = context.user_data.get('loop_variable', {})
            current_index = loop_info.get('index', 0)
            template_vars.update({
                'index_plus_one': current_index + 1,
                'ordinal': get_ordinal(current_index + 1),
                'total': loop_info.get('total', 0)
            })
        text_content += node['text_template'].format(**template_vars)
    else:
        text_content += texts.get_text(node['text_key'])

    node_id = context.user_data['current_node_id']
    await context.bot.edit_message_text(
        chat_id=update.effective_chat.id,
        message_id=context.user_data['anchor_message_id'],
        text=text_content,
        reply_markup=keyboards.get_year_grid_keyboard(node_id, end_year=end_year),
        parse_mode=ParseMode.HTML
    )
    return AWAITING_GENERIC_INPUT

async def process(update: Update, context: ContextTypes.DEFAULT_TYPE, node: dict):
    """Procesa la selección del año o la navegación en la cuadrícula."""
    query = update.callback_query
    await query.answer()
    
    node_id = context.user_data['current_node_id']
    
    try:
        action, value = query.data.replace(f"{node_id}_", "").split('_', 1)
    except ValueError:
        logger.warning(f"Callback de year_picker con formato incorrecto: {query.data}")
        return None

    if action == "select":
        year = value
        if 'loop_variable' in context.user_data:
            loop_info = context.user_data['loop_variable']
            context.user_data[loop_info['name']][loop_info['index']][node['save_to']] = year
        else:
            context.user_data[node['save_to']] = year
        return node.get('next_node')

    if action == "nav":
        new_end_year = int(value)
        await render(update, context, node, end_year=new_end_year)
        return None