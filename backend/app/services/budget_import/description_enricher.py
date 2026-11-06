"""Enriquecimiento de descripciones de partidas: búsqueda COVENIN + redacción final con IA.

Flujo:
1. Se buscan las mejores partidas COVENIN candidatas (búsqueda híbrida existente).
2. La IA elige la candidata que mejor corresponde y redacta la descripción final usando
   la partida oficial como base, sin inventar valores numéricos que el usuario no dio.
3. Se valida la respuesta (candidata existente, números no inventados). Si algo falla
   se degrada de forma segura a la descripción oficial COVENIN o a la original.
"""
import json
import logging
import re
from typing import Any, Dict, List, Optional, Set

from sqlalchemy.orm import Session

from app.services.llm_router import call_llm_json

from .matching import find_candidates

logger = logging.getLogger(__name__)

MAX_DESCRIPTION_CHARS = 400
CANDIDATES_FOR_LLM = 5
CANDIDATES_IN_RESPONSE = 4
MIN_SCORE_FOR_OFFICIAL_FALLBACK = 0.55
_NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)?")
_VALID_CONFIDENCE = {"alta", "media", "baja"}


def _extract_numbers(text: str) -> Set[str]:
    """Devuelve los números de un texto normalizados con punto decimal."""
    return {token.replace(",", ".") for token in _NUMBER_RE.findall(text or "")}


def find_invented_numbers(generated: str, *allowed_sources: str) -> List[str]:
    """Lista los números presentes en `generated` que no aparecen en ninguna fuente permitida."""
    allowed: Set[str] = set()
    for source in allowed_sources:
        allowed |= _extract_numbers(source)
    return sorted(_extract_numbers(generated) - allowed)


def build_enrich_prompt(description: str, unit: str, candidates: List[Dict[str, Any]]) -> str:
    """Construye el prompt de redacción técnica anclado a las candidatas COVENIN."""
    payload = {
        "descripcion_usuario": description,
        "unidad": unit,
        "candidatas_covenin": [
            {
                "cod_par": candidate["cod_par"],
                "descripcion_oficial": candidate["description"],
                "unidad": candidate["unit"],
            }
            for candidate in candidates
        ],
    }
    return f"""
Eres un ingeniero de costos venezolano experto en normativa COVENIN. Debes redactar la descripción
técnica final de una partida de obra levantada en una planilla de cómputos métricos.

PASOS:
1. Elige entre las candidatas la que MEJOR corresponda al ELEMENTO CONSTRUCTIVO y a la ACCIÓN descritos
   por el usuario. Si ninguna corresponde plenamente, usa "cod_par": null.
2. Si elegiste una candidata, usa su descripción oficial como base de la redacción y ajústala SOLO con los
   datos que el usuario escribió (espesor, diámetro, ubicación, dosificación).
3. Si no elegiste ninguna, redacta en estilo COVENIN: ACCIÓN + ELEMENTO + ESPECIFICACIÓN + ALCANCE.

REGLAS ESTRICTAS:
- NUNCA inventes valores numéricos (espesores, diámetros, resistencias f'c, dosificaciones, alturas) que no
  estén en la descripción del usuario o en la candidata elegida. Si falta un dato necesario escribe
  "SEGÚN PLANOS Y ESPECIFICACIONES".
- El alcance (INCLUYE ...) debe corresponder a la acción: excavación, compactación, demolición o bote NO
  suministran materiales; una instalación sí incluye los materiales propios del elemento.
- Conserva todos los datos técnicos que ya escribió el usuario.
- Mayúsculas, un solo párrafo, máximo 300 caracteres, sin viñetas.
- Devuelve SOLO este JSON:
  {{"cod_par": "CODIGO_EXACTO_O_null", "descripcion_final": "TEXTO", "confianza": "alta|media|baja",
    "motivo": "una frase breve explicando la elección"}}

DATOS:
{json.dumps(payload, ensure_ascii=False, indent=1)}
"""


def _public_candidate(candidate: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "cod_par": candidate.get("cod_par"),
        "cov_par": candidate.get("cov_par"),
        "description": candidate.get("description") or "",
        "unit": candidate.get("unit") or "",
        "score": candidate.get("score") or 0.0,
    }


def _fallback_result(
    description: str,
    candidates: List[Dict[str, Any]],
    warning: str,
) -> Dict[str, Any]:
    """Resultado seguro cuando la IA no está disponible o su respuesta no es confiable."""
    top: Optional[Dict[str, Any]] = candidates[0] if candidates else None
    warnings = [warning]
    if top and float(top.get("score") or 0.0) >= MIN_SCORE_FOR_OFFICIAL_FALLBACK:
        return {
            "suggested_description": (top["description"] or "").strip().upper(),
            "source": "covenin",
            "base_candidate": _public_candidate(top),
            "confidence": "media",
            "reasoning": "Mejor coincidencia en la norma COVENIN (sin redacción adicional de IA).",
            "ai_used": False,
            "warnings": warnings,
        }
    return {
        "suggested_description": "",
        "source": "none",
        "base_candidate": None,
        "confidence": "baja",
        "reasoning": "No hay una coincidencia COVENIN suficientemente clara.",
        "ai_used": False,
        "warnings": warnings,
    }


def parse_enrich_response(
    data: Any,
    description: str,
    candidates: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Valida la respuesta del LLM; lanza ValueError si no es utilizable."""
    if not isinstance(data, dict):
        raise ValueError("La respuesta de la IA no es un objeto JSON.")

    final_text = str(data.get("descripcion_final") or "").strip().upper()
    if not final_text:
        raise ValueError("La IA no devolvió una descripción final.")
    if len(final_text) > MAX_DESCRIPTION_CHARS:
        raise ValueError("La descripción generada excede la longitud permitida.")

    raw_code = data.get("cod_par")
    chosen: Optional[Dict[str, Any]] = None
    if raw_code is not None and str(raw_code).strip().lower() not in {"", "null", "none"}:
        code = str(raw_code).strip()
        chosen = next((c for c in candidates if c["cod_par"] == code), None)
        if chosen is None:
            logger.info("La IA propuso un código fuera de las candidatas (%s); se ignora.", code)

    invented = find_invented_numbers(
        final_text,
        description,
        chosen["description"] if chosen else "",
    )
    if invented:
        raise ValueError(f"La IA incluyó valores no presentes en la partida: {', '.join(invented)}")

    confidence = str(data.get("confianza") or "media").strip().lower()
    if confidence not in _VALID_CONFIDENCE:
        confidence = "media"

    return {
        "suggested_description": final_text,
        "source": "covenin_ia" if chosen else "ia",
        "base_candidate": _public_candidate(chosen) if chosen else None,
        "confidence": confidence,
        "reasoning": str(data.get("motivo") or "").strip()[:240],
        "ai_used": True,
        "warnings": [],
    }


def enrich_description(
    db: Session,
    description: str,
    unit: str = "",
    use_ai: bool = True,
) -> Dict[str, Any]:
    """Devuelve una sugerencia de descripción basada en COVENIN y terminada por la IA."""
    clean_description = (description or "").strip()
    if len(clean_description) < 3:
        raise ValueError("La descripción de la partida es demasiado corta.")
    clean_unit = (unit or "").strip()

    candidates = find_candidates(
        db,
        description=clean_description,
        unit=clean_unit,
        limit=CANDIDATES_FOR_LLM,
    )

    if not use_ai:
        result = _fallback_result(
            clean_description,
            candidates,
            "Tu plan no incluye IA; se muestra la coincidencia COVENIN.",
        )
    elif not candidates:
        result = _generate_without_candidates(clean_description, clean_unit)
    else:
        result = _generate_with_candidates(clean_description, clean_unit, candidates)

    result["candidates"] = [_public_candidate(c) for c in candidates[:CANDIDATES_IN_RESPONSE]]
    return result


def _generate_with_candidates(
    description: str,
    unit: str,
    candidates: List[Dict[str, Any]],
) -> Dict[str, Any]:
    try:
        data = call_llm_json(build_enrich_prompt(description, unit, candidates))
        return parse_enrich_response(data, description, candidates)
    except Exception as exc:
        logger.error("No se pudo enriquecer la descripción con IA: %s", exc, exc_info=True)
        return _fallback_result(
            description,
            candidates,
            "La IA no pudo completar la redacción; se muestra la coincidencia COVENIN.",
        )


def _generate_without_candidates(description: str, unit: str) -> Dict[str, Any]:
    try:
        data = call_llm_json(build_enrich_prompt(description, unit, []))
        return parse_enrich_response(data, description, [])
    except Exception as exc:
        logger.error("No se pudo redactar la descripción con IA (sin candidatas): %s", exc, exc_info=True)
        return _fallback_result(
            description,
            [],
            "No se encontraron partidas COVENIN y la IA no pudo redactar la descripción.",
        )
