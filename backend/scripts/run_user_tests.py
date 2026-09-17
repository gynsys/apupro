import json
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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
from scripts.compare_apu_architectures import compare_apu_results, run_pipeline_a_baseline, run_pipeline_b_inverse


def run_custom_tests() -> None:
    """Ejecuta los dos casos solicitados por el usuario en ambas arquitecturas."""
    test_cases = [
        {
            "case_name": "Prueba 1: Acarreo a mano de piedra bruta en carretilla (40-50m)",
            "description": "ACARREO A MANO DE PIEDRA BRUTA CON USO DE CARRETILLA, A DISTANCIAS ENTRE 40 Y 50m (IDA Y VUELTA) CON PENDIENTES DE 2-5%.",
            "unit": "m3.m",
            "covenin_prefix": "R9",
        },
        {
            "case_name": "Prueba 2: Limpieza y desengrase de barandas y pasamanos metálicos",
            "description": "LIMPIEZA DE SUPERFICIES EN BARANDAS Y PASAMANOS METÁLICOS: REMOCIÓN DE CONTAMINANTES Y DESMANCHADO DE LA ESTRUCTURA MEDIANTE LA APLICACIÓN DE DETERGENTES Y DESENGRASANTES CONVENCIONALES. INCLUYE MANO DE OBRA, INSUMOS DE LIMPIEZA Y RETIRO DE RESIDUOS",
            "unit": "m",
            "covenin_prefix": "E811",
        },
    ]

    all_comparisons: List[Dict[str, Any]] = []

    print("\n" + "=" * 80)
    print("EJECUTANDO PRUEBAS RÁPIDAS DE USUARIO")
    print("=" * 80 + "\n")

    with get_db_session() as db:
        for idx, tc in enumerate(test_cases, 1):
            print(f"\n------------------------------------------------------------")
            print(f"CASO [{idx}/2]: {tc['case_name']}")
            print(f"Descripción: '{tc['description']}' | Unidad: '{tc['unit']}'")
            print(f"------------------------------------------------------------")

            # 1. Pipeline A
            print(" -> Ejecutando Flujo A (Baseline RAG)...")
            res_a, time_a = run_pipeline_a_baseline(
                tc["description"], tc["unit"], tc["covenin_prefix"], db
            )
            print(f"    [Flujo A Finalizado en {time_a}s] Rendimiento={res_a.get('partida', {}).get('performance')} {tc['unit']}/día")

            time.sleep(2)

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
            time.sleep(2)

    output_path = backend_dir / "scripts" / "user_quick_tests_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_comparisons, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 80)
    print(f"PRUEBAS COMPLETADAS EXITOSAMENTE. Guardado en: {output_path}")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    run_custom_tests()
