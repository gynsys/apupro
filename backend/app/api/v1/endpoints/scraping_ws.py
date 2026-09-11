import asyncio
import json
import logging
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, status
from sqlalchemy.orm import Session
import jwt

from app.core.config import settings
from app.db.base import get_db
from app.db.models.arko import ArkoAdmin
from app.api.v1.endpoints.scraping import bot_state

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    """Manejador de conexiones activas de WebSockets con logging y desconexión segura."""
    def __init__(self) -> None:
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]) -> None:
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error enviando mensaje por WebSocket: {e}", exc_info=True)
                self.disconnect(connection)


manager = ConnectionManager()


def authenticate_websocket(websocket: WebSocket, db: Session) -> Optional[ArkoAdmin]:
    """Valida la autenticación para la conexión WebSocket.
    Soporta cookie httpOnly (arko_admin_token), query parameter (?token=) y cabecera Authorization.
    """
    token = websocket.cookies.get("arko_admin_token") or websocket.query_params.get("token")
    if not token:
        auth_header = websocket.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: Optional[str] = payload.get("sub")
        token_type: Optional[str] = payload.get("type")
        if not email or token_type != "arko_admin":
            return None
        user = db.query(ArkoAdmin).filter(ArkoAdmin.email == email).first()
        return user
    except Exception as e:
        logger.error(f"Error validando token en WebSocket: {e}", exc_info=True)
        return None


@router.websocket("/ws/logs")
async def websocket_logs(websocket: WebSocket, db: Session = Depends(get_db)) -> None:
    """WebSocket endpoint para logs de scraping en tiempo real.
    Requiere autenticación obligatoria y permisos de administrador.
    """
    user = authenticate_websocket(websocket, db)
    if not user:
        logger.warning("Intento de conexión a WebSocket de logs rechazado: No autenticado")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized")
        return

    user_email = user.email.lower() if user.email else ""
    is_admin = (
        getattr(user, "is_superadmin", False) or
        (user_email == "admin@arko360.net") or
        getattr(user, "role", "") in ["admin", "superadmin"]
    )
    if not is_admin:
        logger.warning(f"Intento de conexión a WebSocket de logs rechazado para usuario no admin: {user_email}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Forbidden")
        return

    await manager.connect(websocket)
    try:
        # Enviar logs existentes al conectar
        initial_logs = bot_state.logs[-50:]  # Últimos 50 logs
        await websocket.send_json({
            "type": "initial_logs",
            "logs": initial_logs
        })

        # Mantener conexión abierta y emitir logs y status periódicamente
        last_log_count = len(bot_state.logs)
        while True:
            await asyncio.sleep(1)
            await websocket.send_json({
                "type": "status",
                "status": bot_state.status,
                "config": bot_state.config.dict() if hasattr(bot_state.config, "dict") else bot_state.config
            })

            # Enviar nuevos logs si se generaron
            current_log_count = len(bot_state.logs)
            if current_log_count > last_log_count:
                new_logs = bot_state.logs[last_log_count:]
                for log in new_logs:
                    await websocket.send_json({
                        "type": "log",
                        "log": log
                    })
                last_log_count = current_log_count

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Error en sesión de WebSocket de logs: {e}", exc_info=True)
        manager.disconnect(websocket)