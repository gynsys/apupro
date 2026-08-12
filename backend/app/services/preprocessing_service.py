"""
Módulo de preprocesamiento de datos APU (Análisis de Precios Unitarios).

Este módulo recupera partidas similares de la base de datos, calcula estadísticas
de rendimiento de insumos y estructura un payload para consumo por un LLM.
"""

import logging
import statistics
import unicodedata
from sqlalchemy import func
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import or_, and_, case
from sqlalchemy.orm import Session

from app.db.models.cost360 import (
    CostAPUEquipment,
    CostAPULabor,
    CostAPUMaterial,
    CostEquipment,
    CostItem,
    CostLabor,
    CostMaterial,
)

# ---------------------------------------------------------------------------
# Configuración de logging
# ---------------------------------------------------------------------------
logger = logging.getLogger(__name__)

def strip_accents(s: str) -> str:
    if not s:
        return s
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def unaccent_col(column):
    return func.translate(column, 'áéíóúÁÉÍÓÚäëïöüÄËÏÖÜ', 'aeiouAEIOUaeiouAEIOU')

# ---------------------------------------------------------------------------
# Constantes de configuración
# ---------------------------------------------------------------------------
STOPWORDS = {
    "para", "con", "del", "por", "las", "los", "una", "uno", "como", "sobre",
    "el", "la", "de", "en", "y", "a", "que", "se", "un", "al", "lo", "le",
    "es", "son", "fue", "han", "ha", "me", "te", "su", "sus", "mi", "mis",
}
MIN_KEYWORD_LENGTH = 3
SIMILARITY_THRESHOLD = 0.25
PRESENCE_THRESHOLD = 20.0
OBLIGATORY_THRESHOLD = 70.0
TOP_ITEMS_LIMIT = 10
SEARCH_LIMIT = 50
CATALOG_FALLBACK_LIMIT = 20
MATERIAL_FALLBACK_LIMIT = 80
VARIABILITY_RATIO = 0.5


# ---------------------------------------------------------------------------
# Estructuras de datos
# ---------------------------------------------------------------------------
@dataclass
class InsumoStat:
    """Estadísticas de un insumo agrupado."""
    descripcion: str
    unidad: str
    cantidades: List[float] = field(default_factory=list)
    codigos: Set[str] = field(default_factory=set)
    total_partidas_unidad: int = 0

    @property
    def frecuencia(self) -> int:
        return len(self.cantidades)

    @property
    def promedio(self) -> Optional[float]:
        if not self.cantidades:
            return None
        return statistics.mean(self.cantidades)

    @property
    def minimo(self) -> Optional[float]:
        return min(self.cantidades) if self.cantidades else None

    @property
    def maximo(self) -> Optional[float]:
        return max(self.cantidades) if self.cantidades else None

    @property
    def porcentaje_presencia(self) -> float:
        if self.total_partidas_unidad <= 0:
            return 0.0
        return (self.frecuencia / self.total_partidas_unidad) * 100

    def to_dict(self) -> Dict[str, Any]:
        return {
            "descripcion": self.descripcion,
            "unidad": self.unidad,
            "min": round(self.minimo, 4) if self.minimo is not None else None,
            "max": round(self.maximo, 4) if self.maximo is not None else None,
            "promedio": round(self.promedio, 4) if self.promedio is not None else None,
            "frecuencia": self.frecuencia,
            "total_partidas_unidad": self.total_partidas_unidad,
            "porcentaje_presencia": round(self.porcentaje_presencia, 1),
            "codigos": sorted(self.codigos),
        }


@dataclass
class SearchResult:
    """Resultado de una búsqueda de partidas similares."""
    items: List[CostItem]
    modo_fallback: bool
    keywords: List[str]


# ---------------------------------------------------------------------------
# Funciones auxiliares
# ---------------------------------------------------------------------------
def _extract_keywords(description: str) -> List[str]:
    """
    Extrae palabras clave de una descripción, filtrando stopwords
    y palabras muy cortas.
    """
    if not isinstance(description, str) or not description.strip():
        return []

    words = description.split()
    keywords = [
        w.lower().strip(".,;:!?()")
        for w in words
        if len(w.strip(".,;:!?()")) > MIN_KEYWORD_LENGTH
        and strip_accents(w.lower().strip(".,;:!?()")) not in STOPWORDS
    ]
    return keywords


def _normalize_unit(unit: Optional[str]) -> str:
    """Normaliza una unidad de medida para evitar duplicados por formato."""
    if not unit:
        return "ND"
    normalized = unit.strip().lower()
    # Mapeos comunes de normalización
    mappings = {
        "m2": "m²",
        "m3": "m³",
        "m2.": "m²",
        "m3.": "m³",
        "kg.": "kg",
        "und.": "und",
        "unidad": "und",
        "unidades": "und",
        "dia": "día",
        "día.": "día",
        "dia.": "día",
    }
    return mappings.get(normalized, normalized)


def _calculate_similarity_score(item: CostItem, keywords: List[str]) -> float:
    """
    Calcula un score de similitud entre una partida y las keywords.
    """
    if not keywords:
        return 0.0

    if not item.Descri:
        return 0.0

    keywords_set = set(keywords)
    desc_words = {
        w.lower().strip(".,;:!?()")
        for w in item.Descri.split()
        if len(w.strip(".,;:!?()")) > MIN_KEYWORD_LENGTH
    }

    if not desc_words:
        return 0.0

    score = 0
    for kw in keywords_set:
        for dw in desc_words:
            if kw in dw or dw in kw:
                score += 1
                break  # Cuenta una vez por keyword

    return score / len(keywords_set)


def _find_similar_items(
    db: Session,
    description: str,
    covenin_prefix: Optional[str],
) -> Tuple[List[CostItem], float]:
    """
    Busca partidas filtrando ESTRICTAMENTE por el prefijo COVENIN seleccionado,
    y luego utiliza el motor RAG V6 (MiniLM) para calcular la similitud semántica.
    Devuelve las partidas encontradas y el score más alto.
    """
    if not covenin_prefix:
        return [], 0.0

    try:
        base_items = db.query(CostItem).filter(CostItem.CodPar.like(f"{covenin_prefix}%")).all()
    except Exception as exc:
        logger.error("Error al consultar partidas por prefijo COVENIN: %s", exc)
        return [], 0.0

    if not base_items:
        return [], 0.0

    from app.services.ai_search import ai_engine
    if not ai_engine.is_loaded:
        ai_engine.load_brain()

    best_score = 0.0
    similar_items = []

    if ai_engine.is_loaded and description.strip():
        valid_ids = [item.CodPar for item in base_items]
        results = ai_engine.calculate_similarity_for_subset(description, valid_ids)
        
        if results:
            best_score = results[0]["score"]
            top_ids = [res["id"] for res in results[:3]]
            
            # Mapear IDs a objetos de SQLAlchemy
            item_map = {item.CodPar: item for item in base_items}
            similar_items = [item_map[pid] for pid in top_ids if pid in item_map]
    else:
        # Fallback: Solo devolver hasta 3 de las base si falla la IA
        similar_items = base_items[:3]

    return similar_items, best_score





def _fetch_insumos(
    db: Session,
    item_codes: List[str],
    unidad_por_partida: Dict[str, str],
) -> Tuple[Dict, Dict, Dict]:
    """
    Recupera insumos (materiales, equipos, mano de obra) de las partidas dadas.
    """
    resultados = {
        "materiales": defaultdict(lambda: defaultdict(list)),
        "mano_obra": defaultdict(lambda: defaultdict(list)),
        "equipos": defaultdict(lambda: defaultdict(list)),
    }

    if not item_codes:
        return resultados["materiales"], resultados["mano_obra"], resultados["equipos"]

    # Materiales
    try:
        mat_rels = (
            db.query(CostAPUMaterial, CostMaterial)
            .join(CostMaterial, CostAPUMaterial.CodIns == CostMaterial.CodMat)
            .filter(CostAPUMaterial.CodPar.in_(item_codes))
            .all()
        )
        for rel, mat in mat_rels:
            u_partida = _normalize_unit(unidad_por_partida.get(rel.CodPar))
            desc = (mat.Descri or "").strip()
            unidad = _normalize_unit(mat.UniMat)
            key = f"{desc} | {unidad}"
            resultados["materiales"][u_partida][key].append(
                {"cantidad": rel.CanIns, "codigo": mat.CodMat}
            )
    except Exception as exc:
        logger.error("Error al consultar materiales: %s", exc)

    # Equipos
    try:
        eq_rels = (
            db.query(CostAPUEquipment, CostEquipment)
            .join(CostEquipment, CostAPUEquipment.CodIns == CostEquipment.CodEqu)
            .filter(CostAPUEquipment.CodPar.in_(item_codes))
            .all()
        )
        for rel, eq in eq_rels:
            u_partida = _normalize_unit(unidad_por_partida.get(rel.CodPar))
            desc = (eq.Descri or "").strip()
            key = f"{desc} | día"
            resultados["equipos"][u_partida][key].append(
                {"cantidad": rel.CanIns, "codigo": eq.CodEqu}
            )
    except Exception as exc:
        logger.error("Error al consultar equipos: %s", exc)

    # Mano de obra
    try:
        mo_rels = (
            db.query(CostAPULabor, CostLabor)
            .join(CostLabor, CostAPULabor.CodIns == CostLabor.CodMan)
            .filter(CostAPULabor.CodPar.in_(item_codes))
            .all()
        )
        for rel, mo in mo_rels:
            u_partida = _normalize_unit(unidad_por_partida.get(rel.CodPar))
            desc = (mo.Descri or "").strip()
            key = f"{desc} | día"
            resultados["mano_obra"][u_partida][key].append(
                {"cantidad": rel.CanIns, "codigo": mo.CodMan}
            )
    except Exception as exc:
        logger.error("Error al consultar mano de obra: %s", exc)

    return resultados["materiales"], resultados["mano_obra"], resultados["equipos"]


def _calculate_statistics(
    materiales: Dict,
    mano_obra: Dict,
    equipos: Dict,
    similar_items: List[CostItem],
) -> Dict[str, Dict[str, Dict[str, InsumoStat]]]:
    """
    Calcula estadísticas de rendimiento para cada tipo de insumo.
    """
    estadisticas: Dict[str, Dict[str, Dict[str, InsumoStat]]] = {
        "materiales": defaultdict(dict),
        "mano_obra": defaultdict(dict),
        "equipos": defaultdict(dict),
    }

    # Precalcular conteo de partidas por unidad para evitar O(n²)
    partidas_por_unidad: Dict[str, int] = defaultdict(int)
    for item in similar_items:
        unidad = _normalize_unit(item.UniPar)
        partidas_por_unidad[unidad] += 1

    for tipo, grupos_por_unidad in {
        "materiales": materiales,
        "mano_obra": mano_obra,
        "equipos": equipos,
    }.items():
        for u_partida, grupos_insumos in grupos_por_unidad.items():
            for key, items in grupos_insumos.items():
                cantidades = [
                    i["cantidad"]
                    for i in items
                    if i["cantidad"] is not None and i["cantidad"] > 0
                ]
                if not cantidades:
                    continue

                stat = InsumoStat(
                    descripcion=key.split(" | ")[0],
                    unidad=key.split(" | ")[1],
                    cantidades=cantidades,
                    codigos={i["codigo"] for i in items if i.get("codigo")},
                    total_partidas_unidad=partidas_por_unidad.get(u_partida, 0),
                )
                estadisticas[tipo][u_partida][key] = stat

    return estadisticas


def _detect_warnings(
    estadisticas: Dict[str, Dict[str, Dict[str, InsumoStat]]]
) -> List[str]:
    """Detecta advertencias de alta variabilidad en los rendimientos."""
    advertencias = []

    for tipo, grupos_por_unidad in estadisticas.items():
        for u_partida, grupos_insumos in grupos_por_unidad.items():
            for key, stat in grupos_insumos.items():
                if stat.porcentaje_presencia < PRESENCE_THRESHOLD:
                    continue
                if not stat.promedio or stat.promedio <= 0:
                    continue

                rango = (stat.maximo or 0) - (stat.minimo or 0)
                if rango > stat.promedio * VARIABILITY_RATIO:
                    advertencias.append(
                        f"{tipo.upper()} '{stat.descripcion}' (unidad {u_partida}): "
                        f"alta variabilidad (min={stat.minimo}, max={stat.maximo}, "
                        f"promedio={stat.promedio}). Revisar según condiciones específicas."
                    )

    return advertencias


def _build_catalog(
    db: Session,
    estadisticas: Dict[str, Dict[str, Dict[str, InsumoStat]]],
    modo_fallback: bool,
    keywords: List[str],
) -> Dict[str, List[Dict[str, Any]]]:
    """Construye el catálogo de insumos con precios actuales."""
    catalogo = {
        "materiales": [],
        "equipos": [],
        "mano_obra": [],
    }

    if not modo_fallback:
        codigos_mat: Set[str] = set()
        codigos_eq: Set[str] = set()
        codigos_mo: Set[str] = set()

        for u_partida, grupos_insumos in estadisticas["materiales"].items():
            for key, stat in grupos_insumos.items():
                if stat.porcentaje_presencia >= PRESENCE_THRESHOLD:
                    codigos_mat.update(stat.codigos)

        for u_partida, grupos_insumos in estadisticas["equipos"].items():
            for key, stat in grupos_insumos.items():
                if stat.porcentaje_presencia >= PRESENCE_THRESHOLD:
                    codigos_eq.update(stat.codigos)

        for u_partida, grupos_insumos in estadisticas["mano_obra"].items():
            for key, stat in grupos_insumos.items():
                if stat.porcentaje_presencia >= PRESENCE_THRESHOLD:
                    codigos_mo.update(stat.codigos)

        # Consultar catálogos
        if codigos_mat:
            try:
                mats = (
                    db.query(CostMaterial)
                    .filter(CostMaterial.CodMat.in_(list(codigos_mat)))
                    .all()
                )
                catalogo["materiales"] = [
                    {
                        "codigo": m.CodMat,
                        "descripcion": m.Descri,
                        "unidad": m.UniMat,
                        "precio": m.CosMat,
                    }
                    for m in mats
                ]
            except Exception as exc:
                logger.error("Error al consultar catálogo de materiales: %s", exc)

        if codigos_eq:
            try:
                eqs = (
                    db.query(CostEquipment)
                    .filter(CostEquipment.CodEqu.in_(list(codigos_eq)))
                    .all()
                )
                catalogo["equipos"] = [
                    {
                        "codigo": e.CodEqu,
                        "descripcion": e.Descri,
                        "precio_diario": e.CosDia,
                    }
                    for e in eqs
                ]
            except Exception as exc:
                logger.error("Error al consultar catálogo de equipos: %s", exc)

        if codigos_mo:
            try:
                mos = (
                    db.query(CostLabor)
                    .filter(CostLabor.CodMan.in_(list(codigos_mo)))
                    .all()
                )
                catalogo["mano_obra"] = [
                    {
                        "codigo": m.CodMan,
                        "descripcion": m.Descri,
                        "jornal": m.Jornal,
                    }
                    for m in mos
                ]
            except Exception as exc:
                logger.error("Error al consultar catálogo de mano de obra: %s", exc)

        # Fallback de mano de obra si no hay resultados
        if not catalogo["mano_obra"]:
            try:
                cat_mos = (
                    db.query(CostLabor)
                    .filter(
                        or_(
                            CostLabor.Descri.ilike("%peón%"),
                            CostLabor.Descri.ilike("%maestro%"),
                        )
                    )
                    .limit(CATALOG_FALLBACK_LIMIT)
                    .all()
                )
                catalogo["mano_obra"] = [
                    {
                        "codigo": m.CodMan,
                        "descripcion": m.Descri,
                        "jornal": m.Jornal,
                    }
                    for m in cat_mos
                ]
            except Exception as exc:
                logger.error("Error en fallback de mano de obra: %s", exc)

    else:
        # Modo fallback: búsqueda por keywords en catálogos
        if keywords:
            try:
                cat_mats = (
                    db.query(CostMaterial)
                    .filter(or_(*[CostMaterial.Descri.ilike(f"%{k}%") for k in keywords]))
                    .limit(MATERIAL_FALLBACK_LIMIT)
                    .all()
                )
                catalogo["materiales"] = [
                    {
                        "codigo": m.CodMat,
                        "descripcion": m.Descri,
                        "unidad": m.UniMat,
                        "precio": m.CosMat,
                    }
                    for m in cat_mats
                ]
            except Exception as exc:
                logger.error("Error en fallback de materiales: %s", exc)

        # Equipos: en fallback, buscar por keywords si existen, sino vacío
        if keywords:
            try:
                cat_eqs = (
                    db.query(CostEquipment)
                    .filter(or_(*[CostEquipment.Descri.ilike(f"%{k}%") for k in keywords]))
                    .limit(CATALOG_FALLBACK_LIMIT)
                    .all()
                )
                catalogo["equipos"] = [
                    {
                        "codigo": e.CodEqu,
                        "descripcion": e.Descri,
                        "precio_diario": e.CosDia,
                    }
                    for e in cat_eqs
                ]
            except Exception as exc:
                logger.error("Error en fallback de equipos: %s", exc)

        try:
            cat_mos = (
                db.query(CostLabor)
                .filter(
                    or_(
                        CostLabor.Descri.ilike("%peón%"),
                        CostLabor.Descri.ilike("%maestro%"),
                        CostLabor.Descri.ilike("%albañil%"),
                    )
                )
                .limit(CATALOG_FALLBACK_LIMIT)
                .all()
            )
            catalogo["mano_obra"] = [
                {
                    "codigo": m.CodMan,
                    "descripcion": m.Descri,
                    "jornal": m.Jornal,
                }
                for m in cat_mos
            ]
        except Exception as exc:
            logger.error("Error en fallback de mano de obra: %s", exc)

    return catalogo


def _format_rendimientos(
    estadisticas: Dict[str, Dict[str, Dict[str, InsumoStat]]]
) -> Dict[str, Dict[str, List[Dict[str, Any]]]]:
    """Formatea las estadísticas para el payload final."""
    rendimientos: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}

    for tipo, grupos_por_unidad in estadisticas.items():
        for u_partida, grupos_insumos in grupos_por_unidad.items():
            if u_partida not in rendimientos:
                rendimientos[u_partida] = {
                    "materiales": [],
                    "mano_obra": [],
                    "equipos": [],
                }

            for key, stat in grupos_insumos.items():
                if stat.porcentaje_presencia < PRESENCE_THRESHOLD:
                    continue

                rendimientos[u_partida][tipo].append({
                    "descripcion": stat.descripcion,
                    "unidad_insumo": stat.unidad,
                    "cantidad_minima": stat.minimo,
                    "cantidad_maxima": stat.maximo,
                    "cantidad_promedio": stat.promedio,
                    "frecuencia": f"{stat.frecuencia}/{stat.total_partidas_unidad} partidas",
                    "porcentaje_presencia": f"{stat.porcentaje_presencia}%",
                    "obligatorio": stat.porcentaje_presencia > OBLIGATORY_THRESHOLD,
                    "opcional": stat.porcentaje_presencia <= OBLIGATORY_THRESHOLD,
                })

    return rendimientos


# ---------------------------------------------------------------------------
# Función principal
# ---------------------------------------------------------------------------
def preprocess_apu_data(
    db: Session,
    description: str,
    covenin_prefix: Optional[str] = None,
    covenin_context: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Preprocesa datos de APU para generar un payload estructurado para un LLM.

    Args:
        db: Sesión de SQLAlchemy.
        description: Descripción de la partida de obra.
        covenin_prefix: Prefijo COVENIN seleccionado por el usuario (ej. E34).
        covenin_context: Texto del contexto (ej. Edificaciones > Estructuras > Encofrados).

    Returns:
        Diccionario con modo, partidas encontradas, rendimientos, catálogo y advertencias.
    """
    # Validación de entrada
    if not isinstance(description, str):
        logger.warning("description no es string, convirtiendo: %s", type(description))
        description = str(description) if description else ""

    description = description.strip()
    if not description:
        logger.warning("Descripción vacía recibida")

    # 1. Extraer keywords (solo para fallback de catalogos)
    keywords = _extract_keywords(description)
    logger.info("Keywords extraídas: %s", keywords)

    # 2. Buscar partidas similares usando RAG V6 acotado
    similar_items, best_score = _find_similar_items(db, description, covenin_prefix)
    
    # PORTERO MATEMÁTICO: Bloqueo de incongruencia total
    if best_score < 0.15 and len(similar_items) > 0:
        logger.warning("PORTERO MATEMÁTICO: Incongruencia detectada. Score máximo = %f", best_score)
        return {
            "modo": "incongruencia_matematica",
            "solicitud_usuario": description,
            "covenin_prefix": covenin_prefix,
            "covenin_context": covenin_context,
            "advertencias_preprocesamiento": [],
            "partidas_encontradas": 0
        }

    modo_fallback = len(similar_items) == 0
    partida_exacta_codigo = None
    modo = "sin_datos_historicos" if modo_fallback else "con_datos_historicos"

    if best_score > 0.85:
        modo = "partida_exacta_encontrada"
        partida_exacta_codigo = similar_items[0].CodPar
        logger.info("Partida exacta detectada: %s con score %f", partida_exacta_codigo, best_score)
    elif modo_fallback:
        logger.info("Activado modo_fallback: no se encontraron partidas similares")

    # 4. Recuperar insumos y calcular estadísticas
    item_codes = [item.CodPar for item in similar_items]
    unidad_por_partida = {
        item.CodPar: item.UniPar for item in similar_items
    }

    materiales, mano_obra, equipos = _fetch_insumos(
        db, item_codes, unidad_por_partida
    )

    estadisticas = _calculate_statistics(
        materiales, mano_obra, equipos, similar_items
    )

    # 5. Detectar advertencias
    advertencias = _detect_warnings(estadisticas)

    # 6. Construir catálogo
    catalogo = _build_catalog(db, estadisticas, modo_fallback, keywords)

    # 7. Formatear rendimientos
    rendimientos_formateados = _format_rendimientos(estadisticas)

    # 8. Armar payload
    payload = {
        "modo": modo,
        "partida_exacta_codigo": partida_exacta_codigo,
        "solicitud_usuario": description,
        "covenin_prefix": covenin_prefix,
        "covenin_context": covenin_context,
        "partidas_encontradas": len(similar_items),
        "detalle_partidas": [
            {
                "codigo": p.CodPar,
                "descripcion": p.Descri,
                "unidad": p.UniPar,
            }
            for p in similar_items
        ],
        "rendimientos_historicos_por_unidad_partida": rendimientos_formateados,
        "catalogo_insumos_disponibles": catalogo,
        "advertencias_preprocesamiento": advertencias,
    }

    logger.info("Payload generado: modo=%s, partidas=%d, advertencias=%d",
                payload["modo"], payload["partidas_encontradas"], len(advertencias))

    return payload
