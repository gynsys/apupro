from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import asyncio
import json

from sqlalchemy import func

from app.db.base import get_db
from app.db.arko_base import ArkoSessionLocal
from app.db.models.notification import Notification
from app.api.v1.endpoints.arko import get_current_arko_admin

router = APIRouter()


def _serialize(notification: Notification) -> dict:
    return {
        "id": notification.id,
        "message": notification.message,
        "type": notification.type,
        "link": getattr(notification, "link", None),
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
    }

class NotificationResponse(BaseModel):
    id: int
    message: str
    type: str
    link: Optional[str] = None
    is_read: bool
    created_at: str

    class Config:
        from_attributes = True

@router.get("/", response_model=List[NotificationResponse])
def get_notifications(current_user = Depends(get_current_arko_admin)):
    """Obtiene las notificaciones del usuario logueado"""
    with ArkoSessionLocal() as db:
        notifs = db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).limit(50).all()
        
        return [
            {
                "id": n.id,
                "message": n.message,
                "type": n.type,
                "link": getattr(n, "link", None),
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None
            } for n in notifs
        ]


@router.get("/stream")
async def stream_notifications(
    request: Request,
    current_user = Depends(get_current_arko_admin),
):
    """SSE de notificaciones para actualizar la campana sin refrescar.

    Es un polling del servidor cada 2 s por usuario. Funciona con varios
    workers porque no depende de memoria compartida; para una carga mucho
    mayor conviene Redis pub/sub.
    """
    user_id = int(current_user.id)

    async def event_generator():
        with ArkoSessionLocal() as db:
            last_id = (
                db.query(func.max(Notification.id))
                .filter(Notification.user_id == user_id)
                .scalar()
                or 0
            )

        while True:
            if await request.is_disconnected():
                break

            with ArkoSessionLocal() as db:
                notifications = (
                    db.query(Notification)
                    .filter(
                        Notification.user_id == user_id,
                        Notification.id > last_id,
                    )
                    .order_by(Notification.id.asc())
                    .limit(50)
                    .all()
                )
                for notification in notifications:
                    last_id = max(last_id, notification.id)
                    payload = {
                        "type": "notification",
                        "notification": _serialize(notification),
                    }
                    yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

            yield ": keep-alive\n\n"
            for _ in range(5):
                if await request.is_disconnected():
                    return
                await asyncio.sleep(3)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

@router.put("/{notif_id}/read")
def mark_as_read(notif_id: int, current_user = Depends(get_current_arko_admin)):
    """Marca una notificación como leída"""
    with ArkoSessionLocal() as db:
        notif = db.query(Notification).filter(Notification.id == notif_id, Notification.user_id == current_user.id).first()
        if not notif:
            raise HTTPException(status_code=404, detail="Notificación no encontrada")
        
        notif.is_read = True
        db.commit()
        return {"status": "ok"}

@router.put("/read-all")
def mark_all_as_read(current_user = Depends(get_current_arko_admin)):
    """Marca todas las notificaciones como leídas"""
    with ArkoSessionLocal() as db:
        db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == False).update({"is_read": True})
        db.commit()
        return {"status": "ok"}
