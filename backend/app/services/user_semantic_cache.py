import json
from typing import Any, Dict, List, Optional
import numpy as np
from sqlalchemy.orm import Session
from app.core.logging import logger
from app.db.models.costbase import CustomCostItem
from app.services.ai_search import ai_engine


def compute_description_embedding(description: str) -> Optional[np.ndarray]:
    """
    Genera el vector de embedding para una descripción técnica.
    Retorna un ndarray de NumPy en float32 o None si ocurre un error.
    """
    if not description or not isinstance(description, str) or not description.strip():
        return None

    try:
        if not ai_engine.is_loaded:
            ai_engine.load()
        vec = ai_engine.encode_query(description.strip())
        return vec
    except Exception as exc:
        logger.error("Error al generar embedding para caché semántico: %s", exc, exc_info=True)
        return None


def calculate_vector_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """
    Calcula la similitud de coseno entre dos vectores 1D.
    Retorna un valor entre -1.0 y 1.0.
    """
    if vec_a is None or vec_b is None or len(vec_a) == 0 or len(vec_b) == 0:
        return 0.0

    norm_a = float(np.linalg.norm(vec_a))
    norm_b = float(np.linalg.norm(vec_b))

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    similarity = float(np.dot(vec_a, vec_b) / (norm_a * norm_b))
    return max(-1.0, min(1.0, similarity))


def lookup_user_semantic_cache(
    db: Session,
    user_id: Optional[int],
    description: str,
    threshold: float = 0.96
) -> Optional[Dict[str, Any]]:
    """
    Busca si el usuario autenticado tiene un APU previamente guardado/validado
    con una similitud semántica >= threshold (por defecto 0.96).

    Retorna el APU estructurado si hay coincidencia (0 tokens de LLM), o None.
    """
    if user_id is None or not description or not isinstance(description, str) or not description.strip():
        return None

    clean_desc = description.strip()

    try:
        # 1. Consultar APUs guardados pertenecientes a este usuario que tengan embedding
        saved_items = db.query(CustomCostItem).filter(
            CustomCostItem.user_id == user_id,
            CustomCostItem.embedding.isnot(None)
        ).all()

        if not saved_items:
            return None

        # 2. Generar embedding de la consulta entrante
        query_vec = compute_description_embedding(clean_desc)
        if query_vec is None:
            return None

        # 3. Comparar similitud contra cada APU del usuario
        best_match: Optional[CustomCostItem] = None
        best_score: float = -1.0

        for item in saved_items:
            if not item.embedding:
                continue
            try:
                emb_list = json.loads(item.embedding)
                item_vec = np.array(emb_list, dtype=np.float32)
                sim = calculate_vector_similarity(query_vec, item_vec)
                if sim > best_score:
                    best_score = sim
                    best_match = item
            except Exception as parse_err:
                logger.warning("Error al deserializar embedding de CustomCostItem %s: %s", item.id, parse_err)
                continue

        # 4. Verificar umbral de aceptación (>= 0.96)
        if best_match is not None and best_score >= threshold:
            logger.info(
                "Semantic Cache HIT para usuario %s (similitud: %.4f): '%.80s' -> Guardado: '%.80s'",
                user_id, best_score, clean_desc, best_match.description
            )

            # Deserializar apu_data
            apu_dict: Dict[str, Any] = {}
            if best_match.apu_data:
                try:
                    apu_dict = json.loads(best_match.apu_data)
                except Exception as json_err:
                    logger.error("Error al deserializar apu_data de CustomCostItem %s: %s", best_match.id, json_err, exc_info=True)

            partida_obj = apu_dict.get("partida") or {
                "cod_par": f"CUST-{best_match.id[:8].upper()}",
                "description": best_match.description,
                "unit": best_match.unit,
                "performance": best_match.performance or 1.0,
                "quantity": 1.0
            }

            cached_result = {
                "status": "completed",
                "source": "user_semantic_cache",
                "cache_hit": True,
                "similarity": round(best_score, 4),
                "matched_custom_id": best_match.id,
                "partida": partida_obj,
                "materials": apu_dict.get("materials", []),
                "equipments": apu_dict.get("equipments", []),
                "labors": apu_dict.get("labors", []),
                "notas_adaptacion": [
                    f"⚡ APU recuperado instantáneamente de tus partidas guardadas "
                    f"(similitud {best_score * 100:.1f}%, 0 tokens consumidos)."
                ],
                "advertencias": []
            }
            return cached_result

        return None

    except Exception as exc:
        logger.error("Error en lookup_user_semantic_cache: %s", exc, exc_info=True)
        return None
