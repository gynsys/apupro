"""
Budget export endpoints: Generate and stream formatted Excel workbooks.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from app.api.v1.endpoints.arko import get_current_arko_admin
from app.api.v1.endpoints.export_utils import (
    generate_budget_excel_workbook,
    generate_budget_all_apus_excel_workbook,
)
from app.core.logging import logger
from app.db.base import get_db
from app.db.models.arko import ArkoAdmin
from app.db.models.budget import Budget, BudgetItem
from app.schemas.budget import BudgetExportExcelRequest
from app.services.code_mapping import apply_code_maps, build_code_maps

router = APIRouter()


@router.post("/{budget_id}/export-excel")
async def export_budget_excel(
    budget_id: str,
    payload: Optional[BudgetExportExcelRequest] = None,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> FileResponse:
    """Genera un archivo Excel (.xlsx) con formulas, capitulos, logo y formato profesional para el presupuesto."""
    if not budget_id:
        raise HTTPException(status_code=400, detail="ID de presupuesto inválido")

    try:
        budget = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == str(current_user.id)).first()
        if not budget:
            raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

        budget_dict: Dict[str, Any] = {
            "name": budget.name,
            "project_name": budget.project_name or budget.name,
            "obra": budget.project_name or budget.name,
            "ubicacion": getattr(budget, "ubicacion", "") or "",
            "client_name": budget.client_name or "",
            "company_rif": budget.company_rif or "",
            "currency": budget.currency or "USD",
            "iva_percent": float(budget.iva_percent if budget.iva_percent is not None else 16.0),
            "title": "PRESUPUESTO",
            "notes": budget.notes or "",
        }

        if payload:
            if payload.title:
                budget_dict["title"] = payload.title
            if payload.obra:
                budget_dict["obra"] = payload.obra
            if payload.ubicacion:
                budget_dict["ubicacion"] = payload.ubicacion
            if payload.contratante:
                budget_dict["contratante"] = payload.contratante
            if payload.company_rif:
                budget_dict["company_rif"] = payload.company_rif
            if payload.currency:
                budget_dict["currency"] = payload.currency
            if payload.iva_percent is not None:
                budget_dict["iva_percent"] = payload.iva_percent
            if payload.logo_base64:
                budget_dict["logo_base64"] = payload.logo_base64
            if payload.notes is not None:
                budget_dict["notes"] = payload.notes

        items_data: List[Dict[str, Any]] = []
        if payload and payload.items:
            items_data = [item.model_dump() for item in payload.items]
        else:
            db_items = db.query(BudgetItem).filter(BudgetItem.budget_id == budget_id).order_by(BudgetItem.order).all()
            for db_item in db_items:
                items_data.append({
                    "id": db_item.id,
                    "is_chapter": db_item.is_chapter,
                    "cod_par": db_item.cov_par or db_item.cod_par or "",
                    "description": db_item.description,
                    "unit": db_item.unit or "",
                    "quantity": float(db_item.quantity or 0.0),
                    "pu": 0.0,
                })

        file_path, filename = generate_budget_excel_workbook(budget_dict, items_data)

        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exportando presupuesto a Excel: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error al exportar presupuesto a Excel: {str(e)}")


@router.post("/{budget_id}/export-apus-excel")
async def export_budget_all_apus_excel(
    budget_id: str,
    payload: Optional[Dict[str, Any]] = Body(None),
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> FileResponse:
    """Genera un archivo Excel (.xlsx) con un libro de trabajo donde cada hoja corresponde a un APU del presupuesto."""
    if not budget_id:
        raise HTTPException(status_code=400, detail="ID de presupuesto inválido")

    try:
        budget = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == str(current_user.id)).first()
        if not budget:
            raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

        settings: Dict[str, Any] = {
            "name": budget.name,
            "project_name": budget.project_name or budget.name,
            "obra": budget.project_name or budget.name,
            "ubicacion": getattr(budget, "ubicacion", "") or "",
            "client_name": budget.client_name or "",
            "company_rif": budget.company_rif or "",
            "currency": budget.currency or "USD",
            "exchange_rate": float(budget.exchange_rate or 1.0),
            "admin_percent": float(budget.admin_percent if budget.admin_percent is not None else 15.0),
            "profit_percent": float(budget.profit_percent if budget.profit_percent is not None else 10.0),
            "iva_percent": float(budget.iva_percent if budget.iva_percent is not None else 16.0),
            "fcas_percent": float(budget.fcas_percent if budget.fcas_percent is not None else 417.0),
            "labor_bonus": float(budget.labor_bonus if budget.labor_bonus is not None else 0.0),
            "bono_in_fcas": bool(budget.bono_in_fcas),
        }

        if payload and isinstance(payload, dict):
            if "settings" in payload and isinstance(payload["settings"], dict):
                settings.update(payload["settings"])
            for key in [
                "project_name",
                "obra",
                "client_name",
                "contratante",
                "currency",
                "admin_percent",
                "profit_percent",
                "iva_percent",
                "fcas_percent",
                "labor_bonus",
                "bono_in_fcas",
            ]:
                if key in payload and payload[key] is not None:
                    settings[key] = payload[key]

        items_data: List[Dict[str, Any]] = []

        if payload and isinstance(payload.get("items"), list) and len(payload["items"]) > 0:
            for it in payload["items"]:
                if isinstance(it, dict):
                    if "materials" in it or "equipments" in it or "labors" in it:
                        items_data.append({
                            "item": it.get("item") if isinstance(it.get("item"), dict) else it,
                            "materials": it.get("materials") or [],
                            "equipments": it.get("equipments") or [],
                            "labors": it.get("labors") or [],
                        })
                    else:
                        items_data.append({"item": it, "materials": [], "equipments": [], "labors": []})

        if not items_data:
            db_items = (
                db.query(BudgetItem)
                .options(
                    joinedload(BudgetItem.materials),
                    joinedload(BudgetItem.equipments),
                    joinedload(BudgetItem.labors),
                )
                .filter(BudgetItem.budget_id == budget_id)
                .order_by(BudgetItem.order)
                .all()
            )

            for db_item in db_items:
                if db_item.is_chapter:
                    continue

                item_info: Dict[str, Any] = {
                    "id": db_item.id,
                    "is_chapter": False,
                    "cod_par": db_item.cod_par,
                    "cov_par": db_item.cov_par,
                    "CodPar": db_item.cod_par,
                    "CovPar": db_item.cov_par,
                    "description": db_item.description,
                    "Descri": db_item.description,
                    "unit": db_item.unit,
                    "UniPar": db_item.unit,
                    "quantity": float(db_item.quantity or 1.0),
                    "CanPar": float(db_item.quantity or 1.0),
                    "performance": float(db_item.performance or 1.0),
                    "RenPar": float(db_item.performance or 1.0),
                    "bono_in_fcas": budget.bono_in_fcas,
                    "labor_bonus": float(budget.labor_bonus or 0.0),
                }

                mats: List[Dict[str, Any]] = [
                    {
                        "codigo": m.codigo,
                        "Descri": m.descripcion,
                        "descripcion": m.descripcion,
                        "UniMat": m.unidad,
                        "unidad": m.unidad,
                        "CanIns": float(m.cantidad or 0.0),
                        "cantidad": float(m.cantidad or 0.0),
                        "Desper": float(m.desperdicio or 0.0),
                        "desperdicio": float(m.desperdicio or 0.0),
                        "CosMat": float(m.precio_unitario or 0.0),
                        "precio_unitario": float(m.precio_unitario or 0.0),
                    }
                    for m in db_item.materials
                ]

                eqs: List[Dict[str, Any]] = [
                    {
                        "codigo": e.codigo,
                        "Descri": e.descripcion,
                        "descripcion": e.descripcion,
                        "UniEq": e.unidad,
                        "unidad": e.unidad,
                        "CanIns": float(e.cantidad or 0.0),
                        "cantidad": float(e.cantidad or 0.0),
                        "Deprec": float(e.depreciacion if e.depreciacion is not None else 1.0),
                        "depreciacion": float(e.depreciacion if e.depreciacion is not None else 1.0),
                        "CosDia": float(e.precio_unitario or 0.0),
                        "precio_unitario": float(e.precio_unitario or 0.0),
                    }
                    for e in db_item.equipments
                ]

                mos: List[Dict[str, Any]] = [
                    {
                        "codigo": l.codigo,
                        "Descri": l.descripcion,
                        "descripcion": l.descripcion,
                        "CanIns": float(l.cantidad or 0.0),
                        "cantidad": float(l.cantidad or 0.0),
                        "Jornal": float(l.jornal or 0.0),
                        "jornal": float(l.jornal or 0.0),
                        "Bono": float(l.bono if l.bono is not None else 0.0),
                        "bono": float(l.bono if l.bono is not None else 0.0),
                    }
                    for l in db_item.labors
                ]

                items_data.append({
                    "item": item_info,
                    "materials": mats,
                    "equipments": eqs,
                    "labors": mos,
                })

        # Traducir códigos de referencia visibles al código interno de Maprex
        apply_code_maps(items_data, build_code_maps(db))

        budget_dict: Dict[str, Any] = {
            "name": budget.name,
            "project_name": budget.project_name or budget.name,
            "client_name": budget.client_name or "",
            "currency": budget.currency or "USD",
        }

        file_path, filename = generate_budget_all_apus_excel_workbook(budget_dict, items_data, settings=settings)

        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exportando APUs del presupuesto a Excel: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error al exportar APUs a Excel: {str(e)}")
