from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, text
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
import unicodedata

def strip_accents(s: str) -> str:
    if not s:
        return s
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def unaccent_col(column):
    return func.translate(column, 'áéíóúÁÉÍÓÚäëïöüÄËÏÖÜ', 'aeiouAEIOUaeiouAEIOU')

def get_items_paginated(db: Session, skip: int = 0, limit: int = 50, search: Optional[str] = None, chapter: Optional[str] = None, categoria: Optional[str] = None, tipo_actividad: Optional[str] = None, search_desc: bool = True, search_insumos: bool = False, covenin: Optional[str] = None, database_id: str = "master", only_coded: bool = False, hidden_categories: Optional[str] = None):
    
    # Failsafe: Si ambos están apagados, forzar búsqueda por descripción por defecto
    if not search_desc and not search_insumos:
        search_desc = True
    
    # Determinar qué base de datos está seleccionada y configurar la query apropiada
    if database_id == "personalizada":
        # Base de datos personalizada: buscar en CustomCostItem
        query = db.query(CustomCostItem)
        if search:
            words = search.split()
            all_filters = []
            for word in words:
                clean_word = strip_accents(word)
                word_filters = []
                if search_desc:
                    word_filters.append(unaccent_col(CustomCostItem.description).ilike(f"%{clean_word}%"))
                if search_insumos:
                    word_filters.append(unaccent_col(CustomCostItem.apu_data).ilike(f"%{clean_word}%"))
                if word_filters:
                    all_filters.append(or_(*word_filters))
            
            if all_filters:
                query = query.filter(and_(*all_filters))
        
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
    
    # Para cualquier otra base de datos (master o personalizadas adicionales), buscar en CostItem
    query = db.query(CostItem)
    
    # Si no es master, verificar si es una base de datos personalizada con filtros específicos
    if database_id and database_id != "master":
        db_config = get_database_by_id(db, database_id)
        if db_config and not db_config.is_master:
            # Aplicar filtros específicos de la base de datos personalizada si existen
            # Aquí podrías agregar lógica específica según cómo estén configuradas las bases personalizadas
            pass  # Por ahora, busca en toda la base maestra
    
    if search:
        words = search.split()
        all_filters = []
        for word in words:
            clean_word = strip_accents(word)
            word_filters = []
            if search_desc:
                word_filters.extend([
                    unaccent_col(CostItem.Descri).ilike(f"%{clean_word}%")
                ])
            if search_insumos:
                word_filters.extend([
                    CostItem.apu_materials.any(CostAPUMaterial.material.has(unaccent_col(CostMaterial.Descri).ilike(f"%{clean_word}%"))),
                    CostItem.apu_equipments.any(CostAPUEquipment.equipment.has(unaccent_col(CostEquipment.Descri).ilike(f"%{clean_word}%"))),
                    CostItem.apu_labors.any(CostAPULabor.labor.has(unaccent_col(CostLabor.Descri).ilike(f"%{clean_word}%")))
                ])
            if word_filters:
                all_filters.append(or_(*word_filters))
        
        # Aplicar todos los filtros con AND entre palabras diferentes para mayor precisión
        if all_filters:
            query = query.filter(and_(*all_filters))
            
    if covenin:
        query = query.filter(CostItem.CovPar.startswith(covenin))
    if chapter:
        query_chap = query.filter(or_(CostItem.CovPar.startswith(chapter), CostItem.CodPar.startswith(chapter)))
        total = query_chap.count()
        
        if total == 0 and len(chapter) > 3:
            fallback_chap = chapter[:-1]
            while len(fallback_chap) >= 3:
                query_chap = query.filter(or_(CostItem.CovPar.startswith(fallback_chap), CostItem.CodPar.startswith(fallback_chap)))
                total = query_chap.count()
                if total > 0:
                    break
                fallback_chap = fallback_chap[:-1]
        
        query = query_chap
    else:
        total = query.count()
        
    if categoria:
        query = query.filter(CostItem.Categoria == categoria)
        total = query.count() # re-count if categoria is applied
    if tipo_actividad:
        query = query.filter(CostItem.TipoActividad == tipo_actividad)
        total = query.count() # re-count if tipo_actividad is applied
    if only_coded:
        query = query.filter(CostItem.CovPar.op('~')(r'^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$'))
        total = query.count()

    if hidden_categories and not covenin and not chapter:
        hc_list = [hc.strip() for hc in hidden_categories.split(',')]
        for hc in hc_list:
            if hc:
                query = query.filter(or_(CostItem.CovPar == None, ~CostItem.CovPar.startswith(hc)))
        total = query.count()
    
    # Priorizar partidas con COVENIN completo (formato [LETRA].[9 DÍGITOS] como C.110800300)
    # Usamos una función SQL nativa para mayor compatibilidad
    from sqlalchemy import case, func
    covenin_priority = case(
        (func.length(CostItem.CovPar) == 11, 0),  # COVENIN completo tiene 11 caracteres (LETRA + punto + 9 dígitos)
        else_=1  # Otros tienen prioridad 1
    )
    
    items = query.order_by(covenin_priority, CostItem.CodPar).offset(skip).limit(limit).all()
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
    valid_apu_query = db.query(CostItem.CodPar).filter(CostItem.CovPar.op('~')(r'^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$'))
    used_materials = db.query(CostAPUMaterial.CodIns).filter(CostAPUMaterial.CodPar.in_(valid_apu_query))
    
    query = db.query(CostMaterial).filter(CostMaterial.CodMat.in_(used_materials))
    if search:
        search_term = f"%{search}%"
        query = query.filter(CostMaterial.CodMat.ilike(search_term) | CostMaterial.Descri.ilike(search_term))
    total = query.count()
    items = query.order_by(CostMaterial.CodMat).offset(skip).limit(limit).all()
    return total, items

def search_equipments_paginated(db: Session, skip: int, limit: int, search: str):
    valid_apu_query = db.query(CostItem.CodPar).filter(CostItem.CovPar.op('~')(r'^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$'))
    used_equipments = db.query(CostAPUEquipment.CodIns).filter(CostAPUEquipment.CodPar.in_(valid_apu_query))

    query = db.query(CostEquipment).filter(CostEquipment.CodEqu.in_(used_equipments))
    if search:
        search_term = f"%{search}%"
        query = query.filter(CostEquipment.CodEqu.ilike(search_term) | CostEquipment.Descri.ilike(search_term))
    total = query.count()
    items = query.order_by(CostEquipment.CodEqu).offset(skip).limit(limit).all()
    return total, items

def search_labors_paginated(db: Session, skip: int, limit: int, search: str):
    valid_apu_query = db.query(CostItem.CodPar).filter(CostItem.CovPar.op('~')(r'^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$'))
    used_labors = db.query(CostAPULabor.CodIns).filter(CostAPULabor.CodPar.in_(valid_apu_query))

    query = db.query(CostLabor).filter(CostLabor.CodMan.in_(used_labors))
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
    import logging
    logger = logging.getLogger(__name__)

    source_id = payload.source_database_id or 'master'
    source_db = get_database_by_id(db, source_id)
    if not source_db and source_id != 'master':
        raise ValueError(f"Base de datos origen '{source_id}' no encontrada")

    import re
    clean_name = re.sub(r'[^a-z0-9_]', '', payload.name.lower().replace(' ', '_'))
    if not clean_name:
        clean_name = 'db'
    new_db_id = f"{clean_name}_{str(uuid.uuid4())[:8]}"

    logger.warning(f"[CREATE_DB_CRUD] Creating DB id={new_db_id} source={source_id} owner={created_by}")

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
        created_by=created_by,
        owner_id=created_by
    )
    db.add(new_database)
    db.commit()
    
    # Clonación Física vía Esquemas de PostgreSQL
    try:
        source_schema = "public" if source_id == "master" else source_id
        logger.warning(f"[CREATE_DB_CRUD] Creating schema={new_db_id} from source_schema={source_schema}")
        
        # 1. Crear el esquema
        db.execute(text(f'CREATE SCHEMA "{new_db_id}"'))
        
        # 2. Copiar tablas
        tables_to_clone = [
            "cost360_materials",
            "cost360_equipment",
            "cost360_labor",
            "cost360_items",
            "cost360_apu_materials",
            "cost360_apu_equipment",
            "cost360_apu_labor"
        ]
        
        for table in tables_to_clone:
            logger.warning(f"[CREATE_DB_CRUD] Cloning table={table}")
            # Crear estructura e índices (INCLUDING ALL)
            db.execute(text(f'CREATE TABLE "{new_db_id}"."{table}" (LIKE "{source_schema}"."{table}" INCLUDING ALL)'))
            # Copiar datos físicos
            db.execute(text(f'INSERT INTO "{new_db_id}"."{table}" SELECT * FROM "{source_schema}"."{table}"'))
            
        db.commit()
        logger.warning(f"[CREATE_DB_CRUD] Schema cloned successfully id={new_db_id}")
    except Exception as e:
        logger.error(f"[CREATE_DB_CRUD] Schema clone FAILED: {str(e)}", exc_info=True)
        db.rollback()
        # Si falla la clonación física, revertimos la creación del registro
        db.delete(new_database)
        db.commit()
        raise ValueError(f"Error al clonar la base de datos físicamente: {str(e)}")

    db.refresh(new_database)
    return new_database

def update_database(db: Session, database_id: str, payload: Cost360DatabaseUpdate):
    """Actualizar metadatos de una base de datos"""
    db_obj = get_database_by_id(db, database_id)
    if not db_obj:
        return None
    
    if payload.name is not None:
        db_obj.name = payload.name
    if payload.description is not None:
        db_obj.description = payload.description
    if payload.is_active is not None:
        db_obj.is_active = payload.is_active
    if getattr(payload, 'material_inflation', None) is not None:
        db_obj.material_inflation = payload.material_inflation
    if getattr(payload, 'labor_inflation', None) is not None:
        db_obj.labor_inflation = payload.labor_inflation
    if getattr(payload, 'equipment_inflation', None) is not None:
        db_obj.equipment_inflation = payload.equipment_inflation
    
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
    
    # NUEVA LÓGICA: Si es la personalizada, limpiar la tabla nativa
    if database_id == "personalizada":
        from app.db.models.cost360 import CustomCostItem
        db.query(CustomCostItem).delete()
        db.commit()
        return True
    
    # Eliminar el esquema físico en PostgreSQL
    try:
        db.execute(text(f'DROP SCHEMA IF EXISTS "{database_id}" CASCADE'))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Advertencia: No se pudo eliminar el esquema físico {database_id}: {e}")
        
    return True

def update_master_item(db: Session, item_code: str, descri: str, unipar: str, renpar: float):
    item = db.query(CostItem).filter(CostItem.CodPar == item_code).first()
    if not item:
        return None
    
    if descri is not None:
        item.Descri = descri
    if unipar is not None:
        item.UniPar = unipar
    if renpar is not None:
        item.RenPar = renpar
        
    db.commit()
    db.refresh(item)
    return item

def delete_master_item(db: Session, item_code: str):
    item = db.query(CostItem).filter(CostItem.CodPar == item_code).first()
    if not item:
        return False
    
    # Cascade delete child relations manually to avoid FK constraint errors
    db.query(CostAPUMaterial).filter(CostAPUMaterial.CodPar == item_code).delete(synchronize_session=False)
    db.query(CostAPUEquipment).filter(CostAPUEquipment.CodPar == item_code).delete(synchronize_session=False)
    db.query(CostAPULabor).filter(CostAPULabor.CodPar == item_code).delete(synchronize_session=False)
    
    # Delete the main item
    db.delete(item)
    db.commit()
    return True

