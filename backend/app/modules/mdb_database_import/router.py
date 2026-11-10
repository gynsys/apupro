"""Router de importación de bases de datos CostBase desde archivos Maprex (.mdb, .accdb, .prx, .zip)."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.v1.endpoints.arko import get_current_arko_admin
from app.core.logging import logger
from app.db.base import get_db
from app.db.models.arko import ArkoAdmin
from app.modules.mdb_database_import.service import (
    MdbDatabaseImportError,
    create_costbase_from_csv_zip,
    create_costbase_from_mdb,
)

router = APIRouter()

MAX_MDB_BYTES = 150 * 1024 * 1024  # 150 MB
ALLOWED_SUFFIXES = {".mdb", ".accdb", ".prx", ".zip"}


def _require_superadmin(current_user: ArkoAdmin) -> None:
    """Verifica que el usuario actual tenga permisos de superadministrador."""
    allowed = (
        getattr(current_user, "is_superadmin", False) is True
        or getattr(current_user, "email", "").lower() == "admin@arko360.net"
        or getattr(current_user, "role", "") == "superadmin"
    )
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="Solo el superadministrador puede crear o importar bases de datos completas.",
        )


@router.post("/import-mdb")
async def import_mdb_database_endpoint(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    is_published: bool = Form(True),
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """
    Importa un archivo Maprex Access (.mdb, .accdb) o un ZIP de CSVs para generar
    una base de datos oficial e independiente en CostBase con sus catálogos y recetas APU.
    """
    _require_superadmin(current_user)

    clean_name = (name or "").strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="El nombre de la base de datos es obligatorio.")

    filename = file.filename or "base_maprex.mdb"
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(
            status_code=400,
            detail="Formato no soportado. Debe ser un archivo .mdb, .accdb, .prx o un ZIP con CSVs.",
        )

    tmp_path: Optional[str] = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix="mdb_db_import_", suffix=suffix, delete=False
        ) as tmp:
            tmp_path = tmp.name
            total_bytes = 0
            while chunk := await file.read(1024 * 1024):
                total_bytes += len(chunk)
                if total_bytes > MAX_MDB_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="El archivo excede el límite permitido de 150 MB.",
                    )
                tmp.write(chunk)

        user_email = str(current_user.email).strip().lower()
        if suffix == ".zip":
            result = create_costbase_from_csv_zip(
                db=db,
                zip_path=tmp_path,
                name=clean_name,
                description=description,
                user_email=user_email,
                is_published=is_published,
            )
        else:
            result = create_costbase_from_mdb(
                db=db,
                mdb_path=tmp_path,
                name=clean_name,
                description=description,
                user_email=user_email,
                is_published=is_published,
            )

        return result

    except HTTPException:
        raise
    except MdbDatabaseImportError as exc:
        db.rollback()
        logger.error("[MDB_ROUTER] Error controlado en importación: %s", exc, exc_info=True)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        logger.error("[MDB_ROUTER] Error inesperado importando base de datos Access: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al procesar la base de datos: {str(exc)}",
        ) from exc
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError as cleanup_err:
                logger.warning("[MDB_ROUTER] No se pudo borrar archivo temporal %s: %s", tmp_path, cleanup_err)
