"""
Servicio de Investigación de Precios de Mercado en la Web.
Busca cotizaciones y listas de precios en internet para insumos de construcción
que no se encuentran en el catálogo local de CostBase.
"""
import re
import logging
from typing import Optional, Dict, Any, List
try:
    from duckduckgo_search import DDGS
except ImportError:
    try:
        from ddgs import DDGS
    except ImportError:
        DDGS = None

from app.services.llm_router import call_llm_json

logger = logging.getLogger(__name__)

# Caché en memoria para evitar consultas web repetidas durante la misma sesión
_WEB_PRICE_CACHE: Dict[str, Dict[str, Any]] = {}


def _clean_search_query(description: str) -> str:
    """Limpia y extrae términos esenciales para la búsqueda web."""
    if not description:
        return ""
    # Quitar caracteres especiales pero conservar dimensiones
    cleaned = re.sub(r'[^\w\s\d\.\,\"\/\-\']', ' ', description)
    # Quitar palabras de relleno o códigos provisionales
    stop_words = {"suministro", "instalacion", "colocacion", "mano", "obra", "incluye", "transporte", "acarreo"}
    words = [w for w in cleaned.split() if w.lower() not in stop_words]
    return " ".join(words[:8]).strip()


def research_material_web_price(description: str, unit: str = "") -> Optional[Dict[str, Any]]:
    """
    Busca en internet el precio promedio de un material en USD para el mercado de construcción.
    Retorna un diccionario con precio_promedio, rango_min, rango_max y resumen, o None si no hay datos.
    """
    if DDGS is None:
        logger.warning("[WEB_PRICE] duckduckgo_search no disponible en el entorno. Omitiendo búsqueda web.")
        return None

    if not description or not description.strip():
        return None

    desc_clean = _clean_search_query(description)
    if not desc_clean:
        return None

    cache_key = f"{desc_clean.lower()}_{unit.lower()}"
    if cache_key in _WEB_PRICE_CACHE:
        logger.info("[WEB_PRICE] Retornando precio desde caché para: %s", desc_clean)
        return _WEB_PRICE_CACHE[cache_key]

    unit_hint = f"por {unit}" if unit else ""
    query = f"precio {desc_clean} {unit_hint} venezuela dolares".strip()

    logger.info("[WEB_PRICE] Consultando en internet: '%s'", query)

    snippets: List[str] = []
    try:
        ddgs = DDGS()
        results = list(ddgs.text(query, max_results=5))
        for r in results:
            title = r.get("title", "")
            body = r.get("body", "")
            if title or body:
                snippets.append(f"- {title}: {body}")
    except Exception as exc:
        logger.error("[WEB_PRICE] Error al consultar buscador web para '%s': %s", query, exc, exc_info=True)
        return None

    if not snippets:
        logger.warning("[WEB_PRICE] No se encontraron resultados web para: %s", query)
        return None

    snippets_text = "\n".join(snippets)

    prompt = f"""Eres un ingeniero de costos y cotizador de construcción. Analiza los siguientes resultados de búsqueda en internet sobre insumos en el mercado:
{snippets_text}

Material solicitado: "{description}" (Unidad: {unit or 'unidad comercial'}).

Determina el precio unitario promedio estimado en USD (dólares) para este insumo.
Descarta publicaciones no relacionadas, fletes excesivos o valores atípicos.
Responde estrictamente en formato JSON válido con la siguiente estructura:
{{
  "precio_promedio": 25.50,
  "rango_min": 20.0,
  "rango_max": 32.0,
  "resumen": "Promedio basado en ofertas web..."
}}
"""

    try:
        data = call_llm_json(prompt, use_case="cost360")
        if isinstance(data, dict):
            precio_prom = float(data.get("precio_promedio") or 0.0)
            if precio_prom > 0:
                result = {
                    "precio_promedio": round(precio_prom, 2),
                    "rango_min": round(float(data.get("rango_min") or precio_prom), 2),
                    "rango_max": round(float(data.get("rango_max") or precio_prom), 2),
                    "resumen": str(data.get("resumen") or "Cotización promedio de mercado web").strip()
                }
                _WEB_PRICE_CACHE[cache_key] = result
                logger.info("[WEB_PRICE] Precio promedio detectado para '%s': $%.2f USD", desc_clean, precio_prom)
                return result
    except Exception as exc:
        logger.error("[WEB_PRICE] Error al procesar respuesta del LLM para '%s': %s", desc_clean, exc, exc_info=True)

    return None
