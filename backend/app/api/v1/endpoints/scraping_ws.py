from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
import json
import asyncio

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

@router.websocket("/ws/logs")
async def websocket_logs(websocket: WebSocket):
    """WebSocket endpoint para logs en tiempo real"""
    await manager.connect(websocket)
    try:
        # Enviar logs existentes al conectar
        from app.api.v1.endpoints.scraping import bot_state
        initial_logs = bot_state.logs[-50:]  # Últimos 50 logs
        await websocket.send_json({
            "type": "initial_logs",
            "logs": initial_logs
        })

        # Mantener conexión abierta y enviar nuevos logs
        last_log_count = len(bot_state.logs)
        while True:
            # Enviar estado actual periódicamente
            await asyncio.sleep(1)
            await websocket.send_json({
                "type": "status",
                "status": bot_state.status,
                "config": bot_state.config.dict() if hasattr(bot_state.config, 'dict') else bot_state.config
            })

            # Enviar nuevos logs si hay
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
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)