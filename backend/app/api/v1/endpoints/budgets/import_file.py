"""Importación de presupuestos desde archivos Excel, CSV, PDF e imágenes."""
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.api.v1.endpoints.arko import _get_costos_config, get_current_arko_admin
from app.db.arko_base import ArkoSessionLocal
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
from app.middleware.plan_limits import check_ai_access, check_budget_limit
from app.services.ai_apu_service import generate_apu_with_ai
from app.services.ai_apu_service_v2 import generate_apu_v2
from app.services.ai_apu_service_v3 import generate_apu_v3
from app.services.budget_import import build_preview
from app.services.budget_import.errors import BudgetImportError, OCRError
from app.services.budget_import.matching import find_candidates, refine_with_llm
from app.services.budget_postprocessor import is_labor_only_activity, recalibrate_budget_performances
from app.services.preprocessing_service import preprocess_apu_data

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
    calculation: str = ""
    confidence: str = ""
    warnings: List[str] = []
    is_chapter: bool = False
    candidates: List[Candidate] = []
    selected_cod_par: Optional[str] = None
    has_covenin_code_match: bool = False


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


class GeneratedMaterial(BaseModel):
    codigo: str = ""
    descripcion: str = ""
    unidad: str = "und"
    precio_unitario: float = 0.0
    cantidad: float = 0.0
    desperdicio: float = 0.0


class GeneratedEquipment(BaseModel):
    codigo: str = ""
    descripcion: str = ""
    unidad: str = "día"
    precio_unitario: float = 0.0
    cantidad: float = 0.0
    depreciacion: float = 1.0


class GeneratedLabor(BaseModel):
    codigo: str = ""
    descripcion: str = ""
    cantidad: float = 0.0
    jornal: float = 0.0
    bono: float = 0.0


class GenerateApuRequest(BaseModel):
    description: str = Field(min_length=3, max_length=1200)
    unit: str = Field(default="und", max_length=20)
    code: Optional[str] = None


class GenerateApuResponse(BaseModel):
    status: str = "completed"
    partida: Optional[Dict[str, Any]] = None
    materials: List[Dict[str, Any]] = []
    equipments: List[Dict[str, Any]] = []
    labors: List[Dict[str, Any]] = []
    advertencias: List[str] = []


class ResolveComputoRequest(BaseModel):
    description: str = Field(min_length=3, max_length=1200)
    unit: str = Field(default="M2", max_length=20)
    sc_index: int = Field(default=1, ge=1, le=9999)
    auto_generate_sc: bool = True


class ResolveComputoResponse(BaseModel):
    resolution_type: str = "covenin"
    assigned_code: str
    cod_par: Optional[str] = None
    cov_par: Optional[str] = None
    matched_description: Optional[str] = None
    matched_unit: Optional[str] = None
    performance: float = 1.0
    candidates: List[Candidate] = []
    materials: List[Dict[str, Any]] = []
    equipments: List[Dict[str, Any]] = []
    labors: List[Dict[str, Any]] = []
    advertencias: List[str] = []


class CommitItem(BaseModel):
    description: str = Field(min_length=1, max_length=600)
    unit: str = Field(default="und", max_length=20)
    quantity: float = 0.0
    performance: Optional[float] = None
    is_chapter: bool = False
    cod_par: Optional[str] = None
    cov_par: Optional[str] = None
    code: Optional[str] = None
    materials: List[GeneratedMaterial] = []
    equipments: List[GeneratedEquipment] = []
    labors: List[GeneratedLabor] = []

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
    generated_items: int
    generic_items: int
    message: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _copy_apu_components(db: Session, db_item: BudgetItem, cost_item: CostItem) -> None:
    """Copia los insumos del APU maestro al item del presupuesto y asigna el rendimiento COVENIN."""
    is_labor_only, _ = is_labor_only_activity(db_item.description)

    # Solo copiar materiales si la partida legítimamente admite insumos de materiales
    if not is_labor_only:
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

    if cost_item.RenPar and cost_item.RenPar > 0:
        db_item.performance = float(cost_item.RenPar)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/import/preview", response_model=PreviewResponse)
async def preview_budget_import(
    file: UploadFile = File(...),
    mode: str = Form("budget"),
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
        return build_preview(data, file.filename, db, mode=mode)
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


def _generate_apu_with_fallback(
    db: Session,
    description: str,
    unit: str,
) -> Dict[str, Any]:
    """Ejecuta el motor de generación de APU v3.0 con respaldo en v2.0 y v1.0."""
    if not description or len(description.strip()) < 3:
        raise ValueError("La descripción es obligatoria para generar un APU.")

    result: Optional[Dict[str, Any]] = None
    try:
        v3_res = generate_apu_v3(
            user_description=description,
            db=db,
            requested_unit=unit,
            use_embeddings=False,
        )
        if (
            v3_res.get("status") in ("completed", "success")
            and v3_res.get("partida")
            and any(v3_res.get(k) for k in ("materials", "equipments", "labors"))
        ):
            result = v3_res
    except Exception as exc_v3:
        logger.warning("Generador v3.0 falló para importación/cómputos, recurriendo a v2.0: %s", exc_v3)

    if result is None:
        try:
            result = generate_apu_v2(
                user_description=description,
                requested_unit=unit,
                db=db,
            )
        except Exception as exc_v2:
            logger.warning("Generador v2.0 falló para importación, recurriendo a v1: %s", exc_v2)
            try:
                preprocessed = preprocess_apu_data(db, description, None, None)
                result = generate_apu_with_ai(preprocessed, None, db=db, requested_unit=unit)
            except Exception as exc_v1:
                logger.error("Error generando APU para importación (v3, v2 y v1 fallaron): %s", exc_v1, exc_info=True)
                raise HTTPException(
                    status_code=502,
                    detail="El generador de APUs no pudo procesar la partida. Inténtalo de nuevo.",
                ) from exc_v1

    return result


@router.post("/import/generate-apu", response_model=GenerateApuResponse)
def generate_import_apu(
    payload: GenerateApuRequest,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Genera un APU con el motor de IA de la plataforma para una partida importada."""
    check_ai_access(current_user)

    description = payload.description.strip()
    if len(description) < 5:
        raise HTTPException(status_code=400, detail="La descripción es demasiado corta para generar un APU.")
    unit = (payload.unit or "und").strip().lower() or "und"

    result = _generate_apu_with_fallback(db=db, description=description, unit=unit)

    if result.get("status") not in ("completed", "success") or not result.get("partida"):
        detail = (
            result.get("clarification_message")
            or "No se pudo generar un APU para esta partida. Revisa o amplía la descripción."
        )
        raise HTTPException(status_code=422, detail=detail)

    if not any(result.get(key) for key in ("materials", "equipments", "labors")):
        raise HTTPException(
            status_code=422,
            detail="El APU generado no contiene insumos. Amplía la descripción técnica e inténtalo de nuevo.",
        )

    # Si se suministró un código en la solicitud (el código del archivo), asignárselo a la partida generada
    partida = result.get("partida") or {}
    supplied_code = (payload.code or "").strip()
    if supplied_code:
        partida["cod_par"] = supplied_code[:80]
        partida["cov_par"] = supplied_code[:80]

    # Consumir cuota de APUs con IA (solo si el usuario tiene un límite finito).
    try:
        with ArkoSessionLocal() as adb:
            db_user = adb.query(ArkoAdmin).filter(ArkoAdmin.id == current_user.id).first()
            if db_user:
                db_user.ai_apus_generated = (getattr(db_user, "ai_apus_generated", 0) or 0) + 1
                adb.commit()
    except Exception as exc:
        logger.warning("No se pudo incrementar la cuota de APUs generados: %s", exc)

    return {
        "status": "completed",
        "partida": partida,
        "materials": result.get("materials") or [],
        "equipments": result.get("equipments") or [],
        "labors": result.get("labors") or [],
        "advertencias": result.get("advertencias") or [],
    }


@router.post("/import/resolve-computo", response_model=ResolveComputoResponse)
def resolve_computo_item(
    payload: ResolveComputoRequest,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Busca coincidencia COVENIN para un apunte de cómputos o genera partida S/C 01 con APU IA."""
    description = (payload.description or "").strip()
    if len(description) < 3:
        raise HTTPException(status_code=400, detail="La descripción de la partida es demasiado corta.")

    unit = (payload.unit or "M2").strip() or "M2"
    sc_code = f"S/C {max(1, int(payload.sc_index or 1)):02d}"

    candidates = find_candidates(db, description=description, unit=unit, limit=5)
    probe_item: Dict[str, Any] = {
        "row": 1,
        "description": description,
        "unit": unit,
        "quantity": 1.0,
        "is_chapter": False,
        "candidates": [dict(c) for c in candidates],
        "selected_cod_par": candidates[0]["cod_par"] if candidates else None,
    }

    if candidates:
        try:
            refine_with_llm([probe_item])
        except Exception as exc_ref:
            logger.error("Error en arbitraje LLM para cómputos: %s", exc_ref, exc_info=True)

    refined_candidates = probe_item.get("candidates") or candidates
    selected_cod_par = probe_item.get("selected_cod_par")
    llm_rejected = bool(probe_item.get("llm_rejected", False))

    chosen_candidate: Optional[Dict[str, Any]] = None
    if selected_cod_par and not llm_rejected:
        chosen_candidate = next(
            (c for c in refined_candidates if c.get("cod_par") == selected_cod_par),
            None,
        )
        if chosen_candidate and float(chosen_candidate.get("score") or 0.0) < 0.65:
            chosen_candidate = None

    if chosen_candidate:
        cost_item = db.query(CostItem).filter(CostItem.CodPar == chosen_candidate["cod_par"]).first()
        has_db_apu = bool(
            cost_item
            and (cost_item.apu_materials or cost_item.apu_equipments or cost_item.apu_labors)
        )
        if cost_item and has_db_apu:
            raw_cov = str(
                (cost_item.CovPar if cost_item.CovPar else None)
                or chosen_candidate.get("cov_par")
                or ""
            ).strip()
            cov_code = (
                raw_cov
                if (raw_cov and raw_cov.upper() != "S/C")
                else cost_item.CodPar
            )
            perf = float(cost_item.RenPar) if (cost_item.RenPar and float(cost_item.RenPar) > 0) else 1.0
            official_desc = (cost_item.Descri or chosen_candidate.get("description") or description).strip().upper()
            return {
                "resolution_type": "covenin",
                "assigned_code": str(cov_code),
                "cod_par": cost_item.CodPar,
                "cov_par": str(cov_code),
                "matched_description": official_desc,
                "matched_unit": cost_item.UniPar or chosen_candidate.get("unit") or unit,
                "performance": perf,
                "candidates": refined_candidates,
                "materials": [],
                "equipments": [],
                "labors": [],
                "advertencias": [],
            }

    # No hay coincidencia COVENIN válida -> Crear partida S/C 01, S/C 02, ...
    if payload.auto_generate_sc:
        try:
            check_ai_access(current_user)
            gen_res = _generate_apu_with_fallback(db=db, description=description, unit=unit.lower())
            partida = gen_res.get("partida") or {}
            materials = gen_res.get("materials") or []
            equipments = gen_res.get("equipments") or []
            labors = gen_res.get("labors") or []
            if any((materials, equipments, labors)):
                perf_val = float(partida.get("rendimiento") or 1.0)
                if perf_val <= 0:
                    perf_val = 1.0
                try:
                    with ArkoSessionLocal() as adb:
                        db_user = adb.query(ArkoAdmin).filter(ArkoAdmin.id == current_user.id).first()
                        if db_user:
                            db_user.ai_apus_generated = (getattr(db_user, "ai_apus_generated", 0) or 0) + 1
                            adb.commit()
                except Exception as exc_quota:
                    logger.error("No se pudo actualizar cuota IA en cómputos: %s", exc_quota, exc_info=True)

                improved_desc = (
                    partida.get("description")
                    or partida.get("descripcion")
                    or gen_res.get("partida", {}).get("description")
                    or description
                ).strip().upper()

                return {
                    "resolution_type": "sc_generated",
                    "assigned_code": sc_code,
                    "cod_par": sc_code,
                    "cov_par": sc_code,
                    "matched_description": improved_desc,
                    "matched_unit": (partida.get("unidad") or unit).upper(),
                    "performance": perf_val,
                    "candidates": refined_candidates,
                    "materials": materials,
                    "equipments": equipments,
                    "labors": labors,
                    "advertencias": gen_res.get("advertencias") or [],
                }
        except Exception as exc_gen:
            logger.error("Error generando APU automático para %s (%s): %s", sc_code, description[:60], exc_gen, exc_info=True)

    return {
        "resolution_type": "sc_generic",
        "assigned_code": sc_code,
        "cod_par": sc_code,
        "cov_par": sc_code,
        "matched_description": description.strip().upper(),
        "matched_unit": unit.upper(),
        "performance": 1.0,
        "candidates": refined_candidates,
        "materials": [],
        "equipments": [],
        "labors": [],
        "advertencias": ["Partida registrada como S/C sin insumos automáticos; puedes editar o generar su APU."],
    }


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
    generated_items = 0
    generic_items = 0

    try:
        db.add(budget)
        db.flush()

        for index, item in enumerate(payload.items, start=1):
            description = item.description.strip().upper()
            if not description:
                continue

            is_chapter = bool(item.is_chapter)
            has_generated = bool(
                not is_chapter and (item.materials or item.equipments or item.labors)
            )
            requested_code = (item.cod_par or "").strip()
            cost_item: Optional[CostItem] = None
            if requested_code and not is_chapter and not has_generated:
                cost_item = db.query(CostItem).filter(CostItem.CodPar == requested_code).first()

            supplied_code = (item.code or "").strip()

            # Respaldo automático en el servidor si una partida de cómputos llega sin insumos ni cost_item
            if (
                not is_chapter
                and not has_generated
                and cost_item is None
                and payload.source_filename == "Cómputos de Inspección Móvil"
            ):
                try:
                    resolved_fallback = resolve_computo_item(
                        payload=ResolveComputoRequest(
                            description=description,
                            unit=item.unit or "M2",
                            sc_index=index,
                            auto_generate_sc=True,
                        ),
                        db=db,
                        current_user=current_user,
                    )
                    if resolved_fallback.get("resolution_type") == "covenin" and resolved_fallback.get("cod_par"):
                        cost_item = (
                            db.query(CostItem)
                            .filter(CostItem.CodPar == resolved_fallback["cod_par"])
                            .first()
                        )
                        if cost_item and cost_item.Descri:
                            description = cost_item.Descri
                        supplied_code = ""
                    elif any(
                        resolved_fallback.get(k) for k in ("materials", "equipments", "labors")
                    ):
                        item.materials = [
                            GeneratedMaterial(**m) for m in (resolved_fallback.get("materials") or [])
                        ]
                        item.equipments = [
                            GeneratedEquipment(**e) for e in (resolved_fallback.get("equipments") or [])
                        ]
                        item.labors = [
                            GeneratedLabor(**l) for l in (resolved_fallback.get("labors") or [])
                        ]
                        if resolved_fallback.get("performance"):
                            item.performance = float(resolved_fallback["performance"])
                        has_generated = True
                except Exception as exc_fb:
                    logger.error(
                        "Error en respaldo automático de APU para cómputos (%s): %s",
                        description[:60],
                        exc_fb,
                        exc_info=True,
                    )

            if is_chapter:
                cod_par = supplied_code or f"CAP-{index:03d}"
                cov_par = supplied_code or None
                unit = ""
            elif has_generated:
                # Partida con APU generado con IA: conservar el código suministrado del archivo si existe
                item_code = supplied_code or requested_code or f"GEN-{index:03d}"
                cod_par = item_code
                cov_par = item_code
                unit = item.unit or "und"
            elif cost_item:
                # Partida de base COVENIN: conservar el código suministrado del archivo si existe
                cod_par = supplied_code or cost_item.CodPar
                cov_par = supplied_code or cost_item.CovPar or cost_item.CodPar
                unit = cost_item.UniPar or item.unit or "und"
            else:
                # Partida genérica (sin APU): conservar el código suministrado del archivo si existe
                item_code = supplied_code or requested_code or f"IMP-{index:03d}"
                cod_par = item_code
                cov_par = supplied_code or None
                unit = item.unit or "und"

            initial_perf = 1.0
            if item.performance and float(item.performance) > 0:
                initial_perf = float(item.performance)
            elif cost_item and cost_item.RenPar and float(cost_item.RenPar) > 0:
                initial_perf = float(cost_item.RenPar)

            db_item = BudgetItem(
                budget_id=budget.id,
                cod_par=cod_par[:80],
                cov_par=cov_par[:80] if cov_par else None,
                description=description,
                unit="" if is_chapter else unit[:20],
                quantity=0.0 if is_chapter else float(item.quantity or 0.0),
                performance=initial_perf,
                order=index,
                is_chapter=is_chapter,
            )
            db.add(db_item)
            db.flush()

            if has_generated:
                is_labor_only, _ = is_labor_only_activity(description)
                if not is_labor_only:
                    for mat in item.materials:
                        db.add(DBMaterial(
                            budget_item_id=db_item.id,
                            codigo=(mat.codigo or "")[:80],
                            descripcion=mat.descripcion or "",
                            unidad=(mat.unidad or "und")[:20],
                            precio_unitario=float(mat.precio_unitario or 0.0),
                            cantidad=float(mat.cantidad or 0.0),
                            desperdicio=float(mat.desperdicio or 0.0),
                        ))
                for eq in item.equipments:
                    db.add(DBEquipment(
                        budget_item_id=db_item.id,
                        codigo=(eq.codigo or "")[:80],
                        descripcion=eq.descripcion or "",
                        unidad=(eq.unidad or "día")[:20],
                        precio_unitario=float(eq.precio_unitario or 0.0),
                        cantidad=float(eq.cantidad or 0.0),
                        depreciacion=float(eq.depreciacion or 1.0),
                    ))
                for lab in item.labors:
                    db.add(DBLabor(
                        budget_item_id=db_item.id,
                        codigo=(lab.codigo or "")[:80],
                        descripcion=lab.descripcion or "",
                        cantidad=float(lab.cantidad or 0.0),
                        jornal=float(lab.jornal or 0.0),
                        bono=float(lab.bono or 0.0),
                    ))
                generated_items += 1
            elif cost_item and not is_chapter:
                _copy_apu_components(db, db_item, cost_item)
                matched_items += 1
            elif not is_chapter:
                generic_items += 1

            items_created += 1

        # Post-procesamiento y calibración determinista obligatoria de salida
        try:
            recalibrate_budget_performances(budget.id, db, dry_run=False)
        except Exception as exc_post:
            logger.error("Error en post-procesamiento de rendimientos al importar: %s", exc_post, exc_info=True)

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
        "generated_items": generated_items,
        "generic_items": generic_items,
        "message": f"Presupuesto creado con {items_created} partidas "
                   f"({matched_items} con APU de la base maestra, {generated_items} generadas con IA, "
                   f"{generic_items} genéricas).",
    }
