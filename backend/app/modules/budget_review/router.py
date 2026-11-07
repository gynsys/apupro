"""Endpoints FastAPI para el módulo de Revisión y Auditoría de Presupuestos."""
from __future__ import annotations

import io
import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.v1.endpoints.arko import get_current_arko_admin
from app.db.base import get_db
from app.db.models.arko import ArkoAdmin
from app.modules.budget_review.schemas import (
    AuditFromBudgetRequest,
    ReviewSnapshotDetailOut,
    ReviewSnapshotSummaryOut,
)
from app.modules.budget_review.service import (
    audit_existing_budget,
    audit_uploaded_file,
    delete_review_snapshot,
    export_audit_report_excel,
    get_review_snapshot_detail,
    list_review_snapshots,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/budget-review", tags=["budget-review"])

MAX_REVIEW_FILE_BYTES = 25 * 1024 * 1024


def _resolve_user_id(current_user: ArkoAdmin) -> str:
    """Extrae el identificador único del usuario autenticado."""
    uid = getattr(current_user, "id", None) or getattr(current_user, "email", None)
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no válido.",
        )
    return str(uid)


@router.get("/snapshots", response_model=List[ReviewSnapshotSummaryOut])
def get_snapshots_list(
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> List[Any]:
    """Lista todas las auditorías de presupuestos realizadas por el usuario."""
    user_id = _resolve_user_id(current_user)
    try:
        return list_review_snapshots(db=db, user_id=user_id)
    except Exception as exc:
        logger.error("Error listando auditorías de presupuesto: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo obtener la lista de auditorías.",
        ) from exc


@router.post("/audit-budget", response_model=ReviewSnapshotDetailOut)
def run_audit_on_existing_budget(
    payload: AuditFromBudgetRequest,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Ejecuta una auditoría completa sobre una copia aislada de un presupuesto existente en CostBase."""
    user_id = _resolve_user_id(current_user)
    try:
        snapshot = audit_existing_budget(
            db=db,
            user_id=user_id,
            budget_id=payload.budget_id,
            database_id=payload.database_id,
        )
        return get_review_snapshot_detail(db=db, snapshot_id=snapshot.id, user_id=user_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Error auditando presupuesto %s: %s", payload.budget_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error ejecutando auditoría del presupuesto: {exc}",
        ) from exc


@router.post("/audit-file", response_model=ReviewSnapshotDetailOut)
def run_audit_on_uploaded_file(
    file: UploadFile = File(...),
    database_id: str = Form("master"),
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Importa un archivo (Libro Excel de APUs de Maprex/CostBase, presupuesto Excel, CSV o PDF) y lo audita."""
    user_id = _resolve_user_id(current_user)
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe tener un nombre válido.",
        )
    try:
        raw_bytes = file.file.read(MAX_REVIEW_FILE_BYTES + 1)
        if len(raw_bytes) > MAX_REVIEW_FILE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="El archivo supera el límite máximo permitido de 25 MB.",
            )
        snapshot = audit_uploaded_file(
            db=db,
            user_id=user_id,
            file_bytes=raw_bytes,
            filename=file.filename,
            database_id=database_id,
        )
        return get_review_snapshot_detail(db=db, snapshot_id=snapshot.id, user_id=user_id)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Error auditando archivo %s: %s", file.filename, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No se pudo procesar ni auditar el archivo: {exc}",
        ) from exc


@router.get("/snapshots/{snapshot_id}", response_model=ReviewSnapshotDetailOut)
def get_snapshot_by_id(
    snapshot_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Obtiene el informe completo de una auditoría por su ID."""
    user_id = _resolve_user_id(current_user)
    try:
        return get_review_snapshot_detail(db=db, snapshot_id=snapshot_id, user_id=user_id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Error obteniendo snapshot %s: %s", snapshot_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al cargar el informe de auditoría.",
        ) from exc


@router.delete("/snapshots/{snapshot_id}")
def remove_snapshot_by_id(
    snapshot_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, str]:
    """Elimina un snapshot de auditoría."""
    user_id = _resolve_user_id(current_user)
    try:
        delete_review_snapshot(db=db, snapshot_id=snapshot_id, user_id=user_id)
        return {"status": "deleted", "id": snapshot_id}
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Error eliminando snapshot %s: %s", snapshot_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo eliminar la auditoría.",
        ) from exc


@router.get("/snapshots/{snapshot_id}/export-excel")
def download_snapshot_excel(
    snapshot_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> StreamingResponse:
    """Descarga el Informe de Auditoría de Presupuesto en formato Excel (.xlsx)."""
    user_id = _resolve_user_id(current_user)
    try:
        excel_bytes, filename = export_audit_report_excel(
            db=db, snapshot_id=snapshot_id, user_id=user_id
        )
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Error exportando Excel de auditoría %s: %s", snapshot_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error generando el archivo Excel de auditoría.",
        ) from exc
