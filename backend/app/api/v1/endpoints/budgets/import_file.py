"""Importación de presupuestos desde archivos Excel, CSV, PDF e imágenes."""
import io
import logging
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.api.v1.endpoints.arko import _get_costos_config, get_current_arko_admin
from app.db.arko_base import ArkoSessionLocal, get_arko_db
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
    performance: Optional[float] = None
    materials: List[GeneratedMaterial] = []
    equipments: List[GeneratedEquipment] = []
    labors: List[GeneratedLabor] = []
    apu_source: Optional[str] = None


class PreviewHeader(BaseModel):
    budget_name: str
    project_name: Optional[str] = None
    client_name: Optional[str] = None
    currency: str = "USD"
    fcas_percent: Optional[float] = None
    admin_percent: Optional[float] = None
    profit_percent: Optional[float] = None
    iva_percent: Optional[float] = None


class PreviewResponse(BaseModel):
    filename: str
    source_type: str
    header: PreviewHeader
    items: List[PreviewItem]
    stats: Dict[str, int]
    warnings: List[str] = []


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
    apu_source: Optional[str] = None
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
    source_type: Optional[str] = "budget"
    fcas_percent: Optional[float] = None
    admin_percent: Optional[float] = None
    profit_percent: Optional[float] = None
    iva_percent: Optional[float] = None

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


def _enrich_sparse_description(description: str, unit: str = "und") -> str:
    """Enriquece descripciones telegráficas o ambiguas con parámetros constructivos
    canónicos para evitar alucinaciones del modelo LLM generador de APUs."""
    clean = (description or "").strip()
    if not clean:
        return clean

    # Si la descripción ya es extensa o detallada, respetarla
    words = clean.split()
    if len(words) >= 10 and any(kw in clean.lower() for kw in ("incluye", "espesor", "e=", "d=", "f'c", "calibre", "mortero", "andamios")):
        return clean

    lower = clean.lower()

    # Patrones constructivos canónicos de enriquecimiento
    if re.search(r"\b(friso|revoque|tarrajeo)\b", lower):
        is_ext = bool(re.search(r"\b(exterior|fachada)\b", lower))
        loc = "PAREDES EXTERIORES" if is_ext else "PAREDES INTERIORES"
        return f"CONSTRUCCIÓN DE FRISO ACABADO LISO EN {loc}, INCLUYE MORTERO 1:4, REMATE DE ARISTAS Y ANDAMIOS HASTA H=3.00M"

    if re.search(r"\b(pintura|pintar|esmalte)\b", lower):
        is_ext = bool(re.search(r"\b(exterior|fachada)\b", lower))
        if is_ext:
            return "APLICACIÓN DE PINTURA DE CAUCHO ELASTOMÉRICA PARA EXTERIORES EN FACHADAS, INCLUYE FONDO ANTIALCALINO Y 2 MANOS DE ACABADO"
        return "APLICACIÓN DE PINTURA DE CAUCHO MATE EN PAREDES INTERIORES, INCLUYE PREPARACIÓN DE SUPERFICIE, FONDO SELLADOR Y 2 MANOS DE ACABADO HASTA H=3.00M"

    if re.search(r"\b(pared.*bloque|bloque.*pared|pared de bloque)\b", lower):
        match_esp = re.search(r"e\s*=\s*(\d+)", lower)
        esp = match_esp.group(1) if match_esp else "15"
        return f"CONSTRUCCIÓN DE PARED DE BLOQUES DE ARCILLA E={esp}CM, INCLUYE MORTERO DE PEGA 1:4 Y ANDAMIOS HASTA H=3.00M"

    if re.search(r"\b(demoli|tumbar|derrib)\b", lower):
        is_pared = bool(re.search(r"\b(pared|muro|tabique)\b", lower))
        elem = "PARED DE BLOQUES" if is_pared else "ELEMENTO EXISTENTE"
        return f"DEMOLICIÓN A MANO DE {elem}, INCLUYE ACARREO INTERNO Y APILAMIENTO DE ESCOMBROS HASTA SITIO DE DISPOSICIÓN"

    if re.search(r"\b(tuberi|tubo).*agua\b", lower):
        is_serv = bool(re.search(r"\b(servida|negra|residual|pluvial)\b", lower))
        if is_serv:
            return 'SUMINISTRO E INSTALACIÓN DE TUBERÍA PVC PARA AGUAS SERVIDAS D=4", INCLUYE ACCESORIOS, PEGA PVC Y PRUEBA DE ESTANQUEIDAD'
        return 'SUMINISTRO E INSTALACIÓN DE TUBERÍA PVC PARA AGUAS BLANCAS D=1/2", INCLUYE ACCESORIOS, PEGA PVC Y PRUEBA HIDROSTÁTICA'

    if re.search(r"\b(impermeabili|manto)\b", lower):
        return "IMPERMEABILIZACIÓN DE LOSA DE TECHO CON MANTO ASFÁLTICO DE 4MM, INCLUYE IMPRIMACIÓN ASFÁLTICA Y 2 MANOS DE PINTURA DE ALUMINIO"

    if re.search(r"\b(ceramica|porcelanato)\b", lower):
        if "porcelanato" in lower:
            return "SUMINISTRO E INSTALACIÓN DE PISO DE PORCELANATO 60X60CM, INCLUYE PEGO BLANCO ESPECIAL, NIVELADORES Y EMBOQUILLADO"
        return "SUMINISTRO E INSTALACIÓN DE PISO DE CERÁMICA ESMALTADA DE TRÁFICO MEDIO, INCLUYE PEGO GRIS, CORTES Y EMBOQUILLADO"

    if re.search(r"\b(bote.*escombro|escombro.*bote|acarreo.*escombro)\b", lower):
        return "TRANSPORTE Y BOTE DE ESCOMBROS EN CAMIÓN VOLTEO, INCLUYE CARGA MANUAL, TRASLADO Y DISPOSICIÓN FINAL EN BOTADERO AUTORIZADO"

    if len(words) < 5:
        upper_text = clean.upper()
        if not re.search(r"\bINCLUYE\b", upper_text):
            return f"{upper_text}, INCLUYE MATERIALES, HERRAMIENTAS MENORES Y MANO DE OBRA ESPECIALIZADA"

    return clean


def _generate_apu_with_fallback(
    db: Session,
    description: str,
    unit: str,
) -> Dict[str, Any]:
    """Ejecuta el motor de generación de APU v3.0 con respaldo en v2.0 y v1.0."""
    if not description or len(description.strip()) < 3:
        raise ValueError("La descripción es obligatoria para generar un APU.")

    # Enriquecer descripciones telegráficas para evitar que el LLM alucine especificaciones
    enriched_desc = _enrich_sparse_description(description, unit=unit)
    if enriched_desc != description:
        logger.info(
            "Descripción técnica enriquecida para evitar alucinación IA: '%s' -> '%s'",
            description[:60],
            enriched_desc[:80],
        )

    result: Optional[Dict[str, Any]] = None
    try:
        v3_res = generate_apu_v3(
            user_description=enriched_desc,
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
                user_description=enriched_desc,
                requested_unit=unit,
                db=db,
            )
        except Exception as exc_v2:
            logger.warning("Generador v2.0 falló para importación, recurriendo a v1: %s", exc_v2)
            try:
                preprocessed = preprocess_apu_data(db, enriched_desc, None, None)
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
    fcas_val = payload.fcas_percent if (payload.fcas_percent is not None and payload.fcas_percent > 0) else getattr(costos, "fcas", 0.0)
    admin_val = payload.admin_percent if (payload.admin_percent is not None and payload.admin_percent > 0) else getattr(costos, "porcentajeAdministracion", 15.0)
    profit_val = payload.profit_percent if (payload.profit_percent is not None and payload.profit_percent > 0) else getattr(costos, "porcentajeUtilidad", 10.0)
    iva_val = payload.iva_percent if (payload.iva_percent is not None and payload.iva_percent >= 0) else getattr(costos, "iva", 16.0)

    budget = Budget(
        user_id=str(current_user.id),
        name=payload.name.strip(),
        description=f"Importado desde {payload.source_filename}" if payload.source_filename else "Importado desde archivo",
        project_name=(payload.project_name or payload.name).strip(),
        client_name=(payload.client_name or None),
        currency=payload.currency,
        exchange_rate=1.0,
        fcas_percent=fcas_val,
        admin_percent=admin_val,
        profit_percent=profit_val,
        iva_percent=iva_val,
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
            if cost_item and cost_item.RenPar and float(cost_item.RenPar) > 0:
                initial_perf = float(cost_item.RenPar)
            elif item.performance and float(item.performance) > 0:
                initial_perf = float(item.performance)

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
                # Si proviene del nuevo flujo de Libro de APU (Excel), clonar 1:1 sin reglas ni filtros.
                # Si proviene del flujo antiguo de generación con IA, proteger contra alucinaciones de materiales en demolición.
                is_from_excel_apu = (payload.source_type == "excel_apu") or (item.apu_source == "excel_apu")
                if not is_from_excel_apu:
                    is_labor_only, _ = is_labor_only_activity(description)
                    save_materials = not is_labor_only
                else:
                    save_materials = True

                if save_materials:
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

        # Post-procesamiento y calibración determinista obligatoria para el FLUJO ESTÁNDAR / IMÁGENES / LISTADOS
        # En la importación de Libros de APUs de Excel (excel_apu), se omite para respetar la copia fiel.
        is_apu_workbook_flow = (payload.source_type == "excel_apu") or any(
            it.apu_source == "excel_apu" for it in payload.items
        )
        if not is_apu_workbook_flow:
            try:
                has_uncalibrated = any(
                    (not it.is_chapter and float(it.performance or 1.0) <= 1.0 and it.unit not in ("gl", "glb", "sg"))
                    for it in db.query(BudgetItem).filter(BudgetItem.budget_id == budget.id).all()
                )
                if has_uncalibrated:
                    recalibrate_budget_performances(budget.id, db, dry_run=False)
            except Exception as exc_post:
                logger.error("Error en post-procesamiento de rendimientos al importar (flujo estándar): %s", exc_post, exc_info=True)

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


# ---------------------------------------------------------------------------
# Cómputos Métricos: Sincronización multidispositivo de borradores
# ---------------------------------------------------------------------------

@router.get("/computos/drafts", response_model=List[Dict[str, Any]])
def get_computos_drafts(
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> List[Dict[str, Any]]:
    """Devuelve la lista de borradores de cómputos guardados por el usuario autenticado."""
    config = current_user.site_config or {}
    drafts = config.get("computos_drafts", [])
    if not isinstance(drafts, list):
        return []
    return drafts


@router.post("/computos/drafts")
def save_computos_draft(
    payload: Dict[str, Any],
    arko_db: Session = Depends(get_arko_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Guarda o actualiza un borrador de cómputos en la cuenta del usuario para sincronización multidispositivo."""
    if not payload:
        raise HTTPException(status_code=400, detail="El cuerpo de la solicitud no puede estar vacío.")

    user = arko_db.query(ArkoAdmin).filter(ArkoAdmin.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    config = dict(user.site_config or {})
    raw_drafts = config.get("computos_drafts", [])
    drafts = list(raw_drafts) if isinstance(raw_drafts, list) else []

    incoming_items: List[Dict[str, Any]] = []
    if "drafts" in payload and isinstance(payload["drafts"], list):
        incoming_items = [it for it in payload["drafts"] if isinstance(it, dict)]
    else:
        incoming_items = [payload]

    for item in incoming_items:
        draft_id = str(item.get("id") or f"draft-{int(time.time() * 1000)}")
        item["id"] = draft_id
        if not item.get("savedAt"):
            item["savedAt"] = datetime.utcnow().isoformat()

        clean_name = (item.get("budgetName") or "").strip()
        drafts = [
            d for d in drafts
            if str(d.get("id")) != draft_id and (not clean_name or (d.get("budgetName") or "").strip() != clean_name)
        ]
        drafts.insert(0, item)

    try:
        drafts.sort(key=lambda x: str(x.get("savedAt") or ""), reverse=True)
    except Exception as sort_err:
        logger.error("Error ordenando borradores de cómputos: %s", sort_err, exc_info=True)

    config["computos_drafts"] = drafts[:40]
    user.site_config = config
    flag_modified(user, "site_config")
    arko_db.commit()

    return {
        "status": "saved",
        "id": incoming_items[0].get("id") if incoming_items else None,
        "drafts": config["computos_drafts"],
    }


@router.delete("/computos/drafts/{draft_id}")
def delete_computos_draft(
    draft_id: str,
    arko_db: Session = Depends(get_arko_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Elimina un borrador de cómputos guardado de la cuenta del usuario."""
    clean_draft_id = (draft_id or "").strip()
    if not clean_draft_id:
        raise HTTPException(status_code=400, detail="Identificador de borrador inválido.")

    user = arko_db.query(ArkoAdmin).filter(ArkoAdmin.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    config = dict(user.site_config or {})
    raw_drafts = config.get("computos_drafts", [])
    drafts = list(raw_drafts) if isinstance(raw_drafts, list) else []

    drafts = [d for d in drafts if str(d.get("id")) != clean_draft_id]

    config["computos_drafts"] = drafts
    user.site_config = config
    flag_modified(user, "site_config")
    arko_db.commit()

    return {"status": "deleted", "id": clean_draft_id, "drafts": drafts}


# ---------------------------------------------------------------------------
# Cómputos Métricos: Exportación a Excel .xlsx nativo genuino (OpenXML)
# ---------------------------------------------------------------------------

class ComputosExportRequest(BaseModel):
    budgetName: Optional[str] = "Planilla de Cómputos Métricos"
    projectName: Optional[str] = ""
    items: List[Dict[str, Any]] = []


@router.post("/computos/export-excel")
def export_computos_excel(
    payload: ComputosExportRequest,
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> StreamingResponse:
    """Genera y descarga un archivo Excel .xlsx nativo genuino (OpenXML) para la Planilla de Cómputos Métricos."""
    valid_items = [it for it in payload.items if isinstance(it, dict) and (it.get("description") or "").strip()]
    if not valid_items:
        raise HTTPException(status_code=400, detail="No hay partidas con datos para exportar.")

    wb = Workbook()
    ws = wb.active
    ws.title = "Cómputos Métricos"
    ws.views.sheetView[0].showGridLines = True

    # Paleta de fuentes y bordes
    title_font = Font(name="Calibri", size=18, bold=True, color="1E293B")
    meta_label_font = Font(name="Calibri", size=10, bold=True, color="1E293B")
    meta_val_font = Font(name="Calibri", size=10, bold=False, color="334155")

    # ENCABEZADO DE COLUMNAS: Todas en negrita y centradas tanto vertical como horizontalmente
    header_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="D97706", end_color="D97706", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    header_border = Border(
        left=Side(style="thin", color="B45309"),
        right=Side(style="thin", color="B45309"),
        top=Side(style="thin", color="B45309"),
        bottom=Side(style="thin", color="B45309"),
    )

    cell_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )

    chap_font = Font(name="Calibri", size=11, bold=True, color="78350F")
    chap_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    chap_border = Border(
        left=Side(style="thin", color="D97706"),
        right=Side(style="thin", color="D97706"),
        top=Side(style="thin", color="D97706"),
        bottom=Side(style="thin", color="D97706"),
    )

    total_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    partial_row_fill = PatternFill(start_color="FFFBEB", end_color="FFFBEB", fill_type="solid")

    # 1. Título General
    ws.merge_cells("A1:L1")
    t_cell = ws["A1"]
    t_cell.value = "Planilla de Cómputos Métricos"
    t_cell.font = title_font
    t_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 36

    # 2. Metadatos (Obra y Fecha)
    ws["A2"] = "Obra:"
    ws["A2"].font = meta_label_font
    ws["B2"] = (payload.projectName or payload.budgetName or "—").strip()
    ws["B2"].font = meta_val_font

    ws["A3"] = "Fecha:"
    ws["A3"].font = meta_label_font
    ws["B3"] = datetime.now().strftime("%d/%m/%Y")
    ws["B3"].font = meta_val_font

    ws.row_dimensions[2].height = 18
    ws.row_dimensions[3].height = 18
    ws.row_dimensions[4].height = 8

    # 3. Fila de Encabezados de Columnas (Fila 5)
    headers = [
        "N°",
        "DESCRIPCIÓN DE LA PARTIDA",
        "UND",
        "LARGO",
        "ANCHO",
        "ALTO",
        "VECES",
        "FACTOR",
        "DIST. (km)",
        "PARCIAL",
        "TOTAL",
        "OBSERVACIONES",
    ]
    ws.row_dimensions[5].height = 28

    for col_idx, header_text in enumerate(headers, start=1):
        c = ws.cell(row=5, column=col_idx, value=header_text)
        c.font = header_font
        c.fill = header_fill
        c.alignment = header_align
        c.border = header_border

    # Anchos de columnas optimizados
    col_widths = {
        "A": 7,   # N°
        "B": 58,  # DESCRIPCIÓN
        "C": 10,  # UND
        "D": 11,  # LARGO
        "E": 11,  # ANCHO
        "F": 11,  # ALTO
        "G": 10,  # VECES
        "H": 11,  # FACTOR
        "I": 12,  # DIST. (km)
        "J": 13,  # PARCIAL
        "K": 14,  # TOTAL
        "L": 26,  # OBSERVACIONES
    }
    for col_letter, width in col_widths.items():
        ws.column_dimensions[col_letter].width = width

    # 4. Filas de Partidas y Capítulos
    current_row = 6
    current_chapter: Optional[str] = None
    item_num = 1

    def _parse_num(val: Any) -> Any:
        if val is None or val == "" or val == "—":
            return "—"
        try:
            f = float(val)
            return int(f) if f.is_integer() else round(f, 4)
        except (ValueError, TypeError):
            return str(val)

    for item in valid_items:
        chap = (item.get("chapter") or "GENERAL").strip().upper()
        if chap != current_chapter:
            current_chapter = chap
            ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=12)
            c_chap = ws.cell(row=current_row, column=1, value=f"CAPÍTULO: {chap}")
            c_chap.font = chap_font
            c_chap.fill = chap_fill
            c_chap.alignment = Alignment(horizontal="left", vertical="center", indent=1)
            for c_idx in range(1, 13):
                ws.cell(row=current_row, column=c_idx).border = chap_border
            ws.row_dimensions[current_row].height = 24
            current_row += 1

        partials = item.get("partials") or []
        has_partials = len(partials) > 0

        ws.row_dimensions[current_row].height = 22

        # A: N°
        c_a = ws.cell(row=current_row, column=1, value=item_num)
        c_a.alignment = Alignment(horizontal="center", vertical="top")
        c_a.font = Font(name="Calibri", size=10, bold=True)
        c_a.fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

        # B: Descripción
        c_b = ws.cell(row=current_row, column=2, value=str(item.get("description") or "").strip())
        c_b.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
        c_b.font = Font(name="Calibri", size=10, bold=True)

        # C: UND
        c_c = ws.cell(row=current_row, column=3, value=str(item.get("unit") or "").strip())
        c_c.alignment = Alignment(horizontal="center", vertical="top")
        c_c.font = Font(name="Calibri", size=10.5, bold=True, color="1E293B")

        # D-I: Dimensiones
        c_d = ws.cell(row=current_row, column=4, value="—" if has_partials else _parse_num(item.get("length")))
        c_d.alignment = Alignment(horizontal="right" if not has_partials else "center", vertical="top")

        c_e = ws.cell(row=current_row, column=5, value="—" if has_partials else _parse_num(item.get("width")))
        c_e.alignment = Alignment(horizontal="right" if not has_partials else "center", vertical="top")

        c_f = ws.cell(row=current_row, column=6, value="—" if has_partials else _parse_num(item.get("height")))
        c_f.alignment = Alignment(horizontal="right" if not has_partials else "center", vertical="top")

        c_g = ws.cell(row=current_row, column=7, value="—" if has_partials else _parse_num(item.get("times") or 1))
        c_g.alignment = Alignment(horizontal="center", vertical="top")

        c_h = ws.cell(row=current_row, column=8, value="—" if has_partials else _parse_num(item.get("factor")))
        c_h.alignment = Alignment(horizontal="right" if not has_partials else "center", vertical="top")

        c_i = ws.cell(row=current_row, column=9, value="—" if has_partials else _parse_num(item.get("distance")))
        c_i.alignment = Alignment(horizontal="right" if not has_partials else "center", vertical="top")

        # J: Parcial
        c_j = ws.cell(row=current_row, column=10, value="—" if has_partials else _parse_num(item.get("partial")))
        c_j.alignment = Alignment(horizontal="right" if not has_partials else "center", vertical="top")
        c_j.font = Font(name="Calibri", size=10, bold=True)

        # K: Total
        c_k = ws.cell(row=current_row, column=11, value=_parse_num(item.get("quantity") or 0))
        c_k.alignment = Alignment(horizontal="right", vertical="top")
        c_k.font = Font(name="Calibri", size=10.5, bold=True, color="1E293B")
        c_k.fill = total_fill

        # L: Observaciones
        c_l = ws.cell(row=current_row, column=12, value=str(item.get("observations") or "").strip())
        c_l.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
        c_l.font = Font(name="Calibri", size=9.5)

        for c_idx in range(1, 13):
            ws.cell(row=current_row, column=c_idx).border = cell_border

        current_row += 1

        # Partidas con parciales/paredes
        if has_partials:
            for p_idx, part in enumerate(partials, start=1):
                ws.row_dimensions[current_row].height = 20

                p_desc = str(part.get("description") or f"Pared {p_idx}").strip()
                p_unit = str(item.get("unit") or "").strip()

                p_a = ws.cell(row=current_row, column=1, value=f"↳ {p_idx}")
                p_a.alignment = Alignment(horizontal="center", vertical="top")
                p_a.font = Font(name="Calibri", size=9, bold=True, color="D97706")

                p_b = ws.cell(row=current_row, column=2, value=f"    {p_desc}")
                p_b.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
                p_b.font = Font(name="Calibri", size=9.5, italic=True, color="78350F")

                p_c = ws.cell(row=current_row, column=3, value=p_unit)
                p_c.alignment = Alignment(horizontal="center", vertical="top")
                p_c.font = Font(name="Calibri", size=9, color="64748B")

                p_d = ws.cell(row=current_row, column=4, value=_parse_num(part.get("length")))
                p_d.alignment = Alignment(horizontal="right", vertical="top")

                p_e = ws.cell(row=current_row, column=5, value=_parse_num(part.get("width")))
                p_e.alignment = Alignment(horizontal="right", vertical="top")

                p_f = ws.cell(row=current_row, column=6, value=_parse_num(part.get("height")))
                p_f.alignment = Alignment(horizontal="right", vertical="top")

                p_g = ws.cell(row=current_row, column=7, value=_parse_num(part.get("times") or 1))
                p_g.alignment = Alignment(horizontal="center", vertical="top")

                p_h = ws.cell(row=current_row, column=8, value=_parse_num(part.get("factor")))
                p_h.alignment = Alignment(horizontal="right", vertical="top")

                p_i = ws.cell(row=current_row, column=9, value=_parse_num(part.get("distance")))
                p_i.alignment = Alignment(horizontal="right", vertical="top")

                p_j = ws.cell(row=current_row, column=10, value=_parse_num(part.get("partial") or 0))
                p_j.alignment = Alignment(horizontal="right", vertical="top")
                p_j.font = Font(name="Calibri", size=9.5, bold=True, color="B45309")

                p_k = ws.cell(row=current_row, column=11, value="—")
                p_k.alignment = Alignment(horizontal="center", vertical="top")
                p_k.font = Font(name="Calibri", size=9, color="94A3B8")

                p_l = ws.cell(row=current_row, column=12, value=str(part.get("observations") or "").strip())
                p_l.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
                p_l.font = Font(name="Calibri", size=9, italic=True, color="64748B")

                for c_idx in range(1, 13):
                    cell = ws.cell(row=current_row, column=c_idx)
                    cell.fill = partial_row_fill
                    cell.border = cell_border

                current_row += 1

        item_num += 1

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    clean_filename = re.sub(r'[/\\?%*:|"<>]+', '_', (payload.budgetName or "Planilla_de_Computos").strip())
    today_str = datetime.now().strftime("%Y-%m-%d")
    full_filename = f"{clean_filename}_{today_str}.xlsx"

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{full_filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


