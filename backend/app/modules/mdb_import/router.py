"""Endpoint de importación de presupuestos Maprex/Lulo (.mdb/.accdb)."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.v1.endpoints.arko import get_current_arko_admin
from app.db.base import get_db
from app.modules.mdb_import.service import (
    MdbImportError,
    create_budget_from_csv_zip,
    create_budget_from_mdb,
)

router = APIRouter()

MAX_MDB_BYTES = 100 * 1024 * 1024
ALLOWED_SUFFIXES = {".mdb", ".accdb", ".prx", ".zip"}


def _require_superadmin(current_user) -> None:
    allowed = (
        getattr(current_user, "is_superadmin", False) is True
        or getattr(current_user, "email", "") == "admin@arko360.net"
        or getattr(current_user, "role", "") == "superadmin"
    )
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="Solo el superadmin puede importar presupuestos desde Access.",
        )


@router.post("/import-mdb")
async def import_mdb_budget(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_arko_admin),
):
    _require_superadmin(current_user)

    filename = file.filename or "presupuesto.mdb"
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(
            status_code=400,
            detail="El archivo debe ser .mdb, .accdb, .prx o .zip.",
        )

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix="mdb_import_", suffix=suffix, delete=False
        ) as tmp:
            tmp_path = tmp.name
            total = 0
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_MDB_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="El archivo supera el límite de 100 MB.",
                    )
                tmp.write(chunk)

        result = (
            create_budget_from_csv_zip(
                db=db,
                zip_path=tmp_path,
                user_id=str(current_user.id),
            )
            if suffix == ".zip"
            else create_budget_from_mdb(
                db=db,
                mdb_path=tmp_path,
                user_id=str(current_user.id),
            )
        )
        return result
    except HTTPException:
        raise
    except MdbImportError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo importar el archivo Access: {exc}",
        ) from exc
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
