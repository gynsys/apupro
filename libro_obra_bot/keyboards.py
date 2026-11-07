"""Teclados interactivos y utilidades de interfaz para el Bot de Libro de Obra."""
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


def get_libro_main_keyboard() -> InlineKeyboardMarkup:
    """Crea los botones principales para el Bot de Libro de Obra."""
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("✍️ Asentar Nueva Hoja Diaria", callback_data="btn_libro_registrar"),
            ],
            [
                InlineKeyboardButton("✏️ Editar una Hoja Guardada", callback_data="btn_libro_menu_editar"),
                InlineKeyboardButton("📚 Ver / Descargar Libros", callback_data="btn_libro_ver"),
            ],
            [
                InlineKeyboardButton("🗑️ Eliminar un Libro", callback_data="btn_libro_eliminar"),
                InlineKeyboardButton("ℹ️ Ayuda e Instrucciones", callback_data="btn_libro_ayuda"),
            ],
        ]
    )


def get_libro_menu_keyboard() -> InlineKeyboardMarkup:
    """Compatibilidad: devuelve el teclado principal del Libro de Obra."""
    return get_libro_main_keyboard()


def get_home_keyboard() -> InlineKeyboardMarkup:
    """Botón para volver al menú principal del Libro de Obra."""
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("📖 Volver al Panel del Libro", callback_data="btn_menu_libro")]
        ]
    )
