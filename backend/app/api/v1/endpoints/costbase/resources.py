from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.api.v1.endpoints.arko import get_optional_arko_admin
from app.db.models.arko import ArkoAdmin
from app.schemas.costbase import (
    CostMaterialUpdate,
    CostEquipmentUpdate,
    CostLaborUpdate
)
from app.crud.crud_costbase import (
    search_materials_paginated,
    search_equipments_paginated,
    search_labors_paginated,
    get_categories_tree_data,
    update_material,
    delete_material,
    update_equipment,
    delete_equipment,
    update_labor,
    delete_labor,
    get_database_by_id
)
from app.api.v1.endpoints.costbase.common import set_schema_for_db

router = APIRouter()


@router.get("/materials")
def search_materials_route(
    skip: int = 0,
    limit: int = 50,
    search: str = "",
    database_id: str = "master",
    all_items: Optional[bool] = None,
    current_user: Optional[ArkoAdmin] = Depends(get_optional_arko_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    is_superadmin = False
    if current_user:
        is_superadmin = (
            getattr(current_user, 'is_superadmin', False) or
            (current_user.email == 'admin@arko360.net') or
            getattr(current_user, 'role', '') in ['admin', 'superadmin']
        )
    set_schema_for_db(db, database_id)
    # Regla: Admin accede a base ampliada (all_items=True por defecto para admin).
    # Usuarios normales en base maestra solo ven insumos de partidas codificadas (all_items=False).
    if database_id and database_id != "master":
        effective_all_items = True
    elif is_superadmin:
        effective_all_items = True if all_items is None else all_items
    else:
        effective_all_items = False

    total, items = search_materials_paginated(db, skip, limit, search, all_items=effective_all_items)
    # Aplicar factor de inflación de materiales si la base no es maestra
    if database_id and database_id != "master":
        db_config = get_database_by_id(db, database_id)
        if db_config and db_config.material_inflation:
            factor = 1 + (db_config.material_inflation / 100.0)
            for item in items:
                item.CosMat = round((item.CosMat or 0.0) * factor, 4)

    serialized_items = [
        {
            "CodMat": item.CodMat,
            "ref_code": item.ref_code,
            "Descri": item.Descri,
            "UniMat": item.UniMat,
            "CosMat": item.CosMat,
            "family_id": item.family_id,
            "market_indicator_id": item.market_indicator_id,
            "market_factor": item.market_factor,
        }
        for item in items
    ]
    return {"total": total, "items": serialized_items}


@router.get("/equipments")
def search_equipments_route(
    skip: int = 0,
    limit: int = 50,
    search: str = "",
    database_id: str = "master",
    all_items: Optional[bool] = None,
    current_user: Optional[ArkoAdmin] = Depends(get_optional_arko_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    is_superadmin = False
    if current_user:
        is_superadmin = (
            getattr(current_user, 'is_superadmin', False) or
            (current_user.email == 'admin@arko360.net') or
            getattr(current_user, 'role', '') in ['admin', 'superadmin']
        )
    set_schema_for_db(db, database_id)
    # Regla: Admin accede a base ampliada (all_items=True por defecto para admin).
    # Usuarios normales en base maestra solo ven insumos de partidas codificadas (all_items=False).
    if database_id and database_id != "master":
        effective_all_items = True
    elif is_superadmin:
        effective_all_items = True if all_items is None else all_items
    else:
        effective_all_items = False

    total, items = search_equipments_paginated(db, skip, limit, search, all_items=effective_all_items)
    # Aplicar factor de inflación de equipos si la base no es maestra
    factor = 1.0
    if database_id and database_id != "master":
        db_config = get_database_by_id(db, database_id)
        if db_config and db_config.equipment_inflation:
            factor = 1 + (db_config.equipment_inflation / 100.0)

    serialized_items = []
    for item in items:
        dep = item.deprec_factor if (item.deprec_factor and item.deprec_factor > 0) else 1.0
        cos_dia = item.CosDia
        precio = item.precio
        if factor != 1.0:
            cos_dia = round((cos_dia or 0.0) * factor, 4)
            if precio is not None:
                precio = round((precio or 0.0) * factor, 2)
        if precio is None:
            precio = round((cos_dia or 0.0) / dep, 2)

        # Si deprec_factor no vino o es 1.0 pero el precio es alto y claramente el cos_dia es una tasa diaria:
        eff_deprec = item.deprec_factor
        if (eff_deprec is None or eff_deprec == 0 or eff_deprec == 1.0) and precio and cos_dia and precio > 0 and cos_dia > 0 and precio > cos_dia:
            eff_deprec = round(float(cos_dia) / float(precio), 6)

        serialized_items.append({
            "CodEqu": item.CodEqu,
            "ref_code": item.ref_code,
            "Descri": item.Descri,
            "CosDia": cos_dia,
            "precio": precio,
            "deprec_factor": eff_deprec if eff_deprec is not None else item.deprec_factor,
        })
    return {"total": total, "items": serialized_items}


@router.get("/labors")
def search_labors_route(
    skip: int = 0,
    limit: int = 50,
    search: str = "",
    database_id: str = "master",
    all_items: Optional[bool] = None,
    current_user: Optional[ArkoAdmin] = Depends(get_optional_arko_admin),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    is_superadmin = False
    if current_user:
        is_superadmin = (
            getattr(current_user, 'is_superadmin', False) or
            (current_user.email == 'admin@arko360.net') or
            getattr(current_user, 'role', '') in ['admin', 'superadmin']
        )
    set_schema_for_db(db, database_id)
    # Regla: Admin accede a base ampliada (all_items=True por defecto para admin).
    # Usuarios normales en base maestra solo ven insumos de partidas codificadas (all_items=False).
    if database_id and database_id != "master":
        effective_all_items = True
    elif is_superadmin:
        effective_all_items = True if all_items is None else all_items
    else:
        effective_all_items = False

    total, items = search_labors_paginated(db, skip, limit, search, all_items=effective_all_items)
    # Aplicar factor de inflación de mano de obra si la base no es maestra
    factor = 1.0
    if database_id and database_id != "master":
        db_config = get_database_by_id(db, database_id)
        if db_config and db_config.labor_inflation:
            factor = 1 + (db_config.labor_inflation / 100.0)

    serialized_items = []
    for item in items:
        jornal = item.Jornal
        bono = item.Bono
        if factor != 1.0:
            jornal = round((jornal or 0.0) * factor, 4)
            bono = round((bono or 0.0) * factor, 4)
        serialized_items.append({
            "CodMan": item.CodMan,
            "ref_code": item.ref_code,
            "Descri": item.Descri,
            "Jornal": jornal,
            "Bono": bono,
        })
    return {"total": total, "items": serialized_items}


@router.get("/categories_tree")
def get_categories_tree_route(db: Session = Depends(get_db)) -> Any:
    return get_categories_tree_data(db)


@router.patch("/materials/{codigo}")
def update_material_route(codigo: str, payload: CostMaterialUpdate, db: Session = Depends(get_db)) -> Any:
    mat = update_material(db, codigo, payload)
    if not mat:
        raise HTTPException(status_code=404, detail="Material no encontrado")
    return mat


@router.delete("/materials/{codigo}")
def delete_material_route(codigo: str, db: Session = Depends(get_db)) -> Dict[str, str]:
    if not delete_material(db, codigo):
        raise HTTPException(status_code=404, detail="Material no encontrado")
    return {"status": "ok"}


@router.patch("/equipments/{codigo}")
def update_equipment_route(codigo: str, payload: CostEquipmentUpdate, db: Session = Depends(get_db)) -> Any:
    eq = update_equipment(db, codigo, payload)
    if not eq:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    return eq


@router.delete("/equipments/{codigo}")
def delete_equipment_route(codigo: str, db: Session = Depends(get_db)) -> Dict[str, str]:
    if not delete_equipment(db, codigo):
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    return {"status": "ok"}


@router.patch("/labors/{codigo}")
def update_labor_route(codigo: str, payload: CostLaborUpdate, db: Session = Depends(get_db)) -> Any:
    labor = update_labor(db, codigo, payload)
    if not labor:
        raise HTTPException(status_code=404, detail="Mano de obra no encontrada")
    return labor


@router.delete("/labors/{codigo}")
def delete_labor_route(codigo: str, db: Session = Depends(get_db)) -> Dict[str, str]:
    if not delete_labor(db, codigo):
        raise HTTPException(status_code=404, detail="Mano de obra no encontrada")
    return {"status": "ok"}


@router.get("/materials/{material_id}/apus")
def get_material_apus(material_id: str, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """Devuelve las partidas (APUs) donde se usa este material."""
    query = text(r'''
        SELECT a."CodPar", i."Descri", i."CovPar"
        FROM cost360_apu_materials a 
        JOIN cost360_items i ON a."CodPar" = i."CodPar" 
        WHERE a."CodIns" = :cod AND i."CovPar" ~ '^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$'
    ''')
    rows = db.execute(query, {"cod": material_id}).fetchall()
    return [{"CodPar": r[0], "Descri": r[1], "CovPar": r[2]} for r in rows]


@router.get("/equipments/{equipment_id}/apus")
def get_equipment_apus(equipment_id: str, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """Devuelve las partidas (APUs) donde se usa este equipo."""
    query = text(r'''
        SELECT a."CodPar", i."Descri", i."CovPar"
        FROM cost360_apu_equipment a 
        JOIN cost360_items i ON a."CodPar" = i."CodPar" 
        WHERE a."CodIns" = :cod AND i."CovPar" ~ '^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$'
    ''')
    rows = db.execute(query, {"cod": equipment_id}).fetchall()
    return [{"CodPar": r[0], "Descri": r[1], "CovPar": r[2]} for r in rows]


@router.get("/labors/{labor_id}/apus")
def get_labor_apus(labor_id: str, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """Devuelve las partidas (APUs) donde se usa esta mano de obra."""
    query = text(r'''
        SELECT a."CodPar", i."Descri", i."CovPar"
        FROM cost360_apu_labor a 
        JOIN cost360_items i ON a."CodPar" = i."CodPar" 
        WHERE a."CodIns" = :cod AND i."CovPar" ~ '^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$'
    ''')
    rows = db.execute(query, {"cod": labor_id}).fetchall()
    return [{"CodPar": r[0], "Descri": r[1], "CovPar": r[2]} for r in rows]
