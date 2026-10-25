"""
Suite de Prueba de Carga y Estrés Asíncrona para CostBase (apupro_platform).
Simula concurrencia progresiva midiendo RPS, latencias (p50, p95, p99) y tasa de éxito,
sin consumir tokens de proveedores externos de IA (DeepSeek/Gemini).
"""
import argparse
import asyncio
import math
from pathlib import Path
import statistics
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from app.core.config import settings
from app.core.logging import logger


def compute_percentile(sorted_values: List[float], percentile: float) -> float:
    """Calcula el percentil exacto sobre una lista ordenada de latencias en ms."""
    if not sorted_values:
        return 0.0
    if percentile <= 0:
        return sorted_values[0]
    if percentile >= 100:
        return sorted_values[-1]
    idx = (len(sorted_values) - 1) * (percentile / 100.0)
    lower = math.floor(idx)
    upper = math.ceil(idx)
    if lower == upper:
        return sorted_values[int(idx)]
    weight = idx - lower
    return sorted_values[lower] * (1.0 - weight) + sorted_values[upper] * weight


async def execute_virtual_user_step(
    client: httpx.AsyncClient,
    user_idx: int,
    auth_headers: Dict[str, str],
) -> Tuple[str, int, float]:
    """
    Ejecuta una acción representativa de un usuario en CostBase:
    - 50%: Listado de presupuestos / Salud del sistema
    - 30%: Búsqueda de materiales e insumos en el catálogo Cost360
    - 20%: Consulta de configuración / bases de datos disponibles
    """
    t0 = time.perf_counter()
    bucket = user_idx % 10
    try:
        if bucket < 5:
            if auth_headers:
                endpoint = "/api/v1/budgets/"
                resp = await client.get(endpoint, headers=auth_headers)
            else:
                endpoint = "/api/v1/health"
                resp = await client.get(endpoint)
        elif bucket < 8:
            queries = ["cemento", "cabilla", "bloque", "pintura", "tuberia", "concreto", "arena", "manto"]
            q = queries[user_idx % len(queries)]
            endpoint = f"/api/v1/cost360/materials?search={q}&limit=20"
            resp = await client.get(endpoint, headers=auth_headers)
        else:
            endpoint = "/api/v1/arko/config"
            resp = await client.get(endpoint, headers=auth_headers)

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        return endpoint, resp.status_code, elapsed_ms
    except Exception as exc:
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        logger.error(f"Error en petición de carga (VU={user_idx}): {exc}", exc_info=True)
        return "network_error", 0, elapsed_ms


async def run_load_stage(
    base_url: str,
    concurrency: int,
    total_requests: int,
    token: Optional[str] = None,
) -> Dict[str, Any]:
    """Ejecuta una etapa de carga con `concurrency` usuarios simultáneos y `total_requests` peticiones."""
    if concurrency <= 0 or total_requests <= 0:
        raise ValueError("concurrency y total_requests deben ser mayores que cero.")

    limits = httpx.Limits(
        max_connections=min(concurrency + 50, 2500),
        max_keepalive_connections=min(concurrency, 1000),
    )
    timeout = httpx.Timeout(30.0, connect=10.0)
    auth_headers: Dict[str, str] = {"Authorization": f"Bearer {token}"} if token else {}
    semaphore = asyncio.Semaphore(concurrency)

    latencies: List[float] = []
    status_counts: Dict[int, int] = {}

    async with httpx.AsyncClient(base_url=base_url, limits=limits, timeout=timeout) as client:
        async def _bounded_task(i: int) -> None:
            async with semaphore:
                _, code, ms = await execute_virtual_user_step(client, i, auth_headers)
                latencies.append(ms)
                status_counts[code] = status_counts.get(code, 0) + 1

        t_start = time.perf_counter()
        await asyncio.gather(*(_bounded_task(i) for i in range(total_requests)))
        total_duration_s = max(time.perf_counter() - t_start, 0.001)

    sorted_lat = sorted(latencies)
    ok_count = sum(cnt for code, cnt in status_counts.items() if 200 <= code < 400)
    success_rate = (ok_count / len(latencies) * 100.0) if latencies else 0.0

    return {
        "concurrency": concurrency,
        "total_requests": total_requests,
        "duration_s": round(total_duration_s, 2),
        "rps": round(total_requests / total_duration_s, 2),
        "success_rate_pct": round(success_rate, 2),
        "status_counts": status_counts,
        "p50_ms": round(compute_percentile(sorted_lat, 50), 2),
        "p95_ms": round(compute_percentile(sorted_lat, 95), 2),
        "p99_ms": round(compute_percentile(sorted_lat, 99), 2),
        "avg_ms": round(statistics.mean(sorted_lat), 2) if sorted_lat else 0.0,
    }


async def main_async() -> None:
    """Punto de entrada CLI para ejecutar la rampa progresiva de carga."""
    parser = argparse.ArgumentParser(description="Prueba de carga progresiva para CostBase")
    parser.add_argument(
        "--base-url",
        type=str,
        default=settings.BACKEND_URL,
        help="URL base del servidor objetivo",
    )
    parser.add_argument(
        "--stages",
        type=str,
        default="50:200,200:600,500:1500",
        help="Etapas en formato concurrencia:total_peticiones separadas por coma",
    )
    parser.add_argument(
        "--token",
        type=str,
        default="",
        help="JWT Bearer token opcional para probar endpoints autenticados (/budgets)",
    )
    args = parser.parse_args()

    print(f"=== Iniciando Prueba de Carga Progresiva contra {args.base_url} ===")
    for stage_spec in args.stages.split(","):
        parts = stage_spec.strip().split(":")
        if len(parts) != 2:
            raise ValueError(f"Formato de etapa inválido: {stage_spec}. Use concurrencia:peticiones")
        conc = int(parts[0])
        reqs = int(parts[1])
        metrics = await run_load_stage(
            base_url=args.base_url,
            concurrency=conc,
            total_requests=reqs,
            token=args.token or None,
        )
        print(
            f"[Concurrencia: {metrics['concurrency']:4d} VUs | Reqs: {metrics['total_requests']:5d}] "
            f"RPS: {metrics['rps']:6.1f}/s | Éxito: {metrics['success_rate_pct']:6.2f}% | "
            f"p50: {metrics['p50_ms']:6.1f}ms | p95: {metrics['p95_ms']:6.1f}ms | "
            f"p99: {metrics['p99_ms']:6.1f}ms | Códigos: {metrics['status_counts']}"
        )


if __name__ == "__main__":
    asyncio.run(main_async())
