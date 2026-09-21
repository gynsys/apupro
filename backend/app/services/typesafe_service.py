"""
Servicio para la integración con TypeSafe AI (Modelo Jev - System One).
Diseñado para la toma de decisiones tipadas ultrarrápidas (< 500ms)
en clasificación de partidas, detección de unidades y categorización de insumos.
"""
import time
import requests
from typing import Dict, Any, Optional, Tuple

from app.core.logging import logger

TYPESAFE_API_URL = "https://api.typesafe.ai/v1/systemone"
DEFAULT_MODEL = "jev-latest"


def test_typesafe_connection(api_key: str, model_name: str = DEFAULT_MODEL) -> Tuple[bool, int, str]:
    """
    Verifica la conectividad con la API de TypeSafe AI.
    Retorna: (success: bool, latency_ms: int, message: str)
    """
    if not api_key or not isinstance(api_key, str):
        raise ValueError("La API key de TypeSafe AI es requerida y debe ser un string válido.")

    clean_key = api_key.strip()
    if not clean_key:
        raise ValueError("La API key de TypeSafe AI no puede estar vacía.")

    payload = {
        "model": model_name or DEFAULT_MODEL,
        "state": "prueba de conexion",
        "questions": {
            "test": {
                "type": "noul",
                "instructions": "¿Es esto una prueba de conectividad de software?"
            }
        }
    }

    t0 = time.time()
    try:
        response = requests.post(
            TYPESAFE_API_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {clean_key}",
                "Content-Type": "application/json"
            },
            timeout=10
        )
        latency_ms = int((time.time() - t0) * 1000)

        if response.status_code == 200:
            data = response.json()
            model_used = data.get("model", model_name)
            return True, latency_ms, f"Conexión exitosa con TypeSafe AI ({model_used})"
        else:
            err_msg = f"HTTP {response.status_code}: {response.text[:120]}"
            logger.error("Fallo al conectar con TypeSafe AI: %s", err_msg)
            return False, latency_ms, err_msg
    except Exception as exc:
        latency_ms = int((time.time() - t0) * 1000)
        logger.error("Excepción al probar conexión con TypeSafe AI: %s", exc, exc_info=True)
        return False, latency_ms, f"Error de conexión: {str(exc)}"


def evaluate_construction_prompt(
    description: str,
    api_key: str,
    model_name: str = DEFAULT_MODEL
) -> Dict[str, Any]:
    """
    Evalúa una descripción técnica de obra con TypeSafe Jev:
    - Clasifica rubro / categoría constructiva.
    - Sugiere unidad de medida estandarizada (m3, m2, ml, kg, pza, und).
    - Evalúa probabilidad de si la descripción es técnicamente completa o requiere aclaratorias.
    """
    if not description or not isinstance(description, str):
        raise ValueError("La descripción constructiva es obligatoria.")
    if not api_key or not isinstance(api_key, str):
        raise ValueError("Se requiere una API key de TypeSafe AI para la evaluación.")

    clean_desc = description.strip()
    clean_key = api_key.strip()
    if not clean_desc or not clean_key:
        raise ValueError("Ni la descripción ni la API key pueden ser cadenas vacías.")

    payload = {
        "model": model_name or DEFAULT_MODEL,
        "state": clean_desc,
        "questions": {
            "categoria": {
                "type": "choice",
                "instructions": "Clasifica el rubro de construcción principal de esta partida",
                "criteria": {
                    "estructuras_concreto": "Obras de concreto, encofrado, vaciado, losas, vigas, columnas, zapatas",
                    "acero_refuerzo": "Suministro, corte, doblado y colocación de cabillas o acero estructural",
                    "movimiento_tierra": "Excavaciones, terraplenes, rellenos, zanjas, bote de escombros",
                    "albanileria": "Paredes de bloques, ladrillos, friso, mortero, revoque",
                    "acabados": "Pintura, cerámica, porcelanato, yeso, dry-wall, cielo raso",
                    "instalaciones_electricas": "Cables, breakers, tableros, iluminación, canalizaciones",
                    "instalaciones_sanitarias": "Tuberías de aguas blancas, negras, válvulas, piezas sanitarias",
                    "demoliciones": "Demolición y desmantelamiento de elementos existentes"
                }
            },
            "unidad_medida": {
                "type": "choice",
                "instructions": "Determina la unidad de medida estándar recomendada para este cómputo métrico",
                "criteria": {
                    "m3": "Metros cúbicos (volumen de concreto, excavación, relleno)",
                    "m2": "Metros cuadrados (superficie de paredes, frisos, pisos, pintura)",
                    "m": "Metros lineales (tuberías, barandas, cables, bordillos)",
                    "kg": "Kilogramos (acero de refuerzo, cabillas, perfiles pesados)",
                    "pza": "Pieza (un elemento individual identifiable o prefabricado)",
                    "und": "Unidad (equipos, artefactos, piezas unitarias)",
                    "pto": "Punto (puntos eléctricos o sanitarios)"
                }
            },
            "es_completa": {
                "type": "noul",
                "instructions": "¿La descripción cuenta con suficiente especificación técnica (material, acción y alcance) para calcular su APU sin ambigüedad?"
            }
        }
    }

    t0 = time.time()
    try:
        response = requests.post(
            TYPESAFE_API_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {clean_key}",
                "Content-Type": "application/json"
            },
            timeout=8
        )
        latency_ms = int((time.time() - t0) * 1000)

        if response.status_code == 200:
            data = response.json()
            answers = data.get("answers", {})

            categoria_info = answers.get("categoria", {})
            unidad_info = answers.get("unidad_medida", {})
            completa_info = answers.get("es_completa", {})

            return {
                "success": True,
                "engine": "typesafe_jev",
                "model": data.get("model", model_name),
                "latency_ms": latency_ms,
                "category": categoria_info.get("choice", "general"),
                "category_confidence": categoria_info.get("confidence", 0.0),
                "recommended_unit": unidad_info.get("choice", "und"),
                "unit_confidence": unidad_info.get("confidence", 0.0),
                "is_complete_prob": completa_info.get("noul", 0.5),
                "raw_answers": answers
            }
        else:
            logger.error("TypeSafe Jev devolvió HTTP %s: %s", response.status_code, response.text[:150])
            return {
                "success": False,
                "engine": "typesafe_jev",
                "latency_ms": latency_ms,
                "error": f"HTTP {response.status_code}: {response.text[:120]}"
            }
    except Exception as exc:
        latency_ms = int((time.time() - t0) * 1000)
        logger.error("Error al evaluar partida con TypeSafe Jev: %s", exc, exc_info=True)
        return {
            "success": False,
            "engine": "typesafe_jev",
            "latency_ms": latency_ms,
            "error": str(exc)
        }
