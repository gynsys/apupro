"""
Core budget management endpoints: CRUD, duplication, and logo upload.
"""
import shutil
import uuid
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
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
from app.middleware.plan_limits import check_budget_limit
from app.schemas.budget import (
    Budget as BudgetSchema,
    BudgetCreate,
    BudgetSummary,
    BudgetUpdate,
)
from .helpers import ensure_budget_share_columns

router = APIRouter()


@router.post("/", response_model=BudgetSchema, status_code=status.HTTP_201_CREATED)
def create_budget(
    budget_in: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Budget:
    """Crea un nuevo presupuesto para el usuario autenticado."""
    check_budget_limit(current_user)

    budget_data = budget_in.model_dump()
    budget_data["user_id"] = str(current_user.id)

    # Aplicar costos_config del usuario como defaults si no se enviaron valores explicitos
    costos = _get_costos_config(current_user)
    if budget_data.get("profit_percent") is None:
        budget_data["profit_percent"] = costos.porcentajeUtilidad
    if budget_data.get("admin_percent") is None:
        budget_data["admin_percent"] = costos.porcentajeAdministracion
    if budget_data.get("iva_percent") is None:
        budget_data["iva_percent"] = costos.iva
    if budget_data.get("fcas_percent") is None:
        budget_data["fcas_percent"] = costos.fcas
    if budget_data.get("bono_in_fcas") is None:
        budget_data["bono_in_fcas"] = getattr(costos, "fcasBonoInFcas", False)
    if budget_data.get("labor_bonus") is None:
        budget_data["labor_bonus"] = 0.0 if getattr(costos, "fcasBonoInFcas", False) else (getattr(costos, "fcasLaborBonus", 0.0) or 0.0)

    db_budget = Budget(**budget_data)
    db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    return db_budget


@router.get("/", response_model=List[BudgetSummary])
def get_budgets(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> List[Budget]:
    """Lista los presupuestos pertenecientes al usuario autenticado."""
    try:
        budgets = db.query(Budget).filter(Budget.user_id == str(current_user.id)).offset(skip).limit(limit).all()
    except Exception:
        db.rollback()
        ensure_budget_share_columns(db)
        budgets = db.query(Budget).filter(Budget.user_id == str(current_user.id)).offset(skip).limit(limit).all()
    return budgets


@router.get("/{budget_id}", response_model=BudgetSchema)
def get_budget(
    budget_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Budget:
    """Obtiene un presupuesto por ID si pertenece al usuario autenticado."""
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == str(current_user.id)).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    return budget


@router.put("/{budget_id}", response_model=BudgetSchema)
def update_budget(
    budget_id: str,
    budget_in: BudgetUpdate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Budget:
    """Actualiza la configuracion y cabecera de un presupuesto."""
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == str(current_user.id)).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    update_data = budget_in.model_dump(exclude_unset=True)
    if "project_name" in update_data and "name" not in update_data:
        update_data["name"] = update_data["project_name"]
    elif "name" in update_data and "project_name" not in update_data:
        update_data["project_name"] = update_data["name"]

    for field, value in update_data.items():
        setattr(budget, field, value)

    db.commit()
    db.refresh(budget)
    return budget


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(
    budget_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> None:
    """Elimina un presupuesto y todos sus items (cascade)."""
    budget = db.query(Budget).filter(
        Budget.id == budget_id,
        Budget.user_id == str(current_user.id),
    ).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(budget)
    db.commit()


@router.post("/{budget_id}/duplicate", response_model=BudgetSchema)
def duplicate_budget(
    budget_id: str,
    new_name: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Budget:
    """Duplica un presupuesto existente junto con todas sus partidas e insumos."""
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == str(current_user.id)).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    # 1. Duplicar Budget
    new_budget = Budget(
        user_id=str(current_user.id),
        name=new_name,
        currency=budget.currency,
        exchange_rate=budget.exchange_rate,
        material_inflation=budget.material_inflation,
        equipment_inflation=budget.equipment_inflation,
        labor_inflation=budget.labor_inflation,
        labor_bonus=budget.labor_bonus,
        admin_percent=budget.admin_percent,
        profit_percent=budget.profit_percent,
        fcas_percent=budget.fcas_percent,
        iva_percent=budget.iva_percent,
        project_name=budget.project_name,
        company_name=budget.company_name,
        company_rif=budget.company_rif,
        client_name=budget.client_name,
    )
    db.add(new_budget)
    db.commit()
    db.refresh(new_budget)

    # 2. Duplicar Items
    for item in budget.items:
        new_item = BudgetItem(
            budget_id=new_budget.id,
            cod_par=item.cod_par,
            cov_par=item.cov_par,
            description=item.description,
            unit=item.unit,
            quantity=item.quantity,
            performance=item.performance,
            order=item.order,
            is_chapter=item.is_chapter,
        )
        db.add(new_item)
        db.commit()
        db.refresh(new_item)

        # 3. Duplicar componentes APU del item
        for mat in item.materials:
            db.add(
                DBMaterial(
                    budget_item_id=new_item.id,
                    codigo=mat.codigo,
                    descripcion=mat.descripcion,
                    unidad=mat.unidad,
                    precio_unitario=mat.precio_unitario,
                    cantidad=mat.cantidad,
                    desperdicio=mat.desperdicio,
                )
            )
        for eq in item.equipments:
            db.add(
                DBEquipment(
                    budget_item_id=new_item.id,
                    codigo=eq.codigo,
                    descripcion=eq.descripcion,
                    unidad=eq.unidad,
                    precio_unitario=eq.precio_unitario,
                    cantidad=eq.cantidad,
                    depreciacion=eq.depreciacion,
                )
            )
        for lab in item.labors:
            db.add(
                DBLabor(
                    budget_item_id=new_item.id,
                    codigo=lab.codigo,
                    descripcion=lab.descripcion,
                    jornal=lab.jornal,
                    bono=lab.bono,
                    cantidad=lab.cantidad,
                )
            )

    db.commit()
    db.refresh(new_budget)
    return new_budget


@router.post("/{budget_id}/upload-logo")
async def upload_budget_logo(
    budget_id: str,
    logo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, str]:
    """Sube el logo de la empresa para un presupuesto especifico."""
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == str(current_user.id)).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    upload_dir = Path("public/company_logos")
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_extension = logo.filename.split(".")[-1].lower() if logo.filename else ""
    if file_extension not in ["png", "jpg", "jpeg"]:
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PNG, JPG o JPEG")

    unique_filename = f"{budget.id}_{uuid.uuid4().hex[:8]}.{file_extension}"
    file_path = upload_dir / unique_filename

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(logo.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error guardando el archivo: {str(e)}")

    logo_url = f"/company_logos/{unique_filename}"
    budget.company_logo = logo_url
    db.commit()

    return {"logo_url": logo_url}
