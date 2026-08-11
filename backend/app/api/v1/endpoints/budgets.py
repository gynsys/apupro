from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import os
import uuid
import shutil
from pathlib import Path
from fastapi.responses import FileResponse
from app.db.base import get_db
from app.db.models.budget import Budget, BudgetItem, BudgetAPUMaterial as DBMaterial, BudgetAPUEquipment as DBEquipment, BudgetAPULabor as DBLabor
from app.db.models.cost360 import CostItem, CostAPUMaterial, CostAPUEquipment, CostAPULabor
from app.schemas.budget import (
    Budget as BudgetSchema, BudgetCreate, BudgetUpdate, BudgetSummary, 
    BudgetItemCreate, BudgetItem as BudgetItemSchema, BudgetItemUpdate, 
    BudgetAPUMaterialBase, BudgetAPUMaterial, BudgetAPUMaterialUpdate,
    BudgetAPUEquipmentBase, BudgetAPUEquipment, BudgetAPUEquipmentUpdate,
    BudgetAPULaborBase, BudgetAPULabor, BudgetAPULaborUpdate
)

router = APIRouter()

@router.post("/", response_model=BudgetSchema, status_code=status.HTTP_201_CREATED)
def create_budget(budget_in: BudgetCreate, db: Session = Depends(get_db)):
    db_budget = Budget(**budget_in.model_dump())
    db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    return db_budget

@router.get("/", response_model=List[BudgetSummary])
def get_budgets(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    budgets = db.query(Budget).offset(skip).limit(limit).all()
    return budgets

@router.get("/{budget_id}", response_model=BudgetSchema)
def get_budget(budget_id: str, db: Session = Depends(get_db)):
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    return budget

@router.put("/{budget_id}", response_model=BudgetSchema)
def update_budget(budget_id: str, budget_in: BudgetUpdate, db: Session = Depends(get_db)):
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    update_data = budget_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(budget, field, value)
    
    db.commit()
    db.refresh(budget)
    return budget

@router.post("/{budget_id}/upload-logo")
async def upload_budget_logo(budget_id: str, logo: UploadFile = File(...), db: Session = Depends(get_db)):
    """Sube el logo de la empresa para un presupuesto específico"""
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    # Crear directorio para logos si no existe
    upload_dir = Path("public/company_logos")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Generar nombre único para el archivo
    file_extension = logo.filename.split('.')[-1].lower()
    if file_extension not in ['png', 'jpg', 'jpeg']:
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PNG, JPG o JPEG")
    
    unique_filename = f"{budget.id}_{uuid.uuid4().hex[:8]}.{file_extension}"
    file_path = upload_dir / unique_filename
    
    # Guardar el archivo
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(logo.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error guardando el archivo: {str(e)}")
    
    # Actualizar el presupuesto con la URL del logo
    logo_url = f"/company_logos/{unique_filename}"
    budget.company_logo = logo_url
    db.commit()
    
    return {"logo_url": logo_url}

@router.post("/{budget_id}/items", response_model=BudgetItemSchema)
def add_item_to_budget(budget_id: str, item_in: BudgetItemCreate, db: Session = Depends(get_db)):
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
        
    target_order = item_in.order
    if target_order <= 0:
        max_order = db.query(func.max(BudgetItem.order)).filter(BudgetItem.budget_id == budget_id).scalar() or 0
        target_order = max_order + 1
    else:
        db.query(BudgetItem).filter(
            BudgetItem.budget_id == budget_id,
            BudgetItem.order >= target_order
        ).update({BudgetItem.order: BudgetItem.order + 1})
    
    # 1. Crear el BudgetItem (excluir listas de insumos — no son columnas del modelo ORM)
    item_data = item_in.model_dump(exclude={"materials", "equipments", "labors"})
    item_data["order"] = target_order
    db_item = BudgetItem(**item_data, budget_id=budget_id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    # If it is a chapter, skip APU copying
    if item_in.is_chapter:
        return db_item
    
    # 2. Guardar el APU en BudgetAPU
    # PRIORIDAD: Si el frontend envió insumos pre-calculados (con factores de inflación aplicados),
    # se usan directamente. Si no, se copia desde la base maestra de Cost360 (comportamiento original).
    if item_in.materials is not None or item_in.equipments is not None or item_in.labors is not None:
        # --- Ruta A: Frontend proveyó los insumos (base personalizada con factores aplicados) ---
        for mat in (item_in.materials or []):
            db_mat = DBMaterial(
                budget_item_id=db_item.id,
                codigo=mat.codigo,
                descripcion=mat.descripcion,
                unidad=mat.unidad,
                precio_unitario=mat.precio_unitario,
                cantidad=mat.cantidad,
                desperdicio=mat.desperdicio or 0.0
            )
            db.add(db_mat)

        for eq in (item_in.equipments or []):
            db_eq = DBEquipment(
                budget_item_id=db_item.id,
                codigo=eq.codigo,
                descripcion=eq.descripcion,
                unidad=eq.unidad,
                precio_unitario=eq.precio_unitario,
                cantidad=eq.cantidad,
                depreciacion=eq.depreciacion or 1.0
            )
            db.add(db_eq)

        for lab in (item_in.labors or []):
            db_lab = DBLabor(
                budget_item_id=db_item.id,
                codigo=lab.codigo,
                descripcion=lab.descripcion,
                jornal=lab.jornal,
                bono=lab.bono,
                cantidad=lab.cantidad
            )
            db.add(db_lab)

    else:
        # --- Ruta B: Fallback — Copiar desde la base maestra de Cost360 sin factores ---
        cost_item = db.query(CostItem).filter(CostItem.CodPar == item_in.cod_par).first()
        if cost_item:
            for mat in cost_item.apu_materials:
                db_mat = DBMaterial(
                    budget_item_id=db_item.id,
                    codigo=mat.CodIns,
                    descripcion=mat.material.Descri if mat.material else "",
                    unidad=mat.material.UniMat if mat.material else "",
                    precio_unitario=(mat.material.CosMat if (mat.material and mat.material.CosMat is not None) else 0.0),
                    cantidad=mat.CanIns or 0.0,
                    desperdicio=mat.Desper or 0.0
                )
                db.add(db_mat)
                
            for eq in cost_item.apu_equipments:
                precio_diario_depreciado = eq.equipment.CosDia if (eq.equipment and eq.equipment.CosDia is not None) else 0.0
                depreciacion = eq.Deprec if (eq.Deprec is not None and eq.Deprec > 0) else 1.0
                precio_adquisicion = precio_diario_depreciado / depreciacion if depreciacion > 0 else precio_diario_depreciado
                
                db_eq = DBEquipment(
                    budget_item_id=db_item.id,
                    codigo=eq.CodIns,
                    descripcion=eq.equipment.Descri if eq.equipment else "",
                    unidad="Día",
                    precio_unitario=precio_adquisicion,
                    cantidad=eq.CanIns or 0.0,
                    depreciacion=eq.Deprec or 1.0
                )
                db.add(db_eq)
                
            for lab in cost_item.apu_labors:
                db_lab = DBLabor(
                    budget_item_id=db_item.id,
                    codigo=lab.CodIns,
                    descripcion=lab.labor.Descri if lab.labor else "",
                    jornal=(lab.labor.Jornal if (lab.labor and lab.labor.Jornal is not None) else 0.0),
                    bono=(lab.labor.Bono if (lab.labor and lab.labor.Bono is not None) else 0.0),
                    cantidad=lab.CanIns or 0.0
                )
                db.add(db_lab)
        
    db.commit()
    db.refresh(db_item)
        
    return db_item

@router.delete("/{budget_id}/items/{item_id}")
def delete_item_from_budget(budget_id: str, item_id: str, db: Session = Depends(get_db)):
    item = db.query(BudgetItem).filter(BudgetItem.id == item_id, BudgetItem.budget_id == budget_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}

@router.post("/{budget_id}/items/reorder")
def reorder_budget_items(budget_id: str, item_ids: List[str], db: Session = Depends(get_db)):
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
        
    for index, item_id in enumerate(item_ids):
        db.query(BudgetItem).filter(
            BudgetItem.id == item_id, 
            BudgetItem.budget_id == budget_id
        ).update({BudgetItem.order: index + 1})
        
    db.commit()
    return {"ok": True}

@router.post("/{budget_id}/duplicate", response_model=BudgetSchema)
def duplicate_budget(budget_id: str, new_name: str, db: Session = Depends(get_db)):
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    # 1. Duplicate Budget
    new_budget = Budget(
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
        client_name=budget.client_name
    )
    db.add(new_budget)
    db.commit()
    db.refresh(new_budget)
    
    # 2. Duplicate Items
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
            is_chapter=item.is_chapter
        )
        db.add(new_item)
        db.commit()
        db.refresh(new_item)
        
        # 3. Duplicate APU components for this item
        for mat in item.materials:
            db.add(DBMaterial(
                budget_item_id=new_item.id,
                codigo=mat.codigo,
                descripcion=mat.descripcion,
                unidad=mat.unidad,
                precio_unitario=mat.precio_unitario,
                cantidad=mat.cantidad,
                desperdicio=mat.desperdicio
            ))
        for eq in item.equipments:
            db.add(DBEquipment(
                budget_item_id=new_item.id,
                codigo=eq.codigo,
                descripcion=eq.descripcion,
                unidad=eq.unidad,
                precio_unitario=eq.precio_unitario,
                cantidad=eq.cantidad,
                depreciacion=eq.depreciacion
            ))
        for lab in item.labors:
            db.add(DBLabor(
                budget_item_id=new_item.id,
                codigo=lab.codigo,
                descripcion=lab.descripcion,
                jornal=lab.jornal,
                bono=lab.bono,
                cantidad=lab.cantidad
            ))
            
    db.commit()
    db.refresh(new_budget)
    return new_budget

@router.put("/{budget_id}/items/{item_id}", response_model=BudgetItemSchema)
def update_item_in_budget(budget_id: str, item_id: str, item_in: BudgetItemUpdate, db: Session = Depends(get_db)):
    db_budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not db_budget:
        raise HTTPException(status_code=404, detail="Budget not found")
        
    db_item = db.query(BudgetItem).filter(BudgetItem.id == item_id, BudgetItem.budget_id == budget_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found in budget")
        
    for key, value in item_in.dict(exclude_unset=True).items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

@router.post("/{budget_id}/items/{item_id}/materials", response_model=BudgetAPUMaterial)
def add_material_to_item(budget_id: str, item_id: str, material_in: BudgetAPUMaterialBase, db: Session = Depends(get_db)):
    db_item = db.query(BudgetItem).filter(BudgetItem.id == item_id, BudgetItem.budget_id == budget_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    db_material = DBMaterial(
        budget_item_id=item_id,
        **material_in.dict()
    )
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return db_material

@router.post("/{budget_id}/items/{item_id}/equipments", response_model=BudgetAPUEquipment)
def add_equipment_to_item(budget_id: str, item_id: str, equipment_in: BudgetAPUEquipmentBase, db: Session = Depends(get_db)):
    db_item = db.query(BudgetItem).filter(BudgetItem.id == item_id, BudgetItem.budget_id == budget_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    db_equipment = DBEquipment(
        budget_item_id=item_id,
        **equipment_in.dict()
    )
    db.add(db_equipment)
    db.commit()
    db.refresh(db_equipment)
    return db_equipment

@router.post("/{budget_id}/items/{item_id}/labors", response_model=BudgetAPULabor)
def add_labor_to_item(budget_id: str, item_id: str, labor_in: BudgetAPULaborBase, db: Session = Depends(get_db)):
    db_item = db.query(BudgetItem).filter(BudgetItem.id == item_id, BudgetItem.budget_id == budget_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    db_labor = DBLabor(
        budget_item_id=item_id,
        **labor_in.dict()
    )
    db.add(db_labor)
    db.commit()
    db.refresh(db_labor)
    return db_labor

@router.put("/{budget_id}/items/{item_id}/materials/{component_id}", response_model=BudgetAPUMaterial)
def update_material_in_item(budget_id: str, item_id: str, component_id: str, comp_in: BudgetAPUMaterialUpdate, db: Session = Depends(get_db)):
    comp = db.query(DBMaterial).filter(DBMaterial.id == component_id, DBMaterial.budget_item_id == item_id).first()
    if not comp: raise HTTPException(status_code=404, detail="Material not found")
    for key, value in comp_in.dict(exclude_unset=True).items():
        setattr(comp, key, value)
    db.commit()
    db.refresh(comp)
    return comp

@router.put("/{budget_id}/items/{item_id}/equipments/{component_id}", response_model=BudgetAPUEquipment)
def update_equipment_in_item(budget_id: str, item_id: str, component_id: str, comp_in: BudgetAPUEquipmentUpdate, db: Session = Depends(get_db)):
    comp = db.query(DBEquipment).filter(DBEquipment.id == component_id, DBEquipment.budget_item_id == item_id).first()
    if not comp: raise HTTPException(status_code=404, detail="Equipment not found")
    for key, value in comp_in.dict(exclude_unset=True).items():
        setattr(comp, key, value)
    db.commit()
    db.refresh(comp)
    return comp

@router.put("/{budget_id}/items/{item_id}/labors/{component_id}", response_model=BudgetAPULabor)
def update_labor_in_item(budget_id: str, item_id: str, component_id: str, comp_in: BudgetAPULaborUpdate, db: Session = Depends(get_db)):
    comp = db.query(DBLabor).filter(DBLabor.id == component_id, DBLabor.budget_item_id == item_id).first()
    if not comp: raise HTTPException(status_code=404, detail="Labor not found")
    for key, value in comp_in.dict(exclude_unset=True).items():
        setattr(comp, key, value)
    db.commit()
    db.refresh(comp)
    return comp

@router.delete("/{budget_id}/items/{item_id}/materials/{component_id}")
def delete_material_from_item(budget_id: str, item_id: str, component_id: str, db: Session = Depends(get_db)):
    comp = db.query(DBMaterial).filter(DBMaterial.id == component_id, DBMaterial.budget_item_id == item_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Material not found")
    db.delete(comp)
    db.commit()
    return {"ok": True}

@router.delete("/{budget_id}/items/{item_id}/equipments/{component_id}")
def delete_equipment_from_item(budget_id: str, item_id: str, component_id: str, db: Session = Depends(get_db)):
    comp = db.query(DBEquipment).filter(DBEquipment.id == component_id, DBEquipment.budget_item_id == item_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Equipment not found")
    db.delete(comp)
    db.commit()
    return {"ok": True}

@router.delete("/{budget_id}/items/{item_id}/labors/{component_id}")
def delete_labor_from_item(budget_id: str, item_id: str, component_id: str, db: Session = Depends(get_db)):
    comp = db.query(DBLabor).filter(DBLabor.id == component_id, DBLabor.budget_item_id == item_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Labor not found")
    db.delete(comp)
    db.commit()
    return {"ok": True}

@router.post("/{budget_id}/sync_prices")
def sync_budget_prices(budget_id: str, db: Session = Depends(get_db)):
    from app.db.models.cost360 import CostMaterial, CostEquipment, CostLabor
    
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
        
    for item in budget.items:
        # Sync Materials
        for mat in item.materials:
            cost_mat = db.query(CostMaterial).filter(CostMaterial.CodMat == mat.codigo).first()
            if cost_mat:
                mat.precio_unitario = cost_mat.CosMat if cost_mat.CosMat is not None else 0.0
                mat.descripcion = cost_mat.Descri if cost_mat.Descri is not None else mat.descripcion
                
        # Sync Equipment
        for eq in item.equipments:
            cost_eq = db.query(CostEquipment).filter(CostEquipment.CodEqu == eq.codigo).first()
            if cost_eq:
                eq.precio_unitario = cost_eq.CosDia if cost_eq.CosDia is not None else 0.0
                eq.descripcion = cost_eq.Descri if cost_eq.Descri is not None else eq.descripcion
                
        # Sync Labor
        for lab in item.labors:
            cost_lab = db.query(CostLabor).filter(CostLabor.CodMan == lab.codigo).first()
            if cost_lab:
                lab.jornal = cost_lab.Jornal if cost_lab.Jornal is not None else 0.0
                lab.bono = cost_lab.Bono if cost_lab.Bono is not None else 0.0
                lab.descripcion = cost_lab.Descri if cost_lab.Descri is not None else lab.descripcion
                
    db.commit()
    return {"status": "ok", "message": "Precios sincronizados con la Base Maestra"}

@router.post("/{budget_id}/export-excel")
async def export_budget_excel(budget_id: str, db: Session = Depends(get_db)):
    """Genera un archivo Excel con fórmulas para el presupuesto"""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, PatternFill
        
        budget = db.query(Budget).filter(Budget.id == budget_id).first()
        if not budget:
            raise HTTPException(status_code=404, detail="Budget not found")
        
        # Obtener items del presupuesto
        items = db.query(BudgetItem).filter(BudgetItem.budget_id == budget_id).all()
        
        # Crear workbook de Excel
        wb = Workbook()
        ws = wb.active
        ws.title = "Presupuesto"
        
        # Estilos
        header_style = PatternFill(start_color="4CAF50", end_color="4CAF50", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF", size=11)
        total_style = PatternFill(start_color="E8F5E9", end_color="E8F5E9", fill_type="solid")
        total_font = Font(bold=True, size=11)
        currency_format = '#,##0.00'
        
        # Header
        ws.merge_cells("B1:H1")
        ws["B1"] = budget.project_name or "PRESUPUESTO"
        ws["B1"].fill = header_style
        ws["B1"].font = header_font
        
        ws.merge_cells("B2:H2")
        ws["B2"] = f"Obra: {budget.project_name or 'N/A'}"
        
        if budget.client_name:
            ws.merge_cells("B3:H3")
            ws["B3"] = f"Contratante: {budget.client_name}"
        
        if budget.company_rif:
            ws.merge_cells("B4:H4")
            ws["B4"] = f"RIF: {budget.company_rif}"
        
        # Encabezados de tabla
        headers = ["Part. No", "Código COVENIN", "Descripción", "Unidad", "Cantidad", "Precio Unitario", "Total"]
        for i, header in enumerate(headers):
            cell = ws.cell(6, i + 2)
            cell.value = header
            cell.fill = header_style
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center")
        
        # Filas de datos
        row_num = 7
        part_number = 1
        first_data_row = row_num
        
        for item in items:
            if not item.is_chapter:
                # Calcular precio unitario (lógica simplificada)
                pu = item.unit_price or 0
                total = pu * item.quantity
                
                ws.cell(row_num, 2, part_number)
                ws.cell(row_num, 3, item.cov_par or item.cod_par or '')
                ws.cell(row_num, 4, item.description)
                ws.cell(row_num, 5, item.unit)
                ws.cell(row_num, 6, item.quantity)
                ws.cell(row_num, 7, pu).number_format = currency_format
                ws.cell(row_num, 8, f"=RC[-1]*RC[-2]").number_format = currency_format
                
                part_number += 1
                row_num += 1
        
        last_data_row = row_num - 1
        
        # Totales
        ws.cell(row_num, 2, "Total (Sin I.V.A.):")
        ws.cell(row_num, 2).font = total_font
        ws.cell(row_num, 8, f"=SUM(H{first_data_row}:H{last_data_row})").number_format = currency_format
        ws.cell(row_num, 8).fill = total_style
        ws.cell(row_num, 8).font = total_font
        
        row_num += 1
        iva_percent = budget.iva_percent or 16
        ws.cell(row_num, 2, f"I.V.A. ({iva_percent}%):")
        ws.cell(row_num, 2).font = total_font
        ws.cell(row_num, 8, f"=R[-1]C*{iva_percent/100}").number_format = currency_format
        ws.cell(row_num, 8).fill = total_style
        ws.cell(row_num, 8).font = total_font
        
        row_num += 1
        ws.cell(row_num, 2, "Total General:")
        ws.cell(row_num, 2).font = total_font
        ws.cell(row_num, 8, "=R[-2]C+R[-1]C").number_format = currency_format
        ws.cell(row_num, 8).fill = total_style
        ws.cell(row_num, 8).font = total_font
        
        # Ajustar anchos de columnas
        ws.column_dimensions['B'] = 8
        ws.column_dimensions['C'] = 20
        ws.column_dimensions['D'] = 40
        ws.column_dimensions['E'] = 10
        ws.column_dimensions['F'] = 12
        ws.column_dimensions['G'] = 15
        ws.column_dimensions['H'] = 15
        
        # Guardar archivo temporal
        temp_dir = Path("temp")
        temp_dir.mkdir(exist_ok=True)
        import re
        filename = f"{re.sub(r'[^a-z0-9]', '_', budget.name.lower())}.xlsx"
        file_path = temp_dir / filename
        
        wb.save(file_path)
        
        return FileResponse(path=str(file_path), filename=filename)
    except Exception as e:
        import traceback
        print(f"Error exportando Excel: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error al exportar: {str(e)}")

@router.post("/{budget_id}/upload-logo")
async def upload_budget_logo(budget_id: str, logo: UploadFile = File(...), db: Session = Depends(get_db)):
    """Sube el logo de la empresa para un presupuesto específico"""
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    # Crear directorio para logos si no existe
    upload_dir = Path("public/company_logos")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Generar nombre único para el archivo
    file_extension = logo.filename.split('.')[-1].lower()
    if file_extension not in ['png', 'jpg', 'jpeg']:
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PNG, JPG o JPEG")
    
    unique_filename = f"{budget.id}_{uuid.uuid4().hex[:8]}.{file_extension}"
    file_path = upload_dir / unique_filename
    
    # Guardar el archivo
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(logo.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error guardando el archivo: {str(e)}")
    
    # Actualizar el presupuesto con la URL del logo
    logo_url = f"/company_logos/{unique_filename}"
    budget.company_logo = logo_url
    db.commit()
    
    return {"logo_url": logo_url}