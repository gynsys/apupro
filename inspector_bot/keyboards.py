"""
Teclados interactivos y utilidades de interfaz para el Bot Inspector.
"""
import re
import unicodedata
from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def sanitize_filename(name: str) -> str:
    """Genera un nombre de archivo seguro para el sistema operativo sin acentos ni caracteres especiales."""
    if not name:
        return "Obra"
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    clean = re.sub(r"[^a-zA-Z0-9_\s-]", "", normalized)
    clean = re.sub(r"[\s-]+", "_", clean).strip("_")
    return clean[:40] if clean else "Obra"


def get_main_menu_keyboard() -> InlineKeyboardMarkup:
    """Crea los botones del menú principal para elegir la función."""
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("📋 Generar Ficha Diaria", callback_data="btn_menu_ficha"),
            ],
            [
                InlineKeyboardButton("🗓️ Ficha Resumen Semanal", callback_data="btn_menu_resumen_semanal"),
            ],
            [
                InlineKeyboardButton("📖 Libro de Obra", callback_data="btn_menu_libro"),
            ],
        ]
    )


def get_libro_menu_keyboard() -> InlineKeyboardMarkup:
    """Crea los botones del menú secundario para el Módulo de Libro de Obra."""
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("✍️ Llenar / Asentar Hoja", callback_data="btn_libro_registrar"),
                InlineKeyboardButton("✏️ Editar una Hoja Guardada", callback_data="btn_libro_menu_editar"),
            ],
            [
                InlineKeyboardButton("📚 Ver Libros Guardados", callback_data="btn_libro_ver"),
                InlineKeyboardButton("🗑️ Eliminar un Libro", callback_data="btn_libro_eliminar"),
            ],
            [
                InlineKeyboardButton("🏠 Menú Principal", callback_data="btn_menu_home"),
            ],
        ]
    )


def get_awaiting_photos_keyboard(photo_count: int = 0) -> InlineKeyboardMarkup:
    """
    Teclado minimalista mientras el usuario está adjuntando fotos.
    No muestra los botones finales para evitar ruido visual y confusión.
    """
    if photo_count == 0:
        return InlineKeyboardMarkup(
            [
                [
                    InlineKeyboardButton("⏩ Continuar sin fotos", callback_data="btn_show_action_menu"),
                ],
                [
                    InlineKeyboardButton("🔄 Reiniciar", callback_data="btn_reset"),
                ],
            ]
        )
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(f"✅ Listo, continuar ({photo_count} fotos) 👉", callback_data="btn_show_action_menu"),
            ],
            [
                InlineKeyboardButton("🔄 Reiniciar", callback_data="btn_reset"),
            ],
        ]
    )


def get_report_action_keyboard(photo_count: int = 0) -> InlineKeyboardMarkup:
    """
    Botones principales para el reporte recibido.
    Permite explícitamente Guardar en Historial/BD, Generar PDF, Generar Excel, o Registrar en Libro de Obra.
    """
    p_text = f" ({photo_count} fotos)" if photo_count > 0 else ""
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(f"💾 Guardar Jornada en Historial{p_text}", callback_data="btn_save_daily_entry"),
            ],
            [
                InlineKeyboardButton(f"📄 Descargar PDF{p_text}", callback_data="btn_gen_pdf"),
                InlineKeyboardButton(f"📊 Descargar Excel{p_text}", callback_data="btn_gen_excel"),
            ],
            [
                InlineKeyboardButton(f"📦 Descargar Ambos (PDF + Excel){p_text}", callback_data="btn_gen_both"),
            ],
            [
                InlineKeyboardButton("📖 Registrar en Libro de Obra (con IA)", callback_data="btn_to_libro_ai"),
            ],
            [
                InlineKeyboardButton("🏠 Menú Principal", callback_data="btn_menu_home"),
                InlineKeyboardButton("🔄 Reiniciar", callback_data="btn_reset"),
            ],
        ]
    )


def get_format_keyboard(photo_count: int = 0) -> InlineKeyboardMarkup:
    """Compatibilidad con selector de formato."""
    return get_report_action_keyboard(photo_count)


def get_post_save_keyboard() -> InlineKeyboardMarkup:
    """Botones posteriores al guardado en base de datos."""
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("📄 Descargar PDF", callback_data="btn_gen_pdf"),
                InlineKeyboardButton("📊 Descargar Excel", callback_data="btn_gen_excel"),
            ],
            [
                InlineKeyboardButton("📦 Descargar Ambos", callback_data="btn_gen_both"),
                InlineKeyboardButton("📖 Libro de Obra (IA)", callback_data="btn_to_libro_ai"),
            ],
            [
                InlineKeyboardButton("🗓️ Ir a Resumen Semanal", callback_data="btn_menu_resumen_semanal"),
                InlineKeyboardButton("🏠 Menú Principal", callback_data="btn_menu_home"),
            ],
        ]
    )


def get_home_keyboard() -> InlineKeyboardMarkup:
    """Botón simple para retornar al menú principal."""
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("🏠 Volver al Menú Principal", callback_data="btn_menu_home")]
        ]
    )
