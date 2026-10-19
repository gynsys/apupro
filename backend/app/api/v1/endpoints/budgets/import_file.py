"""Importación de presupuestos desde archivos Excel, CSV, PDF e imágenes."""
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.v1.endpoints.arko import _get_costos_config, get_current_arko_admin
from app.db.base import get_db
from app.db.models.arko import ArkoAdmin
from app.db.models.budget import (
    Budget,
    BudgetAPUEquipment as DBEquipment,
    BudgetAPULabor as DBLabor,
    BudgetAPUMaterial as DBMaterial,
    BudgetItem,
)
from app.db.models.cost360 import CostItem
from app.middleware.plan_limits import check_budget_limit
from app.services.budget_import import build_preview
from app.services.budget_import.errors import BudgetImportError, OCRError

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_ITEMS_PER_IMPORT = 300


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class Candidate(BaseModel):
    cod_par: str
    cov_par: Optional[str] = None
    description: str
    unit: str = ""
    score: float = 0.0
    match_type: str = "description"


class PreviewItem(BaseModel):
    row: int
    code: str = ""
    description: str
    unit: str = "und"
    quantity: float = 0.0
    is_chapter: bool = False
    candidates: List[Candidate] = []
    selected_cod_par: Optional[str] = None


class PreviewHeader(BaseModel):
    budget_name: str
    project_name: Optional[str] = None
    client_name: Optional[str] = None
    currency: str = "USD"


class PreviewResponse(BaseModel):
    filename: str
    source_type: str
    header: PreviewHeader
    items: List[PreviewItem]
    stats: Dict[str, int]
    warnings: List[str] = []


class CommitItem(BaseModel):
    description: str = Field(min_length=1, max_length=600)
    unit: str = Field(default="und", max_length=20)
    quantity: float = 0.0
    is_chapter: bool = False
    cod_par: Optional[str] = None
    code: Optional[str] = None

    @field_validator("quantity")
    @classmethod
    def _non_negative(cls, value: float) -> float:
        return max(0.0, float(value or 0.0))


class CommitRequest(BaseModel):
    name: str = Field(min_length=1, max_length=250)
    project_name: Optional[str] = Field(default=None, max_length=250)
    client_name: Optional[str] = Field(default=None, max_length=250)
    currency: str = "USD"
    items: List[CommitItem]
    source_filename: Optional[str] = None

    @field_validator("currency")
    @classmethod
    def _currency(cls, value: str) -> str:
        normalized = (value or "USD").strip().upper()
        return "VES" if normalized in {"VES", "BS", "BSF"} else "USD"


class CommitResponse(BaseModel):
    budget_id: str
    items_created: int
    matched_items: int
    generic_items: int
    message: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _copy_apu_components(db: Session, db_item: BudgetItem, cost_item: CostItem) -> None:
    """Copia los insumos del APU maestro al item del presupuesto."""
    for mat in cost_item.apu_materials:
        db.add(DBMaterial(
            budget_item_id=db_item.id,
            codigo=mat.CodIns,
            descripcion=mat.material.Descri if mat.material else "",
            unidad=mat.material.UniMat if mat.material else "",
            precio_unitario=(mat.material.CosMat if (mat.material and mat.material.CosMat is not None) else 0.0),
            cantidad=mat.CanIns or 0.0,
            desperdicio=mat.Desper or 0.0,
        ))

    for eq in cost_item.apu_equipments:
        precio_diario = eq.equipment.CosDia if (eq.equipment and eq.equipment.CosDia is not None) else 0.0
        depreciacion = eq.Deprec if (eq.Deprec is not None and eq.Deprec > 0) else 1.0
        precio_adquisicion = precio_diario / depreciacion if depreciacion > 0 else precio_diario
        db.add(DBEquipment(
            budget_item_id=db_item.id,
            codigo=eq.CodIns,
            descripcion=eq.equipment.Descri if eq.equipment else "",
            unidad="Día",
            precio_unitario=precio_adquisicion,
            cantidad=eq.CanIns or 0.0,
            depreciacion=eq.Deprec or 1.0,
        ))

    for lab in cost_item.apu_labors:
        db.add(DBLabor(
            budget_item_id=db_item.id,
            codigo=lab.CodIns,
            descripcion=lab.labor.Descri if lab.labor else "",
            jornal=(lab.labor.Jornal if (lab.labor and lab.labor.Jornal is not None) else 0.0),
            bono=(lab.labor.Bono if (lab.labor and lab.labor.Bono is not None) else 0.0),
            cantidad=lab.CanIns or 0.0,
        ))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/import/preview", response_model=PreviewResponse)
async def preview_budget_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Analiza un archivo y devuelve las partidas detectadas con sus candidatas de la base maestra."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="El archivo no tiene nombre.")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"El archivo supera el límite de {MAX_FILE_BYTES // (1024 * 1024)} MB.",
        )

    try:
        return build_preview(data, file.filename, db)
    except OCRError as exc:
        logger.warning("OCR no disponible para %s: %s", file.filename, exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except BudgetImportError as exc:
        logger.info("Importación rechazada para %s: %s", file.filename, exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Error inesperado analizando %s: %s", file.filename, exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Ocurrió un error inesperado al analizar el archivo. Inténtalo de nuevo.",
        ) from exc


@router.post("/import/commit", response_model=CommitResponse, status_code=status.HTTP_201_CREATED)
def commit_budget_import(
    payload: CommitRequest,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Crea el presupuesto y sus partidas a partir de la vista previa confirmada por el usuario."""
    if not payload.items:
        raise HTTPException(status_code=400, detail="Debes incluir al menos una partida.")
    if len(payload.items) > MAX_ITEMS_PER_IMPORT:
        raise HTTPException(
            status_code=400,
            detail=f"El máximo permitido por importación es de {MAX_ITEMS_PER_IMPORT} partidas.",
        )

    check_budget_limit(current_user)

    max_items = getattr(current_user, "max_items_per_budget", None)
    if max_items is not None and len(payload.items) > max_items:
        raise HTTPException(
            status_code=403,
            detail=f"Tu plan permite máximo {max_items} partidas por presupuesto. "
                   f"El archivo contiene {len(payload.items)}.",
        )

    costos = _get_costos_config(current_user)
    budget = Budget(
        user_id=str(current_user.id),
        name=payload.name.strip(),
        description=f"Importado desde {payload.source_filename}" if payload.source_filename else "Importado desde archivo",
        project_name=(payload.project_name or payload.name).strip(),
        client_name=(payload.client_name or None),
        currency=payload.currency,
        exchange_rate=1.0,
        fcas_percent=getattr(costos, "fcas", 0.0),
        admin_percent=getattr(costos, "porcentajeAdministracion", 15.0),
        profit_percent=getattr(costos, "porcentajeUtilidad", 10.0),
        iva_percent=getattr(costos, "iva", 16.0),
        labor_bonus=0.0 if getattr(costos, "fcasBonoInFcas", False) else (getattr(costos, "fcasLaborBonus", 0.0) or 0.0),
        bono_in_fcas=getattr(costos, "fcasBonoInFcas", False),
    )

    items_created = 0
    matched_items = 0
    generic_items = 0

    try:
        db.add(budget)
        db.flush()

        for index, item in enumerate(payload.items, start=1):
            description = item.description.strip()
            if not description:
                continue

            is_chapter = bool(item.is_chapter)
            requested_code = (item.cod_par or "").strip()
            cost_item: Optional[CostItem] = None
            if requested_code and not is_chapter:
                cost_item = db.query(CostItem).filter(CostItem.CodPar == requested_code).first()

            cod_par = cost_item.CodPar if cost_item else ((item.code or "").strip() or f"IMP-{index:03d}")
            cov_par = cost_item.CovPar if cost_item else None
            unit = (cost_item.UniPar if (cost_item and cost_item.UniPar) else item.unit) or "und"

            db_item = BudgetItem(
                budget_id=budget.id,
                cod_par=cod_par[:80],
                cov_par=cov_par,
                description=description,
                unit="" if is_chapter else unit[:20],
                quantity=0.0 if is_chapter else float(item.quantity or 0.0),
                performance=1.0,
                order=index,
                is_chapter=is_chapter,
            )
            db.add(db_item)
            db.flush()

            if cost_item and not is_chapter:
                _copy_apu_components(db, db_item, cost_item)
                matched_items += 1
            elif not is_chapter:
                generic_items += 1

            items_created += 1

        db.commit()
        db.refresh(budget)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.error("Error creando presupuesto importado: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="No se pudo crear el presupuesto. Inténtalo de nuevo.",
        ) from exc

    return {
        "budget_id": budget.id,
        "items_created": items_created,
        "matched_items": matched_items,
        "generic_items": generic_items,
        "message": f"Presupuesto creado con {items_created} partidas "
                   f"({matched_items} con APU de la base maestra, {generic_items} genéricas).",
    }
