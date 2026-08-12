from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
from pathlib import Path

from app.db.base import get_db
from app.schemas.cost360 import (
    CostItemListResponse, APUResponse, APUComponent,
    CostMaterialUpdate, CostEquipmentUpdate, CostLaborUpdate,
    AiApuGenerateRequest, CustomCostItemCreate, CustomCostItemResponse,
    Cost360DatabaseCreate, Cost360DatabaseUpdate, Cost360DatabaseListResponse
)

# Import Services and CRUD
from app.crud.crud_cost360 import (
    get_items_paginated, get_item_by_code,
    get_apu_materials, get_apu_equipments, get_apu_labors,
    search_materials_paginated, search_equipments_paginated, search_labors_paginated,
    get_categories_tree_data,
    update_material, delete_material,
    update_equipment, delete_equipment,
    update_labor, delete_labor,
    save_custom_apu,
    get_all_databases, get_database_by_id, create_database, update_database, delete_database
)
from app.services.preprocessing_service import preprocess_apu_data
from app.services.ai_apu_service import generate_apu_with_ai

router = APIRouter()

@router.get("/items", response_model=CostItemListResponse)
def get_items(skip: int = 0, limit: int = 50, search: Optional[str] = None, chapter: Optional[str] = None, categoria: Optional[str] = None, tipo_actividad: Optional[str] = None, search_desc: bool = True, search_insumos: bool = False, covenin: Optional[str] = None, database_id: str = "master", db: Session = Depends(get_db)):
    total, items = get_items_paginated(db, skip, limit, search, chapter, categoria, tipo_actividad, search_desc, search_insumos, covenin, database_id)
    return {"total": total, "items": items}


def _get_db_factors(db: Session, database_id: str) -> dict:
    """Obtener los factores de inflación de una base de datos por su ID."""
    if not database_id or database_id == 'master':
        return {"mat": 1.0, "lab": 1.0, "eq": 1.0}
    db_config = get_database_by_id(db, database_id)
    if not db_config:
        return {"mat": 1.0, "lab": 1.0, "eq": 1.0}
    return {
        "mat": 1 + (db_config.material_inflation or 0.0) / 100.0,
        "lab": 1 + (db_config.labor_inflation or 0.0) / 100.0,
        "eq": 1 + (db_config.equipment_inflation or 0.0) / 100.0,
    }

@router.get("/items/{item_code}/apu", response_model=APUResponse)
def get_apu(item_code: str, database_id: str = "master", db: Session = Depends(get_db)):
    if item_code.startswith("CUST-"):
        from app.db.models.cost360 import CustomCostItem
        import json
        custom_items = db.query(CustomCostItem).all()
        for ci in custom_items:
            try:
                data = json.loads(ci.apu_data)
                cod = data.get("cod_par") or ("CUST-" + ci.id[:4].upper())
                if cod == item_code:
                    partida = {
                        "CodPar": cod,
                        "Descri": ci.description,
                        "UniPar": ci.unit,
                        "RenPar": ci.performance
                    }
                    materials = [
                        APUComponent(codigo=m.get('id',''), descripcion=m.get('descripcion',''), unidad=m.get('unidad',''), cantidad=m.get('cantidad',0), precio_unitario=m.get('precio_unitario',0), subtotal=m.get('cantidad',0)*m.get('precio_unitario',0)*(1+m.get('desperdicio',0)/100), desperdicio=m.get('desperdicio',0)) for m in data.get('materials', [])
                    ]
                    equipments = [
                        APUComponent(codigo=e.get('id',''), descripcion=e.get('descripcion',''), unidad=e.get('unidad',''), cantidad=e.get('cantidad',0), precio_unitario=e.get('precio_unitario',0), subtotal=e.get('cantidad',0)*e.get('precio_unitario',0)*(e.get('depreciacion',1.0)), depreciacion=e.get('depreciacion',1.0)) for e in data.get('equipments', [])
                    ]
                    labors = [
                        APUComponent(codigo=l.get('id',''), descripcion=l.get('descripcion',''), unidad=l.get('unidad',''), cantidad=l.get('cantidad',0), precio_unitario=l.get('jornal',0), subtotal=l.get('cantidad',0)*l.get('jornal',0), jornal=l.get('jornal',0), bono=l.get('bono',0)) for l in data.get('labors', [])
                    ]
                    return {"partida": partida, "materiales": materials, "equipos": equipments, "manoObra": labors}
            except:
                continue
        raise HTTPException(status_code=404, detail="Partida personalizada no encontrada")

    item = get_item_by_code(db, item_code)
    if not item:
        raise HTTPException(status_code=404, detail="Partida no encontrada")

    factors = _get_db_factors(db, database_id)

    mat_results = get_apu_materials(db, item_code)
    materiales = []
    for rel, mat in mat_results:
        desperdicio = rel.Desper if hasattr(rel, 'Desper') and rel.Desper else 0.0
        precio = (mat.CosMat or 0.0) * factors["mat"]
        subtotal = rel.CanIns * precio * (1 + (desperdicio / 100.0))
        materiales.append(APUComponent(
            codigo=mat.CodMat, descripcion=mat.Descri, unidad=mat.UniMat, cantidad=rel.CanIns,
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
            codigo=eq.CodEqu, descripcion=eq.Descri, unidad="Día", cantidad=rel.CanIns,
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
            codigo=mo.CodMan, descripcion=mo.Descri, unidad="Día", cantidad=rel.CanIns,
            precio_unitario=round(precio, 2), subtotal=round(subtotal, 2),
            jornal=round(jornal, 4), bono=round(bono, 4),
            tot_jornal=round(tot_jornal, 2), tot_bono=round(tot_bono, 2)
        ))

    total_directo = sum(c.subtotal for c in materiales) + sum(c.subtotal for c in equipos) + sum(c.subtotal for c in mano_obra)

    return APUResponse(
        partida=item, materiales=materiales, equipos=equipos, mano_obra=mano_obra, total_directo=round(total_directo, 2)
    )

@router.get("/materials")
def search_materials_route(skip: int = 0, limit: int = 50, search: str = "", database_id: str = "master", db: Session = Depends(get_db)):
    total, items = search_materials_paginated(db, skip, limit, search)
    # Aplicar factor de inflación de materiales si la base no es maestra
    if database_id and database_id != "master":
        db_config = get_database_by_id(db, database_id)
        if db_config and db_config.material_inflation:
            factor = 1 + (db_config.material_inflation / 100.0)
            for item in items:
                item.CosMat = round((item.CosMat or 0.0) * factor, 4)
    return {"total": total, "items": items}

@router.get("/equipments")
def search_equipments_route(skip: int = 0, limit: int = 50, search: str = "", database_id: str = "master", db: Session = Depends(get_db)):
    total, items = search_equipments_paginated(db, skip, limit, search)
    # Aplicar factor de inflación de equipos si la base no es maestra
    if database_id and database_id != "master":
        db_config = get_database_by_id(db, database_id)
        if db_config and db_config.equipment_inflation:
            factor = 1 + (db_config.equipment_inflation / 100.0)
            for item in items:
                item.CosDia = round((item.CosDia or 0.0) * factor, 4)
    return {"total": total, "items": items}

@router.get("/labors")
def search_labors_route(skip: int = 0, limit: int = 50, search: str = "", database_id: str = "master", db: Session = Depends(get_db)):
    total, items = search_labors_paginated(db, skip, limit, search)
    # Aplicar factor de inflación de mano de obra si la base no es maestra
    if database_id and database_id != "master":
        db_config = get_database_by_id(db, database_id)
        if db_config and db_config.labor_inflation:
            factor = 1 + (db_config.labor_inflation / 100.0)
            for item in items:
                item.Jornal = round((item.Jornal or 0.0) * factor, 4)
                item.Bono = round((item.Bono or 0.0) * factor, 4)
    return {"total": total, "items": items}

@router.get("/categories_tree")
def get_categories_tree_route(db: Session = Depends(get_db)):
    return get_categories_tree_data(db)

@router.patch("/materials/{codigo}")
def update_material_route(codigo: str, payload: CostMaterialUpdate, db: Session = Depends(get_db)):
    mat = update_material(db, codigo, payload)
    if not mat: raise HTTPException(status_code=404, detail="Material no encontrado")
    return mat

@router.delete("/materials/{codigo}")
def delete_material_route(codigo: str, db: Session = Depends(get_db)):
    if not delete_material(db, codigo): raise HTTPException(status_code=404, detail="Material no encontrado")
    return {"status": "ok"}

@router.patch("/equipments/{codigo}")
def update_equipment_route(codigo: str, payload: CostEquipmentUpdate, db: Session = Depends(get_db)):
    eq = update_equipment(db, codigo, payload)
    if not eq: raise HTTPException(status_code=404, detail="Equipo no encontrado")
    return eq

@router.delete("/equipments/{codigo}")
def delete_equipment_route(codigo: str, db: Session = Depends(get_db)):
    if not delete_equipment(db, codigo): raise HTTPException(status_code=404, detail="Equipo no encontrado")
    return {"status": "ok"}

@router.patch("/labors/{codigo}")
def update_labor_route(codigo: str, payload: CostLaborUpdate, db: Session = Depends(get_db)):
    labor = update_labor(db, codigo, payload)
    if not labor: raise HTTPException(status_code=404, detail="Mano de obra no encontrada")
    return labor

@router.delete("/labors/{codigo}")
def delete_labor_route(codigo: str, db: Session = Depends(get_db)):
    if not delete_labor(db, codigo): raise HTTPException(status_code=404, detail="Mano de obra no encontrada")
    return {"status": "ok"}

@router.post("/generate-ai-apu")
def generate_ai_apu_route(payload: AiApuGenerateRequest, db: Session = Depends(get_db)):
    # 1. Preprocesamiento (BD + Estadísticas)
    payload_llm = preprocess_apu_data(db, payload.description, payload.covenin_prefix, payload.covenin_context)
    
    # 1.5. Cortocircuito si hay Match Exacto
    if payload_llm.get("modo") == "partida_exacta_encontrada":
        cod_par = payload_llm.get("partida_exacta_codigo")
        item = get_item_by_code(db, cod_par)
        if item:
            mat_results = get_apu_materials(db, cod_par)
            eq_results = get_apu_equipments(db, cod_par)
            mo_results = get_apu_labors(db, cod_par)
            
            materials = []
            for rel, mat in mat_results:
                materials.append({
                    "id": f"m-{mat.CodMat}",
                    "codigo": mat.CodMat,
                    "descripcion": mat.Descri,
                    "unidad": mat.UniMat,
                    "cantidad": rel.CanIns,
                    "desperdicio": getattr(rel, 'Desper', 0.0) or 0.0,
                    "precio_unitario": mat.CosMat or 0.0,
                    "origen": "historico",
                    "nota_calculo": "Extraído de la base de datos maestra."
                })
            
            equipments = []
            for rel, eq in eq_results:
                equipments.append({
                    "id": f"e-{eq.CodEqu}",
                    "codigo": eq.CodEqu,
                    "descripcion": eq.Descri,
                    "unidad": "día",
                    "cantidad": rel.CanIns,
                    "depreciacion": getattr(rel, 'Deprec', 1.0) or 1.0,
                    "precio_unitario": eq.CosDia or 0.0,
                    "origen": "historico",
                    "nota_calculo": "Extraído de la base de datos maestra."
                })
                
            labors = []
            for rel, mo in mo_results:
                labors.append({
                    "id": f"l-{mo.CodMan}",
                    "codigo": mo.CodMan,
                    "descripcion": mo.Descri,
                    "unidad": "día",
                    "cantidad": rel.CanIns,
                    "jornal": mo.Jornal or 0.0,
                    "bono": mo.Bono or 0.0,
                    "precio_unitario": (mo.Jornal or 0.0) + (mo.Bono or 0.0),
                    "origen": "historico",
                    "nota_calculo": "Extraído de la base de datos maestra."
                })

            return {
                "partida": {
                    "cod_par": item.CodPar,
                    "description": item.Descri,
                    "unit": item.UniPar,
                    "quantity": 1.0,
                    "performance": getattr(item, 'RenPar', 1.0) or 1.0
                },
                "materials": materials,
                "equipments": equipments,
                "labors": labors,
                "advertencias": [
                    f"¡MATCH EXACTO! Ingresaste una descripción idéntica a la partida certificada [{item.CodPar}] de la base de datos. Para evitar distorsionar costos, te hemos entregado el APU original sin usar Inteligencia Artificial."
                ]
            }

    # 2. Generación con IA (LLM Router)
    result = generate_apu_with_ai(payload_llm)
    
    return result

@router.post("/custom-apus", response_model=CustomCostItemResponse)
def save_custom_apu_route(payload: CustomCostItemCreate, db: Session = Depends(get_db)):
    new_item = save_custom_apu(db, payload.description, payload.unit, payload.performance, payload.apu_data)
    return new_item

# Database Management Endpoints
@router.get("/databases", response_model=Cost360DatabaseListResponse)
def list_databases(db: Session = Depends(get_db)):
    """Listar todas las bases de datos Cost360 disponibles"""
    databases = get_all_databases(db)
    return {"databases": databases}

@router.post("/databases/initialize")
def initialize_master_database(db: Session = Depends(get_db)):
    """Inicializar la base de datos maestra si no existe"""
    from app.db.models.cost360_database import Cost360Database
    from sqlalchemy import text
    
    # Verificar si la tabla existe
    try:
        db.execute(text("SELECT 1 FROM cost360_databases LIMIT 1"))
    except:
        # Crear tabla si no existe
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS cost360_databases (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                is_master BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                material_inflation FLOAT DEFAULT 0,
                labor_inflation FLOAT DEFAULT 0,
                equipment_inflation FLOAT DEFAULT 0,
                source_database_id VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_by VARCHAR(255)
            )
        """))
        db.commit()
    
    # Verificar si existe la base maestra
    master_db = db.query(Cost360Database).filter(Cost360Database.id == 'master').first()
    
    if not master_db:
        master_db = Cost360Database(
            id='master',
            name='Base Maestra',
            description='Base de datos principal del sistema (Inmutable)',
            is_master=True,
            created_by='system'
        )
        db.add(master_db)
        db.commit()

    # Verificar si existe la base personalizada
    personalizada_db = db.query(Cost360Database).filter(Cost360Database.id == 'personalizada').first()
    
    if not personalizada_db:
        personalizada_db = Cost360Database(
            id='personalizada',
            name='Base Personalizada',
            description='Base de datos para guardar tus APUs creados desde cero o con IA',
            is_master=False,
            created_by='system'
        )
        db.add(personalizada_db)
        db.commit()
        
    return {"message": "Base de datos inicializada correctamente"}

@router.get("/databases/{database_id}")
def get_database(database_id: str, db: Session = Depends(get_db)):
    """Obtener detalles de una base de datos específica"""
    database = get_database_by_id(db, database_id)
    if not database:
        raise HTTPException(status_code=404, detail="Base de datos no encontrada")
    return database

@router.post("/databases")
def create_database_route(payload: Cost360DatabaseCreate, db: Session = Depends(get_db)):
    """
    Crear una nueva base de datos duplicando de una existente con índices de inflación
    
    Ejemplo de uso:
    - Duplicar Base Maestra con 10% inflación en materiales para crear "Base Julio 2024"
    - Duplicar Base Personalizada con 5% inflación en mano de obra
    """
    try:
        new_database = create_database(db, payload)
        return new_database
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/databases/{database_id}")
def update_database_route(database_id: str, payload: Cost360DatabaseUpdate, db: Session = Depends(get_db)):
    """Actualizar metadatos de una base de datos (nombre, descripción, estado activo)"""
    try:
        updated_database = update_database(db, database_id, payload)
        if not updated_database:
            raise HTTPException(status_code=404, detail="Base de datos no encontrada")
        return updated_database
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/apu/{item_id}/export-excel")
async def export_apu_excel(item_id: str, db: Session = Depends(get_db)):
    """Genera un archivo Excel con fórmulas nativas usando el formato del script de referencia apu_formulas.py"""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
        from openpyxl.utils import get_column_letter
        from pathlib import Path

        # Obtener la partida principal
        try:
            item = get_item_by_code(db, item_id.split('-')[0])
        except Exception:
            raise HTTPException(status_code=404, detail="Item not found")

        # Obtener APU
        mat_rows = get_apu_materials(db, item_id)
        eq_rows = get_apu_equipments(db, item_id)
        mo_rows = get_apu_labors(db, item_id)

        rendimiento = item.RenPar or 1.0
        admin_gg = 16.0
        imprevisto_ut = 10.0
        financiamiento = 0.0
        iva = 0.0
        otros_imp = 0.0
        prestaciones = 435.0

        # Crear workbook
        wb = Workbook()
        ws = wb.active
        ws.title = f"APU_{item.CovPar or item.CodPar}"

        # Helper para estilos
        def style_cell(cell, bold=False, size=11, align="left", border=False, number_format=None):
            cell.font = Font(bold=bold, size=size, name="Calibri")
            cell.alignment = Alignment(horizontal=align, vertical="center", wrap_text=True)
            if border:
                thin = Side(style='thin')
                cell.border = Border(left=thin, right=thin, top=thin, bottom=thin)
            if number_format:
                cell.number_format = number_format

        # HEADER (Formato del script de referencia)
        ws.merge_cells("B1:H1")
        ws["B1"] = "ANÁLISIS DE PRECIO UNITARIO"
        style_cell(ws["B1"], bold=True, size=14, align="center")
        
        # B3: Obra - usar item.Descri como nombre de obra por ahora, dejar vacío si no hay
        obra_nombre = item.Descri if item.Descri else ''
        ws["B3"] = f"Obra: {obra_nombre}" if obra_nombre else "Obra:"
        
        # B4: Contratante - dejar vacío si no hay
        ws["B4"] = ""  # Dejar vacío hasta que tengamos datos del contratante
        ws["E5"] = "Part. No.:"
        ws["F5"] = "1"
        ws["G5"] = "Fecha:"
        from datetime import datetime
        ws["H5"] = datetime.now().strftime("%d/%m/%Y")
        ws["B6"] = "Descripción:"
        style_cell(ws["B6"], size=7)
        ws.merge_cells("C6:H6")
        ws["C6"] = item.Descri or ''
        style_cell(ws["C6"], size=7, align="left")
        ws["C6"].alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
        ws["G8"] = "Rendimiento:"
        ws["H8"] = rendimiento
        ws["B9"] = "Código:"
        ws["C9"] = item.CovPar or item.CodPar
        ws["E9"] = "Unidad:"
        ws["F9"] = item.UniPar
        ws["G9"] = "Cantidad:"
        ws["H9"] = "1"

        # MATERIALES
        mat_start = 11
        ws.merge_cells(f"B{mat_start}:H{mat_start}")
        ws[f"B{mat_start}"] = "MATERIALES"
        style_cell(ws[f"B{mat_start}"], bold=True, size=12)
        
        headers = ["No.", "Descripción", "Und.", "Cant.", "Desp.", "Precio", "Total"]
        for i, h in enumerate(headers):
            col = get_column_letter(i + 2)
            ws[f"{col}{mat_start+1}"] = h
            style_cell(ws[f"{col}{mat_start+1}"], bold=True, border=True)
        
        row = mat_start + 2
        for i, (apu_mat, mat) in enumerate(mat_rows):
            ws[f"B{row}"] = i + 1
            ws[f"C{row}"] = mat.Descri if mat else ''
            ws[f"D{row}"] = mat.UniMat if mat else ''
            ws[f"E{row}"] = apu_mat.CanIns or 0
            ws[f"F{row}"] = apu_mat.Desper or 0
            ws[f"G{row}"] = mat.CosMat if mat else 0
            ws[f"H{row}"] = f"=ROUND((G{row}*E{row})*((F{row}/100)+1),2)"
            style_cell(ws[f"H{row}"], number_format='#,##0.00')
            row += 1
        
        total_mat_row = row
        ws[f"F{total_mat_row}"] = "Total Materiales:"
        first_data = mat_start + 2
        last_data = total_mat_row - 1
        ws[f"H{total_mat_row}"] = f"=SUM(H{first_data}:H{last_data})"
        style_cell(ws[f"H{total_mat_row}"], bold=True, number_format='#,##0.00')

        # EQUIPOS
        eq_start = total_mat_row + 2
        ws.merge_cells(f"B{eq_start}:H{eq_start}")
        ws[f"B{eq_start}"] = "EQUIPOS"
        style_cell(ws[f"B{eq_start}"], bold=True, size=12)
        
        headers = ["No.", "Descripción", "", "Cant.", "Cop/Dep", "Precio", "Total"]
        for i, h in enumerate(headers):
            col = get_column_letter(i + 2)
            ws[f"{col}{eq_start+1}"] = h
            style_cell(ws[f"{col}{eq_start+1}"], bold=True, border=True)
        
        row = eq_start + 2
        for i, (apu_eq, eq) in enumerate(eq_rows):
            ws[f"B{row}"] = i + 1
            ws[f"C{row}"] = eq.Descri if eq else ''
            ws[f"E{row}"] = apu_eq.CanIns or 0
            ws[f"F{row}"] = apu_eq.Deprec or 0
            ws[f"G{row}"] = eq.CosDia if eq else 0
            ws[f"H{row}"] = f"=ROUND((G{row}*E{row})*(F{row}),2)"
            style_cell(ws[f"H{row}"], number_format='#,##0.00')
            row += 1
        
        total_eq_row = row
        ws[f"F{total_eq_row}"] = "Total Equipos:"
        first_data = eq_start + 2
        last_data = total_eq_row - 1
        ws[f"H{total_eq_row}"] = f"=SUM(H{first_data}:H{last_data})"
        style_cell(ws[f"H{total_eq_row}"], bold=True, number_format='#,##0.00')
        
        cuo_row = total_eq_row + 1
        ws[f"E{cuo_row}"] = "Costo Unitarios Equipos:"
        ws[f"H{cuo_row}"] = f"=ROUND(H{total_eq_row}/H9,2)"
        style_cell(ws[f"H{cuo_row}"], bold=True, number_format='#,##0.00')

        # MANO DE OBRA
        mo_start = cuo_row + 2
        ws.merge_cells(f"B{mo_start}:H{mo_start}")
        ws[f"B{mo_start}"] = "MANO DE OBRA"
        style_cell(ws[f"B{mo_start}"], bold=True, size=12)
        
        headers = ["No.", "Descripción", "Cant.", "Jornal", "Bono", "Total Jornal", "Total Bono"]
        for i, h in enumerate(headers):
            col = get_column_letter(i + 2)
            ws[f"{col}{mo_start+1}"] = h
            style_cell(ws[f"{col}{mo_start+1}"], bold=True, border=True)
        
        row = mo_start + 2
        for i, (apu_mo, mo) in enumerate(mo_rows):
            ws[f"B{row}"] = i + 1
            ws[f"C{row}"] = mo.Descri if mo else ''
            ws[f"D{row}"] = apu_mo.CanIns or 0
            ws[f"E{row}"] = mo.Jornal if mo else 0
            ws[f"F{row}"] = mo.Bono if mo else 0
            ws[f"G{row}"] = f"=ROUND((D{row}*E{row}),2)"
            ws[f"H{row}"] = f"=ROUND((D{row}*F{row}),2)"
            style_cell(ws[f"G{row}"], number_format='#,##0.00')
            style_cell(ws[f"H{row}"], number_format='#,##0.00')
            row += 1
        
        sub_row = row
        first_data = mo_start + 2
        last_data = sub_row - 1
        ws[f"D{sub_row}"] = "SubTotal Mano de Obra:"
        ws[f"G{sub_row}"] = f"=SUM(G{first_data}:G{last_data})"
        ws[f"H{sub_row}"] = f"=SUM(H{first_data}:H{last_data})"
        style_cell(ws[f"G{sub_row}"], bold=True, number_format='#,##0.00')
        style_cell(ws[f"H{sub_row}"], bold=True, number_format='#,##0.00')
        
        ps_row = sub_row + 1
        ws[f"C{ps_row}"] = prestaciones
        ws[f"D{ps_row}"] = "Prestaciones Sociales:"
        ws[f"G{ps_row}"] = f"=ROUND((C{ps_row}/100)*G{sub_row},2)"
        ws[f"H{ps_row}"] = 0
        style_cell(ws[f"G{ps_row}"], number_format='#,##0.00')
        
        tg_row = ps_row + 1
        ws[f"D{tg_row}"] = "Total General Mano de Obra:"
        ws[f"H{tg_row}"] = f"=G{ps_row}+H{ps_row}+G{sub_row}+H{sub_row}"
        style_cell(ws[f"H{tg_row}"], bold=True, number_format='#,##0.00')
        
        cuo_mo_row = tg_row + 1
        ws[f"D{cuo_mo_row}"] = "Costo Unitario de Mano de Obra:"
        ws[f"H{cuo_mo_row}"] = f"=ROUND(H{tg_row}/H9,2)"
        style_cell(ws[f"H{cuo_mo_row}"], bold=True, number_format='#,##0.00')

        # RESUMEN
        resumen_start = cuo_mo_row + 2
        cd_row = resumen_start + 1
        ws[f"E{cd_row}"] = "COSTO DIRECTO SUBTOTAL A:"
        ws[f"H{cd_row}"] = f"=ROUND(H{total_mat_row}+H{total_eq_row}+H{cuo_mo_row},2)"
        style_cell(ws[f"H{cd_row}"], bold=True, number_format='#,##0.00')
        
        ad_row = cd_row + 1
        ws[f"C{ad_row}"] = admin_gg
        ws[f"D{ad_row}"] = "Administración y Gastos Generales:"
        ws[f"H{ad_row}"] = f"=ROUND((H{cd_row}*C{ad_row})/100,2)"
        style_cell(ws[f"H{ad_row}"], number_format='#,##0.00')
        
        sb_row = ad_row + 1
        ws[f"D{sb_row}"] = "SUBTOTAL B:"
        ws[f"H{sb_row}"] = f"=H{cd_row}+H{ad_row}"
        style_cell(ws[f"H{sb_row}"], bold=True, number_format='#,##0.00')
        
        iu_row = sb_row + 1
        ws[f"B{iu_row}"] = "SON: ( CATORCE MIL CIENTO CUARENTA Y UN Bs. con 78/100 ctms)"
        ws[f"E{iu_row}"] = imprevisto_ut
        ws[f"F{iu_row}"] = "Imprevisto Utilidad:"
        ws[f"H{iu_row}"] = f"=ROUND((H{sb_row}*E{iu_row})/100,2)"
        style_cell(ws[f"H{iu_row}"], number_format='#,##0.00')
        
        sc_row = iu_row + 1
        ws[f"D{sc_row}"] = "SUBTOTAL C:"
        ws[f"H{sc_row}"] = f"=H{sb_row}+H{iu_row}"
        style_cell(ws[f"H{sc_row}"], bold=True, number_format='#,##0.00')
        
        fin_row = sc_row + 1
        ws[f"E{fin_row}"] = financiamiento
        ws[f"F{fin_row}"] = "Financiamiento:"
        ws[f"H{fin_row}"] = f"=ROUND((H{sc_row}*E{fin_row})/100,2)"
        style_cell(ws[f"H{fin_row}"], number_format='#,##0.00')
        
        ps_row = fin_row + 1
        ws[f"D{ps_row}"] = "PRECIO UNITARIO SIN IMPUESTO:"
        ws[f"H{ps_row}"] = f"=H{sc_row}+H{fin_row}"
        style_cell(ws[f"H{ps_row}"], bold=True, number_format='#,##0.00')
        
        iva_row = ps_row + 1
        ws[f"E{iva_row}"] = iva
        ws[f"F{iva_row}"] = "Impuesto (I.V.A.):"
        ws[f"H{iva_row}"] = f"=ROUND((H{ps_row}*E{iva_row})/100,2)"
        style_cell(ws[f"H{iva_row}"], number_format='#,##0.00')
        
        oi_row = iva_row + 1
        ws[f"E{oi_row}"] = otros_imp
        ws[f"F{oi_row}"] = "Otros Impuestos:"
        ws[f"H{oi_row}"] = f"=ROUND((H{ps_row}*E{oi_row})/100,2)"
        style_cell(ws[f"H{oi_row}"], number_format='#,##0.00')
        
        pf_row = oi_row + 2
        ws[f"D{pf_row}"] = "PRECIO UNITARIO (Bs.F.):"
        ws[f"H{pf_row}"] = f"=H{ps_row}+H{iva_row}+H{oi_row}"
        style_cell(ws[f"H{pf_row}"], bold=True, number_format='#,##0.00')

        # Ajustar anchos de columnas (sintaxis correcta del script local)
        ws.column_dimensions['A'].width = 12
        ws.column_dimensions['B'].width = 8
        ws.column_dimensions['C'].width = 50
        ws.column_dimensions['D'].width = 12
        ws.column_dimensions['E'].width = 12
        ws.column_dimensions['F'].width = 12
        ws.column_dimensions['G'].width = 15
        ws.column_dimensions['H'].width = 18

        # Guardar archivo temporal
        temp_dir = Path("temp")
        temp_dir.mkdir(exist_ok=True)
        filename = f"APU_{item.CovPar or item.CodPar}.xlsx"
        file_path = temp_dir / filename
        
        wb.save(file_path)
        
        return FileResponse(path=str(file_path), filename=filename)
        
    except Exception as e:
        import traceback
        print(f"Error exportando APU Excel: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error al exportar APU: {str(e)}")
    wb = Workbook()
    ws = wb.active
    ws.title = f"APU {item.CovPar or item.CodPar}"

    thin       = Side(style='thin')
    border_all = Border(left=thin, right=thin, top=thin, bottom=thin)
    fmt_money  = '#,##0.00'

    green_fill  = PatternFill(start_color="4CAF50", end_color="4CAF50", fill_type="solid")
    orange_fill = PatternFill(start_color="FFA726", end_color="FFA726", fill_type="solid")
    total_fill  = PatternFill(start_color="E8F5E9", end_color="E8F5E9", fill_type="solid")

    def sty(cell, bold: bool = False, size: int = 11, align: str = "left",
            border: bool = False, number_format: str = None, fill: PatternFill = None,
            color: str = None):
        cell.font      = Font(bold=bold, size=size, name="Calibri",
                              color=color if color else "000000")
        cell.alignment = Alignment(horizontal=align, vertical="center", wrap_text=True)
        if border:
            cell.border = border_all
        if number_format:
            cell.number_format = number_format
        if fill:
            cell.fill = fill

    def hdr_cell(cell, text: str = None):
        """Celda de encabezado de columna: fondo verde, texto blanco, borde."""
        if text is not None:
            cell.value = text
        sty(cell, bold=True, size=11, align="center", border=True,
            fill=green_fill, color="FFFFFF")

    # ── 4. ENCABEZADO ────────────────────────────────────────────────────
    ws.merge_cells("B1:H1")
    ws["B1"] = "ANALISIS DE PRECIO UNITARIO"
    sty(ws["B1"], bold=True, size=14, align="center", fill=green_fill, color="FFFFFF")

    ws.merge_cells("B2:H2")
    ws["B2"] = f"Obra: {item.Descri or 'N/A'}"

    ws["B8"] = "Rendimiento:"
    ws["H8"] = rendimiento
    sty(ws["H8"], number_format="0.00")

    ws["B9"] = "Código:"
    ws["C9"] = item.CovPar or item.CodPar
    ws["E9"] = "Unidad:"
    ws["F9"] = item.UniPar or ""

    # ── 5. MATERIALES ────────────────────────────────────────────────────
    mat_sec = 11
    ws.merge_cells(f"B{mat_sec}:H{mat_sec}")
    ws[f"B{mat_sec}"] = "MATERIALES"
    sty(ws[f"B{mat_sec}"], bold=True, size=12, fill=orange_fill)

    for i, h in enumerate(["No.", "Descripción", "Und.", "Cant.", "Desp.", "Precio", "Total"]):
        hdr_cell(ws.cell(mat_sec + 1, i + 2), h)

    row = mat_sec + 2
    mat_first = row
    for i, (apu_mat, master_mat) in enumerate(mat_rows):
        ws.cell(row, 2, i + 1)
        ws.cell(row, 3, master_mat.Descri or "")
        ws.cell(row, 4, master_mat.UniMat or "")
        ws.cell(row, 5, apu_mat.CanIns or 0)
        ws.cell(row, 6, apu_mat.Desper or 0)
        ws.cell(row, 7, master_mat.CosMat or 0)
        sty(ws.cell(row, 7), number_format=fmt_money)
        ws.cell(row, 8, f"=ROUND((G{row}*E{row})*((F{row}/100)+1),2)")
        sty(ws.cell(row, 8), number_format=fmt_money)
        row += 1

    mat_last    = row - 1
    mat_tot_row = row
    ws.cell(mat_tot_row, 6, "Total Materiales:")
    sty(ws.cell(mat_tot_row, 6), bold=True)
    ws.cell(mat_tot_row, 8, f"=SUM(H{mat_first}:H{mat_last})")
    sty(ws.cell(mat_tot_row, 8), bold=True, number_format=fmt_money, fill=total_fill)

    # ── 6. EQUIPOS ───────────────────────────────────────────────────────
    eq_sec = mat_tot_row + 2
    ws.merge_cells(f"B{eq_sec}:H{eq_sec}")
    ws[f"B{eq_sec}"] = "EQUIPOS"
    sty(ws[f"B{eq_sec}"], bold=True, size=12, fill=orange_fill)

    for i, h in enumerate(["No.", "Descripción", "", "Cant.", "Cop/Dep", "Precio", "Total"]):
        hdr_cell(ws.cell(eq_sec + 1, i + 2), h)

    row = eq_sec + 2
    eq_first = row
    for i, (apu_eq, master_eq) in enumerate(eq_rows):
        ws.cell(row, 2, i + 1)
        ws.cell(row, 3, master_eq.Descri or "")
        ws.cell(row, 5, apu_eq.CanIns or 0)
        ws.cell(row, 6, apu_eq.Deprec if apu_eq.Deprec is not None else 1.0)
        ws.cell(row, 7, master_eq.CosDia or 0)
        sty(ws.cell(row, 7), number_format=fmt_money)
        ws.cell(row, 8, f"=ROUND((G{row}*E{row})*(F{row}),2)")
        sty(ws.cell(row, 8), number_format=fmt_money)
        row += 1

    eq_last    = row - 1
    eq_tot_row = row
    ws.cell(eq_tot_row, 6, "Total Equipos:")
    sty(ws.cell(eq_tot_row, 6), bold=True)
    ws.cell(eq_tot_row, 8, f"=SUM(H{eq_first}:H{eq_last})")
    sty(ws.cell(eq_tot_row, 8), bold=True, number_format=fmt_money, fill=total_fill)

    eq_cuo_row = eq_tot_row + 1
    ws.cell(eq_cuo_row, 5, "Costo Unitario Equipos:")
    ws.cell(eq_cuo_row, 8, f"=ROUND(H{eq_tot_row}/H8,2)")
    sty(ws.cell(eq_cuo_row, 8), bold=True, number_format=fmt_money, fill=total_fill)

    # ── 7. MANO DE OBRA ──────────────────────────────────────────────────
    mo_sec = eq_cuo_row + 2
    ws.merge_cells(f"B{mo_sec}:H{mo_sec}")
    ws[f"B{mo_sec}"] = "MANO DE OBRA"
    sty(ws[f"B{mo_sec}"], bold=True, size=12, fill=orange_fill)

    for i, h in enumerate(["No.", "Descripción", "Cant.", "Jornal", "Bono", "Total Jornal", "Total Bono"]):
        hdr_cell(ws.cell(mo_sec + 1, i + 2), h)

    row = mo_sec + 2
    mo_first = row
    for i, (apu_mo, master_mo) in enumerate(mo_rows):
        ws.cell(row, 2, i + 1)
        ws.cell(row, 3, master_mo.Descri or "")
        ws.cell(row, 4, apu_mo.CanIns or 0)
        ws.cell(row, 5, master_mo.Jornal or 0)
        sty(ws.cell(row, 5), number_format=fmt_money)
        ws.cell(row, 6, master_mo.Bono or 0)
        sty(ws.cell(row, 6), number_format=fmt_money)
        ws.cell(row, 7, f"=ROUND((D{row}*E{row}),2)")
        sty(ws.cell(row, 7), number_format=fmt_money)
        ws.cell(row, 8, f"=ROUND((D{row}*F{row}),2)")
        sty(ws.cell(row, 8), number_format=fmt_money)
        row += 1

    mo_last    = row - 1
    mo_sub_row = row
    ws.cell(mo_sub_row, 4, "SubTotal Mano de Obra:")
    sty(ws.cell(mo_sub_row, 4), bold=True)
    ws.cell(mo_sub_row, 7, f"=SUM(G{mo_first}:G{mo_last})")
    sty(ws.cell(mo_sub_row, 7), bold=True, number_format=fmt_money, fill=total_fill)
    ws.cell(mo_sub_row, 8, f"=SUM(H{mo_first}:H{mo_last})")
    sty(ws.cell(mo_sub_row, 8), bold=True, number_format=fmt_money, fill=total_fill)

    mo_ps_row = mo_sub_row + 1
    ws.cell(mo_ps_row, 3, f"{prestaciones},00")
    ws.cell(mo_ps_row, 4, "Prestaciones Sociales:")
    ws.cell(mo_ps_row, 7, f"=ROUND((C{mo_ps_row}/100)*G{mo_sub_row},2)")
    sty(ws.cell(mo_ps_row, 7), number_format=fmt_money)
    ws.cell(mo_ps_row, 8, 0)

    mo_tg_row = mo_ps_row + 1
    ws.cell(mo_tg_row, 4, "Total General Mano de Obra:")
    sty(ws.cell(mo_tg_row, 4), bold=True)
    ws.cell(mo_tg_row, 8, f"=G{mo_ps_row}+H{mo_ps_row}+G{mo_sub_row}+H{mo_sub_row}")
    sty(ws.cell(mo_tg_row, 8), bold=True, number_format=fmt_money, fill=total_fill)

    mo_cuo_row = mo_tg_row + 1
    ws.cell(mo_cuo_row, 4, "Costo Unitario de Mano de Obra:")
    ws.cell(mo_cuo_row, 8, f"=ROUND(H{mo_tg_row}/H8,2)")
    sty(ws.cell(mo_cuo_row, 8), bold=True, number_format=fmt_money, fill=total_fill)

    # ── 8. RESUMEN ───────────────────────────────────────────────────────
    res_sec = mo_cuo_row + 2
    ws.merge_cells(f"B{res_sec}:H{res_sec}")
    ws[f"B{res_sec}"] = "RESUMEN"
    sty(ws[f"B{res_sec}"], bold=True, size=12, fill=green_fill, color="FFFFFF")

    cd_row = res_sec + 1
    ws.cell(cd_row, 5, "COSTO DIRECTO SUBTOTAL A:")
    sty(ws.cell(cd_row, 5), bold=True)
    ws.cell(cd_row, 8, f"=ROUND(H{mat_tot_row}+H{eq_cuo_row}+H{mo_cuo_row},2)")
    sty(ws.cell(cd_row, 8), bold=True, number_format=fmt_money, fill=total_fill)

    ad_row = cd_row + 1
    ws.cell(ad_row, 3, f"{admin_gg},00")
    ws.cell(ad_row, 4, "Administración y Gastos Generales:")
    ws.cell(ad_row, 8, f"=ROUND((H{cd_row}*C{ad_row})/100,2)")
    sty(ws.cell(ad_row, 8), number_format=fmt_money)

    sb_row = ad_row + 1
    ws.cell(sb_row, 4, "SUBTOTAL B:")
    sty(ws.cell(sb_row, 4), bold=True)
    ws.cell(sb_row, 8, f"=H{cd_row}+H{ad_row}")
    sty(ws.cell(sb_row, 8), bold=True, number_format=fmt_money, fill=total_fill)

    iu_row = sb_row + 1
    ws.cell(iu_row, 5, f"{imprevisto_ut},00")
    ws.cell(iu_row, 6, "Imprevisto Utilidad:")
    ws.cell(iu_row, 8, f"=ROUND((H{sb_row}*E{iu_row})/100,2)")
    sty(ws.cell(iu_row, 8), number_format=fmt_money)

    sc_row = iu_row + 1
    ws.cell(sc_row, 4, "SUBTOTAL C:")
    sty(ws.cell(sc_row, 4), bold=True)
    ws.cell(sc_row, 8, f"=H{sb_row}+H{iu_row}")
    sty(ws.cell(sc_row, 8), bold=True, number_format=fmt_money, fill=total_fill)

    fin_row = sc_row + 1
    ws.cell(fin_row, 5, f"{financiamiento},00")
    ws.cell(fin_row, 6, "Financiamiento:")
    ws.cell(fin_row, 8, f"=ROUND((H{sc_row}*E{fin_row})/100,2)")
    sty(ws.cell(fin_row, 8), number_format=fmt_money)

    ps_row = fin_row + 1
    ws.cell(ps_row, 4, "PRECIO UNITARIO SIN IMPUESTO:")
    sty(ws.cell(ps_row, 4), bold=True)
    ws.cell(ps_row, 8, f"=H{sc_row}+H{fin_row}")
    sty(ws.cell(ps_row, 8), bold=True, number_format=fmt_money, fill=total_fill)

    iva_row = ps_row + 1
    ws.cell(iva_row, 5, f"{iva},00")
    ws.cell(iva_row, 6, "Impuesto (I.V.A.):")
    ws.cell(iva_row, 8, f"=ROUND((H{ps_row}*E{iva_row})/100,2)")
    sty(ws.cell(iva_row, 8), number_format=fmt_money)

    oi_row = iva_row + 1
    ws.cell(oi_row, 5, f"{otros_imp},00")
    ws.cell(oi_row, 6, "Otros Impuestos:")
    ws.cell(oi_row, 8, f"=ROUND((H{ps_row}*E{oi_row})/100,2)")
    sty(ws.cell(oi_row, 8), number_format=fmt_money)

    pf_row = oi_row + 2
    ws.cell(pf_row, 4, "PRECIO UNITARIO (Bs.F.):")
    sty(ws.cell(pf_row, 4), bold=True, size=12)
    ws.cell(pf_row, 8, f"=H{ps_row}+H{iva_row}+H{oi_row}")
    sty(ws.cell(pf_row, 8), bold=True, size=12, number_format=fmt_money, fill=total_fill)

    # ── 9. Anchos de columna ─────────────────────────────────────────────
    ws.column_dimensions['A'].width = 4
    ws.column_dimensions['B'].width = 5
    ws.column_dimensions['C'].width = 50
    ws.column_dimensions['D'].width = 14
    ws.column_dimensions['E'].width = 14
    ws.column_dimensions['F'].width = 18
    ws.column_dimensions['G'].width = 16
    ws.column_dimensions['H'].width = 18

    # ── 10. Guardar y retornar ────────────────────────────────────────────
    temp_dir = Path("temp")
    temp_dir.mkdir(exist_ok=True)
    filename  = f"APU_{item.CovPar or item.CodPar}.xlsx"
    file_path = temp_dir / filename
    wb.save(file_path)

    return FileResponse(path=str(file_path), filename=filename)

@router.delete("/databases/{database_id}")
def delete_database_route(database_id: str, db: Session = Depends(get_db)):
    """Eliminar una base de datos personalizada (no la base maestra)"""
    try:
        success = delete_database(db, database_id)
        if not success:
            raise HTTPException(status_code=404, detail="Base de datos no encontrada")
        return {"status": "ok", "message": "Base de datos eliminada correctamente"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
