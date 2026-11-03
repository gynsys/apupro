from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.api.v1.endpoints.arko import get_current_arko_admin, get_optional_arko_admin
from app.schemas.costbase import (
    Cost360DatabaseCreate, Cost360DatabaseUpdate, Cost360DatabaseListResponse
)
from app.crud.crud_costbase import (
    get_all_databases, get_database_by_id, create_database, 
    update_database, delete_database
)
from sqlalchemy import text
from typing import Optional
import threading
import logging
from datetime import datetime

from app.db.models.arko import ArkoAdmin
from app.db.models.notification import Notification
from app.db.arko_base import ArkoSessionLocal
from app.services.email import send_database_published_email

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("", response_model=Cost360DatabaseListResponse)
def list_databases(
    db: Session = Depends(get_db),
    current_user: Optional[ArkoAdmin] = Depends(get_optional_arko_admin)
):
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
        db.execute(text("UPDATE custom_cost_items SET user_id = 1 WHERE user_id IS NULL;"))
        db.commit()
        # Reintentar la consulta
        databases = get_all_databases(db)
        
    # Filtrar por bases maestras o bases que le pertenecen al usuario
    user_dbs = []
    user_email = current_user.email.lower() if (current_user and getattr(current_user, 'email', None)) else ""
    is_superadmin = False
    if current_user:
        is_superadmin = (
            getattr(current_user, 'is_superadmin', False) or
            (user_email == 'admin@arko360.net') or
            getattr(current_user, 'role', '') in ['admin', 'superadmin']
        )
    
    logger.warning(f"[LIST_DB] user_email='{user_email}' total_dbs={len(databases)}")

    has_master = False
    for db_obj in databases:
        # Mostrar si es maestra, si está publicada, o si le pertenece al usuario
        if getattr(db_obj, 'is_master', False):
            user_dbs.append(db_obj)
            has_master = True
            logger.warning(f"[LIST_DB] Included {db_obj.id} because is_master")
        elif getattr(db_obj, 'is_published', False):
            user_dbs.append(db_obj)
            logger.warning(f"[LIST_DB] Included {db_obj.id} because is_published")
        else:
            db_owner = getattr(db_obj, 'owner_id', None)
            logger.warning(f"[LIST_DB] Checking {db_obj.id} db_owner='{db_owner}' vs user_email='{user_email}'")
            if db_owner and db_owner.lower() == user_email:
                user_dbs.append(db_obj)
                logger.warning(f"[LIST_DB] Included {db_obj.id} because owner matches")

    # Inyectar Base Personalizada (base virtual de partidas creadas por el usuario)
    if current_user:
        personalizada_db = {
            "id": "personalizada",
            "name": "Base Personalizada",
            "description": "Partidas y APUs creados por el usuario",
            "is_master": False,
            "is_active": True,
            "material_inflation": 0.0,
            "labor_inflation": 0.0,
            "equipment_inflation": 0.0,
            "source_database_id": "master",
            "created_at": None,
            "created_by": None,
            "owner_id": user_email,
            "is_published": False,
            "published_at": None,
        }
        insert_idx = 1 if has_master else 0
        user_dbs.insert(insert_idx, personalizada_db)

    # Para usuarios normales, ocultar los factores de inflación de bases publicadas
    if not is_superadmin:
        sanitized_dbs = []
        for d in user_dbs:
            is_pub = getattr(d, 'is_published', False) if not isinstance(d, dict) else d.get('is_published', False)
            if is_pub:
                sanitized_dbs.append({
                    "id": getattr(d, 'id', None) if not isinstance(d, dict) else d.get('id'),
                    "name": getattr(d, 'name', '') if not isinstance(d, dict) else d.get('name'),
                    "description": getattr(d, 'description', '') if not isinstance(d, dict) else d.get('description'),
                    "is_master": getattr(d, 'is_master', False) if not isinstance(d, dict) else d.get('is_master', False),
                    "is_active": getattr(d, 'is_active', True) if not isinstance(d, dict) else d.get('is_active', True),
                    "material_inflation": 0.0,
                    "labor_inflation": 0.0,
                    "equipment_inflation": 0.0,
                    "source_database_id": getattr(d, 'source_database_id', None) if not isinstance(d, dict) else d.get('source_database_id'),
                    "created_at": getattr(d, 'created_at', None) if not isinstance(d, dict) else d.get('created_at'),
                    "created_by": getattr(d, 'created_by', None) if not isinstance(d, dict) else d.get('created_by'),
                    "owner_id": getattr(d, 'owner_id', None) if not isinstance(d, dict) else d.get('owner_id'),
                    "is_published": True,
                    "published_at": getattr(d, 'published_at', None) if not isinstance(d, dict) else d.get('published_at'),
                })
            else:
                sanitized_dbs.append(d)
        return {"databases": sanitized_dbs}
            
    return {"databases": user_dbs}

@router.post("/initialize")
def initialize_master_database(db: Session = Depends(get_db)):
    """Inicializar la base de datos maestra si no existe"""
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
def get_database(
    database_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[ArkoAdmin] = Depends(get_optional_arko_admin)
):
    """Obtener detalles de una base de datos específica"""
    if database_id == "personalizada":
        user_email = current_user.email.lower() if (current_user and getattr(current_user, 'email', None)) else ""
        return {
            "id": "personalizada",
            "name": "Base Personalizada",
            "description": "Partidas y APUs creados por el usuario",
            "is_master": False,
            "is_active": True,
            "material_inflation": 0.0,
            "labor_inflation": 0.0,
            "equipment_inflation": 0.0,
            "source_database_id": "master",
            "created_at": None,
            "created_by": None,
            "owner_id": user_email,
            "is_published": False,
            "published_at": None,
        }
    database = get_database_by_id(db, database_id)
    if not database:
        raise HTTPException(status_code=404, detail="Base de datos no encontrada")
    
    user_email = current_user.email.lower() if current_user.email else ""
    is_superadmin = (
        getattr(current_user, 'is_superadmin', False) or
        (user_email == 'admin@arko360.net') or
        getattr(current_user, 'role', '') in ['admin', 'superadmin']
    )
    if not is_superadmin and getattr(database, 'is_published', False):
        return {
            "id": database.id,
            "name": database.name,
            "description": database.description,
            "is_master": database.is_master,
            "is_active": database.is_active,
            "material_inflation": 0.0,
            "labor_inflation": 0.0,
            "equipment_inflation": 0.0,
            "source_database_id": database.source_database_id,
            "created_at": database.created_at,
            "created_by": database.created_by,
            "owner_id": database.owner_id,
            "is_published": database.is_published,
            "published_at": database.published_at,
        }
    return database

@router.post("")
def create_database_route(payload: Cost360DatabaseCreate, db: Session = Depends(get_db), current_user = Depends(get_current_arko_admin)):
    """
    Crear una nueva base de datos (copia aislada) para el usuario
    """
    try:
        # Obtener el lÃ­mite del plan del usuario desde la DB correcta (Arko)
        limit = None  # None = sin lÃ­mite (superadmin)
        with ArkoSessionLocal() as arko_session:
            user_record = arko_session.query(ArkoAdmin).filter(
                ArkoAdmin.email == current_user.email
            ).first()
            logger.warning(f"[CREATE_DB] user={current_user.email} user_record_found={user_record is not None} max_budgets={getattr(user_record, 'max_budgets', 'N/A') if user_record else 'N/A'}")
            if user_record:
                # max_budgets NULL = sin lÃ­mite (superadmins)
                if user_record.max_budgets is not None:
                    admin_root = arko_session.query(ArkoAdmin).filter(
                        ArkoAdmin.site_config.isnot(None)
                    ).first()
                    if admin_root and admin_root.site_config:
                        limit = admin_root.site_config.get("max_user_databases", 2)
                    else:
                        limit = 2

        logger.info(f"[CREATE_DB] limit={limit} db_name={payload.name} source={payload.source_database_id}")

        if limit is not None:
            current_db_count = db.query(Cost360Database).filter(
                Cost360Database.owner_id == current_user.email
            ).count()
            
            # TODO: Hardcoded to 20 temporarily so users are not blocked while testing
            limit = 20
            
            logger.warning(f"[CREATE_DB] current_db_count={current_db_count} limit={limit}")
            if current_db_count >= limit:
                raise ValueError(f"LÃ­mite de bases de datos alcanzado ({limit} mÃ¡ximo por usuario).")

        created_by = current_user.email
        new_database = create_database(db, payload, created_by=created_by)

        return new_database
    except ValueError as e:
        logger.error(f"[CREATE_DB] ValueError: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"[CREATE_DB] Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error interno al crear la base de datos: {str(e)}")

@router.patch("/{database_id}")
def update_database_route(database_id: str, payload: Cost360DatabaseUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_arko_admin)):
    """Actualizar metadatos o estado de publicaciÃƒÂ³n"""
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
                updated_database.published_at = datetime.utcnow()

                # Notificar a los usuarios segÃºn el alcance especificado (quincenal o mensual)
                scope = getattr(payload, 'notification_scope', None)
                if scope in ("quincenal", "mensual"):
                    with ArkoSessionLocal() as arko_db:
                        if scope == "quincenal":
                            target_users = arko_db.query(ArkoAdmin).filter(
                                ArkoAdmin.is_active == True,
                                ArkoAdmin.plan.in_(["Profesional", "Experto"])
                            ).all()
                        else:  # mensual
                            target_users = arko_db.query(ArkoAdmin).filter(
                                ArkoAdmin.is_active == True,
                                ArkoAdmin.plan.in_(["BÃ¡sico", "Profesional", "Experto"])
                            ).all()

                        for target_user in target_users:
                            if scope == "quincenal":
                                msg = f"ðŸ“¢ ActualizaciÃ³n Quincenal: Ya estÃ¡ disponible la base de datos '{updated_database.name}' con precios y costos actualizados."
                            else:
                                if target_user.plan == "BÃ¡sico":
                                    msg = f"ðŸ“¢ ActualizaciÃ³n Mensual: Ya estÃ¡ disponible tu nueva base de datos '{updated_database.name}' con costos actualizados."
                                else:
                                    msg = f"ðŸ“¢ ActualizaciÃ³n de Precios: Ya estÃ¡ disponible la base de datos '{updated_database.name}' con costos actualizados."

                            notif = Notification(
                                user_id=target_user.id,
                                message=msg,
                                type="database_published"
                            )
                            db.add(notif)

                            try:
                                threading.Thread(
                                    target=send_database_published_email,
                                    args=(target_user.email, updated_database.name, scope, target_user.plan or "Plan")
                                ).start()
                            except Exception as mail_err:
                                logger.error(f"Error al iniciar hilo de correo para {target_user.email}: {mail_err}", exc_info=True)

            db.commit()
            db.refresh(updated_database)
            
        return updated_database
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{database_id}")
def delete_database_route(database_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_arko_admin)):
    """Eliminar una base de datos personalizada"""
    if database_id in ("personalizada", "master", "compartidos"):
        raise HTTPException(status_code=400, detail="No se pueden eliminar las bases de datos del sistema.")
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
