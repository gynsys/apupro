"""
Budget export endpoints: Generate and stream formatted Excel workbooks.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.v1.endpoints.arko import get_current_arko_admin
from app.api.v1.endpoints.export_utils import generate_budget_excel_workbook
from app.core.logging import logger
from app.db.base import get_db
from app.db.models.arko import ArkoAdmin
from app.db.models.budget import Budget, BudgetItem
from app.schemas.budget import BudgetExportExcelRequest

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
