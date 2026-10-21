"""Mapeo entre los códigos de referencia visibles y los códigos internos de Maprex."""
from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.db.models.costbase import CostEquipment, CostLabor, CostMaterial


def _normalize(text: Any) -> str:
    value = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode()
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def build_code_maps(db: Session) -> Dict[str, Dict[str, list]]:
    """Devuelve ref_code -> [(CodMat/CodEqu/CodMan, Descri)] para los tres catálogos."""
    configs = (
        ("materials", CostMaterial, CostMaterial.CodMat),
        ("equipments", CostEquipment, CostEquipment.CodEqu),
        ("labors", CostLabor, CostLabor.CodMan),
    )
    maps: Dict[str, Dict[str, list]] = {}
    for key, model, code_column in configs:
        rows = (
            db.query(model.ref_code, code_column, model.Descri)
            .filter(model.ref_code.isnot(None))
            .all()
        )
        catalog: Dict[str, list] = {}
        for ref_code, native_code, description in rows:
            ref = str(ref_code or "").strip()
            native = str(native_code or "").strip()
            if not ref or not native:
                continue
            catalog.setdefault(ref, []).append((native, str(description or "")))
        maps[key] = catalog
    return maps


def resolve_native_code(
    code: Any,
    description: Any,
    kind: str,
    maps: Dict[str, Dict[str, list]],
) -> str:
    """Convierte un código de referencia al código interno de Maprex."""
    raw = str(code or "").strip()
    if not raw:
        return raw
    candidates = maps.get(kind, {}).get(raw)
    if not candidates:
        return raw
    if len(candidates) == 1:
        return candidates[0][0]

    target = _normalize(description)
    for native, candidate_description in candidates:
        if _normalize(candidate_description) == target:
            return native

    target_tokens = set(target.split())
    best = max(
        candidates,
        key=lambda item: len(target_tokens & set(_normalize(item[1]).split())),
    )
    return best[0]


def apply_code_maps(items_data: list, maps: Dict[str, Dict[str, list]]) -> None:
    """Reemplaza in-place los códigos de referencia por los códigos Maprex."""
    for entry in items_data or []:
        if not isinstance(entry, dict):
            continue
        for kind, field in (
            ("materials", "materials"),
            ("equipments", "equipments"),
            ("labors", "labors"),
        ):
            for row in entry.get(field) or []:
                if not isinstance(row, dict):
                    continue
                original = row.get("codigo") or row.get("CodIns") or row.get("CodMat") or row.get("CodEqu") or row.get("CodMan")
                description = row.get("descripcion") or row.get("Descri") or ""
                mapped = resolve_native_code(original, description, kind, maps)
                if mapped:
                    row["codigo"] = mapped
