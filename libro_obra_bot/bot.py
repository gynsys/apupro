"""Bot de Telegram exclusivo para la gestión del Libro de Obra Digital."""
import html
import logging
from typing import Optional

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from libro_obra_bot.config import BOT_TOKEN
from libro_obra_bot.conversation_libro import (
    ask_confirm_delete_libro,
    execute_delete_libro,
    execute_save_pending_libro_entry,
    get_libro_obra_conversation_handler,
    handle_cancel_or_back_preview,
    handle_discard_pending_libro_entry,
    handle_download_libro,
    handle_menu_editar_hoja,
    handle_regenerate_libro_desc,
    handle_save_edited_field,
    handle_select_book_to_edit,
    handle_select_sheet_to_edit,
    handle_show_edit_fields_menu,
    handle_start_edit_libro_field,
    process_full_report_for_libro,
    return_to_clean_main_menu,
    show_delete_libro_menu,
    show_libro_obra_hub,
    show_saved_libros_menu,
    start_libro_obra_flow,
)
from libro_obra_bot.keyboards import get_libro_main_keyboard

# Configuración del registrador de logs
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("libro_obra_bot")


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Comando /start: Da la bienvenida y muestra el panel principal del Libro de Obra."""
    await return_to_clean_main_menu(update, context)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Comando /ayuda: Muestra las instrucciones de uso del Libro de Obra."""
    help_text = (
        "📖 *Guía del Libro de Obra Digital*\n\n"
        "Este bot está diseñado para la administración y llenado oficial del Libro de Obra en formato Excel.\n\n"
        "🔹 *¿Cómo asentar una hoja diaria?*\n"
        "1. Usa /asentar o presiona *✍️ Asentar Nueva Hoja Diaria*.\n"
        "2. Selecciona la obra (o escribe el nombre si es nueva).\n"
        "3. Ingresa fecha, horas laboradas, estado del tiempo y personal presente.\n"
        "4. Especifica los equipos y las actividades realizadas.\n"
        "5. El asistente redactará la labor con apoyo de IA y te mostrará la vista previa.\n"
        "6. Revisa y presiona *✅ Confirmar y Guardar* para asentar la hoja foliada en el Excel.\n\n"
        "🔹 *Pega rápida de reporte:*\n"
        "Puedes pegar directamente el texto de tu reporte del día en el chat y el bot "
        "lo convertirá automáticamente en un borrador de hoja para tu revisión.\n\n"
        "🔹 *Comandos útiles:*\n"
        "• /start o /menu - Panel principal del Libro de Obra\n"
        "• /asentar o /nuevo - Iniciar llenado de hoja\n"
        "• /libros o /ver - Ver libros guardados y descargar Excel\n"
        "• /editar - Modificar una hoja asentada previamente\n"
        "• /borrar_libro - Eliminar un libro de obra\n"
        "• /cancelar - Cancelar el flujo actual"
    )
    if update.message:
        await update.message.reply_text(
            help_text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=get_libro_main_keyboard(),
        )
    elif update.callback_query and update.callback_query.message:
        await update.callback_query.message.reply_text(
            help_text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=get_libro_main_keyboard(),
        )


async def asentar_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Comando /asentar o /nuevo: Inicia el flujo para registrar una hoja."""
    await start_libro_obra_flow(update, context)


async def libros_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Comando /libros o /ver: Muestra el catálogo de libros y descarga."""
    await show_saved_libros_menu(update, context)


async def editar_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Comando /editar: Permite editar una hoja guardada."""
    await handle_menu_editar_hoja(update, context)


async def borrar_libro_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Comando /borrar_libro: Menú para eliminar un libro."""
    await show_delete_libro_menu(update, context)


async def reset_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Comando /cancelar: Cancela cualquier operación activa y vuelve al menú."""
    context.user_data.pop("libro_flow", None)
    context.user_data.pop("pending_libro_entry", None)
    context.user_data.pop("pending_edit_field", None)
    if update.message:
        await update.message.reply_text(
            "🔄 Operación cancelada. Regresando al panel principal.",
            reply_markup=get_libro_main_keyboard(),
        )


async def handle_callback_query(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Maneja las interacciones de botones en línea del Libro de Obra."""
    query = update.callback_query
    if not query:
        return

    await query.answer()
    data = query.data or ""

    if data in ("btn_menu_libro", "btn_menu_home"):
        await return_to_clean_main_menu(update, context)
    elif data == "btn_libro_registrar":
        await start_libro_obra_flow(update, context)
    elif data == "btn_libro_menu_editar":
        await handle_menu_editar_hoja(update, context)
    elif data == "btn_libro_ver":
        await show_saved_libros_menu(update, context)
    elif data == "btn_libro_eliminar":
        await show_delete_libro_menu(update, context)
    elif data == "btn_libro_ayuda":
        await help_command(update, context)
    elif data == "btn_libro_guardar_entry":
        await execute_save_pending_libro_entry(update, context)
    elif data == "btn_libro_edit_desc":
        await handle_start_edit_libro_field(update, context, "descripcion_labor")
    elif data == "btn_libro_edit_obs":
        await handle_start_edit_libro_field(update, context, "observaciones")
    elif data == "btn_libro_edit_pers":
        await handle_start_edit_libro_field(update, context, "personal")
    elif data == "btn_libro_edit_equip":
        await handle_start_edit_libro_field(update, context, "equipos")
    elif data == "btn_libro_edit_partidas":
        await handle_start_edit_libro_field(update, context, "resumen_actividades")
    elif data == "btn_libro_edit_clima":
        await handle_start_edit_libro_field(update, context, "clima")
    elif data == "btn_libro_edit_civ_res":
        await handle_start_edit_libro_field(update, context, "civ_residente")
    elif data == "btn_libro_edit_civ_insp":
        await handle_start_edit_libro_field(update, context, "civ_inspector")
    elif data == "btn_libro_edit_menu":
        await handle_show_edit_fields_menu(update, context)
    elif data in ("btn_libro_cancel_edit", "btn_libro_preview_back"):
        await handle_cancel_or_back_preview(update, context)
    elif data == "btn_libro_regen_desc":
        await handle_regenerate_libro_desc(update, context)
    elif data in ("btn_libro_descartar", "btn_reset"):
        await handle_discard_pending_libro_entry(update, context)
    elif data.startswith("btn_edit_book_"):
        await handle_select_book_to_edit(update, context)
    elif data.startswith("btn_edit_sheet_"):
        await handle_select_sheet_to_edit(update, context)
    elif data.startswith("btn_dl_libro_"):
        await handle_download_libro(update, context)
    elif data.startswith("btn_askdel_libro_"):
        await ask_confirm_delete_libro(update, context)
    elif data.startswith("btn_execdel_libro_"):
        await execute_delete_libro(update, context)


async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Maneja mensajes de texto libres cuando no están atrapados en el ConversationHandler."""
    if not update.message or not update.message.text:
        return

    text = update.message.text.strip()

    # Si el usuario está editando un campo en la vista previa del libro
    if context.user_data.get("pending_edit_field"):
        await handle_save_edited_field(update, context)
        return

    # Si pega un reporte o texto largo, procesarlo para el libro de obra
    if len(text) > 40:
        await process_full_report_for_libro(update, context, text)
        return

    # Mensaje corto no reconocido
    await update.message.reply_text(
        "📖 *Panel del Libro de Obra Digital*\n\n"
        "Para asentar una jornada utiliza el botón *✍️ Asentar Nueva Hoja Diaria* o "
        "pega el reporte detallado del día en un solo mensaje.\n\n"
        "Escribe /ayuda para más información.",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=get_libro_main_keyboard(),
    )


async def global_error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Manejador global de excepciones para prevenir caídas del bot."""
    err = context.error
    logger.error("Excepción en bot de Libro de Obra: %s", err, exc_info=True)

    if isinstance(update, Update) and update.effective_message:
        try:
            await update.effective_message.reply_text(
                "⚠️ Hubo un detalle al procesar la solicitud, pero la sesión sigue activa.\n"
                "Por favor usa /menu o intenta nuevamente."
            )
        except Exception as exc:
            logger.debug("No se pudo notificar al usuario: %s", exc)


def create_bot_app() -> Application:
    """Construye y configura la aplicación de Telegram Bot para Libro de Obra."""
    if not BOT_TOKEN or BOT_TOKEN.startswith("PEGA_"):
        raise ValueError("Token de Telegram no configurado. Define TELEGRAM_LIBRO_BOT_TOKEN o TELEGRAM_BOT_TOKEN.")

    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_error_handler(global_error_handler)

    # 1. Comandos principales
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("menu", start_command))
    app.add_handler(CommandHandler("ayuda", help_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("asentar", asentar_command))
    app.add_handler(CommandHandler("nuevo", asentar_command))
    app.add_handler(CommandHandler("libros", libros_command))
    app.add_handler(CommandHandler("ver", libros_command))
    app.add_handler(CommandHandler("editar", editar_command))
    app.add_handler(CommandHandler("borrar_libro", borrar_libro_command))
    app.add_handler(CommandHandler("cancelar", reset_command))

    # 2. Conversación multi-etapa del libro de obra
    app.add_handler(get_libro_obra_conversation_handler())

    # 3. Interacciones con botones inline
    app.add_handler(CallbackQueryHandler(handle_callback_query))

    # 4. Mensajes de texto libres
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_message))

    return app


def main() -> None:
    """Punto de entrada principal para ejecutar el bot de Libro de Obra."""
    logger.info("Iniciando Bot de Libro de Obra Digital en Telegram...")
    app = create_bot_app()
    logger.info("Bot de Libro de Obra activo y escuchando...")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
