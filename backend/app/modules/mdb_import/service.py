"""Servicio de importación de presupuestos desde Maprex/Lulo.

El parser usa `mdbtools`, que debe estar instalado en la imagen del backend.
Los archivos Access 1.0/2.0 muy antiguos no son compatibles con mdbtools; en
ese caso se devuelve un error claro para que el usuario exporte desde Access.
"""

from __future__ import annotations

import csv
import io
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.db.models.budget import (
    Budget,
    BudgetAPUEquipment,
    BudgetAPULabor,
    BudgetAPUMaterial,
    BudgetItem,
)

MDB_TABLES = "mdb-tables"
MDB_EXPORT = "mdb-export"
REQUIRED_TABLE = "ObraApun"


class MdbImportError(Exception):
    """Error de lectura/interpretación del archivo Access."""


def _binary(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise MdbImportError(
            "El servidor no tiene mdbtools instalado. Contacte al administrador."
        )
    return path


def _run(argv: List[str], timeout: int = 120) -> str:
    try:
        result = subprocess.run(
            argv,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise MdbImportError("El archivo tardó demasiado en procesarse.") from exc
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise MdbImportError(
            "No se pudo abrir el archivo Access. "
            "Verifique que no esté dañado, que no tenga contraseña y que sea un "
            "formato compatible con mdbtools. "
            + (detail[:500] if detail else "")
        )
    return result.stdout


def _tables(path: str) -> List[str]:
    output = _run([_binary(MDB_TABLES), "-1", path])
    return [line.strip() for line in output.splitlines() if line.strip()]


def _table(path: str, table: str) -> List[Dict[str, str]]:
    output = _run([_binary(MDB_EXPORT), path, table])
    return list(csv.DictReader(io.StringIO(output)))


def _num(value, default=0.0) -> float:
    if value is None:
        return default
    text = str(value).strip().replace(",", ".")
    if not text:
        return default
    try:
        return float(text)
    except ValueError:
        return default


def _text(value) -> str:
    return str(value or "").strip()


def _currency(project: Dict[str, str]) -> str:
    symbol = (_text(project.get("SimMon")) + " " + _text(project.get("DesMon"))).lower()
    if "bs" in symbol or "bol" in symbol:
        return "VES"
    return "USD"


def create_budget_from_mdb(
    db: Session,
    mdb_path: str,
    user_id: str,
    name: Optional[str] = None,
) -> Dict:
    """Lee el proyecto Maprex y crea un Budget con sus APUs.

    No modifica ninguna base Costbase ni el catálogo maestro.
    """

    available = set(_tables(mdb_path))
    if REQUIRED_TABLE not in available:
        raise MdbImportError(
            "El archivo no contiene la tabla ObraApun. "
            "No parece ser un presupuesto de Maprex/Lulo."
        )

    project_rows = _table(mdb_path, "ObraProy") if "ObraProy" in available else []
    project = project_rows[0] if project_rows else {}
    parts = {r["CodPar"]: r for r in _table(mdb_path, "ObraPart") if r.get("CodPar")}
    lines = _table(mdb_path, "ObraApun")
    materials = {
        r["CodMat"]: r
        for r in (_table(mdb_path, "ObraMate") if "ObraMate" in available else [])
        if r.get("CodMat")
    }
    equipments = {
        r["CodEqu"]: r
        for r in (_table(mdb_path, "ObraEqui") if "ObraEqui" in available else [])
        if r.get("CodEqu")
    }
    labors = {
        r["CodMan"]: r
        for r in (_table(mdb_path, "ObraMano") if "ObraMano" in available else [])
        if r.get("CodMan")
    }

    def recipes(table_name: str) -> Dict[str, List[Dict[str, str]]]:
        grouped: Dict[str, List[Dict[str, str]]] = {}
        if table_name not in available:
            return grouped
        for row in _table(mdb_path, table_name):
            code = _text(row.get("CodPar"))
            if code:
                grouped.setdefault(code, []).append(row)
        return grouped

    by_mat = recipes("ObraPainMate")
    by_eq = recipes("ObraPainEqui")
    by_lab = recipes("ObraPainMano")

    if not lines:
        raise MdbImportError("El archivo no contiene líneas de presupuesto (ObraApun).")

    base_name = name or _text(project.get("Descri")) or Path(mdb_path).stem
    if base_name.lower() in ("obra sin descripción", "obra sin descripcion"):
        base_name = Path(mdb_path).stem
    base_name = f"Importado MDB - {base_name}"

    budget = Budget(
        user_id=str(user_id),
        name=base_name[:250],
        description=(
            "Presupuesto importado desde Microsoft Access/Maprex. "
            f"Archivo: {Path(mdb_path).name}"
        ),
        client_name=_text(project.get("Propie")) or None,
        notes="Importación automática desde MDB. Verificar precios y APUs.",
        currency=_currency(project),
        exchange_rate=1.0,
        fcas_percent=_num(project.get("PreSoc"), 417.0),
        admin_percent=_num(project.get("Admini"), 15.0),
        profit_percent=_num(project.get("Utilid"), 10.0),
        iva_percent=_num(project.get("PorISV"), 16.0),
        labor_bonus=_num(project.get("Bono01"), 0.0),
        bono_in_fcas=False,
        project_name=_text(project.get("Descri")) or None,
    )
    db.add(budget)
    db.flush()

    created = {"items": 0, "materials": 0, "equipments": 0, "labors": 0}
    warnings: List[str] = []
    bono = _num(project.get("Bono01"), 0.0)

    for order, line in enumerate(lines, start=1):
        code = _text(line.get("CodPar"))
        if not code:
            warnings.append(f"Línea {order}: sin código de partida; se omitió.")
            continue
        part = parts.get(code, {})
        item = BudgetItem(
            budget_id=budget.id,
            cod_par=code,
            cov_par=_text(part.get("CovPar")) or None,
            description=_text(part.get("Descri")) or code,
            unit=_text(part.get("UniPar")) or "UND",
            quantity=_num(line.get("CanPar"), 0.0),
            performance=_num(line.get("RenPar") or part.get("RenPar"), 1.0),
            order=order,
            is_chapter=False,
            is_pending=False,
        )
        db.add(item)
        db.flush()
        created["items"] += 1

        for comp in by_mat.get(code, []):
            ins = materials.get(_text(comp.get("CodIns")), {})
            db.add(
                BudgetAPUMaterial(
                    budget_item_id=item.id,
                    codigo=_text(comp.get("CodIns")),
                    descripcion=_text(ins.get("Descri")) or _text(comp.get("CodIns")),
                    unidad=_text(ins.get("UniMat")) or "UND",
                    precio_unitario=_num(ins.get("CosMat"), 0.0),
                    cantidad=_num(comp.get("CanIns"), 0.0),
                    desperdicio=_num(comp.get("Desper"), 0.0),
                )
            )
            created["materials"] += 1

        for comp in by_eq.get(code, []):
            ins = equipments.get(_text(comp.get("CodIns")), {})
            price = _num(ins.get("CosEqu"), 0.0)
            if price == 0:
                price = _num(ins.get("CosDia"), 0.0)
            db.add(
                BudgetAPUEquipment(
                    budget_item_id=item.id,
                    codigo=_text(comp.get("CodIns")),
                    descripcion=_text(ins.get("Descri")) or _text(comp.get("CodIns")),
                    unidad="Día",
                    precio_unitario=price,
                    cantidad=_num(comp.get("CanIns"), 0.0),
                    depreciacion=_num(comp.get("Deprec"), 1.0),
                )
            )
            created["equipments"] += 1

        for comp in by_lab.get(code, []):
            ins = labors.get(_text(comp.get("CodIns")), {})
            db.add(
                BudgetAPULabor(
                    budget_item_id=item.id,
                    codigo=_text(comp.get("CodIns")),
                    descripcion=_text(ins.get("Descri")) or _text(comp.get("CodIns")),
                    cantidad=_num(comp.get("CanIns"), 0.0),
                    jornal=_num(ins.get("Salari"), 0.0),
                    bono=bono,
                )
            )
            created["labors"] += 1

    if created["items"] == 0:
        raise MdbImportError("El archivo no produjo ninguna partida importable.")

    db.commit()
    db.refresh(budget)
    return {
        "budget_id": budget.id,
        "name": budget.name,
        "currency": budget.currency,
        "fcas_percent": budget.fcas_percent,
        **created,
        "warnings": warnings,
    }
