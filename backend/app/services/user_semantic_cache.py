from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional
import numpy as np
from sqlalchemy.orm import Session
from app.core.logging import logger
from app.db.models.costbase import CustomCostItem
from app.services.ai_search import ai_engine
from app.services.text_norm import norm_text

MAX_CACHE_AGE_DAYS: int = 90

_SCOPE_TOKENS = frozenset({
    "ACARREO", "BOTE", "TRANSPORTE", "DESMONTAJE", "SUMINISTRO",
    "INCLUYE", "EXCLUYE", "SIN", "SOLO", "ADEMAS", "RETIRO", "DEMOLICION",
})


def _scope_signature(text: str) -> frozenset:
    """Tokens de alcance presentes en la descripción, para detectar
    APUs que difieren en el alcance aunque sean semánticamente cercanos (P0 #3)."""
    t = norm_text(text)
    return frozenset(tok for tok in _SCOPE_TOKENS if tok in t)


def compute_description_embedding(description: str) -> Optional[np.ndarray]:
    """
    Genera el vector de embedding para una descripción técnica.
    Retorna un ndarray de NumPy en float32 o None si ocurre un error.
    """
    if not description or not isinstance(description, str) or not description.strip():
        return None

    try:
        if not ai_engine.is_loaded:
            ai_engine.load_brain()
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

    if len(vec_a) != len(vec_b):
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
    unit: Optional[str] = None,
    threshold: float = 0.96
) -> Optional[Dict[str, Any]]:
    """
    Busca si el usuario autenticado tiene un APU previamente guardado/validado
    con una similitud semántica >= threshold (por defecto 0.96) que coincida en unidad y alcance.

    Retorna el APU estructurado si hay coincidencia (0 tokens de LLM), o None.
    """
    if user_id is None or not description or not isinstance(description, str) or not description.strip():
        return None

    clean_desc = description.strip()

    try:
        # §6.4: Consultar solo metadatos ligeros sin cargar apu_data pesada O(N)
        # §6.2: Filtrar por unidad si está presente
        q = db.query(
            CustomCostItem.id,
            CustomCostItem.embedding,
            CustomCostItem.description,
            CustomCostItem.unit,
            CustomCostItem.performance,
            CustomCostItem.created_at,
        ).filter(
            CustomCostItem.user_id == user_id,
            CustomCostItem.embedding.isnot(None),
        )

        if unit:
            clean_unit = unit.strip().lower()
            q = q.filter(CustomCostItem.unit.ilike(clean_unit))

        rows = q.limit(500).all()

        if not rows:
            return None

        # 2. Generar embedding de la consulta entrante
        query_vec = compute_description_embedding(clean_desc)
        if query_vec is None:
            return None

        # 3. Comparar similitud contra cada APU del usuario
        best_id: Optional[Any] = None
        best_score: float = -1.0
        best_row: Optional[Any] = None
        dim_mismatch_logged = False

        for row in rows:
            emb_str = row.embedding
            if not emb_str:
                continue
            try:
                emb_list = json.loads(emb_str)
                item_vec = np.array(emb_list, dtype=np.float32)
                if len(item_vec) != len(query_vec):
                    if not dim_mismatch_logged:
                        logger.error(
                            "Dimensión de vector incompatible en caché semántico (item: %d, query: %d)",
                            len(item_vec), len(query_vec)
                        )
                        dim_mismatch_logged = True
                    continue

                sim = calculate_vector_similarity(query_vec, item_vec)
                if sim > best_score:
                    best_score = sim
                    best_id = row.id
                    best_row = row

                    # §6.5: Corte temprano si la similitud es casi idéntica
                    if best_score >= (threshold + 0.02):
                        break

            except Exception as parse_err:
                logger.warning("Error al deserializar embedding de CustomCostItem %s: %s", row.id, parse_err)
                continue

        # 4. Verificar umbral de aceptación (>= threshold)
        if best_row is not None and best_score >= threshold:
            # §6.3: Guardia de alcance: verificar que no haya diferencias sustanciales de alcance
            query_scope = _scope_signature(clean_desc)
            saved_scope = _scope_signature(best_row.description)
            if query_scope != saved_scope:
                logger.info(
                    "Cache descartado por diferencial de alcance: consulta='%s' (scope: %s) guardado='%s' (scope: %s)",
                    clean_desc, query_scope, best_row.description, saved_scope
                )
                return None

            # §6.1: Verificación de TTL / Antigüedad
            saved_at = getattr(best_row, "updated_at", None) or getattr(best_row, "created_at", None)
            age_days = 0
            if saved_at is not None:
                now_dt = datetime.now(timezone.utc) if saved_at.tzinfo is not None else datetime.utcnow()
                age_days = max(0, (now_dt - saved_at).days)
                if age_days > MAX_CACHE_AGE_DAYS:
                    logger.info(
                        "Cache descartado por antigüedad (%d días > %d) para usuario %s",
                        age_days, MAX_CACHE_AGE_DAYS, user_id
                    )
                    return None
            else:
                logger.warning("CustomCostItem %s sin timestamp; caché deshabilitado para este registro.", best_id)
                return None

            # §6.4: Cargar apu_data SOLO del item ganador
            winning_item = db.query(CustomCostItem).filter(CustomCostItem.id == best_id).first()
            if not winning_item:
                return None

            logger.info(
                "Semantic Cache HIT para usuario %s (similitud: %.4f, antigüedad: %d días): '%.80s' -> Guardado: '%.80s'",
                user_id, best_score, clean_desc, age_days, winning_item.description
            )

            # Deserializar apu_data
            apu_dict: Dict[str, Any] = {}
            if winning_item.apu_data:
                try:
                    apu_dict = json.loads(winning_item.apu_data)
                except Exception as json_err:
                    logger.error("Error al deserializar apu_data de CustomCostItem %s: %s", winning_item.id, json_err, exc_info=True)

            # §6.5: str(winning_item.id)[:8] seguro para str o int
            partida_obj = apu_dict.get("partida") or {
                "cod_par": f"CUST-{str(winning_item.id)[:8].upper()}",
                "description": winning_item.description,
                "unit": winning_item.unit,
                "performance": winning_item.performance or 1.0,
                "quantity": 1.0
            }

            cached_advs = list(apu_dict.get("advertencias") or [])
            if not cached_advs:
                for m in apu_dict.get("materials", []):
                    if isinstance(m, dict) and str(m.get("origen", "")).lower() in ("ia", "referencial"):
                        m_desc = m.get("descripcion", "")
                        m_pu = float(m.get("precio_unitario") or 0.0)
                        cached_advs.append(
                            f"[PRECIO_REFERENCIAL] Insumo incorporado (precio referencial de mercado): '{m_desc}' (${m_pu:,.2f} USD). Verifique precio local con proveedores."
                        )
                for e in apu_dict.get("equipments", []):
                    if isinstance(e, dict) and str(e.get("origen", "")).lower() in ("ia", "referencial"):
                        e_desc = e.get("descripcion", "")
                        e_pu = float(e.get("precio_unitario") or 0.0)
                        cached_advs.append(
                            f"[PRECIO_REFERENCIAL] Equipo incorporado (precio referencial de mercado): '{e_desc}' (${e_pu:,.2f} USD). Verifique costo diario con proveedores locales."
                        )

            # Preservar notas originales y agregar nota de recuperación con aviso de vigencia
            notas_adaptacion = list(apu_dict.get("notas_adaptacion") or [])
            cache_note = (
                f"⚡ APU recuperado de tus partidas guardadas "
                f"(similitud {best_score * 100:.1f}%, guardado hace {age_days} días, 0 tokens). "
                f"Los precios corresponden a la fecha de guardado: verifique tarifas vigentes."
            )
            if cache_note not in notas_adaptacion:
                notas_adaptacion.insert(0, cache_note)

            cached_result = {
                "status": "completed",
                "source": "user_semantic_cache",
                "cache_hit": True,
                "similarity": round(best_score, 4),
                "matched_custom_id": winning_item.id,
                "saved_at": saved_at.isoformat() if saved_at else None,
                "age_days": age_days,
                "precios_congelados": True,
                "partida": partida_obj,
                "materials": apu_dict.get("materials", []),
                "equipments": apu_dict.get("equipments", []),
                "labors": apu_dict.get("labors", []),
                "notas_adaptacion": notas_adaptacion,
                "advertencias": cached_advs
            }
            return cached_result

        return None

    except Exception as exc:
        logger.error("Error en lookup_user_semantic_cache: %s", exc, exc_info=True)
        return None
