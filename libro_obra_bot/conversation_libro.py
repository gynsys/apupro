"""
Módulo de Conversación para el llenado guiado del Libro de Obra diario.
Maneja las etapas:
  1. Selección o ingreso de la Obra.
  2. Datos Generales de la Obra (si es nueva: Ente, Contratista, Residente, Inspector, CIVs).
  3. Fecha y Horas trabajadas.
  4. Estado del tiempo (Soleado, Nublado, Lluvioso, etc.).
  5. Personal en Obra (Albañiles, Obreros, etc.) y Personal de Inspección.
  6. Maquinaria y Equipos presentes.
  7. Descripción de Actividades y Resumen de la labor.
  8. Observaciones adicionales.
  9. Confirmación, generación de la nueva hoja y entrega del documento Excel.
"""
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import openpyxl
from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
    Update,
)
from telegram.constants import ParseMode
from telegram.ext import (
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from libro_obra_bot.ai_labor_describer import generate_labor_description_ai
from libro_obra_bot.config import PHOTOS_DIR
from libro_obra_bot.google_drive_service import upload_file_to_drive
from libro_obra_bot.keyboards import (
    get_cancel_shift_date_keyboard,
    get_confirm_shift_date_keyboard,
    get_home_keyboard,
    get_libro_main_keyboard,
    get_libro_menu_keyboard,
)
from libro_obra_bot.libro_obra_service import (
    BOOKS_DIR,
    add_daily_entry_to_book,
    apply_start_date_shift,
    calculate_start_date_shift_preview,
    delete_project_book,
    format_date_es,
    get_sheet_date,
    list_all_project_books,
    list_book_sheets,
    load_sheet_entry_data,
    parse_date_string,
    update_saved_sheet,
)
from libro_obra_bot.parser import (
    format_engineer_name,
    parse_inspection_message,
    resolve_single_inspector,
)
from libro_obra_bot.project_store import (
    delete_project_metadata,
    get_project_metadata,
    get_recent_projects,
    get_sheet_report,
    get_sheet_report_by_date,
    get_user_last_report,
    save_project_metadata,
    save_sheet_report,
    save_user_last_report,
)

logger = logging.getLogger(__name__)

# Estados de la conversación
(
    STATE_SELECT_OBRA,
    STATE_DATOS_GENERALES,
    STATE_FECHA_HORAS,
    STATE_CLIMA,
    STATE_PERSONAL,
    STATE_EQUIPOS,
    STATE_ACTIVIDADES,
    STATE_OBSERVACIONES,
    STATE_CONFIRMAR,
    STATE_CONFIRMAR_BORRADO,
) = range(10)


def is_full_inspection_report(text: str) -> bool:
    """Determina si un mensaje de texto contiene un reporte diario completo o resumido de obra."""
    if not text:
        return False
    lower = text.lower()
    report_keywords = (
        "obra",
        "actividades",
        "actividad",
        "labores",
        "labor",
        "partida",
        "partidas",
        "fecha",
        "jornada",
        "clima",
        "tiempo",
        "residente",
        "inspector",
        "obreros",
        "personal",
        "empresa",
        "contratista",
        "demolición",
        "demolicion",
        "construcción",
        "construccion",
        "maquinaria",
        "equipos",
        "observaciones",
        "ensayos",
        "calidad",
    )
    matches = sum(1 for kw in report_keywords if kw in lower)
    return matches >= 2


def _clean_md(val: Any) -> str:
    """Evita que caracteres especiales de texto libre rompan el formateador Markdown de Telegram."""
    if not val:
        return ""
    s = str(val).strip()
    s = s.replace("**", "")
    s = s.replace("*", "")
    s = s.replace("_", "-")
    s = s.replace("`", "'")
    return s


async def safe_reply_markdown(msg_target, text: str, reply_markup=None):
    """Envía un mensaje con formato Markdown de manera segura, con fallback a texto plano si falla el parseo."""
    try:
        return await msg_target.reply_text(
            text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=reply_markup,
        )
    except Exception as exc:
        logger.warning("Fallo al enviar mensaje con Markdown (%s). Enviando como texto plano.", exc)
        plain_text = text.replace("*", "").replace("`", "").replace("_", "")
        return await msg_target.reply_text(
            plain_text,
            reply_markup=reply_markup,
        )


async def safe_edit_markdown(query_message, text: str, reply_markup=None):
    """Edita un mensaje con formato Markdown de manera segura, con fallback a texto plano si falla el parseo."""
    try:
        return await query_message.edit_text(
            text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=reply_markup,
        )
    except Exception as exc:
        logger.warning("Fallo al editar mensaje con Markdown (%s). Editando como texto plano.", exc)
        plain_text = text.replace("*", "").replace("`", "").replace("_", "")
        return await query_message.edit_text(
            plain_text,
            reply_markup=reply_markup,
        )


def build_libro_entry_preview(
    obra: str,
    entry_data: Dict[str, Any],
    general_data: Optional[Dict[str, Any]] = None,
) -> str:
    """Construye la vista previa estructurada en bloques claros de la Página 15."""
    fecha = _clean_md(entry_data.get("fecha")) or "No indicada"
    horas = _clean_md(entry_data.get("horas_trabajadas")) or "8 HORAS"
    clima = _clean_md(entry_data.get("clima")) or "SOLEADO"
    personal = _clean_md(entry_data.get("personal")) or "Personal estándar en obra"
    personal_insp = _clean_md(entry_data.get("personal_inspeccion")) or "Ninguno reportado"
    equipos = _clean_md(entry_data.get("equipos")) or "En blanco - no reportado"
    resumen_act = _clean_md(entry_data.get("resumen_actividades")) or "• Actividades ejecutadas en obra"
    desc_labor = _clean_md(entry_data.get("descripcion_labor")) or "Labores ejecutadas según cronograma."
    cc = _clean_md(entry_data.get("control_calidad")) or "En blanco - no reportado"
    rev = _clean_md(entry_data.get("revisado_por")) or "En blanco - no reportado"
    obs = _clean_md(entry_data.get("observaciones")) or "En blanco - no reportado"
    obra_clean = _clean_md(obra)

    profesionales_str = ""
    if general_data:
        res_n = _clean_md(general_data.get("ing_residente")) or "No indicado"
        res_civ = _clean_md(general_data.get("civ_residente")) or "En blanco"
        insp_n = _clean_md(general_data.get("ing_inspector")) or "No indicado"
        insp_civ = _clean_md(general_data.get("civ_inspector")) or "En blanco"
        profesionales_str = (
            f"👷 *Residente:* `{res_n}` (CIV: `{res_civ}`)\n"
            f"🕵️ *Inspector:* `{insp_n}` (CIV: `{insp_civ}`)\n\n"
        )

    lines = [
        "📋 *VISTA PREVIA: HOJA DE CONTROL DIARIO*",
        "*(Formato legal según Página 15 del Libro de Obra CIV)*",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━",
        f"🏗️ *Obra:* {obra_clean}",
        f"📅 *Fecha:* `{fecha}`  |  ⏱️ *Jornada:* `{horas}`",
        f"☀️ *Estado del Tiempo:* `{clima}`\n",
        profesionales_str + f"👥 *Personal en Obra:*\n{personal}\n",
        f"👷 *Personal de Inspección:*\n{personal_insp}\n",
        f"🚜 *Equipos y Herramientas:*\n{equipos}\n",
        f"📌 *Resumen de Actividades por Partida:*\n{resumen_act}\n",
        f"📝 *Descripción de la Labor Diaria:*\n{desc_labor}\n",
        f"💬 *Observaciones:*\n{obs}\n",
        f"🔍 *Control de Calidad:* {cc}",
        f"✍️ *Revisado Por:* {rev}",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "👇 *Revisa los bloques. Puedes editar cualquier campo directamente en Telegram antes de guardar en el Libro de Obra (.xlsx):*",
    ]
    return "\n".join(lines)


def get_libro_entry_preview_keyboard() -> InlineKeyboardMarkup:
    """Devuelve los botones de edición, regeneración o retorno al menú principal."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📋 Recuperar Mensaje Original", callback_data="btn_libro_recuperar_msg"),
        ],
        [
            InlineKeyboardButton("✏️ Editar Descripción", callback_data="btn_libro_edit_desc"),
            InlineKeyboardButton("📝 Más Campos...", callback_data="btn_libro_edit_menu"),
        ],
        [
            InlineKeyboardButton("🔄 Regenerar con IA", callback_data="btn_libro_regen_desc"),
            InlineKeyboardButton("❌ Descartar", callback_data="btn_libro_descartar"),
        ],
        [
            InlineKeyboardButton("🔙 Menú Libro de Obra", callback_data="btn_menu_libro"),
            InlineKeyboardButton("🏠 Menú Principal", callback_data="btn_menu_home"),
        ],
    ])


def get_libro_edit_fields_keyboard() -> InlineKeyboardMarkup:
    """Menú interactivo para elegir qué campo específico del Libro de Obra desea editar el usuario."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📝 Descripción de la Labor", callback_data="btn_libro_edit_desc"),
            InlineKeyboardButton("💬 Observaciones", callback_data="btn_libro_edit_obs"),
        ],
        [
            InlineKeyboardButton("👥 Personal en Obra", callback_data="btn_libro_edit_pers"),
            InlineKeyboardButton("🚜 Maquinaria y Equipos", callback_data="btn_libro_edit_equip"),
        ],
        [
            InlineKeyboardButton("📌 Resumen Partidas", callback_data="btn_libro_edit_partidas"),
            InlineKeyboardButton("🌦️ Clima / Horas", callback_data="btn_libro_edit_clima"),
        ],
        [
            InlineKeyboardButton("🏛️ C.I.V. Residente", callback_data="btn_libro_edit_civ_res"),
            InlineKeyboardButton("🏛️ C.I.V. Inspector", callback_data="btn_libro_edit_civ_insp"),
        ],
        [
            InlineKeyboardButton("🔙 Volver a Vista Previa", callback_data="btn_libro_preview_back"),
        ],
    ])


def format_report_text_from_entry(obra: str, entry_data: Dict[str, Any], general_data: Dict[str, Any]) -> str:
    """Reconstruye un mensaje de reporte en formato texto estándar para que el usuario pueda copiarlo y editarlo."""
    if not obra:
        raise ValueError("obra no puede estar vacía.")
    if not entry_data:
        raise ValueError("entry_data no puede estar vacío.")

    fecha = entry_data.get("fecha") or datetime.now().strftime("%d/%m/%Y")
    clima = entry_data.get("clima") or "Soleado"
    horas = entry_data.get("horas_trabajadas") or "8 horas"
    personal = entry_data.get("personal") or "Personal estándar en obra"
    equipos = entry_data.get("equipos") or ""
    empresa = general_data.get("firma_contratista") or general_data.get("empresa") or ""
    residente = general_data.get("ing_residente") or general_data.get("ingeniero_residente") or ""
    civ_res = general_data.get("civ_residente") or ""
    inspector = entry_data.get("personal_inspeccion") or general_data.get("ing_inspector") or ""
    civ_insp = general_data.get("civ_inspector") or ""

    actividades = entry_data.get("actividades_list") or []
    if not actividades:
        raw_res = entry_data.get("resumen_actividades") or ""
        actividades = [a.strip(" •-*.") for a in raw_res.split("\n") if a.strip(" •-*.\t")]
    if not actividades:
        actividades = ["Actividades ejecutadas en obra"]

    acts_formatted = "\n".join(f".- {a}" for a in actividades)
    observaciones = entry_data.get("observaciones") or ""

    lines: List[str] = [
        f"*Fecha:* {fecha}",
        f"*Obra:* {obra}",
    ]
    if empresa:
        lines.append(f"*Nombre de la empresa:* {empresa}")
    if residente:
        lines.append(f"*Ing. Residente:* {residente}")
        if civ_res:
            lines.append(f"CIV: {civ_res}")
    if inspector:
        clean_insp_lines = [l.strip() for l in inspector.splitlines() if l.strip()]
        lines.append(f"*Personal de Inspección:* {clean_insp_lines[0] if clean_insp_lines else inspector}")
        if civ_insp:
            lines.append(f"CIV: {civ_insp}")
        for extra_insp in clean_insp_lines[1:]:
            lines.append(extra_insp)

    lines.append(f"*Personal en Obra:* {personal}")
    lines.append("*Actividades en ejecución:*")
    lines.append(acts_formatted)
    if equipos and equipos.lower() not in ("none", "en blanco", "sin equipos"):
        lines.append("*Movimientos de maquinaria y equipos:*")
        lines.append(equipos)
    if observaciones and observaciones.lower() not in ("sin observaciones", "sin observaciones particulares.", "none"):
        lines.append(f"*Observaciones:* {observaciones}")
    else:
        lines.append("*Observaciones:*")
    lines.append(f"*Estado del Tiempo:* {clima}")
    lines.append(f"*Horas trabajadas:* {horas}")

    return "\n".join(lines)


async def handle_recuperar_mensaje(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Redirige al usuario al selector interactivo de hojas guardadas para que seleccione qué día/hoja recuperar.
    """
    query = update.callback_query
    if query:
        await query.answer()
    await handle_menu_editar_hoja(update, context)


async def process_full_report_for_libro(update: Update, context: ContextTypes.DEFAULT_TYPE, text: str) -> bool:
    """
    Si el usuario pega un reporte diario completo en el flujo del Libro de Obra,
    lo procesa estructurándolo en bloques y redactando con IA para mostrar la Vista Previa
    con el botón interactivo de Guardar.
    El Libro de Obra no solicita fotos.
    """
    if not is_full_inspection_report(text):
        return False

    parsed = parse_inspection_message(text)
    if not (parsed.get("obra") or parsed.get("actividades")):
        return False

    context.user_data.pop("libro_flow", None)

    msg_target = update.message
    if not msg_target:
        return False

    await msg_target.reply_text(
        "📖 *Reporte detectado para el Libro de Obra (Sin fotos).*\n"
        "🤖 *Estructurando bloques y redactando labor con IA técnica...*",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=ReplyKeyboardRemove(),
    )

    obra = parsed.get("obra", "Obra")
    fecha = parsed.get("fecha") or datetime.now().strftime("%d/%m/%Y")
    empresa = parsed.get("empresa", "")
    residente = parsed.get("ing_residente", "")
    existing_meta = get_project_metadata(obra)
    if existing_meta and existing_meta.get("obra"):
        obra = existing_meta["obra"]
    inspector_val = resolve_single_inspector(
        parsed.get("ing_inspectores", []),
        existing_meta.get("ing_inspector", ""),
    )
    actividades = parsed.get("actividades", [])
    obreros = parsed.get("obreros", "")
    caporal = parsed.get("caporal", "") or parsed.get("caporal_obra", "")
    maestro = parsed.get("maestro_obra", "") or parsed.get("maestro", "")
    equipos = parsed.get("equipos") or parsed.get("maquinaria") or ""
    ensayos = parsed.get("control_calidad") or parsed.get("ensayos") or ""

    # Personal en obra: obreros, maestro de obra y caporal corresponden a la cuadrilla de la contratista (A3:C6)
    parts_pers: List[str] = []
    if obreros:
        parts_pers.append(f"{obreros}".strip())
    if maestro:
        clean_m = maestro.strip().strip("*.")
        parts_pers.append(f"Maestro de Obra: {clean_m}")
    if caporal:
        parts_pers.append(f"Caporal: {caporal}".strip())
    personal_str = ", ".join(parts_pers) if parts_pers else "Personal estándar en obra"

    # 1. Generar la redacción formal de ingeniería con IA (incluyendo maquinaria, equipos y ensayos)
    desc_labor_ai = generate_labor_description_ai(
        actividades=actividades,
        obra=obra,
        empresa=empresa,
        fecha=fecha,
        obreros=personal_str,
        equipos=equipos,
        ensayos=ensayos,
    )

    # 2. Resumen ejecutivo de actividades por partida (limpio de clima)
    resumen_actividades = "\n".join(f"• {a}" for a in actividades)

    # 4. Personal de inspección: en A8:C10 van exclusivamente los inspectores (excluyendo cuadrilla de contratista)
    if parsed.get("ing_inspectores"):
        filtered_insp = [
            p for p in parsed["ing_inspectores"]
            if not re.search(r"maestro|caporal", p, re.IGNORECASE)
        ]
        personal_insp_str = "\n".join(format_engineer_name(p) for p in filtered_insp) if filtered_insp else inspector_val
    else:
        personal_insp_str = inspector_val

    # Control de calidad y Revisado por: en blanco a menos que se hayan reportado en el mensaje
    control_calidad = parsed.get("control_calidad", "").strip()
    revisado_por = parsed.get("revisado_por", "").strip()

    entry_data = {
        "fecha": fecha,
        "clima": parsed.get("clima") or "SOLEADO",
        "horas_trabajadas": parsed.get("horas_trabajadas") or "8 HORAS",
        "personal": personal_str or "Personal estándar en obra",
        "personal_inspeccion": personal_insp_str,
        "equipos": parsed.get("equipos", "").strip(),
        "descripcion_labor": desc_labor_ai,
        "resumen_actividades": resumen_actividades,
        "actividades_list": actividades,
        "observaciones": parsed.get("observaciones", "").strip(),
        "control_calidad": control_calidad,
        "revisado_por": revisado_por,
    }

    user_id = update.effective_user.id if update.effective_user else None
    civ_res = parsed.get("civ_residente") or existing_meta.get("civ_residente", "")
    civ_insp = parsed.get("civ_inspector") or existing_meta.get("civ_inspector", "")
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

    # Ejecutar guardado inmediato sin pedir confirmación previa
    await save_and_deliver_libro_entry(
        msg_target=msg_target,
        context=context,
        obra=obra,
        entry_data=entry_data,
        general_data=general_data,
        user_id=user_id,
        raw_text=text,
    )
    return True


async def save_and_deliver_libro_entry(
    msg_target: Any,
    context: ContextTypes.DEFAULT_TYPE,
    obra: str,
    entry_data: Dict[str, Any],
    general_data: Dict[str, Any],
    user_id: Optional[int],
    raw_text: Optional[str] = None,
) -> None:
    """
    Guarda físicamente la hoja en el archivo Excel oficial (.xlsx), sincroniza con Google Drive,
    envía el archivo actualizado al usuario y lo redirige directamente al menú principal.
    """
    if not msg_target:
        raise ValueError("msg_target no puede ser nulo.")
    if not obra:
        raise ValueError("obra no puede estar vacía.")
    if not entry_data:
        raise ValueError("entry_data no puede estar vacío.")

    # 1. Persistir metadatos de obra y último reporte
    save_project_metadata(obra, user_id, general_data)
    if raw_text:
        context.user_data["last_raw_report_text"] = raw_text
        if user_id:
            save_user_last_report(user_id, raw_text, obra=obra)

    try:
        editing_info = context.user_data.get("editing_existing_sheet")
        if editing_info and editing_info.get("sheet_name"):
            target_sheet = editing_info["sheet_name"]
            book_path, sheet_name = update_saved_sheet(obra, target_sheet, entry_data, general_data)
            action_verb = "actualizada"
        else:
            book_path, sheet_name, sheet_num = add_daily_entry_to_book(obra, entry_data, general_data)
            action_verb = "registrada"

        if raw_text:
            save_sheet_report(obra, str(sheet_name), str(entry_data.get("fecha", "")), raw_text)

        equipos_display = entry_data.get("equipos") or "Herramientas menores y equipos de construcción"
        caption_txt = (
            f"📗 *Libro de Obra Oficial Actualizado*\n\n"
            f"• *Obra:* {obra[:60]}...\n"
            f"• *Hoja {action_verb.capitalize()}:* `{sheet_name}`\n"
            f"• *Fecha:* {entry_data.get('fecha')}\n"
            f"• *Estado del Tiempo:* {entry_data.get('clima')}\n"
            f"• *Horas Trabajadas:* {entry_data.get('horas_trabajadas')}\n"
            f"• *Maquinaria / Equipos:* {equipos_display}\n\n"
            f"📝 *Descripción técnica:*\n_{entry_data.get('descripcion_labor', '')[:220]}..._\n\n"
            f"🔗 _Firmas vinculadas dinámicamente con 'DATOS GENERALES'._"
        )

        with open(book_path, "rb") as f:
            sent_doc = await msg_target.reply_document(
                document=f,
                filename=book_path.name,
                caption=caption_txt,
                parse_mode=ParseMode.MARKDOWN,
            )
            if sent_doc:
                track_menu_message(context, sent_doc.message_id)

        drive_res = upload_file_to_drive(book_path)
        drive_note = f"\n☁️ *Sincronizado en Google Drive:* `{book_path.name}`" if drive_res else ""

        # Redirigir al menú principal con todas las opciones disponibles
        main_kb_rows = []
        if drive_res and drive_res.get("web_view_link"):
            main_kb_rows.append([InlineKeyboardButton("☁️ Abrir en Google Drive", url=drive_res["web_view_link"])])
        main_kb_rows.extend(get_libro_main_keyboard().inline_keyboard)

        sent_conf = await msg_target.reply_text(
            f"✅ *Hoja #{sheet_name} {action_verb} exitosamente en el Libro de Obra.*{drive_note}\n\n"
            "📖 _El asiento fue guardado permanentemente en el archivo Excel oficial._\n\n"
            "👇 *Menú Principal:*",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=InlineKeyboardMarkup(main_kb_rows),
        )
        if sent_conf:
            track_menu_message(context, sent_conf.message_id)

    except Exception as exc:
        logger.error("Error al guardar hoja en Libro de Obra: %s", exc, exc_info=True)
        await msg_target.reply_text(
            f"❌ Ocurrió un error al guardar en el libro: {exc}",
            reply_markup=get_libro_main_keyboard(),
        )

    # Limpiar estados de sesión
    context.user_data.pop("pending_libro_entry", None)
    context.user_data.pop("editing_existing_sheet", None)
    context.user_data.pop("libro_flow", None)


async def execute_save_pending_libro_entry(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Guarda físicamente la hoja pendiente en el archivo Excel oficial (.xlsx) y en Google Drive si quedó pendiente.
    """
    query = update.callback_query
    msg_target = query.message if query else update.message
    if not msg_target:
        return
    if query:
        await query.answer()

    pending = context.user_data.get("pending_libro_entry")
    if not pending:
        await msg_target.reply_text(
            "ℹ️ No hay ninguna hoja pendiente por guardar o ya fue registrada automáticamente.",
            reply_markup=get_libro_main_keyboard(),
        )
        return

    obra = pending["obra"]
    entry_data = pending["entry_data"]
    general_data = pending["general_data"]
    user_id = pending.get("user_id")
    raw_text = pending.get("raw_text")

    await save_and_deliver_libro_entry(
        msg_target=msg_target,
        context=context,
        obra=obra,
        entry_data=entry_data,
        general_data=general_data,
        user_id=user_id,
        raw_text=raw_text,
    )


async def handle_regenerate_libro_desc(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Regenera la redacción técnica de labor con IA técnica."""
    query = update.callback_query
    if not query or not query.message:
        return
    await query.answer("🤖 Regenerando redacción técnica con IA...")

    pending = context.user_data.get("pending_libro_entry")
    if not pending:
        await query.message.reply_text("⚠️ No hay hoja activa pendiente para regenerar.")
        return

    obra = pending["obra"]
    entry_data = pending["entry_data"]
    general_data = pending["general_data"]
    actividades = pending.get("actividades", [])

    new_desc = generate_labor_description_ai(
        actividades=actividades,
        obra=obra,
        empresa=general_data.get("firma_contratista", ""),
        fecha=entry_data.get("fecha", ""),
        obreros=entry_data.get("personal", ""),
        equipos=entry_data.get("equipos", ""),
        ensayos=entry_data.get("control_calidad", ""),
    )
    entry_data["descripcion_labor"] = new_desc

    new_preview = build_libro_entry_preview(obra, entry_data, general_data)
    try:
        await query.message.edit_text(
            new_preview,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=get_libro_entry_preview_keyboard(),
        )
    except Exception as exc:
        logger.debug("No se pudo editar texto al regenerar descripción: %s", exc)
        await query.message.reply_text(
            new_preview,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=get_libro_entry_preview_keyboard(),
        )


async def handle_discard_pending_libro_entry(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Descarta la hoja pendiente sin guardar cambios."""
    query = update.callback_query
    if not query or not query.message:
        return
    await query.answer("Hoja descartada")

    context.user_data.pop("pending_libro_entry", None)
    context.user_data.pop("libro_flow", None)

    try:
        await query.message.delete()
    except Exception as exc:
        logger.debug("No se pudo eliminar mensaje al descartar: %s", exc)

    kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("✍️ Intentar Nuevamente", callback_data="btn_libro_registrar")],
        [InlineKeyboardButton("📖 Menú Libro de Obra", callback_data="btn_menu_libro")],
        [InlineKeyboardButton("🏠 Menú Principal", callback_data="btn_menu_home")],
    ])
    await query.message.reply_text(
        "❌ *Hoja descartada.* No se realizaron modificaciones en el Libro de Obra.",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=kb,
    )


async def handle_show_edit_fields_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Muestra el submenú interactivo para seleccionar qué campo editar."""
    query = update.callback_query
    if not query or not query.message:
        return
    await query.answer()

    pending = context.user_data.get("pending_libro_entry")
    if not pending:
        await query.message.reply_text("⚠️ No hay ninguna hoja activa pendiente para editar.")
        return

    text = (
        "✏️ *SELECCIONA EL CAMPO QUE DESEAS MODIFICAR:*\n\n"
        "Elige qué bloque del Libro de Obra deseas corregir antes de guardar:\n\n"
        "• *Descripción de la Labor:* Redacción técnica detallada de la jornada.\n"
        "• *Observaciones:* Notas técnicas o incidencias del día.\n"
        "• *Personal en Obra:* Obreros, albañiles, caporal, etc.\n"
        "• *Maquinaria y Equipos:* Herramientas y vehículos en sitio.\n"
        "• *Resumen Partidas:* Lista de actividades por partida ejecutadas.\n"
        "• *Clima / Horas:* Estado del tiempo y horas trabajadas."
    )
    try:
        await query.message.edit_text(
            text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=get_libro_edit_fields_keyboard(),
        )
    except Exception as exc:
        logger.debug("No se pudo editar texto al mostrar menú de edición: %s", exc)
        await query.message.reply_text(
            text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=get_libro_edit_fields_keyboard(),
        )


async def handle_start_edit_libro_field(update: Update, context: ContextTypes.DEFAULT_TYPE, field: str) -> None:
    """Inicia el modo de edición de un campo específico del Libro de Obra."""
    query = update.callback_query
    if not query or not query.message:
        return
    await query.answer()

    pending = context.user_data.get("pending_libro_entry")
    if not pending or "entry_data" not in pending:
        await query.message.reply_text("⚠️ No hay hoja activa pendiente para modificar.")
        return

    entry_data = pending["entry_data"]
    general_data = pending.get("general_data", {})
    context.user_data["editing_libro_field"] = field

    field_meta = {
        "descripcion_labor": ("Descripción de la Labor Diaria", entry_data.get("descripcion_labor", "")),
        "observaciones": ("Observaciones de la Jornada", entry_data.get("observaciones", "")),
        "personal": ("Personal en Obra", entry_data.get("personal", "")),
        "equipos": ("Maquinaria y Equipos", entry_data.get("equipos", "")),
        "resumen_actividades": ("Resumen de Actividades por Partida", entry_data.get("resumen_actividades", "")),
        "clima": ("Estado del Tiempo", entry_data.get("clima", "")),
        "horas_trabajadas": ("Horas Trabajadas", entry_data.get("horas_trabajadas", "")),
        "civ_residente": ("C.I.V. del Ing. Residente", general_data.get("civ_residente", "")),
        "civ_inspector": ("C.I.V. del Ing. Inspector", general_data.get("civ_inspector", "")),
    }

    label, curr_val = field_meta.get(field, (field, str(entry_data.get(field, ""))))

    cancel_kb = InlineKeyboardMarkup([
        [InlineKeyboardButton("❌ Cancelar Edición", callback_data="btn_libro_cancel_edit")]
    ])

    prompt_text = (
        f"✏️ *EDITAR: {label.upper()}*\n"
        f"───────────────────────────\n"
        f"📋 *Texto actual registrado:*\n"
        f"```\n{curr_val}\n```\n"
        f"───────────────────────────\n"
        f"✍️ *Envía en tu siguiente mensaje el nuevo texto corregido.* \n\n"
        f"💡 _Tip: Puedes copiar el texto de arriba, modificar lo que desees corregir (p. ej. eliminar alucinaciones o agregar especificaciones exactas), y enviarlo por este chat._"
    )

    sent = await safe_reply_markdown(
        query.message,
        prompt_text,
        reply_markup=cancel_kb,
    )
    if sent:
        track_menu_message(context, sent.message_id)


async def handle_cancel_or_back_preview(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Cancela la edición o regresa a la vista previa del Libro de Obra."""
    query = update.callback_query
    if not query or not query.message:
        return
    await query.answer()

    context.user_data.pop("editing_libro_field", None)

    pending = context.user_data.get("pending_libro_entry")
    if not pending:
        await query.message.reply_text("⚠️ No hay hoja activa pendiente.")
        return

    obra = pending["obra"]
    entry_data = pending["entry_data"]
    general_data = pending["general_data"]

    preview_text = build_libro_entry_preview(obra, entry_data, general_data)
    await safe_edit_markdown(
        query.message,
        preview_text,
        reply_markup=get_libro_entry_preview_keyboard(),
    )


async def handle_save_edited_field(update: Update, context: ContextTypes.DEFAULT_TYPE, text: str) -> bool:
    """Aplica el texto editado por el usuario y actualiza la vista previa del Libro de Obra."""
    field = context.user_data.pop("editing_libro_field", None)
    if not field:
        return False

    pending = context.user_data.get("pending_libro_entry")
    if not pending or "entry_data" not in pending:
        if update.message:
            await update.message.reply_text("⚠️ No hay ninguna hoja activa pendiente para modificar.")
        return True

    entry_data = pending["entry_data"]
    obra = pending["obra"]
    general_data = pending["general_data"]

    field_names = {
        "descripcion_labor": "Descripción de la Labor Diaria",
        "observaciones": "Observaciones",
        "personal": "Personal en Obra",
        "equipos": "Maquinaria y Equipos",
        "resumen_actividades": "Resumen de Actividades por Partida",
        "clima": "Estado del Tiempo",
        "horas_trabajadas": "Horas Trabajadas",
        "civ_residente": "C.I.V. del Ing. Residente",
        "civ_inspector": "C.I.V. del Ing. Inspector",
    }
    field_label = field_names.get(field, field)

    clean_text = text.strip()

    if field in ("civ_residente", "civ_inspector"):
        clean_civ = re.sub(r"[^\d\.\-]", "", clean_text).strip(" .-") or clean_text
        general_data[field] = clean_civ
        user_id = pending.get("user_id")
        save_project_metadata(obra, user_id, general_data)
    else:
        entry_data[field] = clean_text

    if field == "resumen_actividades":
        lines = [line.strip().lstrip("•-*").strip() for line in clean_text.splitlines() if line.strip()]
        if lines:
            entry_data["actividades_list"] = lines
            pending["actividades"] = lines

    # Si se está editando una hoja existente, persistir inmediatamente al archivo Excel oficial
    editing_info = context.user_data.get("editing_existing_sheet")
    saved_note = ""
    if editing_info and editing_info.get("sheet_name"):
        target_sheet = editing_info["sheet_name"]
        try:
            book_path, sheet_name = update_saved_sheet(obra, target_sheet, entry_data, general_data)
            upload_file_to_drive(book_path)
            saved_note = f" (guardado en Hoja #{sheet_name})"
            logger.info("Hoja '%s' persistida directamente en Excel tras editar campo '%s'.", sheet_name, field)
        except Exception as edit_save_err:
            logger.error("Error al persistir edición de hoja '%s': %s", target_sheet, edit_save_err, exc_info=True)

    logger.info("Campo '%s' del Libro de Obra actualizado exitosamente por el usuario.", field)

    preview_text = build_libro_entry_preview(obra, entry_data, general_data)

    if update.message:
        sent = await update.message.reply_text(
            f"✅ *{field_label} actualizada con éxito{saved_note}.*\n\n{preview_text}",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=get_libro_entry_preview_keyboard(),
        )
        if sent:
            track_menu_message(context, sent.message_id)

    return True


async def start_libro_obra_flow(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Inicia el flujo guiado para el llenado del Libro de Obra."""
    user_id = update.effective_user.id if update.effective_user else None
    context.user_data["libro_flow"] = {}
    context.user_data["active_module"] = "libro"

    recent_projects = get_recent_projects(user_id)
    buttons = [[p] for p in recent_projects[:4]]
    buttons.append(["➕ Registrar Nueva Obra", "🔙 Volver a Libros"])
    buttons.append(["❌ Cancelar"])

    msg = (
        "📖 *Llenado del Libro Diario de Obra (Sin Fotos)*\n\n"
        "👉 *Pega ahora el reporte diario de inspección en este chat.*\n"
        "_El asistente estructurará los bloques de datos y redactará la labor con IA para que la revises y confirmes con el botón Guardar._\n\n"
        "_O selecciona una obra abajo para llenarlo paso a paso:_"
    )

    if update.callback_query:
        await update.callback_query.answer()
        await update.callback_query.message.reply_text(
            msg,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=ReplyKeyboardMarkup(buttons, resize_keyboard=True, one_time_keyboard=True),
        )
    elif update.message:
        await update.message.reply_text(
            msg,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=ReplyKeyboardMarkup(buttons, resize_keyboard=True, one_time_keyboard=True),
        )

    return STATE_SELECT_OBRA


async def handle_select_obra(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Procesa el nombre de la obra seleccionado o ingresado."""
    text = (update.message.text or "").strip()
    if text in ("❌ Cancelar", "/cancelar"):
        await update.message.reply_text("Operación cancelada.", reply_markup=ReplyKeyboardRemove())
        return ConversationHandler.END

    if text in ("🔙 Volver a Menú", "🔙 Volver al Menú", "🔙 Volver"):
        await update.message.reply_text("Volviendo al menú del Libro de Obra.", reply_markup=ReplyKeyboardRemove())
        await show_libro_obra_hub(update, context)
        return ConversationHandler.END

    if await process_full_report_for_libro(update, context, text):
        return ConversationHandler.END

    if text == "➕ Registrar Nueva Obra":
        await update.message.reply_text(
            "Por favor, escribe el *Nombre de la Obra*:",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=ReplyKeyboardRemove(),
        )
        return STATE_SELECT_OBRA

    if text == "🗑️ Eliminar un Libro":
        user_id = update.effective_user.id if update.effective_user else None
        recent_projects = get_recent_projects(user_id)
        if not recent_projects:
            await update.message.reply_text("ℹ️ No tienes ningún libro de obra registrado actualmente.", reply_markup=ReplyKeyboardRemove())
            return ConversationHandler.END

        delete_buttons = [[f"Eliminar: {p}"] for p in recent_projects]
        delete_buttons.append(["❌ Cancelar"])
        await update.message.reply_text(
            "⚠️ *¿Cuál Libro de Obra deseas eliminar permanentemente?*\n"
            "Esta acción borrará el archivo Excel generado y su configuración.",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=ReplyKeyboardMarkup(delete_buttons, resize_keyboard=True, one_time_keyboard=True),
        )
        return STATE_CONFIRMAR_BORRADO

    obra_name = text
    context.user_data["libro_flow"]["obra"] = obra_name

    existing_meta = get_project_metadata(obra_name)
    if existing_meta and existing_meta.get("ing_residente"):
        context.user_data["libro_flow"]["general_data"] = existing_meta
        today_str = datetime.now().strftime("%d/%m/%Y")
        reply_kb = ReplyKeyboardMarkup(
            [[f"Hoy ({today_str}) - 8 Horas"], ["Solo Fecha de Hoy", "Omitir"]],
            resize_keyboard=True,
            one_time_keyboard=True,
        )
        await update.message.reply_text(
            f"✅ Obra seleccionada: *{obra_name}*\n"
            f"👷 Residente: _{existing_meta.get('ing_residente')}_ (CIV: {existing_meta.get('civ_residente', 'S/N')})\n"
            f"🕵 Inspector: _{existing_meta.get('ing_inspector')}_ (CIV: {existing_meta.get('civ_inspector', 'S/N')})\n\n"
            "📅 *Paso 1/6: Fecha y Horas Trabajadas*\n"
            "Indica la fecha y jornada laboral (o pulsa un botón):",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=reply_kb,
        )
        return STATE_FECHA_HORAS

    await update.message.reply_text(
        f"📝 Configurando datos de: *{obra_name}*\n\n"
        "Para que las firmas y la hoja *DATOS GENERALES* queden bien configuradas, "
        "envía los datos de los profesionales en este formato (puedes copiar y editar):\n\n"
        "```text\n"
        "Residente: Ing. Nombre Apellido\n"
        "CIV Residente: 123456\n"
        "Inspector: Ing. Nombre Apellido\n"
        "CIV Inspector: 654321\n"
        "Contratista: Constructora XYZ C.A.\n"
        "Ente: Ente Contratante\n"
        "```\n"
        "_(O pulsa 'Omitir' si deseas llenarlos directamente en el Excel)_",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=ReplyKeyboardMarkup([["Omitir"]], resize_keyboard=True, one_time_keyboard=True),
    )
    return STATE_DATOS_GENERALES


async def handle_datos_generales(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Parsea y guarda los datos de profesionales y contrato."""
    text = (update.message.text or "").strip()
    if await process_full_report_for_libro(update, context, text):
        return ConversationHandler.END

    obra_name = context.user_data.get("libro_flow", {}).get("obra", "Obra")
    user_id = update.effective_user.id if update.effective_user else None

    general_data = {"obra": obra_name}
    if text.lower() != "omitir":
        for line in text.split("\n"):
            line_s = line.strip()
            if ":" not in line_s:
                continue
            key, val = line_s.split(":", 1)
            key = key.strip().lower()
            val = val.strip()

            if "residente" in key and "civ" not in key:
                general_data["ing_residente"] = format_engineer_name(val)
            elif "civ" in key and "residente" in key:
                general_data["civ_residente"] = val
            elif "inspector" in key and "civ" not in key:
                general_data["ing_inspector"] = format_engineer_name(val) if "," not in val else val
            elif "civ" in key and "inspector" in key:
                general_data["civ_inspector"] = val
            elif "contratista" in key:
                general_data["firma_contratista"] = val
            elif "ente" in key:
                general_data["ente_contratante"] = val
            elif "representante" in key and "civ" not in key:
                general_data["representante_legal"] = val
            elif "civ" in key and "representante" in key:
                general_data["civ_representante"] = val

    save_project_metadata(obra_name, user_id, general_data)
    context.user_data["libro_flow"]["general_data"] = general_data

    today_str = datetime.now().strftime("%d/%m/%Y")
    reply_kb = ReplyKeyboardMarkup(
        [[f"Hoy ({today_str}) - 8 Horas"], ["Solo Fecha de Hoy", "Omitir"]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )
    await update.message.reply_text(
        "📅 *Paso 1/6: Fecha y Horas Trabajadas*\n"
        "Indica la fecha del reporte y las horas laboradas (ejemplo: `30/10/2026 - 8 Horas`):",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=reply_kb,
    )
    return STATE_FECHA_HORAS


async def handle_fecha_horas(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Registra la fecha y horas laboradas."""
    text = (update.message.text or "").strip()
    if await process_full_report_for_libro(update, context, text):
        return ConversationHandler.END

    today_str = datetime.now().strftime("%d/%m/%Y")

    if "hoy" in text.lower() or text.lower() == "omitir":
        fecha = today_str
        horas = "8 HORAS"
    else:
        parts = text.split("-") if "-" in text else [text]
        fecha = parts[0].strip() or today_str
        horas = parts[1].strip() if len(parts) > 1 else "8 HORAS"

    context.user_data["libro_flow"]["entry"] = {
        "fecha": fecha,
        "horas_trabajadas": horas if "HORAS" in horas.upper() else f"{horas} HORAS",
    }

    clima_kb = ReplyKeyboardMarkup(
        [["☀️ Soleado", "⛅ Parcialmente Nublado"], ["🌧️ Lluvioso", "⛈️ Tormenta"]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )
    await update.message.reply_text(
        "🌦 *Paso 2/6: Estado del Tiempo*\n¿Cómo estuvo el clima en la obra hoy?",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=clima_kb,
    )
    return STATE_CLIMA


async def handle_clima(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Registra el estado del tiempo."""
    text = (update.message.text or "").strip()
    if await process_full_report_for_libro(update, context, text):
        return ConversationHandler.END

    clean_clima = text.replace("☀️", "").replace("⛅", "").replace("🌧️", "").replace("⛈️", "").strip().upper()
    context.user_data["libro_flow"]["entry"]["clima"] = clean_clima or "SOLEADO"

    personal_kb = ReplyKeyboardMarkup(
        [["Sin cambios respecto a ayer", "Omitir"]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )
    await update.message.reply_text(
        "👷 *Paso 3/6: Movimiento de Personal*\n"
        "Indica el personal que laboró en sitio (ejemplo: `1 Maestro de obra, 2 Albañiles, 5 Obreros`):",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=personal_kb,
    )
    return STATE_PERSONAL


async def handle_personal(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Registra el movimiento del personal."""
    text = (update.message.text or "").strip()
    if await process_full_report_for_libro(update, context, text):
        return ConversationHandler.END

    if text.lower() != "omitir":
        context.user_data["libro_flow"]["entry"]["personal"] = text
    else:
        context.user_data["libro_flow"]["entry"]["personal"] = "Personal estándar en obra"

    equipos_kb = ReplyKeyboardMarkup(
        [["Herramientas menores", "Sin maquinaria pesada"], ["Omitir"]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )
    await update.message.reply_text(
        "🚜 *Paso 4/6: Movimiento de Maquinaria y Equipos*\n"
        "Indica los equipos y maquinaria en sitio (ejemplo: `1 Retroexcavadora, 1 Trompo mezclador, Herramientas menores`):",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=equipos_kb,
    )
    return STATE_EQUIPOS


async def handle_equipos(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Registra la maquinaria y equipos."""
    text = (update.message.text or "").strip()
    if await process_full_report_for_libro(update, context, text):
        return ConversationHandler.END

    if text.lower() != "omitir":
        context.user_data["libro_flow"]["entry"]["equipos"] = text
    else:
        context.user_data["libro_flow"]["entry"]["equipos"] = "Herramientas menores"

    await update.message.reply_text(
        "🏗 *Paso 5/6: Descripción de Actividades*\n"
        "Describe las labores ejecutadas en el día (puedes enviar viñetas o texto corrido):",
        reply_markup=ReplyKeyboardRemove(),
    )
    return STATE_ACTIVIDADES


async def handle_actividades(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Registra las actividades diarias."""
    text = (update.message.text or "").strip()
    if await process_full_report_for_libro(update, context, text):
        return ConversationHandler.END

    context.user_data["libro_flow"]["entry"]["actividades"] = text

    obs_kb = ReplyKeyboardMarkup(
        [["Sin observaciones particulares", "Omitir"]],
        resize_keyboard=True,
        one_time_keyboard=True,
    )
    await update.message.reply_text(
        "📝 *Paso 6/6: Observaciones de Inspección*\n"
        "Indica notas, observaciones técnicas, solicitudes o alertas para el libro diario:",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=obs_kb,
    )
    return STATE_OBSERVACIONES


async def handle_observaciones(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Registra las observaciones y muestra la vista previa por bloques para confirmación con botón Guardar."""
    text = (update.message.text or "").strip()
    if await process_full_report_for_libro(update, context, text):
        return ConversationHandler.END

    if text.lower() != "omitir":
        context.user_data["libro_flow"]["entry"]["observaciones"] = text
    else:
        context.user_data["libro_flow"]["entry"]["observaciones"] = "Sin observaciones particulares."

    flow = context.user_data.get("libro_flow", {})
    entry = flow.get("entry", {})
    obra = flow.get("obra", "Obra")

    acts_raw = entry.get("actividades", "")
    actividades_list = [a.strip(" -•*") for a in acts_raw.split("\n") if a.strip(" -•*")]

    user_id = update.effective_user.id if update.effective_user else None
    existing_meta = get_project_metadata(obra)
    general_data = flow.get("general_data") or existing_meta

    desc_labor_ai = generate_labor_description_ai(
        actividades=actividades_list,
        obra=obra,
        empresa=general_data.get("firma_contratista", ""),
        fecha=entry.get("fecha", ""),
        obreros=entry.get("personal", ""),
        equipos=entry.get("equipos", ""),
        ensayos=entry.get("control_calidad", ""),
    )

    # Personal de inspección: SOLO INSPECTORES, NUNCA EL RESIDENTE
    insp_str = (general_data.get("ing_inspector") or "").strip()

    entry_data = {
        "fecha": entry.get("fecha") or datetime.now().strftime("%d/%m/%Y"),
        "clima": entry.get("clima") or "SOLEADO",
        "horas_trabajadas": entry.get("horas_trabajadas") or "8 HORAS",
        "personal": entry.get("personal") or "Personal estándar en obra",
        "personal_inspeccion": insp_str,
        "equipos": entry.get("equipos") or "Herramientas menores y equipos de construcción",
        "descripcion_labor": desc_labor_ai,
        "resumen_actividades": "\n".join(f"• {a}" for a in actividades_list) if actividades_list else "• Actividades ejecutadas en obra",
        "actividades_list": actividades_list,
        "observaciones": entry.get("observaciones") or "Sin observaciones particulares.",
        "control_calidad": "",
        "revisado_por": "",
    }

    report_text = format_report_text_from_entry(obra, entry_data, general_data)
    context.user_data["pending_libro_entry"] = {
        "obra": obra,
        "entry_data": entry_data,
        "general_data": general_data,
        "actividades": actividades_list,
        "user_id": user_id,
        "raw_text": report_text,
    }
    context.user_data["last_raw_report_text"] = report_text
    if user_id:
        save_user_last_report(user_id, report_text, obra=obra)

    await save_and_deliver_libro_entry(
        msg_target=update.message,
        context=context,
        obra=obra,
        entry_data=entry_data,
        general_data=general_data,
        user_id=user_id,
        raw_text=report_text,
    )
    return ConversationHandler.END


async def handle_confirmar(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Ejecuta la inserción de la hoja en el Libro de Obra y envía el archivo al usuario."""
    text = (update.message.text or "").strip()
    if "cancelar" in text.lower():
        await update.message.reply_text("Operación cancelada. No se registraron cambios.", reply_markup=ReplyKeyboardRemove())
        return ConversationHandler.END

    await update.message.reply_text("⏳ Procesando y agregando hoja al Libro de Obra...", reply_markup=ReplyKeyboardRemove())

    flow = context.user_data.get("libro_flow", {})
    obra = flow.get("obra", "Obra")
    entry = flow.get("entry", {})
    general_data = flow.get("general_data")

    try:
        book_path, sheet_name, sheet_num = add_daily_entry_to_book(obra, entry, general_data)

        with open(book_path, "rb") as f:
            await update.message.reply_document(
                document=f,
                filename=book_path.name,
                caption=(
                    f"📗 *Libro de Obra Actualizado*\n\n"
                    f"• *Obra:* {obra}\n"
                    f"• *Nueva Hoja Registrada:* Hoja `{sheet_name}`\n"
                    f"• *Fecha:* {entry.get('fecha')}\n\n"
                    f"🔗 _Todas las firmas y datos se vinculan dinámicamente con la hoja 'DATOS GENERALES'._"
                ),
                parse_mode=ParseMode.MARKDOWN,
            )

        # Sincronización automática con Google Drive
        drive_res = upload_file_to_drive(book_path)
        reply_kb = []
        if drive_res and drive_res.get("web_view_link"):
            reply_kb.append([InlineKeyboardButton("☁️ Abrir en Google Drive", url=drive_res["web_view_link"])])
        reply_kb.append([InlineKeyboardButton("🏠 Volver al Menú Principal", callback_data="btn_menu_home")])

        drive_note = f"\n☁️ *Sincronizado en Google Drive:* `{book_path.name}`" if drive_res else ""
        await update.message.reply_text(
            f"✅ *Hoja #{sheet_name} añadida exitosamente al Libro de Obra.*{drive_note}\n"
            "Puedes editar este archivo en Google Drive o registrar una nueva hoja cuando desees con `/libro` o `/start`.",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=InlineKeyboardMarkup(reply_kb),
        )
    except Exception as exc:
        logger.error("Error al registrar hoja en Libro de Obra: %s", exc, exc_info=True)
        await update.message.reply_text(f"❌ Ocurrió un error al procesar el libro: {exc}")

    return ConversationHandler.END


async def handle_confirmar_borrado(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Procesa la confirmación de eliminación de un libro de obra."""
    text = (update.message.text or "").strip()
    if text in ("❌ Cancelar", "/cancelar"):
        await update.message.reply_text("Operación cancelada. No se eliminó ningún archivo.", reply_markup=ReplyKeyboardRemove())
        return ConversationHandler.END

    obra_to_delete = text.replace("Eliminar:", "").strip()
    try:
        deleted_file = delete_project_book(obra_to_delete)
        deleted_db = delete_project_metadata(obra_to_delete)

        if deleted_file or deleted_db:
            await update.message.reply_text(
                f"🗑️ El Libro de Obra de *'{obra_to_delete}'* y su configuración fueron eliminados con éxito.",
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=ReplyKeyboardRemove(),
            )
        else:
            await update.message.reply_text(
                f"ℹ️ No se encontró el libro o configuración de *'{obra_to_delete}'*.",
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=ReplyKeyboardRemove(),
            )
    except Exception as exc:
        logger.error("Error al borrar libro de obra %s: %s", obra_to_delete, exc, exc_info=True)
        await update.message.reply_text(f"❌ Error al eliminar: {exc}", reply_markup=ReplyKeyboardRemove())

    return ConversationHandler.END


async def cancel_libro_obra(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Cancela la conversación y limpia el flujo."""
    context.user_data.pop("libro_flow", None)
    if update.message:
        await update.message.reply_text("Operación cancelada. Volviendo al estado principal.", reply_markup=ReplyKeyboardRemove())
    return ConversationHandler.END


async def cancel_libro_obra_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Si el usuario adjunta una foto mientras estaba en el flujo de Libro de Obra,
    se le informa que el Libro de Obra no lleva fotografías.
    """
    if update.message:
        await update.message.reply_text(
            "ℹ️ *El Libro de Obra es un documento técnico-legal oficial y no lleva fotografías.*\n\n"
            "• Para generar una **Ficha Técnica con Memoria Fotográfica**, pulsa el botón abajo.\n"
            "• Para continuar con el Libro de Obra, pega el reporte de la jornada en texto.",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("📖 Menú del Libro de Obra", callback_data="btn_menu_libro")],
            ]),
        )
    return STATE_SELECT_OBRA


def track_menu_message(context: ContextTypes.DEFAULT_TYPE, msg_id: int) -> None:
    """Registra el id de un mensaje del bot para eliminarlo al limpiar el chat."""
    if not msg_id:
        return
    tracked = context.user_data.setdefault("tracked_menu_messages", [])
    if msg_id not in tracked:
        tracked.append(msg_id)


async def return_to_clean_main_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Limpia los mensajes de menús previos en el chat y muestra el Menú Principal limpio."""
    chat = update.effective_chat
    chat_id = chat.id if chat else None

    # 1. Limpiar estados de sesión
    context.user_data.pop("current_report", None)
    context.user_data.pop("photos", None)
    context.user_data.pop("pending_photos", None)
    context.user_data.pop("libro_flow", None)
    context.user_data.pop("weekly_report", None)
    context.user_data.pop("weekly_photos", None)
    context.user_data.pop("saved_books_cache", None)
    context.user_data.pop("del_books_cache", None)
    context.user_data.pop("del_names_cache", None)

    # 2. Borrar mensajes de menú previos si existen para un chat limpio
    tracked_ids = context.user_data.pop("tracked_menu_messages", [])
    if chat_id and tracked_ids:
        for msg_id in tracked_ids:
            try:
                await context.bot.delete_message(chat_id=chat_id, message_id=msg_id)
            except Exception as exc:
                logger.debug("No se pudo eliminar mensaje previo %s: %s", msg_id, exc)

    query = update.callback_query
    if query and query.message and not query.message.document:
        try:
            await query.message.delete()
        except Exception as exc:
            logger.debug("No se pudo eliminar mensaje de callback: %s", exc)

    welcome_text = (
        "📖 *Libro de Obra Digital*\n\n"
        "Asistente exclusivo para el registro, control y seguimiento oficial de Libros de Obra.\n\n"
        "📌 *Funciones disponibles:*\n"
        "• ✍️ *Asentar Hoja:* Registra la jornada diaria (personal, maquinaria, avance, clima y observaciones).\n"
        "• 📚 *Ver Libros:* Consulta el historial y descarga el Excel oficial con todas las hojas foliadas.\n"
        "• ✏️ *Editar Hoja:* Corrige descripciones u observaciones de asientos guardados.\n"
        "• 🗑️ *Eliminar Libro:* Administra y limpia libros archivados.\n\n"
        "Selecciona una opción del panel para comenzar:"
    )

    if chat_id:
        sent_welcome = await context.bot.send_message(
            chat_id=chat_id,
            text=welcome_text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=get_libro_main_keyboard(),
        )
        if sent_welcome:
            track_menu_message(context, sent_welcome.message_id)


async def show_libro_obra_hub(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Muestra el panel principal interactivo del Módulo de Libro de Obra."""
    context.user_data.pop("libro_flow", None)

    msg = (
        "📖 *Módulo de Libro de Obra*\n\n"
        "• ✍️ *Llenar / Asentar Hoja:* Registra una jornada diaria (pega el reporte o llena guiado para que la IA elabore la hoja oficial).\n"
        "• 📚 *Ver Libros Guardados:* Consulta las obras existentes, cantidad de hojas acumuladas y descarga los archivos Excel.\n"
        "• 🗑️ *Eliminar un Libro:* Elimina de forma segura y permanente el libro y registros de una obra.\n\n"
        "_Selecciona la acción que deseas realizar:_"
    )

    query = update.callback_query
    sent_msg = None
    if query:
        await query.answer()
        if query.message and not query.message.document:
            try:
                await query.message.delete()
            except Exception as exc:
                logger.debug("No se pudo borrar mensaje anterior en show_libro_obra_hub: %s", exc)

        sent_msg = await query.message.reply_text(
            msg,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=get_libro_menu_keyboard(),
        )
    elif update.message:
        sent_msg = await update.message.reply_text(
            msg,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=get_libro_menu_keyboard(),
        )

    if sent_msg:
        track_menu_message(context, sent_msg.message_id)


async def show_saved_libros_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Muestra la lista de libros de obra guardados con botones para descargarlos directamente."""
    context.user_data.pop("libro_flow", None)
    query = update.callback_query
    msg_target = query.message if query else update.message
    if not msg_target:
        return
    if query:
        await query.answer()
        if query.message and not query.message.document:
            try:
                await query.message.delete()
            except Exception as exc:
                logger.debug("No se pudo borrar mensaje anterior en show_saved_libros_menu: %s", exc)

    books = list_all_project_books()
    if not books:
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("✍️ Llenar Primera Hoja", callback_data="btn_libro_registrar")],
            [InlineKeyboardButton("🔙 Volver a Libro de Obra", callback_data="btn_menu_libro")],
            [InlineKeyboardButton("🏠 Menú Principal", callback_data="btn_menu_home")],
        ])
        sent_empty = await msg_target.reply_text(
            "ℹ️ *No tienes ningún Libro de Obra guardado actualmente.*\n\n"
            "Puedes asentar la primera jornada pulsando el botón abajo o enviando tu reporte diario.",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=kb,
        )
        if sent_empty:
            track_menu_message(context, sent_empty.message_id)
        return

    context.user_data["saved_books_cache"] = [b["filename"] for b in books]

    txt = "📚 *Libros de Obra Guardados en el Sistema:*\n\n"
    buttons = []
    for idx, b in enumerate(books):
        p_name = b["project_name"]
        p_name_display = (p_name[:55] + "...") if len(p_name) > 55 else p_name
        last_date_str = f" • Última fecha: `{b['last_date']}`" if b["last_date"] else ""
        txt += f"*{idx + 1}.* 🏗 *{p_name_display}*\n"
        txt += f"   📑 *Hojas acumuladas:* {b['sheet_count']}{last_date_str}\n"
        txt += f"   📁 `{b['filename']}`\n\n"

        short_btn_title = (p_name[:20] + "...") if len(p_name) > 20 else p_name
        buttons.append([
            InlineKeyboardButton(f"📥 Descargar", callback_data=f"btn_dl_libro_{idx}"),
            InlineKeyboardButton(f"✏️ Editar Hojas", callback_data=f"btn_edit_book_{idx}"),
        ])

    buttons.append([
        InlineKeyboardButton("✍️ Llenar / Asentar Hoja", callback_data="btn_libro_registrar"),
        InlineKeyboardButton("🗑️ Eliminar un Libro", callback_data="btn_libro_eliminar"),
    ])
    buttons.append([
        InlineKeyboardButton("🔙 Volver a Libro de Obra", callback_data="btn_menu_libro"),
        InlineKeyboardButton("🏠 Menú Principal", callback_data="btn_menu_home"),
    ])

    sent_list = await msg_target.reply_text(
        txt,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup(buttons),
    )
    if sent_list:
        track_menu_message(context, sent_list.message_id)


async def handle_download_libro(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Entrega el archivo Excel del libro seleccionado al chat de Telegram con botones de navegación limpia."""
    query = update.callback_query
    if not query:
        return
    await query.answer()

    data_str = query.data or ""
    idx_str = data_str.replace("btn_dl_libro_", "").strip()
    try:
        idx = int(idx_str)
        cache = context.user_data.get("saved_books_cache", [])
        if not (0 <= idx < len(cache)):
            books = list_all_project_books()
            cache = [b["filename"] for b in books]
            context.user_data["saved_books_cache"] = cache

        if not (0 <= idx < len(cache)):
            await query.message.reply_text("❌ No se encontró el libro solicitado. Vuelve a listar con 'Ver Libros Guardados'.")
            return

        filename = cache[idx]
        file_path = BOOKS_DIR / filename
        if not file_path.exists():
            await query.message.reply_text(f"❌ El archivo `{filename}` ya no se encuentra en el servidor.", parse_mode=ParseMode.MARKDOWN)
            return

        reply_kb = [
            [
                InlineKeyboardButton("🔙 Volver a Libros", callback_data="btn_libro_ver"),
                InlineKeyboardButton("📖 Menú Libro de Obra", callback_data="btn_menu_libro"),
            ],
            [
                InlineKeyboardButton("🏠 Menú Principal (Limpiar Chat)", callback_data="btn_menu_home"),
            ],
        ]

        with open(file_path, "rb") as f:
            sent_doc = await query.message.reply_document(
                document=f,
                filename=filename,
                caption=f"📗 *Libro de Obra Oficial:* `{filename}`",
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=InlineKeyboardMarkup(reply_kb),
            )
            if sent_doc:
                track_menu_message(context, sent_doc.message_id)
    except Exception as exc:
        logger.error("Error al entregar archivo de libro de obra %s: %s", idx_str, exc, exc_info=True)
        await query.message.reply_text(f"❌ Error al descargar el libro: {exc}")


async def _show_sheets_for_book(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    filename: str,
    project_name: str,
) -> None:
    """Muestra la lista interactiva de hojas de un libro para editar."""
    query = update.callback_query
    msg_target = query.message if query else update.message
    if not msg_target:
        return

    book_path = BOOKS_DIR / filename
    if not book_path.exists():
        await msg_target.reply_text(f"❌ No se encontró el archivo: {filename}")
        return

    sheets = list_book_sheets(book_path)
    if not sheets:
        await msg_target.reply_text(
            f"ℹ️ El libro *{project_name}* no tiene hojas de reporte diario aún.",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 Volver", callback_data="btn_menu_libro")]]),
        )
        return

    context.user_data["editing_book_filename"] = filename
    context.user_data["editing_project_name"] = project_name

    txt = (
        f"✏️ *Editar Hoja Guardada — Selecciona el Día:*\n"
        f"🏗 *{project_name}*\n\n"
        f"Selecciona la hoja cuyo mensaje deseas recuperar para corregir y reenviar:"
    )

    buttons: List[List[InlineKeyboardButton]] = []
    if len(sheets) > 10:
        row_acc: List[InlineKeyboardButton] = []
        for s in sheets:
            s_name = s["sheet_name"]
            fecha = s["fecha"]
            short_fecha = fecha[:5] if len(fecha) >= 5 else fecha
            btn_title = f"📑 H{s_name} • {short_fecha}"
            row_acc.append(InlineKeyboardButton(btn_title, callback_data=f"btn_edit_sheet_{s_name}"))
            if len(row_acc) == 2:
                buttons.append(row_acc)
                row_acc = []
        if row_acc:
            buttons.append(row_acc)
    else:
        for s in sheets:
            s_name = s["sheet_name"]
            fecha = s["fecha"]
            buttons.append([
                InlineKeyboardButton(
                    f"📑 Hoja {s_name} • {fecha}",
                    callback_data=f"btn_edit_sheet_{s_name}",
                )
            ])

    buttons.append([
        InlineKeyboardButton("📚 Ver Libros Guardados", callback_data="btn_libro_ver"),
        InlineKeyboardButton("🏠 Menú Principal", callback_data="btn_menu_home"),
    ])

    if query and query.message and not query.message.document:
        try:
            await query.message.edit_text(txt, parse_mode=ParseMode.MARKDOWN, reply_markup=InlineKeyboardMarkup(buttons))
            return
        except Exception as exc:
            logger.debug("No se pudo editar texto al mostrar hojas: %s", exc)

    sent = await msg_target.reply_text(txt, parse_mode=ParseMode.MARKDOWN, reply_markup=InlineKeyboardMarkup(buttons))
    if sent:
        track_menu_message(context, sent.message_id)


async def handle_menu_editar_hoja(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Maneja el botón '✏️ Editar una Hoja Guardada' del menú de Libro de Obra."""
    query = update.callback_query
    msg_target = query.message if query else update.message
    if not msg_target:
        return
    if query:
        await query.answer()

    books = list_all_project_books()
    if not books:
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("✍️ Asentar Primera Hoja", callback_data="btn_libro_registrar")],
            [InlineKeyboardButton("🏠 Menú Principal", callback_data="btn_menu_home")],
        ])
        await msg_target.reply_text(
            "ℹ️ *No tienes ningún Libro de Obra guardado actualmente.*\n\n"
            "Registra primero una hoja para poder editarla.",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=kb,
        )
        return

    context.user_data["saved_books_cache"] = [b["filename"] for b in books]

    # Si solo hay un libro, mostramos directamente sus hojas
    if len(books) == 1:
        await _show_sheets_for_book(update, context, books[0]["filename"], books[0]["project_name"])
        return

    # Si hay varios, dejamos elegir el libro
    buttons: List[List[InlineKeyboardButton]] = []
    for idx, b in enumerate(books):
        p_name = b["project_name"]
        short_btn_title = (p_name[:28] + "...") if len(p_name) > 28 else p_name
        buttons.append([
            InlineKeyboardButton(f"🏗 {short_btn_title}", callback_data=f"btn_edit_book_{idx}")
        ])
    buttons.append([InlineKeyboardButton("🏠 Menú Principal", callback_data="btn_menu_home")])

    await msg_target.reply_text(
        "✏️ *Selecciona el Libro de Obra cuya hoja deseas editar:*",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup(buttons),
    )


async def handle_select_book_to_edit(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Maneja la selección de un libro para editar sus hojas."""
    query = update.callback_query
    if not query:
        return
    await query.answer()

    data_str = query.data or ""
    idx_str = data_str.replace("btn_edit_book_", "").strip()
    try:
        idx = int(idx_str)
        cache = context.user_data.get("saved_books_cache", [])
        if not (0 <= idx < len(cache)):
            books = list_all_project_books()
            cache = [b["filename"] for b in books]
            context.user_data["saved_books_cache"] = cache
        filename = cache[idx]
        books = list_all_project_books()
        p_name = filename
        for b in books:
            if b["filename"] == filename:
                p_name = b["project_name"]
                break
        await _show_sheets_for_book(update, context, filename, p_name)
    except Exception as exc:
        logger.error("Error al seleccionar libro para editar %s: %s", idx_str, exc, exc_info=True)
        if query.message:
            await query.message.reply_text(f"❌ Error al abrir libro: {exc}")


async def handle_select_sheet_to_edit(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Recupera el mensaje de la hoja seleccionada y se lo entrega al usuario formateado
    en un bloque de código para que lo copie, edite y reenvíe al chat.
    """
    query = update.callback_query
    if not query:
        return
    await query.answer()

    data_str = query.data or ""
    sheet_name = data_str.replace("btn_edit_sheet_", "").strip()

    filename = context.user_data.get("editing_book_filename")
    if not filename:
        books = list_all_project_books()
        if books:
            filename = books[0]["filename"]

    if not filename:
        if query.message:
            await query.message.reply_text("❌ No se encontró el libro de obra correspondiente.")
        return

    book_path = BOOKS_DIR / filename
    try:
        entry_data, general_data, obra = load_sheet_entry_data(book_path, sheet_name)
        if not obra:
            obra = context.user_data.get("editing_project_name") or "Libro de Obra"

        context.user_data["editing_existing_sheet"] = {
            "sheet_name": sheet_name,
            "book_path": str(book_path),
            "obra": obra,
            "fecha": entry_data.get("fecha", ""),
        }
        context.user_data["editing_book_filename"] = filename
        context.user_data["editing_project_name"] = obra

        # Buscar el mensaje original guardado o reconstruirlo con fidelidad
        msg_text = get_sheet_report(obra, str(sheet_name))
        if not msg_text and entry_data.get("fecha"):
            msg_text = get_sheet_report_by_date(obra, str(entry_data["fecha"]))
        if not msg_text:
            msg_text = format_report_text_from_entry(obra, entry_data, general_data)

        fecha_display = entry_data.get("fecha") or "Fecha no especificada"
        reply_lines = [
            f"📋 *Mensaje Recuperado — Hoja #{sheet_name}* ({fecha_display})",
            f"🏗 *Obra:* {obra[:60]}...",
            "",
            "👇 *Toca el cuadro para copiar el reporte completo.*",
            "Pégalo en el chat, realiza las modificaciones que necesites y envíalo. El bot actualizará la hoja automáticamente en el archivo Excel oficial (.xlsx):",
            "",
            f"```text\n{msg_text}\n```",
        ]
        full_text = "\n".join(reply_lines)

        reply_kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("📑 Elegir Otra Hoja", callback_data="btn_libro_menu_editar")],
            [InlineKeyboardButton("🏠 Menú Principal", callback_data="btn_menu_home")],
        ])

        if query.message:
            sent_msg = await safe_reply_markdown(
                query.message,
                full_text,
                reply_markup=reply_kb,
            )
            if sent_msg:
                track_menu_message(context, sent_msg.message_id)

    except Exception as exc:
        logger.error("Error al cargar mensaje de la hoja para editar: %s", exc, exc_info=True)
        if query.message:
            await query.message.reply_text(f"❌ Error al recuperar el mensaje de la hoja #{sheet_name}: {exc}")



async def handle_menu_modificar_fecha_inicio(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Maneja el botón '📅 Modificar Fecha de Inicio' del panel del Libro de Obra."""
    query = update.callback_query
    msg_target = query.message if query else update.message
    if not msg_target:
        return
    if query:
        await query.answer()

    books = list_all_project_books()
    if not books:
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("✍️ Llenar Primera Hoja", callback_data="btn_libro_registrar")],
            [InlineKeyboardButton("🔙 Volver a Libro de Obra", callback_data="btn_menu_libro")],
        ])
        await msg_target.reply_text(
            "ℹ️ *No tienes ningún Libro de Obra guardado actualmente.*\n\n"
            "Registra primero una hoja para poder modificar la fecha de inicio.",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=kb,
        )
        return

    context.user_data["saved_books_cache"] = [b["filename"] for b in books]

    # Si solo hay un libro, pedimos directamente la nueva fecha
    if len(books) == 1:
        await _prompt_new_start_date_for_book(update, context, books[0]["filename"], books[0]["project_name"])
        return

    # Si hay múltiples libros, mostramos selector
    buttons: List[List[InlineKeyboardButton]] = []
    for idx, b in enumerate(books):
        p_name = b["project_name"]
        short_title = (p_name[:28] + "...") if len(p_name) > 28 else p_name
        buttons.append([
            InlineKeyboardButton(f"🏗 {short_title}", callback_data=f"btn_shift_book_{idx}")
        ])
    buttons.append([InlineKeyboardButton("🔙 Volver a Libro de Obra", callback_data="btn_menu_libro")])

    await msg_target.reply_text(
        "📅 *Modificar Fecha de Inicio del Libro de Obra*\n\n"
        "Selecciona el proyecto cuyo cronograma de hojas deseas desplazar:",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup(buttons),
    )


async def handle_select_book_to_shift(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Maneja la selección de un libro específico para desplazar su fecha de inicio."""
    query = update.callback_query
    if not query:
        return
    await query.answer()

    data_str = query.data or ""
    idx_str = data_str.replace("btn_shift_book_", "").strip()
    try:
        idx = int(idx_str)
        cache = context.user_data.get("saved_books_cache", [])
        if not (0 <= idx < len(cache)):
            books = list_all_project_books()
            cache = [b["filename"] for b in books]
            context.user_data["saved_books_cache"] = cache
        filename = cache[idx]
        books = list_all_project_books()
        p_name = filename
        for b in books:
            if b["filename"] == filename:
                p_name = b["project_name"]
                break
        await _prompt_new_start_date_for_book(update, context, filename, p_name)
    except Exception as exc:
        logger.error("Error al seleccionar libro para desplazar fecha %s: %s", idx_str, exc, exc_info=True)
        if query.message:
            await query.message.reply_text(f"❌ Error al abrir libro: {exc}")


async def _prompt_new_start_date_for_book(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    filename: str,
    project_name: str,
) -> None:
    """Inspecciona el libro y solicita al usuario ingresar la nueva fecha de inicio."""
    msg_target = update.callback_query.message if update.callback_query else update.message
    if not msg_target:
        return

    book_path = BOOKS_DIR / filename
    try:
        wb = openpyxl.load_workbook(book_path, data_only=True)
        fixed_sheets = {"DATOS GENERALES", "ACTAS"}
        daily_sheets = [s for s in wb.sheetnames if s not in fixed_sheets]
        if not daily_sheets:
            await msg_target.reply_text(
                f"ℹ️ El libro de la obra *{_clean_md(project_name)}* no contiene hojas diarias de reporte.",
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=get_libro_main_keyboard(),
            )
            return

        sheet_dates: List[Tuple[str, datetime]] = []
        for s in daily_sheets:
            dt = get_sheet_date(wb[s])
            if dt != datetime.max:
                sheet_dates.append((s, dt))

        if not sheet_dates:
            await msg_target.reply_text(
                "❌ No se encontraron fechas válidas asentadas en las hojas del libro.",
                reply_markup=get_libro_main_keyboard(),
            )
            return

        sheet_dates.sort(key=lambda x: x[1])
        first_sheet_name, old_start_date = sheet_dates[0]

        context.user_data["awaiting_new_start_date"] = {
            "filename": filename,
            "project_name": project_name,
            "old_start_date": old_start_date.strftime("%d/%m/%Y"),
            "first_sheet_name": first_sheet_name,
            "total_sheets": len(sheet_dates),
        }

        old_start_str = format_date_es(old_start_date)
        prompt_text = (
            f"📅 *Modificar Fecha de Inicio del Libro de Obra*\n\n"
            f"🏗 Obra: *{_clean_md(project_name)}*\n"
            f"• Hojas diarias asentadas: *{len(sheet_dates)}*\n"
            f"• Fecha de inicio actual (Hoja #{first_sheet_name}): *{old_start_str}*\n\n"
            f"✍️ *Por favor escribe la NUEVA fecha de inicio para la Hoja 1:*\n"
            f"Formato: `DD/MM/AAAA` (ejemplo: `02/11/2026`).\n\n"
            f"💡 _El sistema ajustará secuencialmente todas las hojas posteriores respetando los días hábiles "
            f"y te mostrará una vista previa con la auditoría de saltos antes de aplicar los cambios._"
        )

        sent = await msg_target.reply_text(
            prompt_text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=get_cancel_shift_date_keyboard(),
        )
        if sent:
            track_menu_message(context, sent.message_id)

    except Exception as exc:
        logger.error("Error al preparar cambio de fecha para %s: %s", filename, exc, exc_info=True)
        await msg_target.reply_text(f"❌ Error al consultar el libro: {exc}")


async def handle_process_new_start_date(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    date_text: str,
) -> bool:
    """
    Procesa la nueva fecha de inicio ingresada por el usuario, valida el formato,
    calcula la proyección secuencial por días hábiles, detecta omisiones (saltos)
    y despliega la vista previa con botones de confirmación.
    """
    await_info = context.user_data.get("awaiting_new_start_date")
    if not await_info:
        return False

    msg_target = update.message or (update.callback_query.message if update.callback_query else None)
    if not msg_target:
        return False

    filename = await_info["filename"]
    clean_date = date_text.strip()

    try:
        preview = calculate_start_date_shift_preview(filename, clean_date)
    except ValueError as val_err:
        await msg_target.reply_text(
            f"⚠️ *Fecha no válida:* {val_err}\n\n"
            "Por favor escribe una fecha válida en formato `DD/MM/AAAA` (ejemplo: `02/11/2026`):",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=get_cancel_shift_date_keyboard(),
        )
        return True
    except Exception as exc:
        logger.error("Error al calcular vista previa de desplazamiento: %s", exc, exc_info=True)
        await msg_target.reply_text(
            f"❌ Error al analizar el libro: {exc}",
            reply_markup=get_cancel_shift_date_keyboard(),
        )
        return True

    context.user_data["pending_start_date_shift"] = preview

    old_st = format_date_es(preview["old_start_date"])
    new_st = format_date_es(preview["new_start_date"])
    p_name = _clean_md(preview["project_name"])
    total = preview["total_sheets"]

    lines: List[str] = [
        "📅 *VISTA PREVIA: MODIFICACIÓN DE FECHA DE INICIO*",
        f"🏗 Obra: *{p_name}*",
        "",
        f"• Fecha de inicio anterior: `{old_st}`",
        f"• Nueva fecha de inicio: *{new_st}*",
        f"• Total de hojas a desplazar: *{total}*",
        "",
        "📋 *Cronograma proyectado de hojas:*",
    ]

    shifts = preview["sheet_shifts"]
    if len(shifts) <= 12:
        for s in shifts:
            lines.append(f"• Hoja #{s['sheet_name']}: {format_date_es(s['new_date'])}")
    else:
        for s in shifts[:5]:
            lines.append(f"• Hoja #{s['sheet_name']}: {format_date_es(s['new_date'])}")
        lines.append(f"  _... ({len(shifts) - 8} hojas intermedias ajustadas correlativamente) ..._")
        for s in shifts[-3:]:
            lines.append(f"• Hoja #{s['sheet_name']}: {format_date_es(s['new_date'])}")

    # Auditoría de saltos / omisiones de días laborales
    gaps = preview["gaps"]
    lines.append("")
    lines.append("🔍 *Auditoría de Saltos de Labor:*")
    if gaps:
        total_missing = sum(len(g["missing_workdays"]) for g in gaps)
        lines.append(f"⚠️ *Se detectaron {len(gaps)} salto(s) ({total_missing} día(s) hábil(es) sin asentar):*")
        for g in gaps:
            d_str = ", ".join(format_date_es(d) for d in g["missing_workdays"])
            lines.append(f"• Entre Hoja #{g['from_sheet']} y Hoja #{g['to_sheet']}: Falta asentar *{d_str}*")
        lines.append("")
        lines.append("💡 _El cronograma proyectado preservó los días hábiles. Recuerda que deberás asentar estas hojas pendientes en el libro cuando corresponda._")
    else:
        lines.append("✅ *Cronograma continuo:* No se detectaron saltos ni omisiones en días hábiles.")

    lines.append("")
    lines.append("¿Deseas aplicar estos cambios a todas las hojas del Libro de Obra?")

    full_msg = "\n".join(lines)
    sent = await msg_target.reply_text(
        full_msg,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=get_confirm_shift_date_keyboard(),
    )
    if sent:
        track_menu_message(context, sent.message_id)

    return True


async def execute_confirm_shift_date(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Aplica de forma atómica el desplazamiento de fechas en el archivo Excel y en la base de datos."""
    query = update.callback_query
    msg_target = query.message if query else update.message
    if not msg_target:
        return
    if query:
        await query.answer()

    preview = context.user_data.get("pending_start_date_shift")
    if not preview:
        await msg_target.reply_text(
            "⚠️ No hay ninguna modificación de fecha pendiente por confirmar.",
            reply_markup=get_libro_main_keyboard(),
        )
        return

    progress_msg = await msg_target.reply_text("⏳ *Actualizando Libro de Obra con nueva fecha de inicio...*", parse_mode=ParseMode.MARKDOWN)

    try:
        user_id = update.effective_user.id if update.effective_user else None
        book_filename = preview["book_filename"]
        new_start_str = preview["new_start_date"].strftime("%d/%m/%Y")

        book_path, applied_preview = apply_start_date_shift(book_filename, new_start_str, user_id=user_id)

        # Respaldo en Google Drive si está habilitado
        drive_status = ""
        try:
            drive_res = upload_file_to_drive(book_path)
            if drive_res and drive_res.get("webViewLink"):
                drive_status = f"\n☁️ [Ver en Google Drive]({drive_res['webViewLink']})"
        except Exception as drive_exc:
            logger.warning("No se pudo sincronizar con Drive tras desplazamiento de fecha: %s", drive_exc)

        # Limpiar banderas de estado
        context.user_data.pop("awaiting_new_start_date", None)
        context.user_data.pop("pending_start_date_shift", None)

        p_name = _clean_md(preview["project_name"])
        new_st_str = format_date_es(preview["new_start_date"])
        total_sheets = preview["total_sheets"]

        success_text = (
            f"✅ *¡Libro de Obra Actualizado Exitosamente!*\n\n"
            f"🏗 Obra: *{p_name}*\n"
            f"📅 Nueva Fecha de Inicio: *{new_st_str}*\n"
            f"📄 Hojas actualizadas y foliadas: *{total_sheets}*\n"
            f"🔒 Se generó una copia de respaldo automática previa en el servidor.{drive_status}\n\n"
            f"Te adjunto a continuación el archivo Excel actualizado para tu revisión inmediata:"
        )

        await progress_msg.edit_text(success_text, parse_mode=ParseMode.MARKDOWN)

        # Enviar el archivo Excel actualizado directamente
        try:
            with open(book_path, "rb") as doc_file:
                await msg_target.reply_document(
                    document=doc_file,
                    filename=book_path.name,
                    caption=f"📘 Libro de Obra Actualizado: {p_name}",
                    reply_markup=get_libro_main_keyboard(),
                )
        except Exception as doc_exc:
            logger.error("Error al enviar documento actualizado: %s", doc_exc, exc_info=True)
            await msg_target.reply_text(
                "📘 El libro fue actualizado en disco. Puedes descargarlo en cualquier momento desde *📚 Ver / Descargar Libros*.",
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=get_libro_main_keyboard(),
            )

    except Exception as exc:
        logger.error("Error al ejecutar desplazamiento de fecha de inicio: %s", exc, exc_info=True)
        await progress_msg.edit_text(
            f"❌ *Ocurrió un error al aplicar el cambio:* {exc}\n\n"
            "El archivo original se mantuvo intacto. Intenta nuevamente.",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=get_libro_main_keyboard(),
        )


async def handle_cancel_shift_date(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Cancela la modificación de fecha de inicio y retorna al menú principal."""
    query = update.callback_query
    msg_target = query.message if query else update.message
    if not msg_target:
        return
    if query:
        await query.answer()

    context.user_data.pop("awaiting_new_start_date", None)
    context.user_data.pop("pending_start_date_shift", None)

    await msg_target.reply_text(
        "❌ Modificación de fecha de inicio cancelada. Volviendo al panel principal.",
        reply_markup=get_libro_main_keyboard(),
    )


async def show_delete_libro_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Muestra el selector interactivo para eliminar un libro de obra."""
    context.user_data.pop("libro_flow", None)
    query = update.callback_query
    msg_target = query.message if query else update.message
    if not msg_target:
        return
    if query:
        await query.answer()

    books = list_all_project_books()
    if not books:
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("🔙 Volver a Libro de Obra", callback_data="btn_menu_libro")],
            [InlineKeyboardButton("🏠 Menú Principal", callback_data="btn_menu_home")],
        ])
        await msg_target.reply_text("ℹ️ No tienes ningún Libro de Obra registrado para eliminar.", reply_markup=kb)
        return

    context.user_data["del_books_cache"] = [b["filename"] for b in books]
    context.user_data["del_names_cache"] = [b["project_name"] for b in books]

    txt = (
        "🗑️ *Eliminación de Libros de Obra*\n\n"
        "Selecciona el libro que deseas eliminar permanentemente del sistema:\n"
        "_(Esta acción borrará el archivo Excel y toda su configuración registrada)_"
    )
    buttons = []
    for idx, b in enumerate(books):
        p_name = b["project_name"]
        short_title = (p_name[:26] + "...") if len(p_name) > 26 else p_name
        buttons.append([
            InlineKeyboardButton(f"🗑️ {short_title}", callback_data=f"btn_askdel_libro_{idx}")
        ])

    buttons.append([
        InlineKeyboardButton("🔙 Cancelar y Volver", callback_data="btn_menu_libro"),
    ])

    await msg_target.reply_text(
        txt,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=InlineKeyboardMarkup(buttons),
    )


async def ask_confirm_delete_libro(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Solicita confirmación explícita antes de borrar el libro."""
    query = update.callback_query
    if not query:
        return
    await query.answer()

    idx_str = (query.data or "").replace("btn_askdel_libro_", "").strip()
    try:
        idx = int(idx_str)
        cache_files = context.user_data.get("del_books_cache", [])
        cache_names = context.user_data.get("del_names_cache", [])
        if not (0 <= idx < len(cache_files)):
            books = list_all_project_books()
            cache_files = [b["filename"] for b in books]
            cache_names = [b["project_name"] for b in books]
            context.user_data["del_books_cache"] = cache_files
            context.user_data["del_names_cache"] = cache_names

        filename = cache_files[idx]
        proj_name = cache_names[idx] if idx < len(cache_names) else filename

        kb = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("⚠️ Sí, eliminar definitivamente", callback_data=f"btn_execdel_libro_{idx}"),
            ],
            [
                InlineKeyboardButton("❌ Cancelar", callback_data="btn_libro_eliminar"),
            ],
        ])
        await query.message.reply_text(
            f"⚠️ *¿Confirmas la eliminación permanente de este libro?*\n\n"
            f"🏗 *Obra:* {proj_name}\n"
            f"📁 *Archivo:* `{filename}`\n\n"
            f"_Esta acción no se puede deshacer._",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=kb,
        )
    except Exception as exc:
        logger.error("Error pidiendo confirmación de borrado %s: %s", idx_str, exc, exc_info=True)
        await query.message.reply_text(f"❌ Error: {exc}")


async def execute_delete_libro(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Ejecuta la eliminación física del archivo y metadatos en la base de datos."""
    query = update.callback_query
    if not query:
        return
    await query.answer()

    idx_str = (query.data or "").replace("btn_execdel_libro_", "").strip()
    try:
        idx = int(idx_str)
        cache_files = context.user_data.get("del_books_cache", [])
        cache_names = context.user_data.get("del_names_cache", [])
        if not (0 <= idx < len(cache_files)):
            books = list_all_project_books()
            cache_files = [b["filename"] for b in books]
            cache_names = [b["project_name"] for b in books]

        if not (0 <= idx < len(cache_files)):
            await query.message.reply_text("❌ No se encontró el libro a eliminar.")
            return

        filename = cache_files[idx]
        proj_name = cache_names[idx] if idx < len(cache_names) else filename

        # 1. Borrar archivo
        del_file = delete_project_book(proj_name)
        direct_path = BOOKS_DIR / filename
        if direct_path.exists():
            direct_path.unlink()
            del_file = True

        # 2. Borrar metadatos
        del_meta = delete_project_metadata(proj_name)

        if del_file or del_meta:
            await query.message.reply_text(
                f"🗑️ *Libro de Obra eliminado con éxito:*\n\n"
                f"• *Obra:* {proj_name}\n"
                f"• *Archivo:* `{filename}`\n\n"
                f"El archivo y sus configuraciones fueron removidos.",
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=get_libro_menu_keyboard(),
            )
        else:
            await query.message.reply_text(
                f"ℹ️ El libro de *'{proj_name}'* no fue encontrado o ya había sido eliminado.",
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=get_libro_menu_keyboard(),
            )
    except Exception as exc:
        logger.error("Error al ejecutar eliminación de libro %s: %s", idx_str, exc, exc_info=True)
        await query.message.reply_text(f"❌ Error al eliminar el libro: {exc}")


async def cancel_libro_obra_menu(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Cancela el flujo del libro cuando se presiona un botón del menú inline."""
    context.user_data.pop("libro_flow", None)
    query = update.callback_query
    if query:
        await query.answer()
        data = query.data
        if data in ("btn_menu_libro", "btn_menu_home", "btn_reset"):
            await show_libro_obra_hub(update, context)
        elif data == "btn_libro_ver" or data == "btn_libro_editar":
            await show_saved_libros_menu(update, context)
        elif data == "btn_libro_eliminar":
            await show_delete_libro_menu(update, context)
        elif data == "btn_libro_recuperar_msg":
            await handle_recuperar_mensaje(update, context)
        elif data == "btn_libro_registrar":
            await start_libro_obra_flow(update, context)
        elif data in ("btn_libro_descartar", "btn_cancel"):
            await cancel_libro_obra(update, context)
        elif data in ("btn_menu_home", "btn_reset"):
            await return_to_clean_main_menu(update, context)
    return ConversationHandler.END


def get_libro_obra_conversation_handler() -> ConversationHandler:
    """Construye y devuelve el ConversationHandler para el Libro de Obra."""
    return ConversationHandler(
        entry_points=[
            CommandHandler("llenar_libro", start_libro_obra_flow),
            CallbackQueryHandler(start_libro_obra_flow, pattern="^btn_libro_registrar$"),
        ],
        states={
            STATE_SELECT_OBRA: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_select_obra)],
            STATE_DATOS_GENERALES: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_datos_generales)],
            STATE_FECHA_HORAS: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_fecha_horas)],
            STATE_CLIMA: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_clima)],
            STATE_PERSONAL: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_personal)],
            STATE_EQUIPOS: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_equipos)],
            STATE_ACTIVIDADES: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_actividades)],
            STATE_OBSERVACIONES: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_observaciones)],
            STATE_CONFIRMAR: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_confirmar)],
            STATE_CONFIRMAR_BORRADO: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_confirmar_borrado)],
        },
        fallbacks=[
            CommandHandler("cancelar", cancel_libro_obra),
            CommandHandler("start", cancel_libro_obra),
            CommandHandler("nuevo", cancel_libro_obra),
            CommandHandler("menu", cancel_libro_obra),
            CommandHandler("libro", cancel_libro_obra),
            CommandHandler("libros", cancel_libro_obra),
            CommandHandler("recuperar", handle_recuperar_mensaje),
            CommandHandler("fecha_inicio", handle_menu_modificar_fecha_inicio),
            CommandHandler("modificar_fecha_inicio", handle_menu_modificar_fecha_inicio),
            CallbackQueryHandler(cancel_libro_obra_menu, pattern="^(btn_menu_home|btn_reset|btn_menu_libro|btn_libro_ver|btn_libro_eliminar|btn_libro_registrar|btn_libro_descartar|btn_libro_editar|btn_libro_recuperar_msg|btn_libro_modificar_fecha_inicio|btn_confirm_shift_date|btn_cancel_shift_date|btn_cancel)$"),
            MessageHandler(filters.PHOTO, cancel_libro_obra_photo),
        ],
        allow_reentry=True,
        per_message=False,
        conversation_timeout=900,
    )
