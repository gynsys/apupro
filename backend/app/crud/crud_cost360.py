from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Optional, List, Tuple
from app.db.models.cost360 import (
    CostItem, CostMaterial, CostEquipment, CostLabor,
    CostAPUMaterial, CostAPUEquipment, CostAPULabor, CustomCostItem
)
from app.db.models.cost360_database import Cost360Database
from app.schemas.cost360 import (
    CostMaterialUpdate, CostEquipmentUpdate, CostLaborUpdate,
    Cost360DatabaseCreate, Cost360DatabaseUpdate
)
import uuid
import json

def get_items_paginated(db: Session, skip: int = 0, limit: int = 50, search: Optional[str] = None, chapter: Optional[str] = None, categoria: Optional[str] = None, tipo_actividad: Optional[str] = None, search_desc: bool = True, search_insumos: bool = False, covenin: Optional[str] = None, database_id: str = "master"):
    
    # Failsafe: Si ambos están apagados, forzar búsqueda por descripción por defecto
    if not search_desc and not search_insumos:
        search_desc = True
        
    if database_id == "personalizada":
        query = db.query(CustomCostItem)
        if search:
            words = search.split()
            for word in words:
                filters = []
                if search_desc:
                    filters.append(CustomCostItem.description.ilike(f"%{word}%"))
                if search_insumos:
                    filters.append(CustomCostItem.apu_data.ilike(f"%{word}%"))
                query = query.filter(or_(*filters))
        
        total = query.count()
        custom_items = query.order_by(CustomCostItem.created_at.desc()).offset(skip).limit(limit).all()
        
        items = []
        for ci in custom_items:
            try:
                data = json.loads(ci.apu_data)
                cod_par = data.get("cod_par", "CUST-" + ci.id[:4].upper())
                
                mat_total = sum(m.get('cantidad', 0) * m.get('precio_unitario', 0) * (1 + m.get('desperdicio', 0)/100) for m in data.get('materials', []))
                eq_total = sum(e.get('cantidad', 0) * e.get('depreciacion', 1.0) * e.get('precio_unitario', 0) for e in data.get('equipments', [])) / (ci.performance or 1)
                
                lab_jornal = sum(l.get('cantidad', 0) * l.get('jornal', 0) for l in data.get('labors', []))
                lab_bono = sum(l.get('cantidad', 0) * l.get('bono', 0) for l in data.get('labors', []))
                lab_total = (lab_jornal + lab_bono + (lab_jornal * 4.17)) / (ci.performance or 1)
                
                subtotal_a = mat_total + eq_total + lab_total
                pre_uni = subtotal_a * 1.15 * 1.10
            except:
                cod_par = "CUST-" + ci.id[:4].upper()
                pre_uni = 0.0

            items.append({
                "CodPar": cod_par,
                "Descri": ci.description,
                "CovPar": None,
                "UniPar": ci.unit,
                "PreUni": pre_uni,
                "RenPar": ci.performance,
                "Categoria": "Custom",
                "TipoActividad": "Custom"
            })
        return total, items

    query = db.query(CostItem)
    if search:
        words = search.split()
        for word in words:
            filters = []
            if search_desc:
                filters.extend([
                    CostItem.Descri.ilike(f"%{word}%"),
                    CostItem.CodPar.ilike(f"%{word}%"),
                    CostItem.CovPar.ilike(f"%{word}%")
                ])
            if search_insumos:
                filters.extend([
                    CostItem.apu_materials.any(CostAPUMaterial.material.has(CostMaterial.Descri.ilike(f"%{word}%"))),
                    CostItem.apu_equipments.any(CostAPUEquipment.equipment.has(CostEquipment.Descri.ilike(f"%{word}%"))),
                    CostItem.apu_labors.any(CostAPULabor.labor.has(CostLabor.Descri.ilike(f"%{word}%")))
                ])
            query = query.filter(or_(*filters))
            
    if covenin:
        query = query.filter(CostItem.CovPar.ilike(f"%{covenin}%"))
    if chapter:
        query = query.filter(CostItem.CodPar.startswith(chapter))
    if categoria:
        query = query.filter(CostItem.Categoria == categoria)
    if tipo_actividad:
        query = query.filter(CostItem.TipoActividad == tipo_actividad)
    
    total = query.count()
    items = query.order_by(CostItem.CodPar).offset(skip).limit(limit).all()
    return total, items

def get_item_by_code(db: Session, item_code: str):
    return db.query(CostItem).filter(CostItem.CodPar == item_code).first()

def get_apu_materials(db: Session, item_code: str):
    return db.query(CostAPUMaterial, CostMaterial)\
        .join(CostMaterial, CostAPUMaterial.CodIns == CostMaterial.CodMat)\
        .filter(CostAPUMaterial.CodPar == item_code).all()

def get_apu_equipments(db: Session, item_code: str):
    return db.query(CostAPUEquipment, CostEquipment)\
        .join(CostEquipment, CostAPUEquipment.CodIns == CostEquipment.CodEqu)\
        .filter(CostAPUEquipment.CodPar == item_code).all()

def get_apu_labors(db: Session, item_code: str):
    return db.query(CostAPULabor, CostLabor)\
        .join(CostLabor, CostAPULabor.CodIns == CostLabor.CodMan)\
        .filter(CostAPULabor.CodPar == item_code).all()

def search_materials_paginated(db: Session, skip: int, limit: int, search: str):
    query = db.query(CostMaterial)
    if search:
        search_term = f"%{search}%"
        query = query.filter(CostMaterial.CodMat.ilike(search_term) | CostMaterial.Descri.ilike(search_term))
    total = query.count()
    items = query.order_by(CostMaterial.CodMat).offset(skip).limit(limit).all()
    return total, items

def search_equipments_paginated(db: Session, skip: int, limit: int, search: str):
    query = db.query(CostEquipment)
    if search:
        search_term = f"%{search}%"
        query = query.filter(CostEquipment.CodEqu.ilike(search_term) | CostEquipment.Descri.ilike(search_term))
    total = query.count()
    items = query.order_by(CostEquipment.CodEqu).offset(skip).limit(limit).all()
    return total, items

def search_labors_paginated(db: Session, skip: int, limit: int, search: str):
    query = db.query(CostLabor)
    if search:
        search_term = f"%{search}%"
        query = query.filter(CostLabor.CodMan.ilike(search_term) | CostLabor.Descri.ilike(search_term))
    total = query.count()
    items = query.order_by(CostLabor.CodMan).offset(skip).limit(limit).all()
    return total, items

def get_categories_tree_data(db: Session):
    items = db.query(CostItem.Categoria, CostItem.TipoActividad).distinct().all()
    tree = {}
    for cat, sub in items:
        if cat:
            if cat not in tree:
                tree[cat] = set()
            if sub:
                tree[cat].add(sub)
                
    result = []
    for cat, subs in tree.items():
        result.append({
            "categoria": cat,
            "actividades": sorted(list(subs))
        })
    return sorted(result, key=lambda x: x["categoria"])

def update_material(db: Session, codigo: str, payload: CostMaterialUpdate):
    mat = db.query(CostMaterial).filter(CostMaterial.CodMat == codigo).first()
    if mat:
        if payload.CosMat is not None:
            mat.CosMat = payload.CosMat
        if payload.Descri is not None:
            mat.Descri = payload.Descri
        db.commit()
        db.refresh(mat)
    return mat

def delete_material(db: Session, codigo: str):
    mat = db.query(CostMaterial).filter(CostMaterial.CodMat == codigo).first()
    if mat:
        db.delete(mat)
        db.commit()
        return True
    return False

def update_equipment(db: Session, codigo: str, payload: CostEquipmentUpdate):
    eq = db.query(CostEquipment).filter(CostEquipment.CodEqu == codigo).first()
    if eq:
        if payload.CosDia is not None:
            eq.CosDia = payload.CosDia
        if payload.Descri is not None:
            eq.Descri = payload.Descri
        db.commit()
        db.refresh(eq)
    return eq

def delete_equipment(db: Session, codigo: str):
    eq = db.query(CostEquipment).filter(CostEquipment.CodEqu == codigo).first()
    if eq:
        db.delete(eq)
        db.commit()
        return True
    return False

def update_labor(db: Session, codigo: str, payload: CostLaborUpdate):
    labor = db.query(CostLabor).filter(CostLabor.CodMan == codigo).first()
    if labor:
        if payload.Jornal is not None:
            labor.Jornal = payload.Jornal
        if payload.Bono is not None:
            labor.Bono = payload.Bono
        if payload.Descri is not None:
            labor.Descri = payload.Descri
        db.commit()
        db.refresh(labor)
    return labor

def delete_labor(db: Session, codigo: str):
    labor = db.query(CostLabor).filter(CostLabor.CodMan == codigo).first()
    if labor:
        db.delete(labor)
        db.commit()
        return True
    return False

def save_custom_apu(db: Session, description: str, unit: str, performance: float, apu_data: str):
    new_item = CustomCostItem(
        id=str(uuid.uuid4()),
        description=description,
        unit=unit,
        performance=performance,
        apu_data=apu_data
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

# Database Management CRUD Functions
def get_all_databases(db: Session):
    """Obtener todas las bases de datos Cost360"""
    return db.query(Cost360Database).order_by(Cost360Database.created_at.desc()).all()

def get_database_by_id(db: Session, database_id: str):
    """Obtener una base de datos por ID"""
    return db.query(Cost360Database).filter(Cost360Database.id == database_id).first()

def create_database(db: Session, payload: Cost360DatabaseCreate, created_by: Optional[str] = None):
    """
    Crear una nueva base de datos con índices de inflación.

    Los factores de inflación (material_inflation, labor_inflation, equipment_inflation)
    se guardan como metadatos. El precio con factor se calcula dinámicamente en los
    endpoints de consulta (estrategia de precio virtual), sin duplicar filas de datos.
    """
    source_id = payload.source_database_id or 'master'
    source_db = get_database_by_id(db, source_id)
    if not source_db and source_id != 'master':
        raise ValueError(f"Base de datos origen '{source_id}' no encontrada")

    new_db_id = f"{payload.name.lower().replace(' ', '_')}_{str(uuid.uuid4())[:8]}"

    new_database = Cost360Database(
        id=new_db_id,
        name=payload.name,
        description=payload.description,
        is_master=False,
        is_active=True,
        material_inflation=payload.material_inflation or 0.0,
        labor_inflation=payload.labor_inflation or 0.0,
        equipment_inflation=payload.equipment_inflation or 0.0,
        source_database_id=source_id,
        created_by=created_by
    )
    db.add(new_database)
    db.commit()
    db.refresh(new_database)
    return new_database

def update_database(db: Session, database_id: str, payload: Cost360DatabaseUpdate):
    """Actualizar metadatos de una base de datos"""
    db_obj = get_database_by_id(db, database_id)
    if not db_obj:
        return None
    
    # No permitir modificar la base maestra
    if db_obj.is_master:
        raise ValueError("No se puede modificar la base de datos maestra")
    
    if payload.name is not None:
        db_obj.name = payload.name
    if payload.description is not None:
        db_obj.description = payload.description
    if payload.is_active is not None:
        db_obj.is_active = payload.is_active
    
    db.commit()
    db.refresh(db_obj)
    return db_obj

def delete_database(db: Session, database_id: str):
    """Eliminar una base de datos personalizada"""
    db_obj = get_database_by_id(db, database_id)
    if not db_obj:
        return False
    
    # No permitir eliminar la base maestra
    if db_obj.is_master:
        raise ValueError("No se puede eliminar la base de datos maestra")
    
    db.delete(db_obj)
    db.commit()
    return True
