"""Endpoints FastAPI del módulo de control de obra."""
from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.endpoints.arko import get_current_arko_admin
from app.db.base import get_db
from app.modules.control_obra.domain import ControlObraError
from app.modules.control_obra.service import (
    approve_addendum,
    approve_modification,
    build_report,
    close_period,
    create_addendum,
    create_modification,
    create_period,
    create_progress,
    curve,
    list_periods,
    load_budget,
    reopen_period,
    set_plan,
    summary,
    sync_progress,
    update_progress,
)
from app.db.models.arko import ArkoAdmin


router = APIRouter(prefix="/budgets/{budget_id}/control-obra", tags=["control-obra"])


class ProgressCreate(BaseModel):
    item_id: str
    quantity: float = Field(ge=0)
    entry_date: date
    notes: str = ""
    entry_type: str = "execution"


class ProgressUpdate(BaseModel):
    quantity: float = Field(ge=0)
    entry_date: date
    notes: str = ""


class SyncProgressItem(BaseModel):
    item_id: str
    quantity: float = Field(ge=0)


class SyncProgressRequest(BaseModel):
    items: List[SyncProgressItem]
    entry_date: date
    notes: str = "Sincronizado desde cómputos"


class ModificationLineCreate(BaseModel):
    item_id: Optional[str] = None
    code: str = ""
    description: str = ""
    unit: str = ""
    quantity_delta: float = 0
    unit_price: Optional[float] = None
    is_new_item: bool = False


class ModificationCreate(BaseModel):
    kind: str
    code: str = ""
    description: str = ""
    lines: List[ModificationLineCreate]


class AddendumCreate(BaseModel):
    amount: float = Field(ge=0)
    code: str = ""
    description: str = ""


class PeriodCreate(BaseModel):
    name: str
    start_date: date
    end_date: date


class ReopenRequest(BaseModel):
    reason: str = Field(min_length=3)


class PlanCreate(BaseModel):
    item_id: str
    planned_start: date
    planned_end: date


def _budget_or_404(db: Session, budget_id: str, current_user: ArkoAdmin):
    budget = load_budget(db, budget_id, str(current_user.id))
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    return budget


@router.get("")
def get_control_obra(
    budget_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    budget = _budget_or_404(db, budget_id, current_user)
    return summary(db, budget)


@router.post("/progress", status_code=status.HTTP_201_CREATED)
def post_progress(
    budget_id: str,
    payload: ProgressCreate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    budget = _budget_or_404(db, budget_id, current_user)
    try:
        row = create_progress(
            db, budget, payload.item_id, payload.quantity, payload.entry_date,
            payload.notes, payload.entry_type, str(current_user.id),
        )
    except ControlObraError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"id": row.id, "message": "Avance registrado"}


@router.put("/progress/{entry_id}")
def put_progress(
    budget_id: str,
    entry_id: str,
    payload: ProgressUpdate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    budget = _budget_or_404(db, budget_id, current_user)
    try:
        row = update_progress(
            db, budget, entry_id, payload.quantity, payload.entry_date, payload.notes, str(current_user.id)
        )
    except ControlObraError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"id": row.id, "message": "Avance corregido"}


@router.post("/progress/sync")
def sync_progress_endpoint(
    budget_id: str,
    payload: SyncProgressRequest,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    budget = _budget_or_404(db, budget_id, current_user)
    try:
        result = sync_progress(
            db,
            budget,
            [item.model_dump() for item in payload.items],
            payload.entry_date,
            payload.notes,
            str(current_user.id),
        )
    except ControlObraError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return result


@router.post("/modifications", status_code=status.HTTP_201_CREATED)
def post_modification(
    budget_id: str,
    payload: ModificationCreate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    budget = _budget_or_404(db, budget_id, current_user)
    try:
        row = create_modification(
            db, budget, payload.kind,
            [line.model_dump() for line in payload.lines],
            payload.code, payload.description, str(current_user.id),
        )
    except ControlObraError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"id": row.id, "code": row.code, "status": row.status}


@router.post("/modifications/{modification_id}/approve")
def approve_modification_endpoint(
    budget_id: str,
    modification_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    budget = _budget_or_404(db, budget_id, current_user)
    try:
        row = approve_modification(db, budget, modification_id)
    except ControlObraError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"id": row.id, "status": row.status}


@router.post("/addenda", status_code=status.HTTP_201_CREATED)
def post_addendum(
    budget_id: str,
    payload: AddendumCreate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    budget = _budget_or_404(db, budget_id, current_user)
    try:
        row = create_addendum(db, budget, payload.amount, payload.code, payload.description, str(current_user.id))
    except ControlObraError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"id": row.id, "code": row.code, "status": row.status}


@router.post("/addenda/{addendum_id}/approve")
def approve_addendum_endpoint(
    budget_id: str,
    addendum_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    budget = _budget_or_404(db, budget_id, current_user)
    try:
        row = approve_addendum(db, budget, addendum_id)
    except ControlObraError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"id": row.id, "status": row.status}


@router.get("/periods")
def get_periods(
    budget_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
):
    budget = _budget_or_404(db, budget_id, current_user)
    return [
        {
            "id": row.id,
            "name": row.name,
            "start_date": row.start_date.isoformat(),
            "end_date": row.end_date.isoformat(),
            "status": row.status,
            "reopen_reason": row.reopen_reason,
        }
        for row in list_periods(db, budget)
    ]


@router.post("/periods", status_code=status.HTTP_201_CREATED)
def post_period(
    budget_id: str,
    payload: PeriodCreate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
):
    budget = _budget_or_404(db, budget_id, current_user)
    try:
        row = create_period(db, budget, payload.name, payload.start_date, payload.end_date, str(current_user.id))
    except ControlObraError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"id": row.id, "status": row.status}


@router.post("/periods/{period_id}/close")
def close_period_endpoint(
    budget_id: str,
    period_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
):
    budget = _budget_or_404(db, budget_id, current_user)
    try:
        row = close_period(db, budget, period_id, str(current_user.id))
    except ControlObraError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"id": row.id, "status": row.status}


@router.post("/periods/{period_id}/reopen")
def reopen_period_endpoint(
    budget_id: str,
    period_id: str,
    payload: ReopenRequest,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
):
    budget = _budget_or_404(db, budget_id, current_user)
    try:
        row = reopen_period(db, budget, period_id, payload.reason, str(current_user.id))
    except ControlObraError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"id": row.id, "status": row.status}


@router.post("/plan")
def post_plan(
    budget_id: str,
    payload: PlanCreate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
):
    budget = _budget_or_404(db, budget_id, current_user)
    try:
        row = set_plan(db, budget, payload.item_id, payload.planned_start, payload.planned_end)
    except ControlObraError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"id": row.id, "planned_start": row.planned_start.isoformat(), "planned_end": row.planned_end.isoformat()}


@router.get("/curve")
def get_curve(
    budget_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
):
    budget = _budget_or_404(db, budget_id, current_user)
    return curve(db, budget)


@router.get("/report.xlsx")
def download_report(
    budget_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
):
    budget = _budget_or_404(db, budget_id, current_user)
    buffer = build_report(db, budget)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="control_obra_{budget.id}.xlsx"'},
    )
