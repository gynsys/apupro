"""
Bot de Telegram para Inspección de Obras (fichas_inspector).
Fase 1: Recibe reporte diario por texto, fotos adjuntas y compila la Ficha Técnica
con Memoria Fotográfica en PDF y/o Excel (.xlsx).
Soporta:
  1. Pie de foto / descripción corta debajo de cada imagen.
  2. Fecha de inicio de obra.
  3. Lapso / plazo de ejecución.
  4. Acumulación automática de hojas de inspección en un único libro de Excel por obra.
"""
import logging
import os
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import openpyxl
from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Update,
)
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

from inspector_bot.ai_labor_describer import generate_labor_description_ai
from inspector_bot.config import BOT_TOKEN, PDFS_DIR, PHOTOS_DIR
from inspector_bot.conversation_libro import (
    ask_confirm_delete_libro,
    build_libro_entry_preview,
    execute_delete_libro,
    execute_save_pending_libro_entry,
    get_libro_entry_preview_keyboard,
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
from inspector_bot.excel_generator import generate_inspection_excel
from inspector_bot.google_drive_service import upload_file_to_drive
from inspector_bot.libro_obra_service import add_daily_entry_to_book
from inspector_bot.parser import (
    format_engineer_name,
    parse_inspection_message,
    resolve_single_inspector,
)
from inspector_bot.pdf_generator import generate_inspection_pdf
from inspector_bot.project_store import (
    get_inspections_for_project,
    get_project_metadata,
    get_recent_projects,
    save_inspection_entry,
    save_project_metadata,
)
from inspector_bot.keyboards import (
    get_awaiting_photos_keyboard,
    get_home_keyboard,
    get_main_menu_keyboard,
    get_post_save_keyboard,
    get_report_action_keyboard,
    sanitize_filename,
)
from inspector_bot.weekly_summary_service import consolidate_weekly_inspection

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

# Compatibilidad con alias anteriores
_sanitize_filename = sanitize_filename
_get_main_menu_keyboard = get_main_menu_keyboard
_get_report_action_keyboard = get_report_action_keyboard
_get_format_keyboard = get_report_action_keyboard


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Mensaje de bienvenida con menú de selección de función."""
    # Limpiar cualquier flujo previo atascado
    context.user_data.pop("libro_flow", None)

    welcome_text = (
        "🏗 *¡Bienvenido al Asistente de Inspección e Ingeniería!*\n\n"
        "Selecciona la acción que deseas realizar hoy:\n\n"
        "📋 *1. Generar Ficha de Inspección*\n"
        "Convierte tu reporte diario de obra y fotos en un Informe Técnico formal en PDF o Excel (.xlsx) con Memoria Fotográfica.\n\n"
        "🗓️ *2. Ficha Resumen Semanal*\n"
        "Consolida automáticamente todas las inspecciones de la semana con actividades únicas y fotos agrupadas.\n\n"
        "📖 *3. Libro de Obra*\n"
        "Administra tus libros oficiales en Excel: asienta nuevas hojas, consulta libros guardados o elimínalos."
    )
    if update.message:
        await update.message.reply_text(
            welcome_text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=get_main_menu_keyboard(),
        )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Muestra comandos y formato de reporte admitido."""
    help_text = (
        "🛠 *Comandos disponibles:*\n"
        "• `/start` - Menú principal\n"
        "• `/libro` - Menú interactivo de Libro de Obra (Llenar, Ver, Eliminar)\n"
        "• `/libros` - Ver y descargar Libros de Obra guardados en Excel\n"
        "• `/borrar_libro` - Eliminar permanentemente un libro de obra\n"
        "• `/generar` - Elegir formato y descargar informe de ficha (PDF o Excel)\n"
        "• `/pdf` - Generar ficha técnica directamente en PDF\n"
        "• `/excel` - Generar ficha técnica en Excel (.xlsx con hojas acumuladas)\n"
        "• `/ver` - Ver datos y fotos acumuladas en la sesión de ficha\n"
        "• `/nuevo` - Reiniciar sesión para un reporte nuevo de ficha\n"
        "• `/nuevo_libro` - Reiniciar el libro acumulativo de fichas para la obra actual\n\n"
        "📝 *Ejemplo de mensaje admitido:*\n"
        "```text\n"
        "Fecha: 28/10/2026\n"
        "Obra: REHABILITACIÓN INTEGRAL DE LA UNIDAD...\n"
        "Fecha de Inicio: 26/10/2026.\n"
        "Lapso de Ejecucion: 3 meses.\n"
        "Nombre de la empresa: Constructora Truckers C.A\n"
        "Ing. Residente: Génesis Quintero\n"
        "Ing. Inspector: 2\n"
        "Guido Farroni.\n"
        "Pablo Milano\n"
        "Caporal Jesús Ramirez.\n"
        "Actividades en ejecución:\n"
        ".- Demolición a mano de pared perimetral.\n"
        ".- Remoción de piezas sanitarias dañadas.\n"
        "Obreros en obra: 5 obreros.\n"
        "Caporal de obra: 1\n"
        "```"
    )
    if update.message:
        await update.message.reply_text(help_text, parse_mode=ParseMode.MARKDOWN)


async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Procesa mensajes de texto y detecta reportes diarios de inspección o descripciones de fotos."""
    if not update.message:
        return

    text = (update.message.text or "").strip()
    if not text:
        return

    # Si el usuario está editando un campo del Libro de Obra
    if context.user_data.get("editing_libro_field"):
        if await handle_save_edited_field(update, context, text):
            return

    # Si el usuario está en modo Libro de Obra, procesar sin fotos y mostrar vista previa por bloques
    if context.user_data.get("active_module") == "libro":
        if await process_full_report_for_libro(update, context, text):
            return

    # Verificar si parece un reporte de obra
    has_indicators = any(
        kw in text.lower()
        for kw in ("obra", "fecha", "inspecci", "actividades", "residente", "contratista", "obreros", "ejecucion")
    )

    if has_indicators:
        parsed = parse_inspection_message(text)
        if parsed.get("obra") or parsed.get("actividades"):
            # Guardar reporte en sesión de usuario
            context.user_data["current_report"] = parsed

            # Vincular fotos previas en espera si las hay
            pending = context.user_data.pop("pending_photos", [])
            photos = context.user_data.setdefault("photos", [])
            if pending:
                photos.extend(pending)

            obra_name = parsed.get("obra") or "Sin nombre especificado"
            if len(obra_name) > 80:
                obra_name = obra_name[:80] + "..."

            fecha = parsed.get("fecha") or datetime.now().strftime("%d/%m/%Y")
            fecha_inicio = parsed.get("fecha_inicio") or ""
            lapso = parsed.get("lapso_ejecucion") or ""
            empresa = parsed.get("empresa") or "No indicada"
            residente = parsed.get("ing_residente") or "No indicado"
            inspectores = ", ".join(parsed.get("ing_inspectores", [])) or "No indicados"
            act_count = len(parsed.get("actividades", []))
            obreros = parsed.get("obreros") or "No indicado"

            photo_note = f"\n📸 *{len(photos)} foto(s)* vinculadas automáticamente." if photos else ""

            summary = (
                "✅ *FICHA DE OBRA REGISTRADA*\n"
                "───────────────────────────\n"
                f"🏗 *Obra:* {obra_name}\n"
                f"📅 *Fecha:* {fecha}\n"
            )
            if fecha_inicio:
                summary += f"🚀 *Fecha de Inicio:* {fecha_inicio}\n"
            if lapso:
                summary += f"⏱ *Lapso de Ejecución:* {lapso}\n"

            summary += (
                f"🏢 *Empresa:* {empresa}\n"
                f"👷 *Ing. Residente:* {residente}\n"
                f"🔍 *Inspectores:* {inspectores}\n"
                f"🔨 *Actividades:* {act_count} reportadas\n"
                f"👥 *Personal:* {obreros}\n"
                "───────────────────────────\n"
                f"📸 *Paso 2: Envía ahora las fotos de la inspección.* (Una a una o en grupo){photo_note}"
            )

            await update.message.reply_text(
                summary,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=get_awaiting_photos_keyboard(photo_count=len(photos)),
            )
            return

    # Si ya tiene fotos cargadas y envía un texto corto: asignar como descripción de la última foto
    photos = context.user_data.get("photos", [])
    if photos:
        last_idx = len(photos)
        photos[-1]["caption"] = text
        await update.message.reply_text(
            f"📝 *Descripción asignada a la Foto #{last_idx}:*\n"
            f"_{text}_\n\n"
            f"Llevas *{last_idx} foto(s)* agregadas. Envía la siguiente foto o pulsa el botón para continuar:",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=get_awaiting_photos_keyboard(photo_count=last_idx),
        )
        return

    # Si tiene un reporte activo pero aún no ha subido fotos
    if "current_report" in context.user_data:
        photos = context.user_data.get("photos", [])
        await update.message.reply_text(
            "ℹ️ Tienes un reporte activo. Envía las *fotos* de la obra o pulsa abajo para continuar:",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=get_awaiting_photos_keyboard(photo_count=len(photos)),
        )
    else:
        await update.message.reply_text(
            "👋 Pega el texto de tu reporte diario para iniciar la ficha. Escribe `/ayuda` si necesitas ver el formato.",
            parse_mode=ParseMode.MARKDOWN,
        )


async def handle_photo_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Descarga y registra fotos enviadas por el inspector."""
    if not update.message or not update.message.photo:
        return

    telegram_photo = update.message.photo[-1]
    file_id = telegram_photo.file_id
    caption = (update.message.caption or "").strip()

    user_id = update.effective_user.id if update.effective_user else "default"
    timestamp = int(datetime.now().timestamp())

    try:
        tg_file = await context.bot.get_file(file_id)

        # Si el pie de foto incluye el reporte diario completo
        if caption and any(k in caption.lower() for k in ("actividades", "fecha:", "obreros", "residente:")):
            parsed_caption = parse_inspection_message(caption)
            if parsed_caption.get("obra") or parsed_caption.get("actividades"):
                context.user_data["current_report"] = parsed_caption

        report = context.user_data.get("current_report")

        if report:
            photos_list = context.user_data.setdefault("photos", [])
            idx = len(photos_list) + 1
            dest_path = PHOTOS_DIR / f"{user_id}_{timestamp}_{idx}.jpg"
            await tg_file.download_to_drive(str(dest_path))

            clean_caption = caption if caption != report.get("raw_text") else ""
            photos_list.append({
                "path": str(dest_path),
                "caption": clean_caption,
                "file_id": file_id,
            })

            total = len(photos_list)
            msg_text = f"📸 *Foto #{total} registrada con éxito.*"
            if clean_caption:
                msg_text += f"\n_Descripción:_ \"{clean_caption}\""
            else:
                msg_text += "\n💡 _Tip: Si deseas colocarle descripción a esta foto, envíala como mensaje de texto ahora mismo._"

            msg_text += f"\n\nLlevas *{total} foto(s)* agregadas. Envía más fotos o pulsa el botón para continuar:"

            await update.message.reply_text(
                msg_text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=get_awaiting_photos_keyboard(photo_count=total),
            )
        else:
            pending_list = context.user_data.setdefault("pending_photos", [])
            idx = len(pending_list) + 1
            dest_path = PHOTOS_DIR / f"pending_{user_id}_{timestamp}_{idx}.jpg"
            await tg_file.download_to_drive(str(dest_path))

            pending_list.append({
                "path": str(dest_path),
                "caption": caption,
                "file_id": file_id,
            })

            total_p = len(pending_list)
            await update.message.reply_text(
                f"📸 *Foto #{total_p} recibida y guardada temporalmente.*\n\n"
                f"👉 *Pega ahora el mensaje del reporte diario de la obra* para vincularla(s) automáticamente a tu ficha técnica.",
                parse_mode=ParseMode.MARKDOWN,
            )
    except Exception as exc:
        logger.error("Error descargando foto de Telegram: %s", exc, exc_info=True)
        await update.message.reply_text("❌ Ocurrió un error al procesar la foto. Inténtalo de nuevo.")


async def execute_generate_pdf(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Compila y envía el informe en formato PDF."""
    report = context.user_data.get("current_report")
    target_msg = update.message or (update.callback_query and update.callback_query.message)

    if not report:
        if target_msg:
            await target_msg.reply_text("⚠️ No tienes ningún reporte activo. Pega primero el mensaje diario de la obra.")
        return

    status_msg = await target_msg.reply_text("⏳ *Compilando Ficha Técnica y Memoria Fotográfica en PDF...*", parse_mode=ParseMode.MARKDOWN)

    photos = context.user_data.get("photos", [])
    obra_short = _sanitize_filename(report.get("obra", "Obra"))
    fecha_clean = report.get("fecha", datetime.now().strftime("%d-%m-%Y")).replace("/", "-")
    timestamp = int(datetime.now().timestamp())

    pdf_filename = f"Informe_Inspeccion_{obra_short}_{fecha_clean}_{timestamp}.pdf"
    pdf_path = PDFS_DIR / pdf_filename

    try:
        generate_inspection_pdf(
            report_data=report,
            photos=photos,
            output_pdf_path=str(pdf_path),
        )

        caption = (
            f"📄 *INFORME DIARIO DE INSPECCIÓN (PDF)*\n\n"
            f"🏗 *Obra:* {report.get('obra', 'Sin especificar')[:70]}...\n"
            f"📅 *Fecha:* {report.get('fecha', '')}\n"
        )
        if report.get("fecha_inicio"):
            caption += f"🚀 *Inicio:* {report.get('fecha_inicio')}\n"
        if report.get("lapso_ejecucion"):
            caption += f"⏱ *Lapso:* {report.get('lapso_ejecucion')}\n"

        caption += f"📸 *Fotos incluidas:* {len(photos)}\n\nListo para compartir con la empresa contratista, gerencia o cliente."

        with open(pdf_path, "rb") as pdf_file:
            await target_msg.reply_document(
                document=pdf_file,
                filename=f"Informe_Inspeccion_{obra_short}_{fecha_clean}.pdf",
                caption=caption,
                parse_mode=ParseMode.MARKDOWN,
            )

        # Guardar en base de datos SQLite para historial y resumen semanal
        user_id = update.effective_user.id if update.effective_user else None
        save_inspection_entry(report.get("obra", "Obra"), user_id, report, photos)

        await status_msg.delete()

        # Respaldo automático en Google Drive
        drive_res = upload_file_to_drive(pdf_path)
        reply_kb = []
        if drive_res and drive_res.get("web_view_link"):
            reply_kb.append([InlineKeyboardButton("☁️ Ver PDF en Google Drive", url=drive_res["web_view_link"])])
        reply_kb.append([InlineKeyboardButton("🏠 Volver al Menú Principal", callback_data="btn_menu_home")])

        drive_note = f"\n☁️ *Respaldo en Google Drive:* `{pdf_filename}`" if drive_res else ""
        await target_msg.reply_text(
            f"✅ *Informe PDF generado y guardado en tu historial.*{drive_note}",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=InlineKeyboardMarkup(reply_kb),
        )

    except Exception as exc:
        logger.error("Error generando PDF de inspección: %s", exc, exc_info=True)
        await status_msg.edit_text(f"❌ Ocurrió un error al compilar el PDF: {exc}")


async def execute_generate_excel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Compila y envía el informe en formato Excel (.xlsx), acumulando en el libro de la obra."""
    report = context.user_data.get("current_report")
    target_msg = update.message or (update.callback_query and update.callback_query.message)

    if not report:
        if target_msg:
            await target_msg.reply_text("⚠️ No tienes ningún reporte activo. Pega primero el mensaje diario de la obra.")
        return

    status_msg = await target_msg.reply_text("⏳ *Generando Ficha Técnica y Memoria Fotográfica en Excel (.xlsx)...*", parse_mode=ParseMode.MARKDOWN)

    photos = context.user_data.get("photos", [])
    user_id = update.effective_user.id if update.effective_user else "default"
    obra_short = _sanitize_filename(report.get("obra", "Obra"))
    fecha_rep = report.get("fecha", datetime.now().strftime("%d/%m/%Y"))

    # Archivo consolidado persistente para la obra y usuario
    excel_filename = f"Libro_Inspecciones_{user_id}_{obra_short}.xlsx"
    excel_path = PDFS_DIR / excel_filename

    try:
        generate_inspection_excel(
            report_data=report,
            photos=photos,
            output_excel_path=str(excel_path),
        )

        # Contar cuántas hojas tiene el libro ahora
        wb_check = openpyxl.load_workbook(str(excel_path), read_only=True)
        sheet_count = len(wb_check.sheetnames)
        wb_check.close()

        caption = (
            f"📊 *LIBRO DIARIO DE INSPECCIONES (EXCEL)*\n\n"
            f"🏗 *Obra:* {report.get('obra', 'Sin especificar')[:70]}...\n"
            f"📅 *Jornada registrada:* {fecha_rep}\n"
            f"📑 *Hojas acumuladas en este libro:* {sheet_count}\n"
            f"📸 *Fotos en esta jornada:* {len(photos)}\n\n"
            "Cada reporte diario se organiza como una hoja independiente dentro del mismo libro de Excel."
        )

        with open(excel_path, "rb") as excel_file:
            await target_msg.reply_document(
                document=excel_file,
                filename=f"Libro_Inspecciones_{obra_short}.xlsx",
                caption=caption,
                parse_mode=ParseMode.MARKDOWN,
            )

        # Guardar en base de datos SQLite para historial y resumen semanal
        user_id_val = update.effective_user.id if update.effective_user else None
        save_inspection_entry(report.get("obra", "Obra"), user_id_val, report, photos)

        await status_msg.delete()

        # Respaldo automático en Google Drive
        drive_res = upload_file_to_drive(excel_path)
        reply_kb = []
        if drive_res and drive_res.get("web_view_link"):
            reply_kb.append([InlineKeyboardButton("☁️ Ver Excel en Google Drive", url=drive_res["web_view_link"])])
        reply_kb.append([InlineKeyboardButton("🏠 Volver al Menú Principal", callback_data="btn_menu_home")])

        drive_note = f"\n☁️ *Sincronizado en Google Drive:* `{excel_filename}`" if drive_res else ""
        await target_msg.reply_text(
            f"✅ *Libro Excel generado y actualizado con la nueva jornada.*{drive_note}",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=InlineKeyboardMarkup(reply_kb),
        )

    except Exception as exc:
        logger.error("Error generando Excel de inspección: %s", exc, exc_info=True)
        await status_msg.edit_text(f"❌ Ocurrió un error al compilar el Excel: {exc}")


async def execute_generate_both(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Compila y envía ambos formatos (PDF y Excel)."""
    await execute_generate_pdf(update, context)
    await execute_generate_excel(update, context)


async def generate_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Maneja el comando /generar (con o sin parámetro)."""
    args = context.args or []
    if args:
        sub = args[0].lower()
        if "excel" in sub or "xlsx" in sub:
            await execute_generate_excel(update, context)
            return
        if "pdf" in sub:
            await execute_generate_pdf(update, context)
            return
        if "ambos" in sub or "all" in sub:
            await execute_generate_both(update, context)
            return

    # Si no especificó parámetro, mostrar el selector
    report = context.user_data.get("current_report")
    if not report:
        if update.message:
            await update.message.reply_text("⚠️ No hay ningún reporte activo. Pega primero el mensaje de inspección.")
        return

    photos = context.user_data.get("photos", [])
    if update.message:
        await update.message.reply_text(
            "📋 *Selecciona el formato de salida para tu informe:*",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=_get_format_keyboard(photo_count=len(photos)),
        )


async def show_action_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Muestra el menú de acciones final una vez que el usuario terminó de cargar fotos o decidió continuar sin fotos."""
    query = update.callback_query
    msg_target = query.message if query else update.message
    if not msg_target:
        return

    report = context.user_data.get("current_report")
    if not report:
        await msg_target.reply_text("⚠️ No hay ningún reporte activo en memoria. Pega primero el mensaje del reporte.")
        return

    photos = context.user_data.get("photos", [])
    obra = report.get("obra", "Obra")
    if len(obra) > 70:
        obra = obra[:70] + "..."
    fecha = report.get("fecha") or datetime.now().strftime("%d/%m/%Y")
    total_fotos = len(photos)

    menu_text = (
        "🎯 *¿QUÉ DESEAS HACER CON ESTA JORNADA?*\n"
        "───────────────────────────\n"
        f"🏗 *Obra:* {obra}\n"
        f"📅 *Fecha:* {fecha}\n"
        f"📸 *Fotos vinculadas:* {total_fotos}\n"
        "───────────────────────────\n\n"
        "Selecciona la acción deseada:"
    )

    await msg_target.reply_text(
        menu_text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=get_report_action_keyboard(photo_count=total_fotos),
    )


async def handle_callback_query(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Maneja los botones interactivos Inline."""
    query = update.callback_query
    if not query:
        return

    await query.answer()

    data = query.data
    if data == "btn_show_action_menu":
        await show_action_menu(update, context)
    elif data == "btn_menu_ficha":
        context.user_data["active_module"] = "ficha"
        context.user_data.pop("libro_flow", None)
        ficha_msg = (
            "📋 *Modo Ficha Técnica de Inspección*\n\n"
            "📌 *¿Cómo funciona?*\n"
            "1️⃣ *Pega tu reporte:* Envía el mensaje con los datos (Obra, Fechas, Lapso, Empresa, Inspectores, Actividades, etc.).\n"
            "2️⃣ *Envía las fotos:* Adjunta las imágenes con o sin pie de foto.\n"
            "3️⃣ *Elige tu acción:* Guarda en el historial o descarga directamente en PDF o Excel.\n\n"
            "👉 *Pega ahora mismo el reporte de hoy para comenzar.*"
        )
        if query.message:
            await query.message.reply_text(ficha_msg, parse_mode=ParseMode.MARKDOWN)
    elif data == "btn_menu_resumen_semanal":
        await start_resumen_semanal_flow(update, context)
    elif data == "btn_menu_libro":
        context.user_data["active_module"] = "libro"
        await show_libro_obra_hub(update, context)
    elif data == "btn_libro_registrar":
        context.user_data["active_module"] = "libro"
        await start_libro_obra_flow(update, context)
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
    elif data == "btn_libro_descartar":
        await handle_discard_pending_libro_entry(update, context)
    elif data == "btn_libro_ver":
        await show_saved_libros_menu(update, context)
    elif data == "btn_libro_menu_editar":
        await handle_menu_editar_hoja(update, context)
    elif data.startswith("btn_edit_book_"):
        await handle_select_book_to_edit(update, context)
    elif data.startswith("btn_edit_sheet_"):
        await handle_select_sheet_to_edit(update, context)
    elif data.startswith("btn_dl_libro_"):
        await handle_download_libro(update, context)
    elif data == "btn_libro_eliminar":
        await show_delete_libro_menu(update, context)
    elif data.startswith("btn_askdel_libro_"):
        await ask_confirm_delete_libro(update, context)
    elif data.startswith("btn_execdel_libro_"):
        await execute_delete_libro(update, context)
    elif data.startswith("btn_semanal_obra_"):
        obra_id = data.replace("btn_semanal_obra_", "")
        await handle_select_obra_semanal(update, context, obra_id)
    elif data.startswith("btn_gen_sem_"):
        fmt = data.replace("btn_gen_sem_", "")
        await execute_generate_weekly_summary(update, context, fmt)
    elif data == "btn_save_daily_entry":
        await execute_save_daily_entry(update, context)
    elif data == "btn_to_libro_ai":
        await execute_register_to_libro_ai(update, context)
    elif data == "btn_gen_pdf":
        await execute_generate_pdf(update, context)
    elif data == "btn_gen_excel":
        await execute_generate_excel(update, context)
    elif data == "btn_gen_both":
        await execute_generate_both(update, context)
    elif data == "btn_reset":
        context.user_data.pop("current_report", None)
        context.user_data.pop("photos", None)
        if query.message:
            await query.message.reply_text("🔄 Reporte reiniciado. Puedes enviar un nuevo mensaje cuando gustes.")
    elif data == "btn_menu_home":
        await return_to_clean_main_menu(update, context)


async def execute_save_daily_entry(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Guarda la jornada diaria (datos + fotos) en la base de datos sin necesidad de generar PDF/Excel de inmediato."""
    query = update.callback_query
    msg_target = query.message if query else update.message
    if not msg_target:
        return

    report = context.user_data.get("current_report")
    if not report:
        await msg_target.reply_text("⚠️ No hay ningún reporte activo en memoria. Pega primero el mensaje del reporte.")
        return

    photos = context.user_data.get("photos", [])
    obra = report.get("obra", "Obra")
    fecha = report.get("fecha") or datetime.now().strftime("%d/%m/%Y")
    user_id = update.effective_user.id if update.effective_user else None

    # Guardar en SQLite
    entry_id = save_inspection_entry(obra, user_id, report, photos)

    existing_meta = get_project_metadata(obra)
    # También actualizar metadatos del proyecto
    save_project_metadata(obra, user_id, {
        "obra": obra,
        "firma_contratista": report.get("empresa", "") or existing_meta.get("firma_contratista", ""),
        "ing_residente": report.get("ing_residente", "") or existing_meta.get("ing_residente", ""),
        "ing_inspector": resolve_single_inspector(report.get("ing_inspectores", []), existing_meta.get("ing_inspector", "")),
    })

    confirm_text = (
        f"💾 *JORNADA GUARDADA EN EL HISTORIAL*\n"
        f"───────────────────────────\n"
        f"🏗 *Obra:* {obra[:65]}...\n"
        f"📅 *Fecha:* {fecha}\n"
        f"🔨 *Actividades:* {len(report.get('actividades', []))} registradas\n"
        f"📸 *Fotos vinculadas:* {len(photos)}\n"
        f"🆔 *Registro BD:* #{entry_id}\n"
        f"───────────────────────────\n\n"
        f"Esta jornada quedó guardada y ya está disponible para el **Informe Resumen Semanal**.\n"
        f"¿Deseas también descargar el archivo diario ahora o volver al menú?"
    )

    await msg_target.reply_text(
        confirm_text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=get_post_save_keyboard(),
    )


async def execute_register_to_libro_ai(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Procesa el reporte de mensaje directo, genera la descripción con IA y crea la hoja en el Libro de Obra."""
    query = update.callback_query
    msg_target = query.message if query else update.message
    if not msg_target:
        return

    report = context.user_data.get("current_report")
    if not report:
        await msg_target.reply_text("⚠️ No hay ningún reporte activo en memoria. Pega primero el mensaje del reporte.")
        return

    await msg_target.reply_text("🤖 *Analizando actividades y redactando Descripción de la Labor con IA técnica de ingeniería...*", parse_mode=ParseMode.MARKDOWN)

    obra = report.get("obra", "Obra")
    fecha = report.get("fecha") or datetime.now().strftime("%d/%m/%Y")
    empresa = report.get("empresa", "")
    residente = report.get("ing_residente", "")
    existing_meta = get_project_metadata(obra)
    inspector_val = resolve_single_inspector(
        report.get("ing_inspectores", []),
        existing_meta.get("ing_inspector", ""),
    )
    actividades = report.get("actividades", [])
    obreros = report.get("obreros", "")
    caporal = report.get("caporal", "") or report.get("caporal_obra", "")
    equipos = report.get("equipos") or report.get("maquinaria") or ""
    ensayos = report.get("control_calidad") or report.get("ensayos") or ""

    # 1. Generar la redacción formal de ingeniería con IA (incluyendo maquinaria, equipos y ensayos)
    desc_labor_ai = generate_labor_description_ai(
        actividades=actividades,
        obra=obra,
        empresa=empresa,
        fecha=fecha,
        obreros=f"{obreros}, Caporal: {caporal}".strip(", "),
        equipos=equipos,
        ensayos=ensayos,
    )

    # 2. Resumen ejecutivo de actividades para G13
    resumen_actividades = "\n".join(f"• {a}" for a in actividades)

    # 3. Personal en obra
    personal_str = f"{obreros}".strip()
    if caporal:
        personal_str += f", Caporal: {caporal}"

    # 4. Personal de inspección: en A8:C10 van todos los inspectores reportados en la obra
    if report.get("ing_inspectores"):
        personal_insp_str = "\n".join(format_engineer_name(p) for p in report["ing_inspectores"])
    else:
        personal_insp_str = inspector_val

    control_calidad = report.get("control_calidad", "").strip()
    revisado_por = report.get("revisado_por", "").strip()

    entry_data = {
        "fecha": fecha,
        "clima": report.get("clima") or "SOLEADO",
        "horas_trabajadas": report.get("horas_trabajadas") or "8 HORAS",
        "personal": personal_str or "Personal estándar en obra",
        "personal_inspeccion": personal_insp_str,
        "equipos": report.get("equipos") or "Herramientas menores y equipos de obra",
        "descripcion_labor": desc_labor_ai,
        "resumen_actividades": resumen_actividades,
        "actividades_list": actividades,
        "observaciones": report.get("observaciones") or "Sin novedades técnicas ni retrasos en la jornada.",
        "control_calidad": control_calidad,
        "revisado_por": revisado_por,
    }

    # Metadatos del proyecto para la hoja DATOS GENERALES
    user_id = update.effective_user.id if update.effective_user else None
    civ_res = report.get("civ_residente") or existing_meta.get("civ_residente", "")
    civ_insp = report.get("civ_inspector") or existing_meta.get("civ_inspector", "")
    residente_val = residente or existing_meta.get("ing_residente", "")
    if residente_val:
        residente_val = format_engineer_name(residente_val)

    general_data = {
        "obra": obra,
        "firma_contratista": empresa or existing_meta.get("firma_contratista", ""),
        "ing_residente": residente_val,
        "civ_residente": civ_res,
        "ing_inspector": inspector_val,
        "civ_inspector": civ_insp,
        "ente_contratante": existing_meta.get("ente_contratante", ""),
        "representante_legal": existing_meta.get("representante_legal", ""),
        "civ_representante": existing_meta.get("civ_representante", ""),
    }
    save_project_metadata(obra, user_id, general_data)

    context.user_data["pending_libro_entry"] = {
        "obra": obra,
        "entry_data": entry_data,
        "general_data": general_data,
        "actividades": actividades,
        "user_id": user_id,
    }

    preview_text = build_libro_entry_preview(obra, entry_data, general_data)
    await msg_target.reply_text(
        preview_text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=get_libro_entry_preview_keyboard(),
    )


async def view_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Muestra el estado actual del reporte y fotos."""
    if not update.message:
        return

    report = context.user_data.get("current_report")
    if not report:
        await update.message.reply_text("No hay ningún reporte activo en este momento. Pega un mensaje para empezar.")
        return

    photos = context.user_data.get("photos", [])
    obra = report.get("obra", "Sin especificar")
    fecha = report.get("fecha", "Sin fecha")
    fecha_inicio = report.get("fecha_inicio", "")
    lapso = report.get("lapso_ejecucion", "")

    extra_info = ""
    if fecha_inicio:
        extra_info += f"• Inicio de Obra: {fecha_inicio}\n"
    if lapso:
        extra_info += f"• Lapso de Ejecución: {lapso}\n"

    await update.message.reply_text(
        f"📊 *REPORTE ACTIVO:*\n"
        f"• Obra: {obra}\n"
        f"• Fecha: {fecha}\n"
        f"{extra_info}"
        f"• Fotos cargadas: {len(photos)}\n\n"
        f"Usa `/generar`, `/pdf` o `/excel` para compilar el informe.",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=_get_format_keyboard(photo_count=len(photos)),
    )


async def reset_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Limpia el reporte actual de la sesión."""
    context.user_data.pop("current_report", None)
    context.user_data.pop("photos", None)
    if update.message:
        await update.message.reply_text("🔄 Reporte de hoy reiniciado correctamente. Listo para uno nuevo.")


async def start_resumen_semanal_flow(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Inicia el selector para consolidar el resumen semanal."""
    query = update.callback_query
    msg_target = query.message if query else update.message
    if not msg_target:
        return

    user_id = update.effective_user.id if update.effective_user else None
    recent = get_recent_projects(user_id)

    if not recent:
        await msg_target.reply_text(
            "ℹ️ *No tienes fichas registradas aún en el sistema.*\n\n"
            "Primero genera una o varias fichas diarias pegando los reportes matutinos con sus fotos.",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=InlineKeyboardMarkup(
                [[InlineKeyboardButton("🏠 Menú Principal", callback_data="btn_menu_home")]]
            ),
        )
        return

    buttons = []
    for p in recent[:5]:
        p_short = p[:35] + "..." if len(p) > 35 else p
        buttons.append([InlineKeyboardButton(f"🏗️ {p_short}", callback_data=f"btn_semanal_obra_{p[:30]}")])
    buttons.append([InlineKeyboardButton("🏠 Menú Principal", callback_data="btn_menu_home")])

    await msg_target.reply_text(
        "🗓️ *INFORME RESUMEN SEMANAL DE INSPECCIÓN*\n\n"
        "El bot tomará todas las fichas diarias registradas en la semana, "
        "deduplicará las actividades ejecutadas y unificará todas las fotografías en un solo informe consolidado.\n\n"
        "👉 *Selecciona la obra que deseas consolidar:*",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup(buttons),
    )


async def handle_select_obra_semanal(update: Update, context: ContextTypes.DEFAULT_TYPE, obra_prefix: str) -> None:
    """Busca las inspecciones de la obra seleccionada y muestra el resumen para compilar."""
    query = update.callback_query
    if not query or not query.message:
        return

    user_id = update.effective_user.id if update.effective_user else None
    recent = get_recent_projects(user_id)

    # Encontrar la obra correspondiente
    matched_obra = None
    for p in recent:
        if p.startswith(obra_prefix) or obra_prefix in p:
            matched_obra = p
            break
    if not matched_obra and recent:
        matched_obra = recent[0]

    inspections = get_inspections_for_project(matched_obra, limit=10)
    if not inspections:
        await query.message.reply_text(
            f"ℹ️ No se encontraron inspecciones diarias registradas para la obra *'{matched_obra}'*.",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=InlineKeyboardMarkup(
                [[InlineKeyboardButton("🏠 Menú Principal", callback_data="btn_menu_home")]]
            ),
        )
        return

    try:
        consolidated_rep, all_photos = consolidate_weekly_inspection(inspections)
        context.user_data["weekly_report"] = consolidated_rep
        context.user_data["weekly_photos"] = all_photos

        total_dias = len(inspections)
        total_fotos = len(all_photos)
        act_count = len(consolidated_rep.get("actividades", []))
        fechas_txt = consolidated_rep.get("fecha", "")

        txt_preview = (
            f"📊 *RESUMEN SEMANAL LISTO PARA COMPILAR*\n"
            f"───────────────────────────\n"
            f"🏗 *Obra:* {matched_obra[:65]}...\n"
            f"📅 *Período:* {fechas_txt}\n"
            f"📑 *Jornadas consolidadas:* {total_dias} días\n"
            f"🔨 *Actividades únicas deduplicadas:* {act_count}\n"
            f"📸 *Memoria Fotográfica consolidada:* {total_fotos} fotos\n"
            f"───────────────────────────\n\n"
            f"¿En qué formato deseas descargar el informe semanal?"
        )

        buttons = [
            [
                InlineKeyboardButton("📄 Descargar PDF Semanal", callback_data="btn_gen_sem_pdf"),
                InlineKeyboardButton("📊 Descargar Excel Semanal", callback_data="btn_gen_sem_excel"),
            ],
            [
                InlineKeyboardButton("📦 Descargar Ambos (PDF + Excel)", callback_data="btn_gen_sem_both"),
            ],
            [
                InlineKeyboardButton("🏠 Menú Principal", callback_data="btn_menu_home"),
            ],
        ]

        await query.message.reply_text(
            txt_preview,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=InlineKeyboardMarkup(buttons),
        )
    except Exception as exc:
        logger.error("Error consolidando semana: %s", exc, exc_info=True)
        await query.message.reply_text(f"❌ Error al consolidar inspecciones: {exc}")


async def execute_generate_weekly_summary(update: Update, context: ContextTypes.DEFAULT_TYPE, fmt: str) -> None:
    """Genera y entrega el informe resumen semanal en PDF y/o Excel."""
    query = update.callback_query
    msg_target = query.message if query else update.message
    if not msg_target:
        return

    report = context.user_data.get("weekly_report")
    photos = context.user_data.get("weekly_photos", [])

    if not report:
        await msg_target.reply_text("⚠️ No hay datos semanales activos. Inicia nuevamente con `/resumen_semanal`.")
        return

    obra_short = _sanitize_filename(report.get("obra", "Obra"))
    timestamp = int(datetime.now().timestamp())

    status_msg = await msg_target.reply_text("⏳ *Generando Informe Resumen Semanal...*", parse_mode=ParseMode.MARKDOWN)

    try:
        # Generar PDF si corresponde
        if fmt in ("pdf", "both"):
            pdf_path = PDFS_DIR / f"Resumen_Semanal_{obra_short}_{timestamp}.pdf"
            generate_inspection_pdf(report, photos, str(pdf_path))
            with open(pdf_path, "rb") as f:
                await msg_target.reply_document(
                    document=f,
                    filename=f"Resumen_Semanal_{obra_short}.pdf",
                    caption=f"📄 *INFORME RESUMEN SEMANAL (PDF)*\n\n• Período: {report.get('fecha')}\n• Fotos incluidas: {len(photos)}",
                    parse_mode=ParseMode.MARKDOWN,
                )

        # Generar Excel si corresponde
        if fmt in ("excel", "both"):
            excel_path = PDFS_DIR / f"Resumen_Semanal_{obra_short}_{timestamp}.xlsx"
            generate_inspection_excel(report, photos, str(excel_path))
            with open(excel_path, "rb") as f:
                await msg_target.reply_document(
                    document=f,
                    filename=f"Resumen_Semanal_{obra_short}.xlsx",
                    caption=f"📊 *INFORME RESUMEN SEMANAL (EXCEL)*\n\n• Período: {report.get('fecha')}\n• Memoria Fotográfica en alta definición",
                    parse_mode=ParseMode.MARKDOWN,
                )

        await status_msg.delete()
        await msg_target.reply_text(
            "✨ *Informe Resumen Semanal generado exitosamente.*",
            reply_markup=get_home_keyboard(),
        )
    except Exception as exc:
        logger.error("Error al generar resumen semanal: %s", exc, exc_info=True)
        await status_msg.edit_text(f"❌ Error al generar el resumen semanal: {exc}")


async def nuevo_libro_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Reinicia el archivo de libro acumulativo de Excel para la obra actual."""
    if not update.message:
        return

    report = context.user_data.get("current_report")
    if not report:
        await update.message.reply_text("No hay ningún reporte activo en sesión.")
        return

    user_id = update.effective_user.id if update.effective_user else "default"
    obra_short = _sanitize_filename(report.get("obra", "Obra"))
    excel_filename = f"Libro_Inspecciones_{user_id}_{obra_short}.xlsx"
    excel_path = PDFS_DIR / excel_filename

    if excel_path.exists():
        try:
            excel_path.unlink()
            await update.message.reply_text("📗 El libro acumulativo de Excel para esta obra fue reiniciado. La próxima generación iniciará un libro nuevo.")
        except Exception as exc:
            logger.error("Error eliminando libro acumulativo: %s", exc, exc_info=True)
            await update.message.reply_text(f"❌ Error al reiniciar el libro de Excel: {exc}")
    else:
        await update.message.reply_text("ℹ️ Aún no existe un archivo de libro acumulativo para esta obra.")


def create_bot_app() -> Application:
    """Construye y configura la aplicación de Telegram Bot."""
    if not BOT_TOKEN or BOT_TOKEN.startswith("PEGA_"):
        raise ValueError("Token de Telegram no configurado. Define TELEGRAM_BOT_TOKEN.")

    app = ApplicationBuilder().token(BOT_TOKEN).build()

    # Handlers de comandos
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("semanal", start_resumen_semanal_flow))
    app.add_handler(CommandHandler("resumen_semanal", start_resumen_semanal_flow))
    app.add_handler(CommandHandler("libro", show_libro_obra_hub))
    app.add_handler(CommandHandler("libros", show_saved_libros_menu))
    app.add_handler(CommandHandler("borrar_libro", show_delete_libro_menu))
    app.add_handler(get_libro_obra_conversation_handler())
    app.add_handler(CommandHandler("ayuda", help_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("generar", generate_command))
    app.add_handler(CommandHandler("pdf", execute_generate_pdf))
    app.add_handler(CommandHandler("excel", execute_generate_excel))
    app.add_handler(CommandHandler("xlsx", execute_generate_excel))
    app.add_handler(CommandHandler("ver", view_command))
    app.add_handler(CommandHandler("nuevo", reset_command))
    app.add_handler(CommandHandler("cancelar", reset_command))
    app.add_handler(CommandHandler("nuevo_libro", nuevo_libro_command))

    # Handler de botones interactivos
    app.add_handler(CallbackQueryHandler(handle_callback_query))

    # Handler de fotos
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo_message))

    # Handler de mensajes de texto
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_message))

    return app


def main() -> None:
    """Punto de entrada principal para ejecutar el bot con polling."""
    logger.info("Iniciando Bot de Inspección de Obras en Telegram...")
    app = create_bot_app()
    logger.info("Bot activo y escuchando mensajes en Telegram. Presiona Ctrl+C para detener.")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
