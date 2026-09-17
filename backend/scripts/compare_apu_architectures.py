import json
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Asegurar que el backend esté en el PYTHONPATH
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.core.logging import logger
from app.db.session import get_db_session
from app.services.ai_apu_service import (
    fetch_base_apu_for_prompt,
    generate_apu_with_ai_from_base,
    get_dynamic_candidates,
)
from app.services.inverse_apu_synthesizer import synthesize_apu_inverse


def format_currency_sum(items: List[Dict[str, Any]], price_key: str = "precio_unitario") -> float:
    """Calcula el costo total referencial de una lista de insumos."""
    if not isinstance(items, list):
        return 0.0
    total = 0.0
    for it in items:
        cant = float(it.get("cantidad", 0.0) or 0.0)
        pu = float(it.get(price_key, 0.0) or 0.0)
        deprec = float(it.get("depreciacion", 1.0) or 1.0)
        total += cant * pu * deprec
    return round(total, 2)


def run_pipeline_a_baseline(
    description: str,
    unit: str,
    covenin_prefix: str,
    db: Any
) -> Tuple[Dict[str, Any], float]:
    """
    Ejecuta el Flujo A: Baseline Actual (RAG Dinámico + LLM Adaptador + Calibrador de Cuadrilla).
    """
    if not description or not unit:
        raise ValueError("Descripción y unidad son obligatorias para el Pipeline A.")

    t0 = time.time()
    candidates, _ = get_dynamic_candidates(db, description, covenin_prefix=covenin_prefix, limit=3)
    if not candidates:
        # Fallback sin prefijo
        candidates, _ = get_dynamic_candidates(db, description, limit=3)

    if not candidates:
        raise RuntimeError("No se encontraron partidas base candidatas para el Pipeline A.")

    best_item = candidates[0]["item"]
    base_apu = fetch_base_apu_for_prompt(db, best_item.CodPar)

    comp_apus: List[Dict[str, Any]] = []
    for cand in candidates[1:]:
        c_item = cand["item"]
        comp_apu = fetch_base_apu_for_prompt(db, c_item.CodPar)
        if comp_apu:
            comp_apus.append(comp_apu)

    result_a = generate_apu_with_ai_from_base(
        base_apu=base_apu,
        complementary_apus=comp_apus,
        user_description=description,
        covenin_prefix=covenin_prefix,
        requested_unit=unit,
        db=db,
    )
    elapsed = round(time.time() - t0, 2)
    return result_a, elapsed


def run_pipeline_b_inverse(
    description: str,
    unit: str,
    covenin_prefix: str,
    db: Any
) -> Tuple[Dict[str, Any], float]:
    """
    Ejecuta el Flujo B: PoC Inverso (Component-First: Cuadrilla -> Rendimiento -> Equipos -> Materiales -> Auditor LLM).
    """
    if not description or not unit:
        raise ValueError("Descripción y unidad son obligatorias para el Pipeline B.")

    t0 = time.time()
    result_b = synthesize_apu_inverse(
        user_description=description,
        requested_unit=unit,
        covenin_prefix=covenin_prefix,
        db=db,
    )
    elapsed = round(time.time() - t0, 2)
    return result_b, elapsed


def compare_apu_results(
    case_name: str,
    description: str,
    unit: str,
    res_a: Dict[str, Any],
    time_a: float,
    res_b: Dict[str, Any],
    time_b: float,
) -> Dict[str, Any]:
    """
    Compara las dos respuestas y produce un resumen analítico detallado.
    """
    partida_a = res_a.get("partida", {}) or {}
    partida_b = res_b.get("partida", {}) or {}

    labors_a = res_a.get("labors", []) or []
    labors_b = res_b.get("labors", []) or []

    equipments_a = res_a.get("equipments", []) or []
    equipments_b = res_b.get("equipments", []) or []

    materials_a = res_a.get("materials", []) or []
    materials_b = res_b.get("materials", []) or []

    summary = {
        "case_name": case_name,
        "description": description,
        "requested_unit": unit,
        "pipeline_a_baseline": {
            "elapsed_seconds": time_a,
            "cod_par": partida_a.get("cod_par"),
            "covenin_description": partida_a.get("description"),
            "unit": partida_a.get("unit"),
            "performance": partida_a.get("performance"),
            "labors_count": len(labors_a),
            "labors": [f"{l.get('cantidad', 1.0)}x {l.get('descripcion')} ({l.get('codigo')})" for l in labors_a],
            "equipments_count": len(equipments_a),
            "equipments": [f"{e.get('cantidad', 1.0)}x {e.get('descripcion')} (Dep: {e.get('depreciacion')}, PU: ${e.get('precio_unitario')})" for e in equipments_a],
            "materials_count": len(materials_a),
            "materials": [f"{m.get('cantidad', 1.0)} {m.get('unidad')} de {m.get('descripcion')} (PU: ${m.get('precio_unitario')})" for m in materials_a[:5]],
            "warnings_count": len(res_a.get("advertencias", [])),
        },
        "pipeline_b_inverse": {
            "elapsed_seconds": time_b,
            "cod_par": partida_b.get("cod_par"),
            "covenin_description": partida_b.get("description"),
            "unit": partida_b.get("unit"),
            "performance": partida_b.get("performance"),
            "labors_count": len(labors_b),
            "labors": [f"{l.get('cantidad', 1.0)}x {l.get('descripcion')} ({l.get('codigo')})" for l in labors_b],
            "equipments_count": len(equipments_b),
            "equipments": [f"{e.get('cantidad', 1.0)}x {e.get('descripcion')} (Dep: {e.get('depreciacion')}, PU: ${e.get('precio_unitario')})" for e in equipments_b],
            "materials_count": len(materials_b),
            "materials": [f"{m.get('cantidad', 1.0)} {m.get('unidad')} de {m.get('descripcion')} (PU: ${m.get('precio_unitario')})" for m in materials_b[:5]],
            "warnings_count": len(res_b.get("advertencias", [])),
        },
    }
    return summary


def run_all_benchmark_cases() -> None:
    """
    Ejecuta el benchmark comparativo sobre los 3 casos clave de prueba.
    """
    test_cases = [
        {
            "case_name": "Caso 1: Mantenimiento de Peldaños Metálicos (Escala Puntual)",
            "description": "Mantenimiento y aplicación de fondo anticorrosivo y esmalte en peldaños de escalera metálica",
            "unit": "pza",
            "covenin_prefix": "E811",
        },
        {
            "case_name": "Caso 2: Fabricación e Instalación de Barandas (Herrería)",
            "description": "Fabricación e instalación de barandas de protección con pasamanos de tubo de acero galvanizado 2 pulg y parales cada 1.20m",
            "unit": "m",
            "covenin_prefix": "E360",
        },
        {
            "case_name": "Caso 3: Demolición y Acarreo Manual de Piso de Concreto",
            "description": "Demolición de piso de concreto e=10cm a mano y acarreo en carretilla a 40m",
            "unit": "m3",
            "covenin_prefix": "E111",
        },
    ]

    all_comparisons: List[Dict[str, Any]] = []

    print("\n" + "=" * 80)
    print("INICIANDO BENCHMARK COMPARATIVO DE ARQUITECTURAS APU")
    print("Flujo A: Baseline Actual (RAG Adaptativo con LLM + Calibrador)")
    print("Flujo B: PoC Inverso (Component-First: Cuadrilla -> Rendimiento -> Insumos -> LLM Auditor)")
    print("=" * 80 + "\n")

    with get_db_session() as db:
        for idx, tc in enumerate(test_cases, 1):
            print(f"\n------------------------------------------------------------")
            print(f"EJECUTANDO [{idx}/3]: {tc['case_name']}")
            print(f"Descripción: '{tc['description']}' | Unidad: '{tc['unit']}'")
            print(f"------------------------------------------------------------")

            try:
                # 1. Pipeline A
                print(" -> Ejecutando Flujo A (Baseline)...")
                res_a, time_a = run_pipeline_a_baseline(
                    tc["description"], tc["unit"], tc["covenin_prefix"], db
                )
                print(f"    [Flujo A Finalizado en {time_a}s] Rendimiento={res_a.get('partida', {}).get('performance')} {tc['unit']}/día")

                # 2. Pipeline B
                print(" -> Ejecutando Flujo B (Component-First Inverso)...")
                res_b, time_b = run_pipeline_b_inverse(
                    tc["description"], tc["unit"], tc["covenin_prefix"], db
                )
                print(f"    [Flujo B Finalizado en {time_b}s] Rendimiento={res_b.get('partida', {}).get('performance')} {tc['unit']}/día")

                comparison = compare_apu_results(
                    tc["case_name"], tc["description"], tc["unit"], res_a, time_a, res_b, time_b
                )
                all_comparisons.append(comparison)
                time.sleep(2.5)

            except Exception as exc:
                logger.error(f"Error al ejecutar caso '{tc['case_name']}': {exc}", exc_info=True)
                print(f"ERROR en caso {tc['case_name']}: {exc}")

    # Guardar resultados en JSON para inspección detallada
    output_path = backend_dir / "scripts" / "benchmark_comparison_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_comparisons, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 80)
    print(f"BENCHMARK COMPLETADO EXITOSAMENTE. Resultados guardados en: {output_path}")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    run_all_benchmark_cases()
