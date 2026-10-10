import json
import urllib.parse
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.db.base import get_db
from app.api.v1.endpoints.arko import get_current_arko_admin, get_optional_arko_admin
from app.db.models.arko import ArkoAdmin
from app.db.models.costbase import CustomCostItem
from app.db.models.budget import BudgetItem
from app.schemas.costbase import (
    CostItemListResponse,
    APUResponse,
    APUComponent,
    MasterItemUpdate,
    MasterAPUUpdate
)
from app.crud.crud_costbase import (
    get_items_paginated,
    get_item_by_code,
    get_apu_materials,
    get_apu_equipments,
    get_apu_labors,
    update_master_item,
    delete_master_item,
    update_master_apu_details
)
from app.api.v1.endpoints.costbase.common import (
    set_schema_for_db,
    get_db_factors
)

router = APIRouter()


def _find_custom_cost_item(
    db: Session,
    item_code: str,
    user_id: Optional[int] = None,
    is_superadmin: bool = False
) -> Optional[CustomCostItem]:
    target = item_code.strip().upper()

    # 1. Búsqueda directa por UUID
    ci = db.query(CustomCostItem).filter(CustomCostItem.id == item_code.strip()).first()
    if ci:
        return ci

    # 2. Búsqueda en partidas del usuario (o todas si es superadmin)
    query = db.query(CustomCostItem)
    if user_id is not None and not is_superadmin:
        query = query.filter(or_(CustomCostItem.user_id == user_id, CustomCostItem.user_id.is_(None)))
    candidates = query.all()

    fallback_match: Optional[CustomCostItem] = None

    for candidate in candidates:
        cand_id_upper = candidate.id.upper()
        cand_cust_prefix = f"CUST-{candidate.id[:4].upper()}"

        matches = (cand_id_upper == target or cand_cust_prefix == target)

        if not matches:
            try:
                data = json.loads(candidate.apu_data) if isinstance(candidate.apu_data, str) else candidate.apu_data
                if isinstance(data, dict):
                    codes = [
                        data.get("cod_par"),
                        data.get("CodPar"),
                        data.get("cov_par"),
                        data.get("CovPar"),
                        (data.get("partida", {}).get("cod_par") if isinstance(data.get("partida"), dict) else None),
                        (data.get("partida", {}).get("CodPar") if isinstance(data.get("partida"), dict) else None),
                        (data.get("partida", {}).get("cov_par") if isinstance(data.get("partida"), dict) else None),
                        (data.get("partida", {}).get("CovPar") if isinstance(data.get("partida"), dict) else None),
                    ]
                    for c in codes:
                        if c and str(c).strip().upper() == target:
                            matches = True
                            break
            except Exception:
                continue

        if matches:
            if user_id is not None and candidate.user_id == user_id:
                return candidate
            if fallback_match is None:
                fallback_match = candidate

    return fallback_match


def _build_custom_apu_response(ci: CustomCostItem, item_code: str) -> Dict[str, Any]:
    try:
        data = json.loads(ci.apu_data) if isinstance(ci.apu_data, str) else ci.apu_data
        if not isinstance(data, dict):
            data = {}
    except Exception:
        data = {}

    cod = (
        data.get("cod_par") or
        data.get("CodPar") or
        (data.get("partida", {}).get("cod_par") if isinstance(data.get("partida"), dict) else None) or
        (data.get("partida", {}).get("CodPar") if isinstance(data.get("partida"), dict) else None) or
        f"CUST-{ci.id[:4].upper()}"
    )
    cov = (
        data.get("cov_par") or
        data.get("CovPar") or
        (data.get("partida", {}).get("cov_par") if isinstance(data.get("partida"), dict) else None) or
        (data.get("partida", {}).get("CovPar") if isinstance(data.get("partida"), dict) else None)
    )
    desc = (
        ci.description or
        data.get("description") or
        data.get("Descri") or
        (data.get("partida", {}).get("Descri") if isinstance(data.get("partida"), dict) else None) or
        ""
    )
    unit = (
        ci.unit or
        data.get("unit") or
        data.get("UniPar") or
        (data.get("partida", {}).get("UniPar") if isinstance(data.get("partida"), dict) else None) or
        "und"
    )
    rend = float(
        ci.performance or
        data.get("performance") or
        data.get("RenPar") or
        (data.get("partida", {}).get("RenPar") if isinstance(data.get("partida"), dict) else 1.0) or
        1.0
    )
    if rend <= 0:
        rend = 1.0

    raw_materials = data.get("materials") or data.get("materiales") or []
    materials: List[APUComponent] = []
    for m in raw_materials:
        cod_m = str(m.get("codigo") or m.get("CodMat") or m.get("id") or "s/c").strip()
        desc_m = str(m.get("descripcion") or m.get("Descri") or "Material").strip()
        uni_m = str(m.get("unidad") or m.get("UniMat") or "und").strip()
        cant_m = float(m.get("cantidad") or m.get("CanIns") or 0.0)
        pu_m = float(m.get("precio_unitario") or m.get("CosMat") or 0.0)
        desp_m = float(m.get("desperdicio") or m.get("Desper") or 0.0)
        sub_m = float(m.get("subtotal") or (cant_m * pu_m * (1.0 + (desp_m / 100.0))))
        materials.append(APUComponent(
            codigo=cod_m,
            cod_ins=cod_m,
            ref_code=str(m.get("ref_code") or cod_m).strip(),
            descripcion=desc_m,
            unidad=uni_m,
            cantidad=cant_m,
            precio_unitario=round(pu_m, 4),
            subtotal=round(sub_m, 2),
            desperdicio=desp_m,
            origen=m.get("origen"),
            nota_calculo=m.get("nota_calculo")
        ))

    raw_equipments = data.get("equipments") or data.get("equipos") or []
    equipments: List[APUComponent] = []
    for e in raw_equipments:
        cod_e = str(e.get("codigo") or e.get("CodEqu") or e.get("id") or "s/c").strip()
        desc_e = str(e.get("descripcion") or e.get("Descri") or "Equipo").strip()
        uni_e = str(e.get("unidad") or e.get("UniEqu") or "día").strip()
        cant_e = float(e.get("cantidad") or e.get("CanIns") or 0.0)
        pu_e = float(e.get("precio_unitario") or e.get("CosDia") or 0.0)
        deprec_e = float(e.get("depreciacion") or e.get("Deprec") or 1.0)
        sub_e = float(e.get("subtotal") or (cant_e * pu_e * deprec_e))
        equipments.append(APUComponent(
            codigo=cod_e,
            cod_ins=cod_e,
            ref_code=str(e.get("ref_code") or cod_e).strip(),
            descripcion=desc_e,
            unidad=uni_e,
            cantidad=cant_e,
            precio_unitario=round(pu_e, 4),
            subtotal=round(sub_e, 2),
            depreciacion=deprec_e,
            origen=e.get("origen"),
            nota_calculo=e.get("nota_calculo")
        ))

    raw_labors = data.get("labors") or data.get("labor") or data.get("mano_obra") or []
    labors: List[APUComponent] = []
    for l in raw_labors:
        cod_l = str(l.get("codigo") or l.get("CodMan") or l.get("id") or "s/c").strip()
        desc_l = str(l.get("descripcion") or l.get("Descri") or "Mano de Obra").strip()
        uni_l = str(l.get("unidad") or l.get("UniMan") or "día").strip()
        cant_l = float(l.get("cantidad") or l.get("CanIns") or 0.0)
        jornal_l = float(l.get("jornal") or l.get("Jornal") or 0.0)
        bono_l = float(l.get("bono") or l.get("Bono") or 0.0)
        pu_l = float(l.get("precio_unitario") or (jornal_l + bono_l))
        tot_jornal_l = cant_l * jornal_l
        tot_bono_l = cant_l * bono_l
        sub_l = float(l.get("subtotal") or (cant_l * pu_l))
        labors.append(APUComponent(
            codigo=cod_l,
            cod_ins=cod_l,
            ref_code=str(l.get("ref_code") or cod_l).strip(),
            descripcion=desc_l,
            unidad=uni_l,
            cantidad=cant_l,
            precio_unitario=round(pu_l, 4),
            subtotal=round(sub_l, 2),
            jornal=jornal_l,
            bono=bono_l,
            tot_jornal=round(tot_jornal_l, 2),
            tot_bono=round(tot_bono_l, 2),
            origen=l.get("origen"),
            nota_calculo=l.get("nota_calculo")
        ))

    total_directo = sum(c.subtotal for c in materials) + sum(c.subtotal for c in equipments) + sum(c.subtotal for c in labors)

    mat_total = sum(m.subtotal for m in materials)
    eq_total = sum(e.subtotal for e in equipments) / rend
    lab_jornal_tot = sum((l.tot_jornal or 0.0) for l in labors)
    lab_bono_tot = sum((l.tot_bono or 0.0) for l in labors)
    lab_total = (lab_jornal_tot + lab_bono_tot + (lab_jornal_tot * 4.17)) / rend
    calc_pre_uni = (mat_total + eq_total + lab_total) * 1.15 * 1.10
    pre_uni = float(data.get("pre_uni") or data.get("PreUni") or calc_pre_uni)

    partida = {
        "CodPar": cod,
        "CovPar": cov,
        "Descri": desc,
        "UniPar": unit,
        "PreUni": round(pre_uni, 4),
        "RenPar": rend
    }

    return {
        "partida": partida,
        "materiales": materials,
        "equipos": equipments,
        "mano_obra": labors,
        "total_directo": round(total_directo, 2)
    }


@router.get("/items", response_model=CostItemListResponse)
def get_items(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    chapter: Optional[str] = None,
    categoria: Optional[str] = None,
    tipo_actividad: Optional[str] = None,
    search_desc: bool = True,
    search_insumos: bool = False,
    covenin: Optional[str] = None,
    database_id: str = "master",
    only_coded: bool = False,
    hidden_categories: Optional[str] = None,
    current_user: Optional[ArkoAdmin] = Depends(get_optional_arko_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    if database_id.startswith("budget_"):
        budget_id = database_id.replace("budget_", "")
        query = db.query(BudgetItem).filter(BudgetItem.budget_id == budget_id, BudgetItem.is_chapter == False)

        if search:
            search_term = f"%{search.lower()}%"
            query = query.filter(
                or_(
                    func.lower(BudgetItem.cod_par).like(search_term),
                    func.lower(BudgetItem.description).like(search_term)
                )
            )

        total = query.count()
        budget_items = query.order_by(BudgetItem.order).offset(skip).limit(limit).all()

        items = []
        for bi in budget_items:
            items.append({
                "CodPar": bi.cod_par,
                "Descri": bi.description,
                "CovPar": bi.cov_par,
                "UniPar": bi.unit,
                "PreUni": 0.0,
                "RenPar": bi.performance
            })

        return {"total": total, "items": items}

    user_id = getattr(current_user, 'id', None)
    is_superadmin = False
    if hasattr(current_user, 'id'):
        is_superadmin = (
            getattr(current_user, 'is_superadmin', False) or
            (getattr(current_user, 'email', '') == 'admin@arko360.net') or
            getattr(current_user, 'role', '') in ['admin', 'superadmin']
        )

    set_schema_for_db(db, database_id)
    total, items = get_items_paginated(
        db, skip, limit, search, chapter, categoria, tipo_actividad,
        search_desc, search_insumos, covenin, database_id, only_coded, hidden_categories,
        user_id=user_id, is_superadmin=is_superadmin
    )
    return {"total": total, "items": items}


@router.get("/items/{item_code}/apu", response_model=APUResponse)
def get_apu(
    item_code: str,
    database_id: str = "master",
    db: Session = Depends(get_db),
    current_user: Optional[ArkoAdmin] = Depends(get_optional_arko_admin)
) -> Any:
    if database_id.startswith("budget_"):
        budget_id = database_id.replace("budget_", "")
        bi = db.query(BudgetItem).filter(BudgetItem.budget_id == budget_id, BudgetItem.cod_par == item_code).first()
        if not bi:
            raise HTTPException(status_code=404, detail="Partida de presupuesto no encontrada")

        partida = {
            "CodPar": bi.cod_par,
            "Descri": bi.description,
            "CovPar": bi.cov_par,
            "UniPar": bi.unit,
            "PreUni": 0.0,
            "RenPar": bi.performance
        }

        materials = [
            APUComponent(codigo=m.codigo, descripcion=m.descripcion, unidad=m.unidad, cantidad=m.cantidad, precio_unitario=m.precio_unitario, subtotal=m.cantidad*m.precio_unitario*(1+m.desperdicio/100), desperdicio=m.desperdicio) for m in bi.materials
        ]
        equipments = [
            APUComponent(codigo=e.codigo, descripcion=e.descripcion, unidad=e.unidad, cantidad=e.cantidad, precio_unitario=e.precio_unitario, subtotal=e.cantidad*e.precio_unitario*(e.depreciacion), depreciacion=e.depreciacion) for e in bi.equipments
        ]
        labors = [
            APUComponent(codigo=l.codigo, descripcion=l.descripcion, unidad="Día", cantidad=l.cantidad, precio_unitario=l.jornal+l.bono, subtotal=l.cantidad*(l.jornal+l.bono), jornal=l.jornal, bono=l.bono, tot_jornal=l.cantidad*l.jornal, tot_bono=l.cantidad*l.bono) for l in bi.labors
        ]

        total_directo = sum(c.subtotal for c in materials) + sum(c.subtotal for c in equipments) + sum(c.subtotal for c in labors)
        return {"partida": partida, "materiales": materials, "equipos": equipments, "mano_obra": labors, "total_directo": total_directo}

    set_schema_for_db(db, database_id)

    user_id = getattr(current_user, 'id', None)
    is_superadmin = False
    if hasattr(current_user, 'id'):
        is_superadmin = (
            getattr(current_user, 'is_superadmin', False) or
            (getattr(current_user, 'email', '') == 'admin@arko360.net') or
            getattr(current_user, 'role', '') in ['admin', 'superadmin']
        )

    # 1. Si se solicita explícitamente base personalizada o código CUST-
    if database_id == "personalizada" or item_code.startswith("CUST-"):
        ci = _find_custom_cost_item(db, item_code, user_id=user_id, is_superadmin=is_superadmin)
        if ci:
            return _build_custom_apu_response(ci, item_code)
        if database_id == "personalizada":
            raise HTTPException(status_code=404, detail="Partida personalizada no encontrada")

    # 2. Buscar en catálogo maestro
    item = get_item_by_code(db, item_code)
    if not item:
        # Fallback a búsqueda en CustomCostItem si no se halló en la base maestra
        ci = _find_custom_cost_item(db, item_code, user_id=user_id, is_superadmin=is_superadmin)
        if ci:
            return _build_custom_apu_response(ci, item_code)
        raise HTTPException(status_code=404, detail="Partida no encontrada")

    factors = get_db_factors(db, database_id)

    mat_results = get_apu_materials(db, item_code)
    materiales = []
    for rel, mat in mat_results:
        desperdicio = rel.Desper if hasattr(rel, 'Desper') and rel.Desper else 0.0
        precio = (mat.CosMat or 0.0) * factors["mat"]
        subtotal = rel.CanIns * precio * (1 + (desperdicio / 100.0))
        materiales.append(APUComponent(
            codigo=mat.ref_code or mat.CodMat, cod_ins=mat.CodMat, ref_code=mat.ref_code,
            descripcion=mat.Descri, unidad=mat.UniMat, cantidad=rel.CanIns,
            precio_unitario=round(precio, 4), subtotal=round(subtotal, 2), desperdicio=desperdicio
        ))

    eq_results = get_apu_equipments(db, item_code)
    equipos = []
    for rel, eq in eq_results:
        depreciacion = rel.Deprec if hasattr(rel, 'Deprec') and rel.Deprec else 1.0
        precio_diario_depreciado = (eq.CosDia or 0.0) * factors["eq"]
        precio_adquisicion = precio_diario_depreciado / depreciacion if depreciacion > 0 else precio_diario_depreciado
        subtotal = rel.CanIns * precio_diario_depreciado
        equipos.append(APUComponent(
            codigo=eq.ref_code or eq.CodEqu, cod_ins=eq.CodEqu, ref_code=eq.ref_code,
            descripcion=eq.Descri, unidad="Día", cantidad=rel.CanIns,
            precio_unitario=round(precio_adquisicion, 4), subtotal=round(subtotal, 2), depreciacion=depreciacion
        ))

    mo_results = get_apu_labors(db, item_code)
    mano_obra = []
    for rel, mo in mo_results:
        jornal = (mo.Jornal or 0.0) * factors["lab"]
        bono = (mo.Bono or 0.0) * factors["lab"]
        tot_jornal = rel.CanIns * jornal
        tot_bono = rel.CanIns * bono
        precio = jornal + bono
        subtotal = tot_jornal + tot_bono
        mano_obra.append(APUComponent(
            codigo=mo.ref_code or mo.CodMan, cod_ins=mo.CodMan, ref_code=mo.ref_code,
            descripcion=mo.Descri, unidad="Día", cantidad=rel.CanIns,
            precio_unitario=round(precio, 2), subtotal=round(subtotal, 2),
            jornal=round(jornal, 4), bono=round(bono, 4),
            tot_jornal=round(tot_jornal, 2), tot_bono=round(tot_bono, 2)
        ))

    total_directo = sum(c.subtotal for c in materiales) + sum(c.subtotal for c in equipos) + sum(c.subtotal for c in mano_obra)

    return APUResponse(
        partida=item, materiales=materiales, equipos=equipos, mano_obra=mano_obra, total_directo=round(total_directo, 2)
    )


@router.put("/items/{item_code}/apu")
def update_master_apu_route(
    item_code: str,
    payload: MasterAPUUpdate,
    database_id: str = "master",
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> Dict[str, Any]:
    set_schema_for_db(db, database_id)
    user_id = getattr(current_user, 'id', None)
    is_superadmin = False
    if hasattr(current_user, 'id'):
        is_superadmin = (
            getattr(current_user, 'is_superadmin', False) or
            (getattr(current_user, 'email', '') == 'admin@arko360.net') or
            getattr(current_user, 'role', '') in ['admin', 'superadmin']
        )

    clean_code = urllib.parse.unquote(item_code).strip()

    if database_id == "personalizada" or clean_code.startswith("CUST-") or item_code.startswith("CUST-"):
        ci = _find_custom_cost_item(db, clean_code, user_id=user_id, is_superadmin=is_superadmin) or _find_custom_cost_item(db, item_code, user_id=user_id, is_superadmin=is_superadmin)
        if ci:
            if not is_superadmin and ci.user_id is not None and user_id is not None and ci.user_id != user_id:
                raise HTTPException(status_code=403, detail="No tienes permisos para editar esta partida")

            if payload.description is not None:
                ci.description = payload.description.strip()
            if payload.unit is not None:
                ci.unit = payload.unit.strip()
            if payload.performance is not None and payload.performance > 0:
                ci.performance = float(payload.performance)

            try:
                data = json.loads(ci.apu_data) if isinstance(ci.apu_data, str) else ci.apu_data
                if not isinstance(data, dict):
                    data = {}
            except Exception:
                data = {}

            if payload.description is not None:
                data["description"] = payload.description.strip()
            if payload.unit is not None:
                data["unit"] = payload.unit.strip()
            if payload.performance is not None and payload.performance > 0:
                data["performance"] = float(payload.performance)
            if payload.materials is not None:
                data["materials"] = [m.model_dump() for m in payload.materials]
            if payload.equipments is not None:
                data["equipments"] = [e.model_dump() for e in payload.equipments]
            if payload.labors is not None:
                data["labors"] = [l.model_dump() for l in payload.labors]

            ci.apu_data = json.dumps(data)
            db.commit()
            db.refresh(ci)

            resp = _build_custom_apu_response(ci, clean_code)
            partida_info = resp.get("partida", {})
            return {
                "status": "ok",
                "message": "APU personalizado actualizado correctamente",
                "item": {
                    "CodPar": partida_info.get("CodPar", clean_code),
                    "CovPar": partida_info.get("CovPar"),
                    "Descri": ci.description,
                    "UniPar": ci.unit,
                    "RenPar": ci.performance,
                    "PreUni": partida_info.get("PreUni", 0.0)
                }
            }

    updated_item = update_master_apu_details(
        db=db,
        item_code=clean_code,
        description=payload.description,
        unit=payload.unit,
        performance=payload.performance,
        materials=[m.model_dump() for m in payload.materials] if payload.materials is not None else None,
        equipments=[e.model_dump() for e in payload.equipments] if payload.equipments is not None else None,
        labors=[l.model_dump() for l in payload.labors] if payload.labors is not None else None
    )
    if not updated_item and clean_code != item_code:
        updated_item = update_master_apu_details(
            db=db,
            item_code=item_code,
            description=payload.description,
            unit=payload.unit,
            performance=payload.performance,
            materials=[m.model_dump() for m in payload.materials] if payload.materials is not None else None,
            equipments=[e.model_dump() for e in payload.equipments] if payload.equipments is not None else None,
            labors=[l.model_dump() for l in payload.labors] if payload.labors is not None else None
        )

    if not updated_item:
        ci = _find_custom_cost_item(db, clean_code, user_id=user_id, is_superadmin=is_superadmin) or _find_custom_cost_item(db, item_code, user_id=user_id, is_superadmin=is_superadmin)
        if ci:
            if not is_superadmin and ci.user_id is not None and user_id is not None and ci.user_id != user_id:
                raise HTTPException(status_code=403, detail="No tienes permisos para editar esta partida")
            if payload.description is not None:
                ci.description = payload.description.strip()
            if payload.unit is not None:
                ci.unit = payload.unit.strip()
            if payload.performance is not None and payload.performance > 0:
                ci.performance = float(payload.performance)
            try:
                data = json.loads(ci.apu_data) if isinstance(ci.apu_data, str) else ci.apu_data
                if not isinstance(data, dict):
                    data = {}
            except Exception:
                data = {}
            if payload.description is not None:
                data["description"] = payload.description.strip()
            if payload.unit is not None:
                data["unit"] = payload.unit.strip()
            if payload.performance is not None and payload.performance > 0:
                data["performance"] = float(payload.performance)
            if payload.materials is not None:
                data["materials"] = [m.model_dump() for m in payload.materials]
            if payload.equipments is not None:
                data["equipments"] = [e.model_dump() for e in payload.equipments]
            if payload.labors is not None:
                data["labors"] = [l.model_dump() for l in payload.labors]
            ci.apu_data = json.dumps(data)
            db.commit()
            db.refresh(ci)
            resp = _build_custom_apu_response(ci, clean_code)
            partida_info = resp.get("partida", {})
            return {
                "status": "ok",
                "message": "APU personalizado actualizado correctamente",
                "item": {
                    "CodPar": partida_info.get("CodPar", clean_code),
                    "CovPar": partida_info.get("CovPar"),
                    "Descri": ci.description,
                    "UniPar": ci.unit,
                    "RenPar": ci.performance,
                    "PreUni": partida_info.get("PreUni", 0.0)
                }
            }
        raise HTTPException(status_code=404, detail="Partida no encontrada")
    return {
        "status": "ok",
        "message": "APU actualizado correctamente",
        "item": {
            "CodPar": updated_item.CodPar,
            "CovPar": updated_item.CovPar,
            "Descri": updated_item.Descri,
            "UniPar": updated_item.UniPar,
            "RenPar": updated_item.RenPar,
            "PreUni": updated_item.PreUni
        }
    }


@router.put("/items/{item_code:path}")
def update_master_item_route(
    item_code: str,
    payload: MasterItemUpdate,
    database_id: str = "master",
    db: Session = Depends(get_db)
) -> Any:
    set_schema_for_db(db, database_id)
    clean_code = urllib.parse.unquote(item_code)
    updated_item = update_master_item(db, clean_code, payload.Descri, payload.UniPar, payload.RenPar)
    if not updated_item and clean_code != item_code:
        updated_item = update_master_item(db, item_code, payload.Descri, payload.UniPar, payload.RenPar)
    if not updated_item:
        raise HTTPException(status_code=404, detail=f"Partida '{clean_code}' no encontrada en la base de datos")
    return updated_item


@router.delete("/items/{item_code:path}")
def delete_master_item_route(
    item_code: str,
    database_id: str = "master",
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    set_schema_for_db(db, database_id)
    if not delete_master_item(db, item_code):
        raise HTTPException(status_code=404, detail="Partida no encontrada")
    return {"status": "ok"}
