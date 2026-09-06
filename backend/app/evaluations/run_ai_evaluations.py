"""
Runner de Evaluación y Diagnóstico para el Motor de Búsqueda APU.

Permite ejecutar:
1. Matriz de Casos Límite (Edge Cases)
2. Minería Inversa y Consultas Sintéticas (Stress Testing Masivo)
3. Evaluación Consolidada Completa con Scorecard de Métricas
"""

import argparse
import json
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

# Inyectar ruta backend al PATH para ejecuciones directas
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.logging import logger
from app.db.base import get_db
from app.services.ai_search import ai_engine, detect_materials
from app.services.dimension_service import extract_unified_dimensions, score_dimension_match
from app.services.eval_edge_cases import EDGE_CASES_SUITE, EdgeCase
from app.services.eval_perturbation_service import PerturbationResult, perturb_description


def evaluate_single_edge_case(db: Session, edge_case: EdgeCase) -> Dict[str, Any]:
    """Ejecuta una búsqueda híbrida para un caso límite y evalúa las restricciones conceptuales."""
    if not edge_case:
        raise ValueError("edge_case no puede ser None")

    start_t = time.time()
    results = ai_engine.hybrid_search(db, edge_case.query, limit=5)
    elapsed_ms = (time.time() - start_t) * 1000.0

    if not results:
        return {
            "case_id": edge_case.case_id,
            "category": edge_case.category,
            "query": edge_case.query,
            "passed": False,
            "top_1_id": None,
            "top_1_desc": "",
            "top_1_unit": "",
            "top_1_score": 0.0,
            "failures": ["El motor no devolvió ningún resultado"],
            "elapsed_ms": elapsed_ms,
        }

    top_1 = results[0]
    row = db.execute(
        text('SELECT "CodPar", "Descri", "UniPar" FROM cost360_items WHERE "CodPar" = :cid'),
        {"cid": top_1["id"]},
    ).fetchone()

    top_desc = row[1] if row and row[1] else ""
    top_unit = row[2] if row and row[2] else ""

    passed, failures = edge_case.evaluate(
        item_id=top_1["id"],
        item_desc=top_desc,
        item_unit=top_unit,
    )

    return {
        "case_id": edge_case.case_id,
        "category": edge_case.category,
        "query": edge_case.query,
        "passed": passed,
        "top_1_id": top_1["id"],
        "top_1_desc": top_desc,
        "top_1_unit": top_unit,
        "top_1_score": top_1["score"],
        "failures": failures,
        "elapsed_ms": elapsed_ms,
    }


def run_edge_cases_suite(db: Session) -> Dict[str, Any]:
    """Ejecuta la suite completa de casos límite y calcula métricas por cuadrante."""
    print("\n" + "=" * 90)
    print("EJECUTANDO CASO 3: MATRIZ DE CASOS LÍMITE (EDGE CASES)")
    print("=" * 90)

    results: List[Dict[str, Any]] = []
    category_stats: Dict[str, Dict[str, int]] = {}

    for ec in EDGE_CASES_SUITE:
        cat = ec.category
        if cat not in category_stats:
            category_stats[cat] = {"total": 0, "passed": 0}
        category_stats[cat]["total"] += 1

        eval_res = evaluate_single_edge_case(db, ec)
        results.append(eval_res)

        status_str = "[PASS]" if eval_res["passed"] else "[FAIL]"
        if eval_res["passed"]:
            category_stats[cat]["passed"] += 1

        print(f" {status_str} {ec.case_id:<24} | Cat: {ec.category:<24} | Top-1: {eval_res['top_1_id'] or 'NONE'}")
        if not eval_res["passed"]:
            print(f"        Query: '{ec.query}'")
            print(f"        Desc:  {eval_res['top_1_desc'][:80]}...")
            print(f"        Fallo: {', '.join(eval_res['failures'])}")

    total_cases = len(results)
    passed_cases = sum(1 for r in results if r["passed"])
    rate = (passed_cases / total_cases * 100.0) if total_cases > 0 else 0.0

    print("\n" + "-" * 90)
    print("RESUMEN POR CUADRANTE DE CASOS LÍMITE:")
    for cat_name, stats in category_stats.items():
        cat_rate = (stats["passed"] / stats["total"] * 100.0) if stats["total"] > 0 else 0.0
        print(f" - {cat_name:<30}: {stats['passed']}/{stats['total']} ({cat_rate:.1f}%)")

    print(f"\nTOTAL CASOS LÍMITE: {passed_cases}/{total_cases} Aprobados ({rate:.1f}%)")
    print("-" * 90)

    return {
        "suite": "edge_cases",
        "total": total_cases,
        "passed": passed_cases,
        "success_rate": rate,
        "by_category": category_stats,
        "details": results,
    }


def sample_stratified_items(db: Session, sample_size: int = 50) -> List[Tuple[str, str, str]]:
    """Extrae una muestra diversa y estratificada de partidas representativas de la base de datos."""
    if sample_size <= 0:
        raise ValueError("sample_size debe ser mayor a 0")

    # Muestreo representativo de capítulos clave
    sql = text("""
        SELECT "CodPar", "Descri", "UniPar"
        FROM cost360_items
        WHERE LENGTH("Descri") > 30
          AND "Descri" NOT LIKE '%ANULADA%'
          AND "Descri" NOT LIKE '%OBSOLETA%'
        ORDER BY RANDOM()
        LIMIT :limit
    """)
    rows = db.execute(sql, {"limit": sample_size}).fetchall()
    return [(r[0], r[1], r[2] or "") for r in rows]


def run_reverse_mining_stress(db: Session, sample_size: int = 50) -> Dict[str, Any]:
    """
    Ejecuta el Caso 2: Minería Inversa.
    Toma partidas reales, las perturba a consultas sintéticas coloquiales
    y evalúa el recall y precisión del motor de búsqueda híbrido.
    """
    print("\n" + "=" * 90)
    print(f"EJECUTANDO CASO 2: MINERÍA INVERSA Y STRESS TESTING ({sample_size} PARTIDAS)")
    print("=" * 90)

    items = sample_stratified_items(db, sample_size=sample_size)
    results: List[Dict[str, Any]] = []

    top_1_hits = 0
    top_3_hits = 0
    material_hits = 0
    dimension_hits = 0
    evaluable_materials = 0
    evaluable_dims = 0

    for idx, (codpar, desc, unit) in enumerate(items, 1):
        try:
            perturbed = perturb_description(desc=desc, codpar=codpar, unit=unit, random_seed=idx)
            search_res = ai_engine.hybrid_search(db, perturbed.perturbed_query, limit=5)

            if not search_res:
                results.append({
                    "original_codpar": codpar,
                    "query": perturbed.perturbed_query,
                    "top_1_hit": False,
                    "top_3_hit": False,
                    "reason": "empty_results",
                })
                continue

            candidate_ids = [r["id"] for r in search_res]
            top_1_id = candidate_ids[0]
            top_1_hit = top_1_id == codpar
            top_3_hit = codpar in candidate_ids[:3]

            if top_1_hit:
                top_1_hits += 1
            if top_3_hit:
                top_3_hits += 1

            # Evaluación de Material
            top_row = db.execute(
                text('SELECT "Descri" FROM cost360_items WHERE "CodPar" = :cid'),
                {"cid": top_1_id},
            ).fetchone()
            top_desc = top_row[0] if top_row else ""

            mat_matched = True
            if perturbed.expected_materials:
                evaluable_materials += 1
                q_mats = detect_materials(perturbed.perturbed_query)
                it_mats = detect_materials(top_desc)
                # Verificar coincidencia de material solicitado
                has_mat_match = False
                for cat, q_set in q_mats.items():
                    if q_set & it_mats.get(cat, set()):
                        has_mat_match = True
                        break
                mat_matched = has_mat_match
                if mat_matched:
                    material_hits += 1

            # Evaluación Dimensional
            dim_matched = True
            q_dims = extract_unified_dimensions(perturbed.perturbed_query)
            if q_dims:
                evaluable_dims += 1
                it_dims = extract_unified_dimensions(top_desc)
                dim_delta, _ = score_dimension_match(q_dims, it_dims)
                dim_matched = dim_delta > 0
                if dim_matched:
                    dimension_hits += 1

            results.append({
                "original_codpar": codpar,
                "original_desc": desc,
                "query": perturbed.perturbed_query,
                "top_1_id": top_1_id,
                "top_1_desc": top_desc,
                "top_1_hit": top_1_hit,
                "top_3_hit": top_3_hit,
                "material_matched": mat_matched,
                "dimension_matched": dim_matched,
                "transformations": perturbed.transformations,
            })

            hit_symbol = "[TOP-1]" if top_1_hit else ("[TOP-3]" if top_3_hit else "[MISS]")
            print(f" {hit_symbol:<7} #{idx:02d} | Orig: {codpar} -> Top-1: {top_1_id} | Q: '{perturbed.perturbed_query[:45]}...'")

        except Exception as exc:
            logger.error("Error evaluando partida %s en minería inversa: %s", codpar, exc, exc_info=True)

    total = len(items)
    top_1_pct = (top_1_hits / total * 100.0) if total > 0 else 0.0
    top_3_pct = (top_3_hits / total * 100.0) if total > 0 else 0.0
    mat_pct = (material_hits / evaluable_materials * 100.0) if evaluable_materials > 0 else 100.0
    dim_pct = (dimension_hits / evaluable_dims * 100.0) if evaluable_dims > 0 else 100.0

    print("\n" + "-" * 90)
    print("MÉTRICAS GLOBALES DE MINERÍA INVERSA (STRESS TESTING):")
    print(f" - Top-1 Accuracy : {top_1_hits}/{total} ({top_1_pct:.1f}%)")
    print(f" - Top-3 Recall   : {top_3_hits}/{total} ({top_3_pct:.1f}%)")
    print(f" - Material Match : {material_hits}/{evaluable_materials} ({mat_pct:.1f}%)")
    print(f" - Dimension Match: {dimension_hits}/{evaluable_dims} ({dim_pct:.1f}%)")
    print("-" * 90)

    return {
        "suite": "reverse_mining",
        "sample_size": total,
        "top_1_accuracy": top_1_pct,
        "top_3_recall": top_3_pct,
        "material_match_rate": mat_pct,
        "dimension_match_rate": dim_pct,
        "details": results,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Runner de Evaluación y Afinación del Motor APU")
    parser.add_argument(
        "--mode",
        choices=["edge", "reverse", "all"],
        default="all",
        help="Modo de ejecución: 'edge' (Casos límite), 'reverse' (Minería inversa), 'all' (Ambos)",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=40,
        help="Cantidad de partidas a muestrear para minería inversa (default: 40)",
    )
    parser.add_argument(
        "--output-json",
        type=str,
        default=None,
        help="Ruta de archivo para exportar los resultados en formato JSON",
    )
    args = parser.parse_args()

    print("\nIniciando framework de evaluación...")
    ai_engine.load_brain()

    db: Session = next(get_db())
    report: Dict[str, Any] = {"timestamp": time.time(), "mode": args.mode}

    try:
        if args.mode in ["edge", "all"]:
            report["edge_cases"] = run_edge_cases_suite(db)

        if args.mode in ["reverse", "all"]:
            report["reverse_mining"] = run_reverse_mining_stress(db, sample_size=args.sample_size)

        print("\n" + "=" * 90)
        print("EVALUACIÓN CONCLUIDA EXITOSAMENTE")
        print("=" * 90)

        if args.output_json:
            with open(args.output_json, "w", encoding="utf-8") as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
            print(f"Reporte exportado exitosamente a: {args.output_json}")

    except Exception as exc:
        logger.error("Error fatal durante la ejecución de evaluaciones: %s", exc, exc_info=True)
        print(f"Error fatal: {exc}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
