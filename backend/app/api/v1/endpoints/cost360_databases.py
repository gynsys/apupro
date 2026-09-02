from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.api.v1.endpoints.arko import get_current_arko_admin
from app.schemas.cost360 import (
    Cost360DatabaseCreate, Cost360DatabaseUpdate, Cost360DatabaseListResponse
)
from app.crud.crud_cost360 import (
    get_all_databases, get_database_by_id, create_database, 
    update_database, delete_database
)
from sqlalchemy import text
from typing import Optional

router = APIRouter()

@router.get("", response_model=Cost360DatabaseListResponse)
def list_databases(db: Session = Depends(get_db), current_user = Depends(get_current_arko_admin)):
    """Listar todas las bases de datos Cost360 disponibles para el usuario"""
    try:
        databases = get_all_databases(db)
    except Exception as e:
        # Si falla, es altamente probable que sea porque faltan las columnas nuevas en producción.
        # Hacemos un parche automático (auto-migrate).
        db.rollback()
        db.execute(text("ALTER TABLE cost360_databases ADD COLUMN IF NOT EXISTS owner_id VARCHAR(255);"))
        db.execute(text("ALTER TABLE cost360_databases ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;"))
        db.execute(text("ALTER TABLE cost360_databases ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;"))
        db.commit()
        # Reintentar la consulta
        databases = get_all_databases(db)
        
    # Filtrar por bases maestras o bases que le pertenecen al usuario
    user_dbs = []
    user_email = current_user.email.lower() if current_user.email else ""
    for db_obj in databases:
        # Mostrar si es maestra, si está publicada, o si le pertenece al usuario
        if getattr(db_obj, 'is_master', False):
            user_dbs.append(db_obj)
        elif getattr(db_obj, 'is_published', False):
            user_dbs.append(db_obj)
        else:
            db_owner = getattr(db_obj, 'owner_id', None)
            if db_owner and db_owner.lower() == user_email:
                user_dbs.append(db_obj)
            
    return {"databases": user_dbs}

@router.post("/initialize")
def initialize_master_database(db: Session = Depends(get_db)):
    """Inicializar la base de datos maestra si no existe"""
    from app.db.models.cost360_database import Cost360Database
    
    try:
        db.execute(text("SELECT 1 FROM cost360_databases LIMIT 1"))
    except:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS cost360_databases (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                is_master BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                material_inflation FLOAT DEFAULT 0.0,
                labor_inflation FLOAT DEFAULT 0.0,
                equipment_inflation FLOAT DEFAULT 0.0,
                source_database_id VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_by VARCHAR(255),
                owner_id VARCHAR(255),
                is_published BOOLEAN DEFAULT FALSE,
                published_at TIMESTAMP WITH TIME ZONE
            )
        """))
        db.commit()
        
    master_exists = db.query(Cost360Database).filter(Cost360Database.id == "master").first()
    if not master_exists:
        new_master = Cost360Database(
            id="master",
            name="Base Maestra",
            description="Base de datos principal (Global)",
            is_master=True,
            is_published=True,
            owner_id=None
        )
        db.add(new_master)
        db.commit()
    return {"status": "ok", "message": "Base de datos maestra inicializada"}

@router.get("/{database_id}")
def get_database(database_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_arko_admin)):
    """Obtener detalles de una base de datos especÃ­fica"""
    database = get_database_by_id(db, database_id)
    if not database:
        raise HTTPException(status_code=404, detail="Base de datos no encontrada")
    return database

@router.post("")
def create_database_route(payload: Cost360DatabaseCreate, db: Session = Depends(get_db), current_user = Depends(get_current_arko_admin)):
    """
    Crear una nueva base de datos (copia aislada) para el usuario
    """
    try:
        # User max limit check
        from app.db.models.arko import ArkoAdmin
        admin_config = db.query(ArkoAdmin).first()
        limit = 2
        if admin_config and admin_config.site_config:
            limit = admin_config.site_config.get("max_user_databases", 2)
            
        current_db_count = db.query(get_all_databases.__globals__['Cost360Database']).filter(
            get_all_databases.__globals__['Cost360Database'].owner_id == current_user.email
        ).count()
        
        if current_db_count >= limit:
            raise ValueError(f"LÃ­mite de bases de datos alcanzado ({limit} mÃ¡ximo por usuario).")

        created_by = current_user.email
        new_database = create_database(db, payload, created_by=created_by)
        
        # Guardar owner
        new_database.owner_id = created_by
        db.commit()
        db.refresh(new_database)
        
        return new_database
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/{database_id}")
def update_database_route(database_id: str, payload: Cost360DatabaseUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_arko_admin)):
    """Actualizar metadatos o estado de publicaciÃ³n"""
    try:
        db_obj = get_database_by_id(db, database_id)
        if not db_obj:
            raise HTTPException(status_code=404, detail="Base de datos no encontrada")
            
        if db_obj.owner_id and db_obj.owner_id != current_user.email:
            raise HTTPException(status_code=403, detail="No tienes permisos para editar esta base de datos")
            
        updated_database = update_database(db, database_id, payload)
        
        if hasattr(payload, 'is_published') and payload.is_published is not None:
            updated_database.is_published = payload.is_published
            if payload.is_published:
                from datetime import datetime
                updated_database.published_at = datetime.utcnow()
            db.commit()
            db.refresh(updated_database)
            
        return updated_database
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{database_id}")
def delete_database_route(database_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_arko_admin)):
    """Eliminar una base de datos personalizada"""
    try:
        db_obj = get_database_by_id(db, database_id)
        if not db_obj:
            raise HTTPException(status_code=404, detail="Base de datos no encontrada")
            
        if db_obj.owner_id and db_obj.owner_id != current_user.email:
            raise HTTPException(status_code=403, detail="No tienes permisos para eliminar esta base de datos")
            
        success = delete_database(db, database_id)
        if not success:
            raise HTTPException(status_code=404, detail="Base de datos no encontrada")
        return {"status": "ok", "message": "Base de datos eliminada correctamente"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
