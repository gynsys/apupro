"""
Endpoint para detectar materiales duplicados (exactos y similares) en la BD.
Solo lectura — no modifica ningún dato.
"""
import re
from difflib import SequenceMatcher
from collections import defaultdict
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.base import get_db
from app.core.logging import logger

router_dedup = APIRouter()


def _normalize_key(description: str) -> str:
    """Genera una clave canónica para agrupar duplicados exactos normalizados."""
    if not description:
        return ""
    text_up = description.upper()
    # Eliminar caracteres especiales, conservar alfanuméricos y espacios
    cleaned = re.sub(r'[^A-Z0-9 ]', ' ', text_up)
    # Colapsar espacios múltiples
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned


def _similarity(a: str, b: str) -> float:
    """Retorna similitud entre dos strings (0.0 a 1.0)."""
    return SequenceMatcher(None, a, b).ratio()


@router_dedup.get("/duplicates/stats")
def get_duplicate_stats(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Retorna estadísticas generales de duplicados en la BD sin modificar nada.
    """
    try:
        total_row = db.execute(text('SELECT COUNT(*) FROM cost360_materials')).scalar()

        exact_dups_row = db.execute(text("""
            SELECT COUNT(*) FROM (
                SELECT regexp_replace(upper(trim("Descri")), '[^A-Z0-9 ]', ' ', 'g') AS clave
                FROM cost360_materials
                WHERE "Descri" IS NOT NULL AND "Descri" != ''
                GROUP BY clave
                HAVING count(*) > 1
            ) sub
        """)).scalar()

        # Materiales que caen en grupos duplicados (exactos normalizados)
        in_exact_groups = db.execute(text("""
            SELECT COUNT(*) FROM cost360_materials
            WHERE "Descri" IS NOT NULL
            AND regexp_replace(upper(trim("Descri")), '[^A-Z0-9 ]', ' ', 'g') IN (
                SELECT regexp_replace(upper(trim("Descri")), '[^A-Z0-9 ]', ' ', 'g') AS clave
                FROM cost360_materials
                WHERE "Descri" IS NOT NULL AND "Descri" != ''
                GROUP BY clave
                HAVING count(*) > 1
            )
        """)).scalar()

        unique_real = int(total_row or 0) - int(in_exact_groups or 0) + int(exact_dups_row or 0)
        eliminables = int(in_exact_groups or 0) - int(exact_dups_row or 0)

        return {
            "total_materials": int(total_row or 0),
            "exact_duplicate_groups": int(exact_dups_row or 0),
            "materials_in_exact_groups": int(in_exact_groups or 0),
            "estimated_unique_real": unique_real,
            "estimated_eliminable": eliminables,
        }
    except Exception as e:
        logger.error("Error calculando stats de duplicados", exc_info=True)
        raise


@router_dedup.get("/duplicates/exact")
def get_exact_duplicates(limit: int = 200, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Retorna grupos de materiales con descripción exactamente igual (normalizada).
    No modifica ningún dato.
    """
    try:
        rows = db.execute(text(f"""
            SELECT
                regexp_replace(upper(trim("Descri")), '[^A-Z0-9 ]', ' ', 'g') AS clave,
                array_agg("CodMat" ORDER BY COALESCE("CosMat", 0) DESC) AS codigos,
                array_agg("Descri" ORDER BY COALESCE("CosMat", 0) DESC) AS descripciones,
                array_agg(COALESCE("UniMat", '') ORDER BY COALESCE("CosMat", 0) DESC) AS unidades,
                array_agg(COALESCE("CosMat", 0) ORDER BY COALESCE("CosMat", 0) DESC) AS precios,
                count(*) AS total_en_grupo
            FROM cost360_materials
            WHERE "Descri" IS NOT NULL AND "Descri" != ''
            GROUP BY clave
            HAVING count(*) > 1
            ORDER BY count(*) DESC, clave
            LIMIT {int(limit)}
        """)).fetchall()

        # Contar usos en APUs para cada código
        all_codes = []
        for row in rows:
            all_codes.extend(row[1])  # codigos column

        apu_usage_map = {}
        if all_codes:
            placeholders = ', '.join([f"'{c}'" for c in all_codes])
            usage_rows = db.execute(text(f"""
                SELECT "CodIns", COUNT(*) as usos
                FROM cost360_apu_materials
                WHERE "CodIns" IN ({placeholders})
                GROUP BY "CodIns"
            """)).fetchall()
            apu_usage_map = {r[0]: r[1] for r in usage_rows}

        groups = []
        for i, row in enumerate(rows):
            codigos = row[1]
            descripciones = row[2]
            unidades = row[3]
            precios = row[4]

            variantes = []
            for j, cod in enumerate(codigos):
                variantes.append({
                    "codigo": cod,
                    "descripcion": descripciones[j] if j < len(descripciones) else "",
                    "unidad": unidades[j] if j < len(unidades) else "",
                    "precio": float(precios[j]) if j < len(precios) else 0.0,
                    "usos_en_apu": apu_usage_map.get(cod, 0),
                })

            groups.append({
                "grupo_id": i + 1,
                "clave_normalizada": row[0],
                "total_en_grupo": int(row[5]),
                "eliminables": int(row[5]) - 1,
                "variantes": variantes,
            })

        return {"grupos": groups, "total_grupos": len(groups)}

    except Exception as e:
        logger.error("Error obteniendo duplicados exactos", exc_info=True)
        raise


@router_dedup.get("/duplicates/similar")
def get_similar_duplicates(
    threshold: float = 0.85,
    limit: int = 100,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Detecta materiales con descripciones SIMILARES (no exactas) usando fuzzy matching.
    Usa ventana deslizante sobre descripciones normalizadas ordenadas para eficiencia.
    No modifica ningún dato.
    """
    try:
        # Traer todos los materiales con descripción
        rows = db.execute(text("""
            SELECT "CodMat", "Descri", COALESCE("UniMat", '') AS "UniMat", COALESCE("CosMat", 0) AS "CosMat"
            FROM cost360_materials
            WHERE "Descri" IS NOT NULL AND "Descri" != ''
            ORDER BY upper(trim("Descri"))
        """)).fetchall()

        # Normalizar y detectar duplicados exactos primero (excluirlos de este análisis)
        exact_keys = set()
        normalized: List[tuple] = []  # (key, cod, descri, uni, precio)
        key_count: Dict[str, int] = defaultdict(int)
        for row in rows:
            k = _normalize_key(row[1])
            key_count[k] += 1
            normalized.append((k, row[0], row[1], row[2], float(row[3])))

        # Filtrar los que ya son duplicados exactos (ya los cubrimos en /exact)
        # Solo analizar los "únicos exactos" para buscar similitudes semánticas
        seen_keys: Dict[str, str] = {}  # key -> primer codigo
        candidates = []
        for (k, cod, desc, uni, precio) in normalized:
            if key_count[k] == 1:
                candidates.append((k, cod, desc, uni, precio))

        # Ventana deslizante con window=30 para buscar similitudes
        WINDOW = 30
        visited: set = set()
        groups = []
        group_id = 0

        for i in range(len(candidates)):
            if candidates[i][1] in visited:
                continue
            ki, codi, desci, unii, precioi = candidates[i]
            group_members = [(codi, desci, unii, precioi)]

            end = min(i + WINDOW, len(candidates))
            for j in range(i + 1, end):
                if candidates[j][1] in visited:
                    continue
                kj, codj, descj, unij, precioj = candidates[j]
                sim = _similarity(ki, kj)
                if sim >= threshold:
                    group_members.append((codj, descj, unij, precioj))
                    visited.add(codj)

            if len(group_members) > 1:
                # Obtener usos APU para este grupo
                group_codes = [m[0] for m in group_members]
                placeholders = ', '.join([f"'{c}'" for c in group_codes])
                usage_rows = db.execute(text(f"""
                    SELECT "CodIns", COUNT(*) as usos
                    FROM cost360_apu_materials
                    WHERE "CodIns" IN ({placeholders})
                    GROUP BY "CodIns"
                """)).fetchall()
                apu_map = {r[0]: r[1] for r in usage_rows}

                group_id += 1
                variantes = [{
                    "codigo": m[0],
                    "descripcion": m[1],
                    "unidad": m[2],
                    "precio": m[3],
                    "usos_en_apu": apu_map.get(m[0], 0),
                } for m in group_members]

                groups.append({
                    "grupo_id": group_id,
                    "total_en_grupo": len(group_members),
                    "eliminables": len(group_members) - 1,
                    "variantes": variantes,
                })
                visited.add(codi)

            if len(groups) >= limit:
                break

        return {"grupos": groups, "total_grupos": len(groups)}

    except Exception as e:
        logger.error("Error detectando duplicados similares", exc_info=True)
        raise
