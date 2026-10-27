"""
Bot de Telegram para Inspección de Obras.
Fase 1: Recibe el reporte diario por texto, fotos adjuntas y compila la Ficha Técnica con Memoria Fotográfica en PDF.
"""
import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Update,
)
from telegram.constants import ParseMode
from telegram.ext import (
    ApplicationBuilder,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from inspector_bot.config import BOT_TOKEN, PDFS_DIR, PHOTOS_DIR
from inspector_bot.parser import parse_inspection_message
from inspector_bot.pdf_generator import generate_inspection_pdf

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


def _sanitize_filename(name: str) -> str:
    """Genera un nombre de archivo seguro para el sistema operativo."""
    clean = re.sub(r'[\\/*?:"<>|]', "", name)
    clean = re.sub(r"\s+", "_", clean).strip("_")
    return clean[:45] if clean else "Obra"


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Mensaje de bienvenida con instrucciones claras del flujo de trabajo."""
    welcome_text = (
        "🏗 *¡Bienvenido al Bot de Inspección de Obras!*\n\n"
        "Te ayudo a convertir tus reportes diarios de mensajería en un "
        "*Informe Técnico formal en PDF* con su *Ficha de Obra y Memoria Fotográfica*.\n\n"
        "📌 *¿Cómo funciona? (3 pasos sencillos):*\n"
        "1️⃣ *Pega tu reporte:* Envía el mensaje con los datos (Obra, Empresa, Inspectores, Actividades, etc.).\n"
        "2️⃣ *Envía las fotos:* Adjunta las imágenes de la inspección (puedes enviar varias juntas o con pie de foto).\n"
        "3️⃣ *Genera el PDF:* Escribe `/generar` o presiona el botón y recibirás tu documento listo para firmar y reenviar.\n\n"
        "👉 *Pega ahora mismo el reporte de hoy para comenzar.*"
    )
    await update.message.reply_text(welcome_text, parse_mode=ParseMode.MARKDOWN)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Muestra comandos y formato de reporte admitido."""
    help_text = (
        "🛠 *Comandos disponibles:*\n"
        "• `/start` - Iniciar o ver bienvenida\n"
        "• `/generar` - Crear y descargar el PDF de la inspección\n"
        "• `/ver` - Ver los datos y cantidad de fotos acumuladas\n"
        "• `/nuevo` - Reiniciar y comenzar un reporte nuevo\n\n"
        "📝 *Ejemplo de mensaje admitido:*\n"
        "```text\n"
        "Fecha: 27/10/2026\n"
        "*Obra:* REHABILITACIÓN INTEGRAL DE LA UNIDAD...\n"
        "*Nombre de la empresa:* Constructora Truckers C.A\n"
        "*Ing. Residente:* Roomelt Yanes\n"
        "*Ing. Inspector:* 2\n"
        "Guido Farroni.\n"
        "Pablo Milano\n"
        "*Caporal* Jesús Ramirez.\n"
        "*Actividades en ejecución:*\n"
        ".- Demolición a mano de concreto.\n"
        ".- Acarreo y bote de escombros.\n"
        "*Obreros en obra:* 5 obreros.\n"
        "*Caporal de obra:* 1\n"
        "```"
    )
    await update.message.reply_text(help_text, parse_mode=ParseMode.MARKDOWN)


async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Procesa mensajes de texto y detecta reportes diarios de inspección."""
    text = (update.message.text or "").strip()
    if not text:
        return

    # Verificar si parece un reporte de obra
    has_indicators = any(
        kw in text.lower()
        for kw in ("obra", "fecha", "inspecci", "actividades", "residente", "contratista", "obreros")
    )

    if has_indicators:
        parsed = parse_inspection_message(text)
        if parsed.get("obra") or parsed.get("actividades"):
            # Guardar reporte en sesión de usuario
            context.user_data["current_report"] = parsed
            context.user_data["photos"] = []

            obra_name = parsed.get("obra") or "Sin nombre especificado"
            if len(obra_name) > 80:
                obra_name = obra_name[:80] + "..."

            fecha = parsed.get("fecha") or datetime.now().strftime("%d/%m/%Y")
            empresa = parsed.get("empresa") or "No indicada"
            residente = parsed.get("ing_residente") or "No indicado"
            inspectores = ", ".join(parsed.get("ing_inspectores", [])) or "No indicados"
            act_count = len(parsed.get("actividades", []))
            obreros = parsed.get("obreros") or "No indicado"

            summary = (
                "✅ *FICHA DE OBRA REGISTRADA*\n"
                "───────────────────────────\n"
                f"🏗 *Obra:* {obra_name}\n"
                f"📅 *Fecha:* {fecha}\n"
                f"🏢 *Empresa:* {empresa}\n"
                f"👷 *Ing. Residente:* {residente}\n"
                f"🔍 *Inspectores:* {inspectores}\n"
                f"🔨 *Actividades:* {act_count} reportadas\n"
                f"👥 *Personal:* {obreros}\n"
                "───────────────────────────\n"
                "📸 *Paso 2:* Envía ahora las fotos de la inspección.\n"
                "_(Puedes enviar varias fotos de una vez o con su pie de foto explicativo)_"
            )

            keyboard = [
                [
                    InlineKeyboardButton("📄 Generar PDF (Sin fotos)", callback_data="btn_generate"),
                    InlineKeyboardButton("🔄 Reiniciar", callback_data="btn_reset"),
                ]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)

            await update.message.reply_text(summary, parse_mode=ParseMode.MARKDOWN, reply_markup=reply_markup)
            return

    # Si ya tiene un reporte activo y envía un texto corto (posible nota adicional)
    if "current_report" in context.user_data:
        await update.message.reply_text(
            "ℹ️ Tienes un reporte activo. Envía las *fotos* de la obra o presiona `/generar` para compilar el informe.",
            parse_mode=ParseMode.MARKDOWN,
        )
    else:
        await update.message.reply_text(
            "👋 Pega el texto de tu reporte diario para iniciar la ficha. Escribe `/ayuda` si necesitas ver el formato.",
            parse_mode=ParseMode.MARKDOWN,
        )


async def handle_photo_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Descarga y registra fotos enviadas por el inspector."""
    if "current_report" not in context.user_data:
        await update.message.reply_text(
            "⚠️ *Primero debes pegar el texto del reporte de obra* antes de adjuntar fotos.\n"
            "Escribe `/start` para ver las instrucciones.",
            parse_mode=ParseMode.MARKDOWN,
        )
        return

    photos_list = context.user_data.setdefault("photos", [])

    # Obtener la foto en su mayor resolución
    telegram_photo = update.message.photo[-1]
    file_id = telegram_photo.file_id
    caption = (update.message.caption or "").strip()

    user_id = update.effective_user.id
    timestamp = int(datetime.now().timestamp())
    idx = len(photos_list) + 1

    file_name = f"{user_id}_{timestamp}_{idx}.jpg"
    dest_path = PHOTOS_DIR / file_name

    try:
        tg_file = await context.bot.get_file(file_id)
        await tg_file.download_to_drive(str(dest_path))

        photos_list.append({
            "path": str(dest_path),
            "caption": caption,
            "file_id": file_id,
        })

        total = len(photos_list)
        msg_text = f"📸 *Foto #{total} registrada*"
        if caption:
            msg_text += f"\n_Pie de foto:_ \"{caption}\""

        msg_text += f"\n\nLlevas *{total} foto(s)* agregadas. Envía más o pulsa el botón abajo para crear el informe."

        keyboard = [
            [
                InlineKeyboardButton(f"📄 Generar PDF ({total} Fotos)", callback_data="btn_generate"),
                InlineKeyboardButton("🔄 Reiniciar", callback_data="btn_reset"),
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

        await update.message.reply_text(msg_text, parse_mode=ParseMode.MARKDOWN, reply_markup=reply_markup)
    except Exception as exc:
        logger.error("Error descargando foto de Telegram: %s", exc, exc_info=True)
        await update.message.reply_text("❌ Ocurrió un error al procesar la foto. Inténtalo de nuevo.")


async def execute_generate_pdf(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Genera y envía el documento PDF completo."""
    report = context.user_data.get("current_report")
    if not report:
        target = update.message or (update.callback_query and update.callback_query.message)
        if target:
            await target.reply_text(
                "⚠️ No tienes ningún reporte activo. Pega primero el mensaje diario de la obra.",
                parse_mode=ParseMode.MARKDOWN,
            )
        return

    target_msg = update.message or (update.callback_query and update.callback_query.message)
    status_msg = await target_msg.reply_text("⏳ *Compilando Ficha Técnica y Memoria Fotográfica en PDF...*", parse_mode=ParseMode.MARKDOWN)

    photos = context.user_data.get("photos", [])

    # Nombre de archivo limpio
    obra_short = _sanitize_filename(report.get("obra", "Obra"))
    fecha_clean = report.get("fecha", datetime.now().strftime("%d-%m-%Y")).replace("/", "-")
    user_id = update.effective_user.id
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
            f"📄 *INFORME DIARIO DE INSPECCIÓN FINALIZADO*\n\n"
            f"🏗 *Obra:* {report.get('obra', 'Sin especificar')[:70]}...\n"
            f"📅 *Fecha:* {report.get('fecha', '')}\n"
            f"📸 *Fotos incluidas:* {len(photos)}\n\n"
            "Listo para compartir con la empresa contratista, gerencia o cliente."
        )

        with open(pdf_path, "rb") as pdf_file:
            await target_msg.reply_document(
                document=pdf_file,
                filename=f"Informe_Inspeccion_{obra_short}_{fecha_clean}.pdf",
                caption=caption,
                parse_mode=ParseMode.MARKDOWN,
            )

        await status_msg.delete()

    except Exception as exc:
        logger.error("Error generando PDF de inspección: %s", exc, exc_info=True)
        await status_msg.edit_text(f"❌ Ocurrió un error al compilar el PDF: {exc}")


async def handle_callback_query(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Maneja los botones interactivos Inline."""
    query = update.callback_query
    await query.answer()

    data = query.data
    if data == "btn_generate":
        await execute_generate_pdf(update, context)
    elif data == "btn_reset":
        context.user_data.pop("current_report", None)
        context.user_data.pop("photos", None)
        await query.message.reply_text("🔄 Reporte reiniciado. Puedes enviar un nuevo mensaje cuando gustes.")


async def view_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Muestra el estado actual del reporte y fotos."""
    report = context.user_data.get("current_report")
    if not report:
        await update.message.reply_text("No hay ningún reporte activo en este momento. Pega un mensaje para empezar.")
        return

    photos = context.user_data.get("photos", [])
    obra = report.get("obra", "Sin especificar")
    fecha = report.get("fecha", "Sin fecha")

    await update.message.reply_text(
        f"📊 *REPORTE ACTIVO:*\n"
        f"• Obra: {obra}\n"
        f"• Fecha: {fecha}\n"
        f"• Fotos cargadas: {len(photos)}\n\n"
        f"Escribe `/generar` para compilar el PDF.",
        parse_mode=ParseMode.MARKDOWN,
    )


async def reset_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Limpia el reporte actual."""
    context.user_data.pop("current_report", None)
    context.user_data.pop("photos", None)
    await update.message.reply_text("🔄 Reporte reiniciado correctamente. Listo para uno nuevo.")


def create_bot_app():
    """Construye y configura la aplicación de Telegram Bot."""
    if not BOT_TOKEN or BOT_TOKEN.startswith("PEGA_"):
        raise ValueError("Token de Telegram no configurado. Define TELEGRAM_BOT_TOKEN.")

    app = ApplicationBuilder().token(BOT_TOKEN).build()

    # Handlers de comandos
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("ayuda", help_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("generar", execute_generate_pdf))
    app.add_handler(CommandHandler("ver", view_command))
    app.add_handler(CommandHandler("nuevo", reset_command))
    app.add_handler(CommandHandler("cancelar", reset_command))

    # Handler de botones interactivos
    app.add_handler(CallbackQueryHandler(handle_callback_query))

    # Handler de fotos
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo_message))

    # Handler de mensajes de texto
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_message))

    return app


def main():
    """Punto de entrada principal para ejecutar el bot con polling."""
    print("Iniciando Bot de Inspección de Obras en Telegram...")
    app = create_bot_app()
    print("Bot activo y escuchando mensajes en Telegram. Presiona Ctrl+C para detener.")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
