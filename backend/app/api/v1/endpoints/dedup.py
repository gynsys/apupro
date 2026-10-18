"""
Endpoint para detectar y fusionar insumos duplicados (materiales, equipos y mano de obra) en la BD.
"""
import re
from collections import defaultdict
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.db.base import get_db

router_dedup = APIRouter()


class MergeGroup(BaseModel):
    winner_code: str
    loser_codes: List[str]
    winner_price: Optional[float] = None


class MergeRequest(BaseModel):
    grupos: List[MergeGroup]
    resource_type: str = "materials"


# Conjuntos de tokens mutuamente excluyentes que NUNCA deben proponerse como duplicados similares
CONFLICTING_TOKEN_SETS: List[Set[str]] = [
    {"MORT", "MORTERO", "JM", "GOMA", "JG"},
    {"ISO", "ASTM"},
    {"TTU", "TW", "THHN", "THWN", "SPT"},
    {"ENCHUFABLE", "ATORNILLABLE", "THQL", "THQC", "HQP", "HQC", "TQL", "TQC"},
    {"DARC", "DAR"},
    {"HG", "HF", "PVC", "CPVC", "COBRE", "PEAD", "CONCRETO", "ACERO", "ALUMINIO", "BRONCE"},
    {"NAB", "NLAB", "TAA", "TP2", "TP3"},
    {"EMBUTIR", "EMBU", "SUPERFICIAL", "SUP"},
    {"SENCILLA", "SENCILLO", "SIMPLE", "DOBLE", "TRIPLE"},
    {"ALTA", "BAJA"},
    {"LIVIANO", "PESADO"},
    {"METALICO", "METALICA", "PLASTICO", "PLASTICA"},
    {"INTERIOR", "EXTERIOR"},
    {"BLANCO", "BLANCA", "GRIS", "NEGRO", "NEGRA", "AMARILLO", "AMARILLA", "ROJO", "ROJA", "AZUL", "VERDE", "CAOBA", "NOGAL", "OSCURO", "CLARO"},
    {"HEXAGONAL", "RECTANGULAR", "CIRCULAR"},
    {"CORTO", "LARGO"},
    {"MANO", "PIE"},
    {"HORIZONTAL", "VERTICAL"},
    {"LIMPIA", "SUCIA"},
    {"MACHO", "HEMBRA"},
    {"PRIVADO", "PRIVADA", "PUBLICO", "PUBLICA"},
    {"ACETILENO", "PROPANO", "OXIGENO", "ARGON"},
    {"NITRILO", "LATEX"},
    {"ANEMOMETRO", "BAROMETRO", "HIGROMETRO"},
    {"ENGRASE", "ESTACAS", "VOLTEO", "CISTERNA"},
    {"SOLDADOR", "MECANICO", "FABRICADOR", "CARPINTERO", "CABILLERO", "PLOMERO", "PINTOR", "LINIERO", "LATONERO", "ALBANIL", "ELECTRICISTA", "RESCATISTA", "MARINERO", "MARTILLERO", "MOTORISTA", "MONTADOR"},
    {"MOTONIVELADORA", "MOTOTRAILLA", "MOTOSIERRA", "PAYLOADER", "PATROL", "RETROEXCAVADORA", "EXCAVADORA"},
    {"COSTOS", "COMPUTISTA", "SUELOS", "RESIDENTE"},
    {"CELOSIA", "TELESCOPICA"},
    {"H2S", "O2", "CL2", "NO2", "CO2", "SO2", "NH3", "PH3"},
]

CONFLICTING_PHRASE_PAIRS: List[Tuple[str, str]] = [
    ("CON CONTROL", "SIN CONTROL"),
    ("C/CONTROL", "S/CONTROL"),
    ("C/C", "S/C"),
    ("CON RIPPER", "SIN RIPPER"),
    ("CON PERLAS", "SIN PERLAS"),
    ("CON AISLADORES", "SIN AISLADORES"),
    ("CON VIDRIO", "SIN VIDRIO"),
    ("CON LUZ", "SIN LUZ"),
    ("CEPILLADA", "SIN CEPILLA"),
    ("EN CONTACTO", "NO CONTACTO"),
    ("A/F", "A/C"),
    ("A.B.", "A.N."),
    ("DOBLE JUNTA", "EXJUNTA"),
    ("CXC", "EXC"),
    ("EXE", "EXC"),
    ("TIPO L", "TIPO K"),
    ("ISO I", "ISO II"),
]


def _get_catalog_meta(resource_type: str) -> Dict[str, str]:
    """Retorna metadatos de tabla y columnas según el tipo de insumo."""
    rt = (resource_type or "materials").strip().lower()
    if rt not in {"materials", "equipment", "labor"}:
        raise ValueError(f"Tipo de recurso inválido: {resource_type}")
    if rt == "equipment":
        return {
            "resource_type": "equipment",
            "table": "cost360_equipment",
            "code_col": "CodEqu",
            "desc_col": "Descri",
            "unit_col": "",
            "price_col": "CosDia",
            "apu_table": "cost360_apu_equipment",
            "budget_table": "budget_apu_equipments",
        }
    if rt == "labor":
        return {
            "resource_type": "labor",
            "table": "cost360_labor",
            "code_col": "CodMan",
            "desc_col": "Descri",
            "unit_col": "",
            "price_col": "Jornal",
            "apu_table": "cost360_apu_labor",
            "budget_table": "budget_apu_labors",
        }
    return {
        "resource_type": "materials",
        "table": "cost360_materials",
        "code_col": "CodMat",
        "desc_col": "Descri",
        "unit_col": "UniMat",
        "price_col": "CosMat",
        "apu_table": "cost360_apu_materials",
        "budget_table": "budget_apu_materials",
    }


def _normalize_key(description: str) -> str:
    """Genera una clave canónica para agrupar duplicados exactos normalizados."""
    if not description:
        return ""
    text_up = description.upper()
    for src, dst in [("Á", "A"), ("É", "E"), ("Í", "I"), ("Ó", "O"), ("Ú", "U"), ("Ü", "U")]:
        text_up = text_up.replace(src, dst)
    text_up = text_up.replace(">=", " MAYOR IGUAL ").replace("<=", " MENOR IGUAL ")
    text_up = text_up.replace(">", " MAYOR ").replace("<", " MENOR ")
    text_up = re.sub(r"\b(\d+(?:[.,]\d+)?)\s*K[GO]F\b", r"\1 KG", text_up)
    text_up = re.sub(r"\bK[GO]F\b", "KG", text_up)
    cleaned = re.sub(r"[^A-Z0-9 ]", " ", text_up)
    return re.sub(r"\s+", " ", cleaned).strip()


def _normalize_unit(unit_str: str) -> str:
    """Normaliza unidades físicas equivalentes para evitar fusionar presentaciones distintas."""
    u = (unit_str or "").strip().upper()
    mapping = {
        "M2": "M2", "MT2": "M2",
        "M3": "M3", "MT3": "M3",
        "M": "M", "ML": "M", "MT": "M", "MTS": "M",
        "UND": "UND", "UNID": "UND", "PZA": "UND", "PIEZA": "UND", "U": "UND",
        "KG": "KG", "KGF": "KG", "KGS": "KG", "KOF": "KG",
        "GAL": "GAL", "GALON": "GAL", "GLN": "GAL",
        "CUN": "CUNETE", "CUÑ": "CUNETE", "CUÑET": "CUNETE", "CUÑETE": "CUNETE", "CUNETE": "CUNETE", "CUFIET": "CUNETE",
        "SAC": "SACO", "SACO": "SACO", "SCO": "SACO",
        "ROL": "ROLLO", "ROLLO": "ROLLO", "RLL": "ROLLO",
        "SG": "SG", "S/G": "SG", "GLB": "SG",
        "LT": "LT", "LTS": "LT", "LITRO": "LT", "L": "LT",
        "CAJA": "CAJA", "CJA": "CAJA",
        "CILIN": "CIL", "CIL": "CIL",
        "JGO": "JGO", "JUEGO": "JGO",
    }
    return mapping.get(u, u)


def _extract_numeric_tokens(text_val: str) -> set:
    """Extrae valores numéricos, fracciones mixtas y dimensiones."""
    if not text_val:
        return set()
    up = text_val.upper()
    mixed_fractions = re.findall(r"\d+\s+\d+\s*/\s*\d+", up)
    fractions = re.findall(r"\d+\s*/\s*\d+", up)
    numbers = re.findall(r"\d+(?:[.,]\d+)?", up)
    norm_nums = [n.replace(",", ".") for n in numbers]
    return set(mixed_fractions + fractions + norm_nums)


def _has_conflicting_specs(a: str, b: str) -> bool:
    """Retorna True si dos descripciones difieren en dimensiones o especificaciones técnicas mutuamente excluyentes."""
    if not a or not b:
        return False
    nums_a = _extract_numeric_tokens(a)
    nums_b = _extract_numeric_tokens(b)
    if (nums_a - nums_b) or (nums_b - nums_a):
        return True

    up_a = a.upper()
    up_b = b.upper()

    for p1, p2 in CONFLICTING_PHRASE_PAIRS:
        if (p1 in up_a and p2 in up_b) or (p2 in up_a and p1 in up_b):
            return True

    words_a = set(re.findall(r"[A-Z0-9]+", _normalize_key(a)))
    words_b = set(re.findall(r"[A-Z0-9]+", _normalize_key(b)))

    # Verificar grados/categorías entre comillas o letras aisladas ("A" vs "B" vs "C", NIVEL I vs II vs III)
    grades_a = set(re.findall(r'"([ABC])"|\bNIVEL\s+(I{1,3})\b', up_a))
    grades_b = set(re.findall(r'"([ABC])"|\bNIVEL\s+(I{1,3})\b', up_b))
    if grades_a and grades_b and grades_a != grades_b:
        return True

    for conflict_set in CONFLICTING_TOKEN_SETS:
        found_a = words_a & conflict_set
        found_b = words_b & conflict_set
        if found_a and found_b and found_a != found_b:
            return True

    return False


def _similarity(a: str, b: str) -> float:
    """Retorna similitud entre dos strings (0.0 a 1.0)."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def _fetch_catalog_rows_with_usage(db: Session, meta: Dict[str, str]) -> List[Dict[str, Any]]:
    """Carga los registros del catálogo junto con su conteo de usos en APUs."""
    tbl = meta["table"]
    c_col = meta["code_col"]
    d_col = meta["desc_col"]
    u_col = meta["unit_col"]
    p_col = meta["price_col"]
    apu_tbl = meta["apu_table"]

    unit_expr = f'COALESCE("{u_col}", \'\')' if u_col else "'dia'"
    rows = db.execute(text(f"""
        SELECT "{c_col}", "{d_col}", {unit_expr} AS unit_val, COALESCE("{p_col}", 0) AS price_val
        FROM {tbl}
        WHERE "{d_col}" IS NOT NULL AND "{d_col}" != ''
    """)).fetchall()

    usage_rows = db.execute(text(f"""
        SELECT "CodIns", COUNT(*) AS usos
        FROM {apu_tbl}
        GROUP BY "CodIns"
    """)).fetchall()
    usage_map = {r[0]: int(r[1]) for r in usage_rows}

    items: List[Dict[str, Any]] = []
    for r in rows:
        cod = r[0]
        desc = (r[1] or "").strip()
        uni = (r[2] or "").strip()
        price = float(r[3] or 0.0)
        items.append({
            "codigo": cod,
            "descripcion": desc,
            "unidad": uni,
            "unidad_norm": _normalize_unit(uni) if u_col else "DIA",
            "precio": price,
            "usos_en_apu": usage_map.get(cod, 0),
            "clave": _normalize_key(desc),
        })
    return items


def _attach_apu_samples(db: Session, meta: Dict[str, str], groups: List[Dict[str, Any]]) -> None:
    """Adjunta hasta 4 partidas APU de ejemplo a cada variante de los grupos para inspección en UI."""
    all_codes = [
        v["codigo"]
        for g in groups
        for v in g.get("variantes", [])
        if v.get("usos_en_apu", 0) > 0
    ]
    if not all_codes:
        return

    apu_tbl = meta["apu_table"]
    rows = db.execute(
        text(f"""
            SELECT a."CodIns", a."CodPar", COALESCE(i."Descri", '')
            FROM {apu_tbl} a
            LEFT JOIN cost360_items i ON a."CodPar" = i."CodPar"
            WHERE a."CodIns" = ANY(:codes)
            ORDER BY a."CodPar"
        """),
        {"codes": list(set(all_codes))},
    ).fetchall()

    samples_map: Dict[str, List[Dict[str, str]]] = defaultdict(list)
    for cod_ins, cod_par, descri in rows:
        if len(samples_map[cod_ins]) < 4:
            samples_map[cod_ins].append({
                "cod_par": cod_par,
                "descripcion": (descri or "").strip()[:110],
            })

    for g in groups:
        for v in g.get("variantes", []):
            v["apus_muestra"] = samples_map.get(v["codigo"], [])


def _compute_similar_groups(items: List[Dict[str, Any]], threshold: float, limit: int) -> List[Dict[str, Any]]:
    """Calcula grupos de duplicados similares excluyendo conflictos dimensionales o técnicos."""
    sorted_items = sorted(items, key=lambda x: x["clave"])
    key_count: Dict[tuple, int] = defaultdict(int)
    for it in sorted_items:
        key_count[(it["clave"], it["unidad_norm"])] += 1

    candidates = [it for it in sorted_items if key_count[(it["clave"], it["unidad_norm"])] == 1]

    window = 30
    visited: set = set()
    groups: List[Dict[str, Any]] = []
    group_id = 0

    for i in range(len(candidates)):
        ci = candidates[i]
        if ci["codigo"] in visited:
            continue
        group_members = [ci]
        end = min(i + window, len(candidates))
        for j in range(i + 1, end):
            cj = candidates[j]
            if cj["codigo"] in visited:
                continue
            if ci["unidad_norm"] != cj["unidad_norm"]:
                continue
            if len(ci["descripcion"]) == 40 and len(cj["descripcion"]) == 40:
                continue
            sim = _similarity(ci["clave"], cj["clave"])
            if sim >= threshold:
                if _has_conflicting_specs(ci["descripcion"], cj["descripcion"]):
                    continue
                group_members.append(cj)
                visited.add(cj["codigo"])

        if len(group_members) > 1:
            group_id += 1
            group_members.sort(key=lambda x: (-x["usos_en_apu"], x["codigo"]))
            groups.append({
                "grupo_id": group_id,
                "unidad_grupo": ci["unidad_norm"],
                "truncated_40char_warning": any(len(m["descripcion"]) == 40 for m in group_members),
                "total_en_grupo": len(group_members),
                "eliminables": len(group_members) - 1,
                "variantes": [
                    {
                        "codigo": m["codigo"],
                        "descripcion": m["descripcion"],
                        "unidad": m["unidad"],
                        "precio": m["precio"],
                        "usos_en_apu": m["usos_en_apu"],
                        "apus_muestra": [],
                    }
                    for m in group_members
                ],
            })
            visited.add(ci["codigo"])

        if len(groups) >= limit:
            break

    return groups


@router_dedup.get("/duplicates/stats")
def get_duplicate_stats(
    resource_type: str = "materials",
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retorna estadísticas generales de duplicados exactos y similares en la BD."""
    meta = _get_catalog_meta(resource_type)
    try:
        items = _fetch_catalog_rows_with_usage(db, meta)
        groups: Dict[tuple, List[Dict[str, Any]]] = defaultdict(list)
        for it in items:
            if it["clave"]:
                groups[(it["clave"], it["unidad_norm"])].append(it)

        exact_groups = [v for v in groups.values() if len(v) > 1]
        in_exact_groups = sum(len(g) for g in exact_groups)
        total_items = len(items)
        exact_dups_count = len(exact_groups)
        unique_real = total_items - in_exact_groups + exact_dups_count
        eliminables = in_exact_groups - exact_dups_count

        similar_groups = _compute_similar_groups(items, threshold=0.85, limit=300)
        similar_eliminables = sum(g["eliminables"] for g in similar_groups)

        return {
            "resource_type": meta["resource_type"],
            "total_materials": total_items,
            "exact_duplicate_groups": exact_dups_count,
            "materials_in_exact_groups": in_exact_groups,
            "estimated_unique_real": unique_real,
            "estimated_eliminable": eliminables,
            "similar_duplicate_groups": len(similar_groups),
            "similar_eliminable": similar_eliminables,
        }
    except Exception:
        logger.error("Error calculando stats de duplicados", exc_info=True)
        raise


@router_dedup.get("/duplicates/exact")
def get_exact_duplicates(
    limit: int = 200,
    resource_type: str = "materials",
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Retorna grupos de insumos con descripción normalizada y unidad física idéntica."""
    if limit <= 0:
        raise ValueError("El límite debe ser mayor que cero")
    meta = _get_catalog_meta(resource_type)
    try:
        items = _fetch_catalog_rows_with_usage(db, meta)
        grouped: Dict[tuple, List[Dict[str, Any]]] = defaultdict(list)
        for it in items:
            if it["clave"]:
                grouped[(it["clave"], it["unidad_norm"])].append(it)

        groups = []
        gid = 0
        for (clave, _uni_norm), members in sorted(grouped.items(), key=lambda x: (-len(x[1]), x[0][0])):
            if len(members) <= 1:
                continue

            gid += 1
            variantes = sorted(
                members,
                key=lambda x: (-x["usos_en_apu"], x["precio"] if x["precio"] > 0 else 999999.0, x["codigo"]),
            )
            groups.append({
                "grupo_id": gid,
                "clave_normalizada": clave,
                "unidad_grupo": _uni_norm,
                "truncated_40char_warning": any(len(v["descripcion"]) == 40 for v in variantes),
                "total_en_grupo": len(variantes),
                "eliminables": len(variantes) - 1,
                "variantes": [
                    {
                        "codigo": v["codigo"],
                        "descripcion": v["descripcion"],
                        "unidad": v["unidad"],
                        "precio": v["precio"],
                        "usos_en_apu": v["usos_en_apu"],
                        "apus_muestra": [],
                    }
                    for v in variantes
                ],
            })
            if len(groups) >= limit:
                break

        _attach_apu_samples(db, meta, groups)
        return {"grupos": groups, "total_grupos": len(groups), "resource_type": meta["resource_type"]}
    except Exception:
        logger.error("Error obteniendo duplicados exactos", exc_info=True)
        raise


@router_dedup.get("/duplicates/similar")
def get_similar_duplicates(
    threshold: float = 0.85,
    limit: int = 100,
    resource_type: str = "materials",
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Detecta insumos con descripciones similares (>= threshold) y misma unidad física."""
    if limit <= 0 or not (0.5 <= threshold <= 1.0):
        raise ValueError("Parámetros de similitud fuera de rango")
    meta = _get_catalog_meta(resource_type)
    try:
        items = _fetch_catalog_rows_with_usage(db, meta)
        groups = _compute_similar_groups(items, threshold=threshold, limit=limit)
        _attach_apu_samples(db, meta, groups)
        return {"grupos": groups, "total_grupos": len(groups), "resource_type": meta["resource_type"]}
    except Exception:
        logger.error("Error detectando duplicados similares", exc_info=True)
        raise


@router_dedup.post("/merge")
def merge_duplicates(payload: MergeRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Fusiona grupos de insumos duplicados (materiales, equipos o mano de obra):
    - Redirige todas las referencias APU y de presupuestos de los perdedores al ganador
    - Permite actualizar el precio del ganador si se especifica winner_price
    - Elimina los códigos perdedores de la BD
    """
    meta = _get_catalog_meta(payload.resource_type)
    tbl = meta["table"]
    c_col = meta["code_col"]
    p_col = meta["price_col"]
    apu_tbl = meta["apu_table"]
    budget_tbl = meta["budget_table"]

    total_apus_redirigidas = 0
    total_eliminados = 0
    errores: List[str] = []

    for grupo in payload.grupos:
        winner = grupo.winner_code
        losers = [c for c in grupo.loser_codes if c != winner]
        if not losers:
            continue

        winner_exists = db.execute(
            text(f'SELECT 1 FROM {tbl} WHERE "{c_col}" = :cod'),
            {"cod": winner},
        ).scalar()
        if not winner_exists:
            errores.append(f"Ganador '{winner}' no existe en {tbl}")
            continue

        if grupo.winner_price is not None and grupo.winner_price > 0:
            db.execute(
                text(f'UPDATE {tbl} SET "{p_col}" = :p WHERE "{c_col}" = :cod'),
                {"p": float(grupo.winner_price), "cod": winner},
            )

        for loser in losers:
            try:
                apu_rows = db.execute(
                    text(f'SELECT "CodPar" FROM {apu_tbl} WHERE "CodIns" = :loser'),
                    {"loser": loser},
                ).fetchall()

                for (cod_par,) in apu_rows:
                    winner_in_apu = db.execute(
                        text(f'SELECT 1 FROM {apu_tbl} WHERE "CodPar" = :par AND "CodIns" = :winner'),
                        {"par": cod_par, "winner": winner},
                    ).scalar()

                    if winner_in_apu:
                        db.execute(
                            text(f'DELETE FROM {apu_tbl} WHERE "CodPar" = :par AND "CodIns" = :loser'),
                            {"par": cod_par, "loser": loser},
                        )
                    else:
                        db.execute(
                            text(f'UPDATE {apu_tbl} SET "CodIns" = :winner WHERE "CodPar" = :par AND "CodIns" = :loser'),
                            {"winner": winner, "par": cod_par, "loser": loser},
                        )
                        total_apus_redirigidas += 1

                db.execute(
                    text(f"UPDATE {budget_tbl} SET codigo = :winner WHERE codigo = :loser"),
                    {"winner": winner, "loser": loser},
                )

                if meta["resource_type"] == "materials":
                    db.execute(
                        text('UPDATE cost360_material_synonyms SET "CodMat" = :winner WHERE "CodMat" = :loser'),
                        {"winner": winner, "loser": loser},
                    )

                db.execute(
                    text(f'DELETE FROM {tbl} WHERE "{c_col}" = :loser'),
                    {"loser": loser},
                )
                total_eliminados += 1

            except Exception as e:
                logger.error(f"Error fusionando {loser} -> {winner} en {tbl}: {e}", exc_info=True)
                db.rollback()
                errores.append(f"Error en {loser} -> {winner}: {str(e)}")
                continue

        db.commit()

    return {
        "status": "success" if not errores else "partial",
        "materiales_eliminados": total_eliminados,
        "apus_redirigidas": total_apus_redirigidas,
        "errores": errores,
    }
