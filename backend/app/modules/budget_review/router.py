"""Endpoints FastAPI para el módulo de Revisión y Auditoría de Presupuestos."""
from __future__ import annotations

import io
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.v1.endpoints.arko import get_current_arko_admin
from app.db.base import get_db
from app.db.models.arko import ArkoAdmin
from app.modules.budget_review.schemas import (
    AuditFromBudgetRequest,
    FindingOut,
    ReviewFindingUpdateRequest,
    ReviewSnapshotCloneRequest,
    ReviewSnapshotDetailOut,
    ReviewSnapshotSummaryOut,
    ReviewSnapshotUpdateRequest,
)
from app.modules.budget_review.service import (
    audit_existing_budget,
    audit_uploaded_file,
    clone_review_snapshot,
    delete_review_snapshot,
    export_audit_report_excel,
    get_review_snapshot_detail,
    list_review_snapshots,
    update_review_finding,
    update_review_snapshot,
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
            parent_snapshot_id=payload.parent_snapshot_id,
            custom_name=payload.name,
            project_name=payload.project_name,
            client_name=payload.client_name,
            auditor_notes=payload.auditor_notes,
            report_code=payload.report_code,
            reviewer_name=payload.reviewer_name,
            reviewer_civ=payload.reviewer_civ,
            document_reference=payload.document_reference,
            institution_name=payload.institution_name,
            conclusion_text=payload.conclusion_text,
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
    mode: str = Form("budget"),
    parent_snapshot_id: Optional[str] = Form(None),
    name: Optional[str] = Form(None),
    project_name: Optional[str] = Form(None),
    client_name: Optional[str] = Form(None),
    auditor_notes: Optional[str] = Form(None),
    report_code: Optional[str] = Form(None),
    reviewer_name: Optional[str] = Form(None),
    reviewer_civ: Optional[str] = Form(None),
    document_reference: Optional[str] = Form(None),
    institution_name: Optional[str] = Form(None),
    conclusion_text: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Importa un archivo (Libro Excel de APUs, presupuesto Excel, CSV o PDF) y lo audita."""
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
            parent_snapshot_id=parent_snapshot_id,
            custom_name=name,
            project_name=project_name,
            client_name=client_name,
            auditor_notes=auditor_notes,
            report_code=report_code,
            reviewer_name=reviewer_name,
            reviewer_civ=reviewer_civ,
            document_reference=document_reference,
            institution_name=institution_name,
            conclusion_text=conclusion_text,
            import_mode=mode,
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


@router.patch("/snapshots/{snapshot_id}", response_model=ReviewSnapshotDetailOut)
def save_snapshot_changes(
    snapshot_id: str,
    payload: ReviewSnapshotUpdateRequest,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Guardar: actualiza metadatos, datos del revisor, conclusión y observaciones del auditor."""
    user_id = _resolve_user_id(current_user)
    try:
        return update_review_snapshot(
            db=db,
            snapshot_id=snapshot_id,
            user_id=user_id,
            name=payload.name,
            project_name=payload.project_name,
            client_name=payload.client_name,
            review_status=payload.review_status,
            auditor_notes=payload.auditor_notes,
            report_code=payload.report_code,
            reviewer_name=payload.reviewer_name,
            reviewer_civ=payload.reviewer_civ,
            document_reference=payload.document_reference,
            institution_name=payload.institution_name,
            institution_logo=payload.institution_logo,
            conclusion_text=payload.conclusion_text,
            approver_name=payload.approver_name,
            approver_civ=payload.approver_civ,
            approver_department=payload.approver_department,
            include_monetary_impact=payload.include_monetary_impact,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Error guardando cambios en auditoría %s: %s", snapshot_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudieron guardar los cambios de la auditoría.",
        ) from exc


@router.post("/snapshots/{snapshot_id}/clone", response_model=ReviewSnapshotDetailOut)
def save_snapshot_as_copy(
    snapshot_id: str,
    payload: ReviewSnapshotCloneRequest,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Guardar Como: clona la auditoría actual con un nuevo nombre y expediente independiente."""
    user_id = _resolve_user_id(current_user)
    try:
        return clone_review_snapshot(
            db=db,
            snapshot_id=snapshot_id,
            user_id=user_id,
            new_name=payload.name,
            project_name=payload.project_name,
            client_name=payload.client_name,
            review_status=payload.review_status,
            auditor_notes=payload.auditor_notes,
            report_code=payload.report_code,
            reviewer_name=payload.reviewer_name,
            reviewer_civ=payload.reviewer_civ,
            document_reference=payload.document_reference,
            institution_name=payload.institution_name,
            institution_logo=payload.institution_logo,
            conclusion_text=payload.conclusion_text,
            approver_name=payload.approver_name,
            approver_civ=payload.approver_civ,
            approver_department=payload.approver_department,
            include_monetary_impact=payload.include_monetary_impact,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Error clonando auditoría %s: %s", snapshot_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo duplicar la auditoría.",
        ) from exc


@router.patch("/snapshots/{snapshot_id}/findings/{finding_id}", response_model=FindingOut)
def update_single_finding(
    snapshot_id: str,
    finding_id: int,
    payload: ReviewFindingUpdateRequest,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Any:
    """Actualiza el estado de un hallazgo puntual (PENDIENTE, CORREGIDO, JUSTIFICADO, RECHAZADO) y comentario."""
    user_id = _resolve_user_id(current_user)
    try:
        return update_review_finding(
            db=db,
            snapshot_id=snapshot_id,
            finding_id=finding_id,
            user_id=user_id,
            finding_status=payload.finding_status,
            auditor_comment=payload.auditor_comment,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Error actualizando hallazgo %s: %s", finding_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo actualizar el hallazgo.",
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
