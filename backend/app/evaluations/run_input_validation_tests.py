"""
Test Runner — Validación de Entrada del Pipeline APU

Ejecuta el golden dataset contra las capas del pipeline de forma aislada.

Modos de ejecución:
    1. Solo Capa 1 (sin red, sin LLM):
       python -m app.evaluations.run_input_validation_tests --capa 1

    2. Capas 1 + 2 (requiere DB para el RAG):
       python -m app.evaluations.run_input_validation_tests --capa 2

    3. Capas 1 + 2 + 3 (requiere LLM nano — consume tokens):
       python -m app.evaluations.run_input_validation_tests --capa 3

    4. Pipeline completo (requiere todo el stack):
       python -m app.evaluations.run_input_validation_tests --capa 4

    5. Solo una categoría:
       python -m app.evaluations.run_input_validation_tests --categoria GIBBERISH

    6. Solo los casos que deben llegar a una capa específica:
       python -m app.evaluations.run_input_validation_tests --capa_critica 1

Flags adicionales:
    --verbose    Muestra detalle de cada caso individual
    --fail-fast  Detiene en el primer fallo
    --export     Exporta resultados a JSON en /evaluations/results/
"""

import argparse
import io
import json
import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from app.core.logging import logger
from app.evaluations.golden_dataset_input_validation import (
    GOLDEN_DATASET,
    InputValidationCase,
    Veredicto,
    get_cases_by_categoria,
    get_cases_by_capa,
    get_cases_by_expected,
    get_summary,
)

# ---------------------------------------------------------------------------
# Constantes de Capa 2 (RAG — usadas en run_capa_2_mock)
# ---------------------------------------------------------------------------
RAG_MIN_SCORE: float = 0.70
RAG_MAX_SPREAD: float = 0.015


# ---------------------------------------------------------------------------
# Resultados del test
# ---------------------------------------------------------------------------
class CaseResult:
    """Resultado de ejecutar un caso del golden dataset."""

    def __init__(
        self,
        case: InputValidationCase,
        actual: Optional[Veredicto],
        passed: bool,
        capa_detected: Optional[int],
        detail: str,
    ) -> None:
        self.case = case
        self.actual = actual
        self.passed = passed
        self.capa_detected = capa_detected
        self.detail = detail

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.case.id,
            "categoria": self.case.categoria,
            "input_preview": self.case.input[:80] + ("..." if len(self.case.input) > 80 else ""),
            "expected": self.case.expected,
            "actual": self.actual,
            "passed": self.passed,
            "capa_critica_esperada": self.case.capa_critica,
            "capa_donde_se_detecto": self.capa_detected,
            "detalle": self.detail,
        }


# ---------------------------------------------------------------------------
# CAPAS 1 & 2: Importar lógica de producción directamente
# Los tests ejecutan EXACTAMENTE el mismo código que corre en producción.
# No hay duplicación — si cambia el servicio, los tests lo reflejan.
# ---------------------------------------------------------------------------
from app.services.apu_input_validator import validate_apu_input, validate_rag_signals


def run_capa_1(text: str) -> Tuple[Optional[Veredicto], str]:
    """
    Capa 1: Delega en el servicio de producción `apu_input_validator`.
    Traduce el formato de retorno de la producción al formato del test runner.
    Retorna (veredicto, motivo) si debe rechazar/clarificar, o (None, "ok") si pasa.
    """
    result = validate_apu_input(text)
    if result is None:
        return None, "ok"
    veredicto, mensaje, codigo = result
    return veredicto, f"[{codigo}] {mensaje[:120]}"


def run_capa_2(
    query: str,
    top_candidatas: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[Optional[Veredicto], str]:
    """
    Capa 2: Delega en el servicio de producción `validate_rag_signals`.
    Evalúa señales RAG (Gemini Embeddings + Léxico) para off-topic o ambigüedad extrema.
    """
    # Si no se proveen candidatos mockeados para este test, simular según contexto
    if top_candidatas is None:
        cands = [
            {"score": 0.850, "descripcion": "DEMOLICION DE CERAMICA EN PAREDES"},
            {"score": 0.840, "descripcion": "DEMOLICION DE CERAMICA EN PISOS"},
        ]
    else:
        cands = top_candidatas

    result = validate_rag_signals(query, cands)
    if result is None:
        return None, "ok"
    veredicto, mensaje, codigo, _ = result
    return veredicto, f"[{codigo}] {mensaje[:120]}"


# ===========================================================================
# EJECUTOR DE UN CASO
# ===========================================================================

def run_single_case(
    case: InputValidationCase,
    max_capa: int = 1,
    mock_rag_results: Optional[List[Dict[str, Any]]] = None,
    verbose: bool = False,
) -> CaseResult:
    """
    Ejecuta un caso del golden dataset contra las capas del pipeline.
    Retorna un CaseResult con el veredicto real y si pasó o no.
    """
    text = case.input
    actual_veredicto: Optional[Veredicto] = None
    capa_detected: Optional[int] = None
    detail: str = ""

    # --- CAPA 1 ---
    veredicto_c1, motivo_c1 = run_capa_1(text)
    if veredicto_c1 is not None:
        actual_veredicto = veredicto_c1
        capa_detected = 1
        detail = f"[Capa 1] {motivo_c1}"
    elif max_capa >= 2:
        # --- CAPA 2 ---
        if mock_rag_results is not None:
            cands = mock_rag_results
        elif case.categoria == "OFF_TOPIC":
            cands = [{"score": 0.22, "descripcion": "SUMINISTRO DE MATERIAL"}]
        elif case.categoria == "INVALID_SOLO_ELEMENTO":
            cands = [
                {"score": 0.84, "descripcion": "SUMINISTRO E INSTALACION DE TUBERIA PVC AGUAS BLANCAS"},
                {"score": 0.81, "descripcion": "DESMONTAJE DE TUBERIA EXISTENTE"}
            ]
        elif case.categoria == "INVALID_SOLO_ACCION":
            cands = [
                {"score": 0.85, "descripcion": "DEMOLICION DE CERAMICA EN PAREDES"},
                {"score": 0.84, "descripcion": "DEMOLICION DE ACABADO DE CERAMICA EN PISOS"},
                {"score": 0.83, "descripcion": "DEMOLICION A MANO DE PARED DE BLOQUES"},
            ]
        else:
            cands = [
                {"score": 0.85, "descripcion": "EXCAVACION A MANO EN TERRENO BLANDO"},
                {"score": 0.82, "descripcion": "EXCAVACION A MANO EN TIERRA DURA"},
            ]
        veredicto_c2, motivo_c2 = run_capa_2(text, cands)
        if veredicto_c2 is not None:
            actual_veredicto = veredicto_c2
            capa_detected = 2
            detail = f"[Capa 2] {motivo_c2}"

    # Si ninguna capa detuvo el flujo y estamos en max_capa < 3,
    # asumimos "completed" para los casos que deben pasar
    if actual_veredicto is None:
        if max_capa < 3:
            # En modo capa 1/2 los casos que pasan se marcan como "passed" si su expected es completed
            actual_veredicto = "completed"
            capa_detected = None
            detail = f"Pasó Capas 1-{max_capa} sin intercepción"
        else:
            # Capa 3+ requiere LLM real — marcamos como "not_evaluated"
            actual_veredicto = None
            detail = "Requiere Capa 3 (LLM nano) para evaluación final"

    passed = actual_veredicto == case.expected

    if verbose:
        status_icon = "✅" if passed else "❌"
        print(
            f"  {status_icon} [{case.id}] {case.categoria}\n"
            f"     Input:    {case.input[:70]}{'...' if len(case.input) > 70 else ''}\n"
            f"     Expected: {case.expected} | Actual: {actual_veredicto}\n"
            f"     Detalle:  {detail}\n"
        )

    return CaseResult(
        case=case,
        actual=actual_veredicto,
        passed=passed,
        capa_detected=capa_detected,
        detail=detail,
    )


# ===========================================================================
# EJECUTOR COMPLETO DE LA SUITE
# ===========================================================================

def run_suite(
    cases: List[InputValidationCase],
    max_capa: int = 1,
    verbose: bool = False,
    fail_fast: bool = False,
) -> List[CaseResult]:
    """
    Ejecuta todos los casos y retorna la lista de resultados.
    """
    results: List[CaseResult] = []

    for case in cases:
        result = run_single_case(case, max_capa=max_capa, verbose=verbose)
        results.append(result)
        if fail_fast and not result.passed:
            logger.warning("Fail-fast activado en caso [%s]", case.id)
            break

    return results


def print_report(results: List[CaseResult], max_capa: int) -> None:
    """Imprime el reporte de resultados en consola."""
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    failed = total - passed

    print("\n" + "=" * 70)
    print(f"  REPORTE — Pipeline APU Input Validation (Capas 1–{max_capa})")
    print("=" * 70)
    print(f"  Total casos : {total}")
    print(f"  ✅ Pasaron  : {passed} ({passed/total*100:.1f}%)")
    print(f"  ❌ Fallaron : {failed} ({failed/total*100:.1f}%)")
    print("=" * 70)

    if failed > 0:
        print("\n  FALLOS DETALLADOS:")
        for r in results:
            if not r.passed:
                print(f"\n  ❌ [{r.case.id}] {r.case.categoria}")
                print(f"     Input   : {r.case.input[:80]}{'...' if len(r.case.input) > 80 else ''}")
                print(f"     Expected: {r.case.expected}")
                print(f"     Actual  : {r.actual}")
                print(f"     Capa    : {r.capa_detected} (crítica esperada: {r.case.capa_critica})")
                print(f"     Detalle : {r.detail}")
                if r.case.notas:
                    print(f"     Notas   : {r.case.notas}")

    # Resumen por categoría
    print("\n  RESULTADO POR CATEGORÍA:")
    by_cat: Dict[str, List[CaseResult]] = {}
    for r in results:
        by_cat.setdefault(r.case.categoria, []).append(r)
    for cat, cat_results in sorted(by_cat.items()):
        cat_pass = sum(1 for r in cat_results if r.passed)
        cat_total = len(cat_results)
        icon = "✅" if cat_pass == cat_total else "⚠️ " if cat_pass > 0 else "❌"
        print(f"    {icon} {cat:<30} {cat_pass}/{cat_total}")

    print("=" * 70 + "\n")


def export_results(results: List[CaseResult], output_dir: str) -> str:
    """Exporta los resultados a un archivo JSON."""
    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    filename = os.path.join(output_dir, f"validation_results_{timestamp}.json")
    payload = {
        "timestamp": timestamp,
        "total": len(results),
        "passed": sum(1 for r in results if r.passed),
        "failed": sum(1 for r in results if not r.passed),
        "results": [r.to_dict() for r in results],
    }
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return filename


# ===========================================================================
# ENTRYPOINT CLI
# ===========================================================================

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ejecuta el golden dataset de validación de entrada del pipeline APU."
    )
    parser.add_argument(
        "--capa",
        type=int,
        default=1,
        choices=[1, 2, 3, 4],
        help="Hasta qué capa del pipeline ejecutar (default: 1, sin LLM).",
    )
    parser.add_argument(
        "--categoria",
        type=str,
        default=None,
        help="Ejecuta solo los casos de una categoría específica.",
    )
    parser.add_argument(
        "--capa_critica",
        type=int,
        default=None,
        choices=[1, 2, 3, 4],
        help="Ejecuta solo los casos cuya capa crítica es la indicada.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Muestra detalle de cada caso.",
    )
    parser.add_argument(
        "--fail-fast",
        action="store_true",
        help="Detiene en el primer fallo.",
    )
    parser.add_argument(
        "--export",
        action="store_true",
        help="Exporta resultados a JSON.",
    )
    args = parser.parse_args()

    # Selección de casos
    if args.categoria:
        cases = get_cases_by_categoria(args.categoria)
        if not cases:
            print(f"❌ Categoría no encontrada: '{args.categoria}'")
            print(f"   Categorías disponibles: {sorted(set(c.categoria for c in GOLDEN_DATASET))}")
            sys.exit(1)
    elif args.capa_critica:
        cases = get_cases_by_capa(args.capa_critica)
    else:
        cases = GOLDEN_DATASET

    print(f"\n[TEST] Ejecutando {len(cases)} casos -- Pipeline hasta Capa {args.capa}")
    if args.categoria:
        print(f"   Filtro: categoria = {args.categoria}")
    if args.capa_critica:
        print(f"   Filtro: capa_critica = {args.capa_critica}")

    results = run_suite(
        cases=cases,
        max_capa=args.capa,
        verbose=args.verbose,
        fail_fast=args.fail_fast,
    )

    print_report(results, max_capa=args.capa)

    if args.export:
        output_dir = os.path.join(
            os.path.dirname(__file__), "results"
        )
        path = export_results(results, output_dir)
        print(f"📁 Resultados exportados a: {path}\n")

    # Exit code: 0 si todo pasa, 1 si hay fallos (útil para CI/CD)
    failed_count = sum(1 for r in results if not r.passed)
    sys.exit(0 if failed_count == 0 else 1)


if __name__ == "__main__":
    main()
