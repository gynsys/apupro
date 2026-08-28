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


def _extract_numeric_tokens(text: str) -> set:
    """
    Extrae todos los valores numéricos y fracciones de un texto.
    Incluye: enteros, decimales, fracciones (1/2, 3/4), pulgadas (1"), dimensiones (DN50, D=200)
    """
    # Fracciones tipo 1/2, 3/4, 1 1/2
    fractions = re.findall(r'\d+\s*/\s*\d+', text)
    # Números con unidad pegada: 200MM, 4", 1/2", DN50
    with_units = re.findall(r'\d+(?:[.,]\d+)?(?:\s*(?:MM|CM|M|PLG|"))?', text.upper())
    # Valores tipo D=200, DN=50
    dim_values = re.findall(r'(?:D|DN|DI|DE)\s*[=]?\s*(\d+(?:[.,]\d+)?)', text.upper())
    return set(fractions + with_units + dim_values)


def _are_dimensionally_distinct(a: str, b: str) -> bool:
    """
    Retorna True si dos descripciones difieren en algún valor numérico/dimensional.
    En ese caso NO deben considerarse duplicados, aunque el texto sea similar.
    Ej: 'ABRAZADERA D=1"' vs 'ABRAZADERA D=1/2"' → True (son distintas)
    """
    nums_a = _extract_numeric_tokens(a)
    nums_b = _extract_numeric_tokens(b)
    # Si tienen algún número que el otro NO tiene, son productos distintos
    only_in_a = nums_a - nums_b
    only_in_b = nums_b - nums_a
    return bool(only_in_a or only_in_b)


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
                    # FILTRO CRÍTICO: si difieren en valores numéricos/dimensionales
                    # (ej: D=1" vs D=1/2") NO son duplicados aunque el texto sea similar
                    if _are_dimensionally_distinct(desci, descj):
                        continue
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


from pydantic import BaseModel
from typing import List as PyList


class MergeGroup(BaseModel):
    winner_code: str
    loser_codes: PyList[str]


class MergeRequest(BaseModel):
    grupos: PyList[MergeGroup]


@router_dedup.post("/merge")
def merge_duplicates(payload: MergeRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Fusiona grupos de duplicados:
    - Redirige todas las referencias APU de los perdedores al ganador
    - Maneja conflictos de clave primaria (si el ganador ya existe en la misma APU)
    - Elimina los materiales perdedores de la BD
    IRREVERSIBLE — requiere confirmación explícita del usuario.
    """
    total_apus_redirigidas = 0
    total_eliminados = 0
    errores = []

    for grupo in payload.grupos:
        winner = grupo.winner_code
        losers = [c for c in grupo.loser_codes if c != winner]

        if not losers:
            continue

        # Validar que el ganador existe
        winner_exists = db.execute(
            text('SELECT 1 FROM cost360_materials WHERE "CodMat" = :cod'),
            {"cod": winner}
        ).scalar()
        if not winner_exists:
            errores.append(f"Ganador '{winner}' no existe en la BD")
            continue

        for loser in losers:
            try:
                # 1. Obtener todas las APUs que usan el loser
                apu_rows = db.execute(
                    text('SELECT "CodPar", "CanIns", "Desper" FROM cost360_apu_materials WHERE "CodIns" = :loser'),
                    {"loser": loser}
                ).fetchall()

                for apu_row in apu_rows:
                    cod_par = apu_row[0]
                    can_ins = apu_row[1]
                    desper = apu_row[2]

                    # Verificar si el ganador ya existe en esta misma APU (conflicto PK)
                    winner_in_apu = db.execute(
                        text('SELECT 1 FROM cost360_apu_materials WHERE "CodPar" = :par AND "CodIns" = :winner'),
                        {"par": cod_par, "winner": winner}
                    ).scalar()

                    if winner_in_apu:
                        # Conflicto: la APU ya tiene el ganador — simplemente borramos la fila del loser
                        db.execute(
                            text('DELETE FROM cost360_apu_materials WHERE "CodPar" = :par AND "CodIns" = :loser'),
                            {"par": cod_par, "loser": loser}
                        )
                    else:
                        # No hay conflicto — redirigir la referencia al ganador
                        db.execute(
                            text('UPDATE cost360_apu_materials SET "CodIns" = :winner WHERE "CodPar" = :par AND "CodIns" = :loser'),
                            {"winner": winner, "par": cod_par, "loser": loser}
                        )
                        total_apus_redirigidas += 1

                # 2. También redirigir en equipos y mano de obra si tuvieran tablas similares
                # (por si acaso, intentamos — no falla si no existe)
                try:
                    db.execute(
                        text('DELETE FROM historial_precios WHERE material_id = :loser'),
                        {"loser": loser}
                    )
                except Exception:
                    pass  # tabla puede no tener este registro

                # 3. Eliminar el material perdedor
                db.execute(
                    text('DELETE FROM cost360_materials WHERE "CodMat" = :loser'),
                    {"loser": loser}
                )
                total_eliminados += 1

            except Exception as e:
                logger.error(f"Error fusionando {loser} → {winner}: {e}", exc_info=True)
                db.rollback()
                errores.append(f"Error en {loser} → {winner}: {str(e)}")
                continue

        db.commit()

    return {
        "status": "success" if not errores else "partial",
        "materiales_eliminados": total_eliminados,
        "apus_redirigidas": total_apus_redirigidas,
        "errores": errores,
    }
