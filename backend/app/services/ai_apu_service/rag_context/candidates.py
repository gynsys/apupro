from typing import Any, Dict, List, Set, Tuple
from sqlalchemy.orm import Session
from app.core.logging import logger
from app.db.models.cost360 import CostItem
from app.services.ai_search import ai_engine


INCOMPATIBLE_POLARITY_RULES: List[Tuple[Set[str], Set[str], float]] = [
    # 1. Agua Limpia / Pozo Profundo VS Aguas Negras / Residuales / Achique / Cloacas
    (
        {"pozo", "pozo profundo", "agua limpia", "agua potable", "lapicero", "hidroneumatico"},
        {"aguas negras", "aguas residuales", "aguas servidas", "achique", "cloaca", "drenaje pluvial", "aguas de lluvia"},
        0.25
    ),
    # 2. Tuberías a Presión / Agua Blanca VS Tuberías Sanitarias / Desagüe / Ventilación
    (
        {"presion", "aduccion", "distribucion", "astm d-2241", "ppr", "termofusion", "agua blanca"},
        {"ventilacion", "sanitaria", "desague", "bajante", "norma 656", "aguas servidas"},
        0.25
    ),
    # 3. Trabajo Manual / Espacio Confinado / Reparación Puntual VS Maquinaria Pesada
    (
        {"a mano", "manual", "con carretilla", "espacio confinado", "en sotano", "reparacion puntual"},
        {"retroexcavadora", "payloader", "tractor", "jumbo", "camion roquero", "planta de concreto", "camion mixer"},
        0.30
    ),
    # 4. Cable Sumergible de Pozo VS Cable Eléctrico Convencional en Ducto
    (
        {"cable submarino", "cable sumergible", "pozo profundo"},
        {"conduit", "embutido en tuberia", "en bandeja"},
        0.20
    ),
    # 5. Fuerza / Motores Trifásicos VS Alumbrado / Tomacorrientes Monofásicos
    (
        {"fuerza", "motor", "ccm", "arrancador", "bomba trifasica"},
        {"alumbrado", "iluminacion", "tomacorriente", "tablero nlab"},
        0.20
    ),
    # 6. Trabajo Vertical a Rapel / Cuerdas VS Andamios Tubulares Apoyados de Piso
    (
        {"rapel", "a rapel", "cuerda", "silleta", "guindola", "trabajo vertical", "trabajo suspendido"},
        {"andamio tubular", "andamio de marco", "andamio de un cuerpo", "andamio modular"},
        0.25
    ),
    # 7. Trabajos a Nivel de Piso / Pavimento VS Trabajos en Altura / Torres / Fachadas
    (
        {"piso", "pisos", "pavimento", "pavimentos", "acera", "aceras", "radier", "contrapiso", "sobrepiso"},
        {"torre", "torres", "rapel", "escalerilla", "guia de onda", "fachada"},
        0.30
    )
]

TECHNICAL_DISCIPLINE_CLUSTERS: Dict[str, Set[str]] = {
    "BOMBEO_HIDRAULICA": {
        "bomba", "bombas", "bombeo", "hidroneumatico", "pozo", "pozo profundo",
        "lapicero", "sumergible", "centrifuga", "presion constante", "achique",
        "electrobomba", "motobomba", "eyector"
    },
    "HVAC_CLIMATIZACION": {
        "aire acondicionado", "split", "chiller", "fancoil", "climatizacion",
        "refrigeracion", "condensadora", "evaporadora", "ducteria", "difusor",
        "unidad de ventana", "uma", "vrf", "vrv"
    },
    "ELECTRICO_FUERZA": {
        "transformador", "subestacion", "tablero electrico", "tablero de distribucion",
        "planta electrica", "grupo electrogeno", "ccm", "arrancador", "banco de transformadores",
        "poste", "linea de alta tension", "linea de baja tension", "seccionador"
    },
    "ESTRUCTURAS_METALICAS": {
        "estructura metalica", "viga metalica", "columna metalica", "perfil metalico",
        "cercha", "tijera metalica", "correa metalica", "baranda metalica", "escalera metalica",
        "porton metalico", "reja de hierro", "galpon", "cubierta metalica"
    },
    "ELEVACION_TRANSPORTE": {
        "ascensor", "montacargas", "escalera mecanica"
    },
    "OBRA_CIVIL_ALBANILERIA": {
        "pared de bloque", "friso", "revoque", "losa", "concreto", "viga de concreto",
        "columna de concreto", "zapata", "mamposteria", "piso de granito", "ceramica", "porcelanato"
    }
}

CORE_EQUIPMENT_KEYWORDS: List[str] = [
    "bomba",
    "bombas",
    "hidroneumatico",
    "bomba sumergible",
    "bomba centrifuga",
    "equipo de bombeo",
    "sistema de bombeo",
    "transformador",
    "tablero electrico",
    "tablero de distribucion",
    "aire acondicionado",
    "chiller",
    "fancoil",
    "planta electrica",
    "grupo electrogeno",
    "ascensor",
    "montacargas",
    "compresor",
]

AUXILIARY_CIVIL_OR_FITTING_TERMS: List[str] = [
    "conexion domiciliaria",
    "caja para medidor",
    "caja troncoconica",
    "acometida",
    "meter joke",
    "zanja",
    "demolicion",
    "bote de",
    "acarreo de",
]


def _apply_technical_scoring_adjustments(query_text: str, item_desc: str, current_score: float) -> float:
    """
    Ajusta el score de similitud técnica:
    1. Aplica penalizaciones cruzadas a candidatos con polaridad técnica opuesta (agua limpia vs residual, etc.).
    2. Valida disciplina técnica tecnológica: penaliza severamente candidatos de disciplinas cruzadas incompatibles
       (ej: split de aire acondicionado cuando se solicita bomba/bombeo) y bonifica a la misma disciplina.
    3. Bonifica coincidencia de acción (desmontaje vs desmontaje).
    4. Penaliza partidas de accesorios menores o conexiones domiciliarias cuando se solicitó equipo principal.
    """
    if not query_text or not item_desc:
        return current_score

    q_lower = query_text.lower()
    i_lower = item_desc.lower()

    # 1. Reglas de polaridad técnica opuesta
    for polo_a, polo_b, penalty in INCOMPATIBLE_POLARITY_RULES:
        q_has_a = any(t in q_lower for t in polo_a)
        q_has_b = any(t in q_lower for t in polo_b)
        i_has_a = any(t in i_lower for t in polo_a)
        i_has_b = any(t in i_lower for t in polo_b)

        if q_has_a and not q_has_b and i_has_b and not i_has_a:
            current_score = max(0.0, current_score - penalty)
        elif q_has_b and not q_has_a and i_has_a and not i_has_b:
            current_score = max(0.0, current_score - penalty)

    # 2. Afinidad y Discordancia por Disciplina Tecnológica
    q_disciplines: Set[str] = set()
    for disc_name, terms in TECHNICAL_DISCIPLINE_CLUSTERS.items():
        if any(term in q_lower for term in terms):
            q_disciplines.add(disc_name)

    i_disciplines: Set[str] = set()
    for disc_name, terms in TECHNICAL_DISCIPLINE_CLUSTERS.items():
        if any(term in i_lower for term in terms):
            i_disciplines.add(disc_name)

    if q_disciplines:
        if i_disciplines:
            shared = q_disciplines & i_disciplines
            if shared:
                # Misma disciplina técnica: bonificación alta
                current_score = min(1.0, current_score + 0.20)
            else:
                # Conflicto severo de disciplina cruzada (ej. bomba vs aire acondicionado)
                current_score = max(0.0, current_score - 0.40)
        else:
            # El candidato no tiene ninguna de las disciplinas principales del query
            is_auxiliary = any(aux in i_lower for aux in AUXILIARY_CIVIL_OR_FITTING_TERMS)
            if is_auxiliary:
                current_score = max(0.0, current_score - 0.20)

    # 3. Afinidad de Verbo Rector (Desmontaje / Demolición)
    q_is_removal = any(r in q_lower for r in ["desmontaje", "demolicion", "retiro", "desinstalacion", "extraccion", "desmantelamiento"])
    i_is_removal = any(r in i_lower for r in ["desmontaje", "demolicion", "retiro", "desinstalacion", "extraccion", "desmantelamiento", "desconexion"])
    if q_is_removal and i_is_removal:
        current_score = min(1.0, current_score + 0.08)

    return current_score


def get_dynamic_candidates(
    db: Session,
    description: str,
    covenin_prefix: str = "",
    limit: int = 15,
) -> Tuple[List[Dict[str, Any]], float]:
    """
    Recupera las partidas más similares desde el Cerebro RAG Híbrido,
    considerando el material técnico y filtrando opcionalmente por prefijo.
    Aplica penalizaciones cruzadas a candidatos con incompatibilidad funcional polar.
    """
    if not description or not isinstance(description, str):
        return [], 0.0

    try:
        if not getattr(ai_engine, "is_loaded", False):
            ai_engine.load_brain()
            
        hybrid_results = ai_engine.hybrid_search(db, description, limit=limit * 3)
        if not hybrid_results:
            return [], 0.0
            
        best_score = float(hybrid_results[0]["score"])
        
        tipo_obra = covenin_prefix[0] if covenin_prefix else ""
        prefixes = [covenin_prefix] if covenin_prefix else []
        
        candidates_with_scores: List[Tuple[str, float]] = []
        
        for result in hybrid_results:
            item_id = result["id"]
            score = float(result["score"])
            
            is_strict = any(item_id.startswith(p) for p in prefixes) if prefixes else False
            is_family = item_id.startswith(tipo_obra) if tipo_obra else False
            
            if is_strict:
                score += 0.15
            elif is_family:
                score += 0.05
                
            if score >= 0.30:
                candidates_with_scores.append((item_id, score))
                
        candidates_with_scores.sort(key=lambda x: x[1], reverse=True)
        final_ids = [c[0] for c in candidates_with_scores[:limit]]
            
        if not final_ids:
            return [], best_score
            
        items = db.query(CostItem).filter(CostItem.CodPar.in_(final_ids)).all()
        item_map = {i.CodPar: i for i in items}
        
        # Aplicar penalización de polaridad técnica y afinidad de equipos principales
        scored_candidates: List[Dict[str, Any]] = []
        for i, score in candidates_with_scores[:limit]:
            if i in item_map:
                it = item_map[i]
                adjusted_score = _apply_technical_scoring_adjustments(description, it.Descri or "", score)
                scored_candidates.append({"item": it, "score": round(adjusted_score, 3)})

        # Re-ordenar por el score ajustado para priorizar candidatos afines
        scored_candidates.sort(key=lambda x: x["score"], reverse=True)
        best_adjusted = scored_candidates[0]["score"] if scored_candidates else best_score
        return scored_candidates, float(best_adjusted)
    except Exception as exc:
        logger.error("Error en get_dynamic_candidates: %s", exc, exc_info=True)
        return [], 0.0
