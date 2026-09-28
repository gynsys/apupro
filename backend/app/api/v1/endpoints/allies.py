import os
import shutil
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.db.base import get_db
from app.db.models.strategic_ally import StrategicAlly
from app.db.models.arko import ArkoAdmin
from app.api.v1.endpoints.arko import get_current_arko_admin
from app.schemas.strategic_ally import (
    StrategicAllyCreate,
    StrategicAllyUpdate,
    StrategicAllyResponse
)

router = APIRouter()

UPLOAD_DIR = Path(settings.UPLOAD_DIR).resolve()
ALLIES_UPLOAD_DIR = UPLOAD_DIR / "allies"
ALLIES_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def check_is_superadmin(current_user: ArkoAdmin) -> None:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no autenticado"
        )
    is_super = bool(
        getattr(current_user, "is_superadmin", False)
        or current_user.email in ("admin@arko360.net", "admin@arko360.com")
        or getattr(current_user, "role", "") == "superadmin"
        or getattr(current_user, "is_admin", False)
    )
    if not is_super:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido a super administradores"
        )


def seed_default_allies_if_empty(db: Session) -> None:
    try:
        count = db.query(StrategicAlly).count()
        if count == 0:
            pall_ally = StrategicAlly(
                name="PALL FERRETERIA, C.A.",
                logo_url="/images/allies/pall-ferreteria.png",
                website_url=None,
                category="Materiales y Ferretería",
                description="Empresa líder en suministro de materiales de construcción, herramientas y ferretería general.",
                is_active=True,
                order=1,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            db.add(pall_ally)
            db.commit()
            logger.info("Seed inicial de aliado PALL FERRETERIA, C.A. creado exitosamente.")
    except Exception as e:
        db.rollback()
        logger.error(f"Error al verificar o inicializar aliados por defecto: {str(e)}", exc_info=True)


@router.get("", response_model=List[StrategicAllyResponse])
def get_public_allies(db: Session = Depends(get_db)) -> List[StrategicAlly]:
    try:
        seed_default_allies_if_empty(db)
        allies = (
            db.query(StrategicAlly)
            .filter(StrategicAlly.is_active.is_(True))
            .order_by(StrategicAlly.order.asc(), StrategicAlly.id.asc())
            .all()
        )
        return allies
    except Exception as e:
        logger.error(f"Error fetching public allies: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener la lista de aliados estratégicos"
        )


@router.get("/admin", response_model=List[StrategicAllyResponse])
def get_admin_allies(
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> List[StrategicAlly]:
    check_is_superadmin(current_user)
    try:
        seed_default_allies_if_empty(db)
        allies = (
            db.query(StrategicAlly)
            .order_by(StrategicAlly.order.asc(), StrategicAlly.id.asc())
            .all()
        )
        return allies
    except Exception as e:
        logger.error(f"Error fetching admin allies: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al obtener aliados para administración"
        )


@router.post("", response_model=StrategicAllyResponse, status_code=status.HTTP_201_CREATED)
def create_ally(
    ally_in: StrategicAllyCreate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> StrategicAlly:
    check_is_superadmin(current_user)
    if not ally_in.name or not ally_in.name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El nombre de la empresa aliada es obligatorio"
        )
    if not ally_in.logo_url or not ally_in.logo_url.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El logo de la empresa aliada es obligatorio"
        )

    try:
        new_ally = StrategicAlly(
            name=ally_in.name.strip(),
            logo_url=ally_in.logo_url.strip(),
            website_url=ally_in.website_url.strip() if ally_in.website_url else None,
            category=ally_in.category.strip() if ally_in.category else None,
            description=ally_in.description.strip() if ally_in.description else None,
            is_active=ally_in.is_active,
            order=ally_in.order,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(new_ally)
        db.commit()
        db.refresh(new_ally)
        logger.info(f"Aliado estratégico creado: {new_ally.name} (ID: {new_ally.id})")
        return new_ally
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating strategic ally: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al crear aliado estratégico"
        )


@router.put("/{ally_id}", response_model=StrategicAllyResponse)
def update_ally(
    ally_id: int,
    ally_in: StrategicAllyUpdate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> StrategicAlly:
    check_is_superadmin(current_user)
    if ally_id <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID de aliado inválido")

    try:
        ally = db.query(StrategicAlly).filter(StrategicAlly.id == ally_id).first()
        if not ally:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aliado estratégico no encontrado")

        update_data = ally_in.dict(exclude_unset=True)
        for field, value in update_data.items():
            if field in ("name", "logo_url") and value is not None and not str(value).strip():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"El campo {field} no puede estar vacío")
            setattr(ally, field, value.strip() if isinstance(value, str) else value)

        ally.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(ally)
        logger.info(f"Aliado estratégico actualizado: {ally.name} (ID: {ally.id})")
        return ally
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating strategic ally {ally_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar aliado estratégico"
        )


@router.delete("/{ally_id}", status_code=status.HTTP_200_OK)
def delete_ally(
    ally_id: int,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> Dict[str, Any]:
    check_is_superadmin(current_user)
    if ally_id <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ID de aliado inválido")

    try:
        ally = db.query(StrategicAlly).filter(StrategicAlly.id == ally_id).first()
        if not ally:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aliado estratégico no encontrado")

        ally_name = ally.name
        db.delete(ally)
        db.commit()
        logger.info(f"Aliado estratégico eliminado: {ally_name} (ID: {ally_id})")
        return {"status": "success", "message": f"Aliado {ally_name} eliminado correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting strategic ally {ally_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al eliminar aliado estratégico"
        )


@router.post("/upload-logo", status_code=status.HTTP_200_OK)
async def upload_ally_logo(
    file: UploadFile = File(...),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> Dict[str, str]:
    check_is_superadmin(current_user)
    if not file or not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archivo no proporcionado")

    file_extension = Path(file.filename).suffix.lower()
    allowed_extensions = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"}
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato no permitido. Formatos admitidos: {', '.join(allowed_extensions)}"
        )

    try:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        safe_name = "".join(c for c in Path(file.filename).stem if c.isalnum() or c in ("-", "_"))[:30]
        filename = f"ally_{safe_name}_{timestamp}{file_extension}"
        file_path = ALLIES_UPLOAD_DIR / filename

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        relative_path = file_path.relative_to(UPLOAD_DIR)
        url_path = f"/uploads/{relative_path.as_posix()}"
        return {"message": "Logo subido exitosamente", "logo_url": url_path}
    except Exception as e:
        logger.error(f"Error uploading ally logo: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al guardar el logo del aliado"
        )
