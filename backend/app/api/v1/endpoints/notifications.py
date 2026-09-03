from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.db.base import get_db
from app.db.arko_base import ArkoSessionLocal
from app.db.models.notification import Notification
from app.api.v1.endpoints.arko import get_current_arko_admin

router = APIRouter()

class NotificationResponse(BaseModel):
    id: int
    message: str
    type: str
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
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None
            } for n in notifs
        ]

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
