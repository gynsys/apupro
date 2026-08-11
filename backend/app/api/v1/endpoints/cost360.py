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
    payload_llm = preprocess_apu_data(db, payload.description, payload.categoria, payload.tipo_actividad)
    
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
    """Genera un archivo Excel con fórmulas nativas A1 para un APU específico.
    Sigue la estructura exacta del archivo apu_formulas.py de referencia.
    """
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, PatternFill
        from openpyxl.utils import get_column_letter
        from openpyxl.styles import Border, Side

        # ── 1. Obtener la partida principal ──────────────────────────────────
        try:
            item = get_item_by_code(db, item_id.split('-')[0])
        except Exception:
            raise HTTPException(status_code=404, detail="Item not found")

        # ── 2. Obtener APU: las funciones devuelven listas de tuplas (apu_row, master_row) ──
        mat_rows = get_apu_materials(db, item_id)
        eq_rows  = get_apu_equipments(db, item_id)
        mo_rows  = get_apu_labors(db, item_id)

        rendimiento    = item.RenPar or 1.0
        admin_gg       = 16.0
        imprevisto_ut  = 10.0
        financiamiento = 0.0
        iva            = 0.0
        otros_imp      = 0.0
        prestaciones   = 435.0   # % FCAS / Prestaciones Sociales

        # ── 3. Helpers de estilo ──────────────────────────────────────────────
        header_style = PatternFill(start_color="4CAF50", end_color="4CAF50", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF", size=11)
        section_style = PatternFill(start_color="FFA726", end_color="FFA726", fill_type="solid")
        section_font = Font(bold=True, size=12)
        total_style = PatternFill(start_color="E8F5E9", end_color="E8F5E9", fill_type="solid")
        total_font = Font(bold=True, size=11)
        currency_format = '#,##0.00'

        # ── 4. Crear workbook y hoja ───────────────────────────────────────────
        wb = Workbook()
        ws = wb.active
        ws.title = "APU"

        # ── 5. HEADER ─────────────────────────────────────────────────────────
        ws.merge_cells("B1:H1")
        ws["B1"] = "ANÁLISIS DE PRECIO UNITARIO"
        ws["B1"].fill = header_style
        ws["B1"].font = header_font

        ws.merge_cells("B2:H2")
        ws["B2"] = f"Obra: {item.Descri or 'N/A'}"

        ws.cell(3, 2, "Código:")
        ws.cell(3, 3, item.CovPar or item.CodPar)
        ws.cell(3, 5, "Unidad:")
        ws.cell(3, 6, item.UniPar)
        ws.cell(3, 7, "Rendimiento:")
        ws.cell(3, 8, rendimiento)

        # ── 6. MATERIALES ─────────────────────────────────────────────────────
        ws.merge_cells(f"B{5}:H{5}")
        ws[f"B{5}"] = "1. MATERIALES"
        ws[f"B{5}"].fill = section_style
        ws[f"B{5}"].font = section_font

        mat_headers = ["No.", "Descripción", "Und.", "Cant.", "Desp.", "Precio", "Total"]
        for i, header in enumerate(mat_headers):
            cell = ws.cell(6, i + 2)
            cell.value = header
            cell.fill = header_style
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center")

        mat_row = 7
        mat_start = mat_row
        for i, mat in enumerate(mat_rows):
            ws.cell(mat_row, 2, i + 1)
            ws.cell(mat_row, 3, mat.Descri or '')
            ws.cell(mat_row, 4, mat.UniPar or '')
            ws.cell(mat_row, 5, mat.Cant or 0)
            ws.cell(mat_row, 6, mat.Desperdicio or 0)
            ws.cell(mat_row, 7, mat.Precio or 0).number_format = currency_format
            ws.cell(mat_row, 8, f"=ROUND((RC[-1]*RC[-3])*((RC[-2]/100)+1),2)").number_format = currency_format
            mat_row += 1

        mat_end = mat_row - 1
        ws.cell(mat_row, 2, "Total Materiales:")
        ws.cell(mat_row, 2).font = total_font
        ws.cell(mat_row, 8, f"=SUM(H{mat_start}:H{mat_end})").number_format = currency_format
        ws.cell(mat_row, 8).fill = total_style
        ws.cell(mat_row, 8).font = total_font

        # ── 7. EQUIPOS ───────────────────────────────────────────────────────
        eq_row = mat_row + 2
        ws.merge_cells(f"B{eq_row}:H{eq_row}")
        ws[f"B{eq_row}"] = "2. EQUIPOS"
        ws[f"B{eq_row}"].fill = section_style
        ws[f"B{eq_row}"].font = section_font

        eq_headers = ["No.", "Descripción", "", "Cant.", "Cop/Dep", "Precio", "Total"]
        for i, header in enumerate(eq_headers):
            cell = ws.cell(eq_row + 1, i + 2)
            cell.value = header
            cell.fill = header_style
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center")

        eq_row += 2
        eq_start = eq_row
        for i, eq in enumerate(eq_rows):
            ws.cell(eq_row, 2, i + 1)
            ws.cell(eq_row, 3, eq.Descri or '')
            ws.cell(eq_row, 5, eq.Cant or 0)
            ws.cell(eq_row, 6, eq.CopDep or 0)
            ws.cell(eq_row, 7, eq.Precio or 0).number_format = currency_format
            ws.cell(eq_row, 8, f"=ROUND((RC[-1]*RC[-3])*(RC[-2]),2)").number_format = currency_format
            eq_row += 1

        eq_end = eq_row - 1
        ws.cell(eq_row, 2, "Total Equipos:")
        ws.cell(eq_row, 2).font = total_font
        ws.cell(eq_row, 8, f"=SUM(H{eq_start}:H{eq_end})").number_format = currency_format
        ws.cell(eq_row, 8).fill = total_style
        ws.cell(eq_row, 8).font = total_font

        # ── 8. MANO DE OBRA ──────────────────────────────────────────────────
        mo_row = eq_row + 2
        ws.merge_cells(f"B{mo_row}:H{mo_row}")
        ws[f"B{mo_row}"] = "3. MANO DE OBRA"
        ws[f"B{mo_row}"].fill = section_style
        ws[f"B{mo_row}"].font = section_font

        mo_headers = ["No.", "Descripción", "Cant.", "Jornal", "Bono", "Total Jornal", "Total Bono"]
        for i, header in enumerate(mo_headers):
            cell = ws.cell(mo_row + 1, i + 2)
            cell.value = header
            cell.fill = header_style
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center")

        mo_row += 2
        mo_start = mo_row
        for i, mo in enumerate(mo_rows):
            ws.cell(mo_row, 2, i + 1)
            ws.cell(mo_row, 3, mo.Descri or '')
            ws.cell(mo_row, 4, mo.Cant or 0)
            ws.cell(mo_row, 5, mo.Jornal or 0).number_format = currency_format
            ws.cell(mo_row, 6, mo.Bono or 0).number_format = currency_format
            ws.cell(mo_row, 7, f"=RC[-3]*RC[-2]").number_format = currency_format
            ws.cell(mo_row, 8, f"=RC[-4]*RC[-3]").number_format = currency_format
            mo_row += 1

        mo_end = mo_row - 1
        ws.cell(mo_row, 2, "Total Mano de Obra:")
        ws.cell(mo_row, 2).font = total_font
        ws.cell(mo_row, 7, f"=SUM(G{mo_start}:G{mo_end})").number_format = currency_format
        ws.cell(mo_row, 7).fill = total_style
        ws.cell(mo_row, 7).font = total_font
        ws.cell(mo_row, 8, f"=SUM(H{mo_start}:H{mo_end})").number_format = currency_format
        ws.cell(mo_row, 8).fill = total_style
        ws.cell(mo_row, 8).font = total_font

        # ── 9. RESUMEN ───────────────────────────────────────────────────────
        summary_row = mo_row + 2
        ws.merge_cells(f"B{summary_row}:H{summary_row}")
        ws[f"B{summary_row}"] = "RESUMEN"
        ws[f"B{summary_row}"].fill = section_style
        ws[f"B{summary_row}"].font = section_font

        # Cálculos del resumen (simplificados)
        ws.cell(summary_row + 1, 2, "Costo Directo:")
        ws.cell(summary_row + 1, 8, f"=H{mat_end}+H{eq_end}+H{mo_end}").number_format = currency_format

        ws.cell(summary_row + 2, 2, "Administración y Gastos (15%):")
        ws.cell(summary_row + 2, 8, f"=R[-1]C*0.15").number_format = currency_format

        ws.cell(summary_row + 3, 2, "Subtotal B:")
        ws.cell(summary_row + 3, 8, "=R[-2]C+R[-1]C").number_format = currency_format

        ws.cell(summary_row + 4, 2, "Imprevisto y Utilidad (10%):")
        ws.cell(summary_row + 4, 8, f"=R[-1]C*0.10").number_format = currency_format

        ws.cell(summary_row + 5, 2, "PRECIO UNITARIO FINAL:")
        ws.cell(summary_row + 5, 8, "=R[-2]C+R[-1]C").number_format = currency_format
        ws.cell(summary_row + 5, 8).fill = total_style
        ws.cell(summary_row + 5, 8).font = total_font

        # ── 10. Ajustar anchos de columnas ─────────────────────────────────────
        ws.column_dimensions['B'] = 8
        ws.column_dimensions['C'] = 30
        ws.column_dimensions['D'] = 10
        ws.column_dimensions['E'] = 12
        ws.column_dimensions['F'] = 12
        ws.column_dimensions['G'] = 15
        ws.column_dimensions['H'] = 15

        # ── 11. Guardar archivo temporal ───────────────────────────────────────
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
