"""Limpieza de mensajes del flujo del Libro de Obra.

Objetivo: mantener un solo panel de texto visible por chat.
- Los mensajes escritos por el usuario se eliminan al recibirlos.
- Antes de enviar un nuevo panel de texto, se elimina el anterior.
- Los documentos descargados no se borran automáticamente.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from telegram import Bot, Update
from telegram.ext import ContextTypes

logger = logging.getLogger("libro_obra_bot.cleanup")


def _chat_key(chat_id: Any) -> Optional[int]:
    if chat_id is None:
        return None
    if hasattr(chat_id, "id"):
        return int(chat_id.id)
    try:
        return int(chat_id)
    except (TypeError, ValueError):
        return None


class CleanBot(Bot):
    """Bot que conserva únicamente el último panel de texto por chat."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._last_text_message: dict[int, int] = {}

    async def send_message(self, *args, **kwargs):
        chat_id = kwargs.get("chat_id")
        if chat_id is None and args:
            chat_id = args[0]
        key = _chat_key(chat_id)

        message = await super().send_message(*args, **kwargs)

        if key is not None:
            previous_id = self._last_text_message.get(key)
            self._last_text_message[key] = message.message_id
            if previous_id and previous_id != message.message_id:
                try:
                    await self.delete_message(chat_id=key, message_id=previous_id)
                except Exception as exc:
                    logger.debug(
                        "No se pudo borrar panel anterior %s en chat %s: %s",
                        previous_id,
                        key,
                        exc,
                    )
        return message


async def cleanup_user_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Borra el mensaje entrante del usuario para no acumular historial.

    Solo actúa sobre mensajes escritos por el usuario. Los callbacks no traen
    `update.message`, por lo que el panel del bot no se toca aquí.
    """
    message = update.message
    if not message:
        return

    try:
        await message.delete()
    except Exception as exc:
        logger.debug("No se pudo borrar mensaje del usuario %s: %s", message.message_id, exc)
