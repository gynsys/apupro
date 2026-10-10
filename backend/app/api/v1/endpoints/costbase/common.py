import re
import unicodedata
from typing import Any, Dict, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.crud.crud_costbase import get_database_by_id
from app.db.models.llm_provider import LLMProvider
from app.crud.llm import decrypt_api_key


def set_schema_for_db(db: Session, database_id: str) -> None:
    """Establece de forma segura el search_path para el esquema de la base de datos solicitada.
    Valida el formato del identificador y verifica su existencia en PostgreSQL mediante consulta parametrizada
    para prevenir inyección SQL.
    """
    if not database_id or database_id in ["master", "personalizada"]:
        return
    if not re.match(r'^[a-zA-Z0-9_]+$', database_id):
        logger.warning(f"Identificador de esquema rechazado por formato inválido: {database_id}")
        return
    try:
        exists = db.execute(
            text("SELECT 1 FROM information_schema.schemata WHERE schema_name = :schema"),
            {"schema": database_id}
        ).scalar()
        if exists:
            db.execute(text(f'SET LOCAL search_path TO "{database_id}", public'))
        else:
            logger.warning(f"El esquema '{database_id}' no existe en PostgreSQL. search_path no modificado.")
    except Exception as e:
        logger.error(f"Error setting schema for database {database_id}: {e}", exc_info=True)


def clean_cell_str(val: Any) -> str:
    """Limpia cadenas de celdas de Excel o tablas."""
    if val is None:
        return ""
    if isinstance(val, float) and val.is_integer():
        return str(int(val)).strip()
    val_str = str(val).strip()
    return "" if val_str.lower() in ("none", "nan") else val_str


def normalize_text_alphanumeric(text_val: str) -> str:
    """Normaliza texto eliminando tildes, signos de puntuación y espacios extras."""
    if not text_val or not isinstance(text_val, str):
        return ""
    nfkd = unicodedata.normalize('NFKD', text_val)
    no_accents = ''.join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9 ]', '', no_accents.lower()).strip()


def is_covenin_coded_item(item: Any) -> bool:
    """
    Verifica si una partida pertenece al catálogo de partidas tipificadas/codificadas COVENIN (~9.642 partidas).
    Excluye partidas con 'S/C', 'SC' o sin código normativo oficial.
    """
    if not item or not getattr(item, 'CovPar', None):
        return False
    cov = str(item.CovPar).strip()
    if not cov or "S/C" in cov.upper() or "SC" in cov.upper():
        return False
    return bool(re.match(r'(^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$|^[0-9]+RA$)', cov))


def get_db_factors(db: Session, database_id: str) -> Dict[str, float]:
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


def get_active_typesafe_key(db: Session) -> Optional[str]:
    """Obtiene la API key descifrada del proveedor 'typesafe' si existe y está activo."""
    try:
        provider = db.query(LLMProvider).filter(
            LLMProvider.provider_key == "typesafe",
            LLMProvider.is_active == True
        ).first()
        if provider and provider.api_key_enc:
            return decrypt_api_key(provider.api_key_enc)
    except Exception as e:
        logger.error(f"Error al obtener TypeSafe key: {e}", exc_info=True)
    return None


RESOURCE_CONFIG: Dict[str, Dict[str, str]] = {
    "materials": {
        "table": "cost360_materials",
        "id_col": "CodMat",
        "price_col": "CosMat",
        "desc_col": "Descri",
        "name": "Material",
    },
    "material": {
        "table": "cost360_materials",
        "id_col": "CodMat",
        "price_col": "CosMat",
        "desc_col": "Descri",
        "name": "Material",
    },
    "materiales": {
        "table": "cost360_materials",
        "id_col": "CodMat",
        "price_col": "CosMat",
        "desc_col": "Descri",
        "name": "Material",
    },
    "equipments": {
        "table": "cost360_equipment",
        "id_col": "CodEqu",
        "price_col": "precio",
        "desc_col": "Descri",
        "name": "Equipo",
    },
    "equipment": {
        "table": "cost360_equipment",
        "id_col": "CodEqu",
        "price_col": "precio",
        "desc_col": "Descri",
        "name": "Equipo",
    },
    "equipos": {
        "table": "cost360_equipment",
        "id_col": "CodEqu",
        "price_col": "precio",
        "desc_col": "Descri",
        "name": "Equipo",
    },
    "labors": {
        "table": "cost360_labor",
        "id_col": "CodMan",
        "price_col": "Jornal",
        "desc_col": "Descri",
        "name": "Mano de Obra",
    },
    "labor": {
        "table": "cost360_labor",
        "id_col": "CodMan",
        "price_col": "Jornal",
        "desc_col": "Descri",
        "name": "Mano de Obra",
    },
    "mano_obra": {
        "table": "cost360_labor",
        "id_col": "CodMan",
        "price_col": "Jornal",
        "desc_col": "Descri",
        "name": "Mano de Obra",
    },
    "mano-de-obra": {
        "table": "cost360_labor",
        "id_col": "CodMan",
        "price_col": "Jornal",
        "desc_col": "Descri",
        "name": "Mano de Obra",
    },
}
