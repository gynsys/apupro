"""Arnes de evaluacion en SOMBRA del canal lexico y dimensional del RAG hibrido (SOLO LECTURA).

Compara tres configuraciones del buscador sin modificar ``ai_search.py`` ni la BD:

* ``BASE``: ``ai_engine.hybrid_search`` tal como corre en produccion.
* ``LEX2``: reemplaza UNICAMENTE el canal lexico por uno ponderado por IDF
  (sin corte duro de 1000 resultados), que descarta muletillas contractuales y
  de interfaz ("suministro", "instalacion", "incluye", "unidad ml") pero conserva
  todos los sustantivos tecnicos ("tuberia", "concreto", "acero", "polipropileno").
* ``LEX2_DIM``: ``LEX2`` + equivalencia de diametros nominales imperial <-> metrico
  (PPR/PEAD ISO 4065: 1/2" <-> 20 mm, 3/4" <-> 25 mm, 1" <-> 32 mm, etc.),
  fracciones de pulgada sin comillas en contexto de tuberia ("ppr 1/2") y
  extraccion de espesores en cm/m ("e=20 cm", "0.10 m de espesor").

Uso (dentro del contenedor, con PYTHONPATH=/app):
    python rag_shadow_eval.py --real-queries real_queries.json --out report.json
"""
import argparse
import contextlib
import json
import math
import random
import re
import sys
import unicodedata
from collections import defaultdict
from typing import Any, Dict, Iterator, List, Optional, Sequence, Set, Tuple

import numpy as np
from sqlalchemy import text

import app.services.ai_search as ai_search_mod
from app.core.logging import logger
from app.db.session import get_db_session
from app.services.ai_search import ai_engine
from app.services.dimension_service import DimensionToken, extract_unified_dimensions
from app.services.synonyms_service import expand_technical_synonyms

SEED: int = 42
HYBRID_LIMIT: int = 45  # limit * 3 con limit=15, igual que get_dynamic_candidates
TOP_K_VALUES: Tuple[int, int, int] = (1, 5, 15)
MAX_DF_RATIO: float = 0.18
IDF_EXPONENT: float = 1.6
MIN_STRATUM_SIZE: int = 50
MAX_STRATA: int = 20
MIN_CORE_WORDS: int = 4
SHORT_QUERY_WORDS: int = 8

BOILERPLATE_PREFIX_RE = re.compile(
    r"^(S/T/I|S/I|S/T/C|S/T)\s+(DE\s+)?|"
    r"^SUMINISTRO[,]?\s+(TRANSPORTE\s+)?(E|Y)\s+(INSTALACION|COLOCACION)\s+(DE\s+)?|"
    r"^(INSTALACION|COLOCACION|CONSTRUCCION)\s+(DE\s+)?",
    re.IGNORECASE,
)
UI_UNIT_CLAUSE_RE = re.compile(
    r"\bunidad\s+(?:ml|m2|m3|m|und|pza|pto|kgf|kg|ton|gl|sg|l|lt|lts|gal|km|ha|mes|dia|hr|h)\b",
    re.IGNORECASE,
)
TOKEN_RE = re.compile(r"[A-Z0-9]+")
NUMERIC_OR_SYMBOL_RE = re.compile(r"[\d.,/\"'()=%\-+]+")

# Muletillas contractuales / gramaticales que no identifican el objeto fisico ni la disciplina
CONTRACTUAL_STOP_STEMS: Set[str] = {
    "CON", "PARA", "POR", "SIN", "DEL", "LOS", "LAS", "UNA", "UNO", "ENTRE", "HASTA",
    "DESDE", "SEGUN", "COMO", "MAS", "MENO", "MAYOR", "MENOR", "IGUAL", "SIMILAR",
    "TIPO", "USO", "EMPLEO", "MEDIANTE", "UTILIZANDO", "EMPLEANDO", "CORRESPONDIENTE",
    "SUMINISTRO", "TRANSPORTE", "INSTALACION", "COLOCACION", "CONSTRUCCION", "APLICACION",
    "ELABORACION", "EJECUCION", "INCLUYE", "EXCLUYE", "INCLUIDO", "UNIDAD", "UND",
    "MATERIAL", "INSUMO", "EQUIPO", "HERRAMIENTA", "OBRA", "SITIO",
}

# Equivalencia nominal pulgadas <-> diametro externo metrico ISO 4065 (PPR / PEAD / termofusion)
INCH_TO_METRIC_PLASTIC_OD_MM: List[Tuple[float, float]] = [
    (0.50, 20.0),   # 1/2"  <-> 20 mm
    (0.75, 25.0),   # 3/4"  <-> 25 mm
    (1.00, 32.0),   # 1"    <-> 32 mm
    (1.25, 40.0),   # 1 1/4"<-> 40 mm
    (1.50, 50.0),   # 1 1/2"<-> 50 mm
    (2.00, 63.0),   # 2"    <-> 63 mm
    (2.50, 75.0),   # 2 1/2"<-> 75 mm
    (3.00, 90.0),   # 3"    <-> 90 mm
    (4.00, 110.0),  # 4"    <-> 110 mm
    (6.00, 160.0),  # 6"    <-> 160 mm
]


def strip_accents_upper(value: str) -> str:
    """Normaliza a mayusculas sin acentos."""
    if not isinstance(value, str):
        raise ValueError("value debe ser str")
    decomposed = unicodedata.normalize("NFKD", value.upper())
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def light_stem(token: str) -> str:
    """Stemming minimo de plurales para unir TUBERIA/TUBERIAS, CONEXION/CONEXIONES."""
    if len(token) > 4 and token.endswith("ES") and not token.endswith("NES"):
        return token[:-1]
    if len(token) > 4 and token.endswith("NES"):
        return token[:-2]
    if len(token) > 3 and token.endswith("S"):
        return token[:-1]
    return token


def normalize_tokens(value: str) -> List[str]:
    """Tokens alfanumericos de >= 3 caracteres, sin acentos y con stemming ligero."""
    if not isinstance(value, str):
        raise ValueError("value debe ser str")
    cleaned = UI_UNIT_CLAUSE_RE.sub(" ", value)
    return [
        light_stem(tok)
        for tok in TOKEN_RE.findall(strip_accents_upper(cleaned))
        if len(tok) >= 3 and not tok.isdigit()
    ]


def family_key(description: str) -> str:
    """Clave de familia: la descripcion sin numeros ni simbolos (ej. EST253 == EST254)."""
    cleaned = NUMERIC_OR_SYMBOL_RE.sub(" ", strip_accents_upper(description))
    words = [w for w in TOKEN_RE.findall(cleaned) if len(w) > 1]
    return " ".join(words)


class InformativeLexicalIndex:
    """Indice invertido en memoria con ponderacion IDF^p y descarte de muletillas."""

    def __init__(self, docs: Dict[str, str], max_df_ratio: float = MAX_DF_RATIO) -> None:
        if not docs:
            raise ValueError("docs no puede estar vacio")
        if not 0.0 < max_df_ratio <= 1.0:
            raise ValueError("max_df_ratio debe estar en (0, 1]")
        self.n_docs: int = len(docs)
        postings: Dict[str, List[str]] = defaultdict(list)
        for item_id, description in docs.items():
            for token in set(normalize_tokens(description or "")):
                postings[token].append(item_id)
        self.postings: Dict[str, List[str]] = dict(postings)
        self.idf: Dict[str, float] = {
            tok: math.log((self.n_docs + 1) / (len(ids) + 1)) ** IDF_EXPONENT
            for tok, ids in self.postings.items()
        }
        df_stops = {
            tok for tok, ids in self.postings.items() if len(ids) / self.n_docs > max_df_ratio
        }
        self.stop_terms: Set[str] = df_stops | CONTRACTUAL_STOP_STEMS

    def informative_query_terms(self, query: str) -> List[str]:
        """Terminos de la consulta (tras expandir sinonimos) que aportan senal."""
        expanded = expand_technical_synonyms(UI_UNIT_CLAUSE_RE.sub(" ", query))
        seen: Dict[str, None] = {}
        for tok in normalize_tokens(expanded):
            if tok in self.postings and tok not in self.stop_terms:
                seen[tok] = None
        return list(seen.keys())

    def score_query(self, query: str) -> Dict[str, float]:
        """Cobertura ponderada por IDF^p de la consulta sobre cada documento (0..1)."""
        terms = self.informative_query_terms(query)
        if not terms:
            return {}
        total = sum(self.idf[t] for t in terms)
        if total <= 0.0:
            return {}
        scores: Dict[str, float] = defaultdict(float)
        for tok in terms:
            weight = self.idf[tok]
            for item_id in self.postings[tok]:
                scores[item_id] += weight
        return {item_id: value / total for item_id, value in scores.items()}


class PlasticAwareDiameterToken(DimensionToken):
    """Token de diametro que conoce tanto la conversion geometrica (x25.4) como la nominal PPR/PEAD."""

    def __init__(self, canonical_value: float, raw_text: str, alt_plastic_mm: Optional[float] = None) -> None:
        super().__init__("diameter_mm", canonical_value, raw_text)
        self.alt_plastic_mm: Optional[float] = alt_plastic_mm

    def matches(self, other: DimensionToken) -> bool:
        if not isinstance(other, DimensionToken) or other.dim_type != "diameter_mm":
            return False
        candidates_self = [self.canonical_value]
        if self.alt_plastic_mm is not None:
            candidates_self.append(self.alt_plastic_mm)
        candidates_other = [other.canonical_value]
        other_alt = getattr(other, "alt_plastic_mm", None)
        if other_alt is not None:
            candidates_other.append(float(other_alt))
        for a in candidates_self:
            for b in candidates_other:
                if abs(a - b) <= max(1.2, 0.04 * max(a, b)):
                    return True
        return False


def _plastic_od_for_inches(inches: float) -> Optional[float]:
    for ref_in, od_mm in INCH_TO_METRIC_PLASTIC_OD_MM:
        if abs(inches - ref_in) <= 0.03:
            return od_mm
    return None


def enhanced_extract_dimensions(text_input: str) -> List[DimensionToken]:
    """Extiende extract_unified_dimensions con espesores cm/m, fracciones sin comillas y equivalencia PPR."""
    if not text_input or not isinstance(text_input, str):
        return []
    # Ignorar parentesis de diametro interno "(DIAMETRO INTERNO 33.4 MM)" para no duplicar diametros
    cleaned = re.sub(r"\(\s*DIAMETRO\s+INTERNO[^)]*\)", " ", text_input, flags=re.IGNORECASE)
    base_tokens = extract_unified_dimensions(cleaned)
    upper = cleaned.upper()
    is_plastic_metric = any(k in upper for k in ("POLIPROPILENO", "PPR", "TERMOFUSION", "POLIFUSION", "PEAD", "HDPE"))

    upgraded: List[DimensionToken] = []
    has_diameter = False
    for tok in base_tokens:
        if tok.dim_type == "diameter_mm":
            has_diameter = True
            inches = tok.canonical_value / 25.4
            alt_mm = _plastic_od_for_inches(inches)
            upgraded.append(PlasticAwareDiameterToken(tok.canonical_value, tok.raw_text, alt_mm))
        else:
            upgraded.append(tok)

    # Fracciones de pulgada sin comillas cuando hay contexto de tuberia (ej. "ppr 1/2", "tuberia 3/4")
    if not has_diameter and any(k in upper for k in ("TUBERIA", "TUBO", "PPR", "POLIPROPILENO", "PVC", "HG", "PEAD")):
        m_frac = re.search(r"(?<![\d.,/])(\d+\s*[-/]\s*\d+|\d+\s+\d+/\d+)(?![\d.,/])", cleaned)
        if m_frac:
            raw_f = m_frac.group(1).replace("-", " ")
            parts = raw_f.split()
            inches_val: Optional[float] = None
            if len(parts) == 2 and "/" in parts[1]:
                n_str, d_str = parts[1].split("/", 1)
                if float(d_str) != 0:
                    inches_val = float(parts[0]) + float(n_str) / float(d_str)
            elif len(parts) == 1 and "/" in parts[0]:
                n_str, d_str = parts[0].split("/", 1)
                if float(d_str) != 0:
                    inches_val = float(n_str) / float(d_str)
            if inches_val is not None and 0.20 <= inches_val <= 12.0:
                mm_geom = round(inches_val * 25.4, 2)
                alt_mm = _plastic_od_for_inches(inches_val)
                primary = alt_mm if (is_plastic_metric and alt_mm is not None) else mm_geom
                upgraded.append(PlasticAwareDiameterToken(primary, m_frac.group(0), alt_mm or mm_geom))

    # Espesores en cm o m: "e=20 cm", "espesor 10 cm", "espesor 25 cms", "0.10 m de espesor"
    for m_th in re.finditer(
        r"(?:\be\s*=\s*|\bespesor\s*(?:de\s*)?=?\s*)(\d+(?:[.,]\d+)?)\s*(cm|cms|m|mm)\b"
        r"|(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(cm|cms|m)\s+de\s+espesor\b",
        cleaned,
        re.IGNORECASE,
    ):
        num_s = m_th.group(1) or m_th.group(3)
        unit_s = (m_th.group(2) or m_th.group(4) or "cm").lower()
        val = float(num_s.replace(",", "."))
        cm_val = val * 100.0 if unit_s == "m" else (val / 10.0 if unit_s == "mm" else val)
        upgraded.append(DimensionToken("thickness_cm", round(cm_val, 2), m_th.group(0)))

    return upgraded


@contextlib.contextmanager
def cached_query_encoder() -> Iterator[Dict[str, np.ndarray]]:
    """Cachea los embeddings de consulta para no pagar la API varias veces por consulta."""
    original = ai_engine.encode_query
    cache: Dict[str, np.ndarray] = {}

    def _cached(query: str) -> np.ndarray:
        if query not in cache:
            cache[query] = original(query)
        return cache[query]

    ai_engine.encode_query = _cached  # type: ignore[method-assign]
    try:
        yield cache
    finally:
        ai_engine.__dict__.pop("encode_query", None)


@contextlib.contextmanager
def shadow_variant(
    index: InformativeLexicalIndex,
    desc_map: Dict[str, str],
    use_enhanced_dims: bool = False,
) -> Iterator[None]:
    """Sustituye el canal lexico (y opcionalmente el extractor dimensional) dentro del proceso."""
    orig_dim_fn = ai_search_mod.extract_unified_dimensions

    def _informative(db: Any, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        scores = index.score_query(query)
        ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
        return [{"id": i, "score": s, "desc": desc_map.get(i, "")} for i, s in ranked]

    ai_engine.lexical_search = _informative  # type: ignore[method-assign]
    if use_enhanced_dims:
        ai_search_mod.extract_unified_dimensions = enhanced_extract_dimensions  # type: ignore[assignment]
    try:
        yield
    finally:
        ai_engine.__dict__.pop("lexical_search", None)
        ai_search_mod.extract_unified_dimensions = orig_dim_fn  # type: ignore[assignment]


def run_search(db: Any, query: str) -> List[str]:
    """Ids ordenados devueltos por el pipeline hibrido actual."""
    results = ai_engine.hybrid_search(db, query, limit=HYBRID_LIMIT)
    return [r["id"] for r in results]


def build_wrapped_query(description: str, unit: str) -> str:
    """Consulta con muletillas, como la escribiria un usuario real."""
    core = BOILERPLATE_PREFIX_RE.sub("", description.strip()).strip(" ,.")
    core_words = core.split()
    core = " ".join(core_words[:12])
    return f"Suministro e instalación de {core} Incluye conexiones y accesorios unidad {unit}".strip()


def build_short_query(description: str) -> str:
    """Consulta breve, primeras palabras del nucleo de la descripcion."""
    core = BOILERPLATE_PREFIX_RE.sub("", description.strip()).strip(" ,.")
    return " ".join(core.split()[:SHORT_QUERY_WORDS]).lower()


def sample_synthetic_cases(
    rows: Sequence[Tuple[str, str, Optional[str], Optional[str]]],
    per_stratum: int,
) -> List[Dict[str, Any]]:
    """Muestra estratificada por disciplina con semilla fija (reproducible)."""
    if per_stratum <= 0:
        raise ValueError("per_stratum debe ser positivo")
    by_stratum: Dict[str, List[Tuple[str, str, str]]] = defaultdict(list)
    for code, descri, disciplina, unit in rows:
        if not descri or len(descri.split()) < MIN_CORE_WORDS:
            continue
        by_stratum[disciplina or "<NULL>"].append((code, descri, unit or "und"))
    eligible = [s for s, items in by_stratum.items() if len(items) >= MIN_STRATUM_SIZE]
    eligible.sort(key=lambda s: len(by_stratum[s]), reverse=True)
    rng = random.Random(SEED)
    cases: List[Dict[str, Any]] = []
    for stratum in eligible[:MAX_STRATA]:
        items = sorted(by_stratum[stratum])
        for code, descri, unit in rng.sample(items, min(per_stratum, len(items))):
            cases.append({
                "target": code,
                "stratum": stratum,
                "target_description": descri,
                "variants": {
                    "wrapped": build_wrapped_query(descri, unit),
                    "short": build_short_query(descri),
                },
            })
    return cases


class MetricAccumulator:
    """Acumula recall@k exacto, recall@15 por familia y MRR."""

    def __init__(self) -> None:
        self.count: int = 0
        self.hits: Dict[int, int] = {k: 0 for k in TOP_K_VALUES}
        self.family_hits_15: int = 0
        self.reciprocal_rank_sum: float = 0.0

    def add(self, ranked_ids: Sequence[str], target: str, target_family: str, desc_map: Dict[str, str]) -> None:
        self.count += 1
        if target in ranked_ids:
            position = ranked_ids.index(target) + 1
            self.reciprocal_rank_sum += 1.0 / position
            for k in TOP_K_VALUES:
                if position <= k:
                    self.hits[k] += 1
        top15 = ranked_ids[: TOP_K_VALUES[-1]]
        if any(family_key(desc_map.get(i, "")) == target_family for i in top15):
            self.family_hits_15 += 1

    def summary(self) -> Dict[str, float]:
        if self.count == 0:
            return {"n": 0}
        out: Dict[str, float] = {"n": float(self.count)}
        for k in TOP_K_VALUES:
            out[f"recall@{k}"] = round(self.hits[k] / self.count, 4)
        out["familia@15"] = round(self.family_hits_15 / self.count, 4)
        out["MRR"] = round(self.reciprocal_rank_sum / self.count, 4)
        return out


def evaluate_synthetic(
    db: Any,
    cases: Sequence[Dict[str, Any]],
    desc_map: Dict[str, str],
    index: InformativeLexicalIndex,
) -> Dict[str, Dict[str, Dict[str, float]]]:
    """Corre BASE, LEX2 y LEX2_DIM sobre los casos sinteticos."""
    systems = ("BASE", "LEX2", "LEX2_DIM")
    acc: Dict[str, Dict[str, MetricAccumulator]] = {
        s: {variant: MetricAccumulator() for variant in ("wrapped", "short")}
        for s in systems
    }
    failures = 0
    for number, case in enumerate(cases, start=1):
        target = case["target"]
        target_family = family_key(case["target_description"])
        for variant, query in case["variants"].items():
            try:
                base_ids = run_search(db, query)
                with shadow_variant(index, desc_map, use_enhanced_dims=False):
                    lex2_ids = run_search(db, query)
                with shadow_variant(index, desc_map, use_enhanced_dims=True):
                    lex2_dim_ids = run_search(db, query)
            except Exception as exc:
                failures += 1
                db.rollback()
                logger.error("Fallo evaluando %s/%s: %s", target, variant, exc, exc_info=True)
                continue
            acc["BASE"][variant].add(base_ids, target, target_family, desc_map)
            acc["LEX2"][variant].add(lex2_ids, target, target_family, desc_map)
            acc["LEX2_DIM"][variant].add(lex2_dim_ids, target, target_family, desc_map)
        if number % 20 == 0:
            sys.stdout.write(f"  ... {number}/{len(cases)} casos sinteticos\n")
            sys.stdout.flush()
    if failures:
        sys.stdout.write(f"AVISO: {failures} consultas fallaron (ver logs)\n")
    return {s: {v: m.summary() for v, m in variants.items()} for s, variants in acc.items()}


def evaluate_real(
    db: Any,
    real_cases: Sequence[Dict[str, Any]],
    desc_map: Dict[str, str],
    index: InformativeLexicalIndex,
) -> List[Dict[str, Any]]:
    """Compara top-5 de BASE vs LEX2 vs LEX2_DIM en consultas reales."""
    report: List[Dict[str, Any]] = []
    for case in real_cases:
        query = case["query"]
        acceptable = set(case.get("acceptable_ids") or [])
        try:
            base_ids = run_search(db, query)[:5]
            with shadow_variant(index, desc_map, use_enhanced_dims=False):
                lex2_ids = run_search(db, query)[:5]
            with shadow_variant(index, desc_map, use_enhanced_dims=True):
                lex2_dim_ids = run_search(db, query)[:5]
        except Exception as exc:
            db.rollback()
            logger.error("Fallo evaluando consulta real '%s': %s", query, exc, exc_info=True)
            continue
        entry: Dict[str, Any] = {
            "query": query,
            "terminos_informativos": index.informative_query_terms(query),
            "dims_detectadas": [repr(d) for d in enhanced_extract_dimensions(query)],
            "BASE_top5": [(i, desc_map.get(i, "")[:70]) for i in base_ids],
            "LEX2_top5": [(i, desc_map.get(i, "")[:70]) for i in lex2_ids],
            "LEX2_DIM_top5": [(i, desc_map.get(i, "")[:70]) for i in lex2_dim_ids],
            "top1_cambia": bool(base_ids and lex2_dim_ids and base_ids[0] != lex2_dim_ids[0]),
        }
        if acceptable:
            entry["etiquetado"] = True
            entry["BASE_acierta@1"] = bool(base_ids and base_ids[0] in acceptable)
            entry["BASE_acierta@5"] = any(i in acceptable for i in base_ids)
            entry["LEX2_acierta@1"] = bool(lex2_ids and lex2_ids[0] in acceptable)
            entry["LEX2_acierta@5"] = any(i in acceptable for i in lex2_ids)
            entry["LEX2_DIM_acierta@1"] = bool(lex2_dim_ids and lex2_dim_ids[0] in acceptable)
            entry["LEX2_DIM_acierta@5"] = any(i in acceptable for i in lex2_dim_ids)
        report.append(entry)
    return report


def print_synthetic(metrics: Dict[str, Dict[str, Dict[str, float]]]) -> None:
    """Imprime la tabla de metricas sinteticas."""
    sys.stdout.write("\n=== SINTETICOS (verdad conocida) ===\n")
    for variant in ("wrapped", "short"):
        sys.stdout.write(f"\n-- variante: {variant} --\n")
        header = f"{'sistema':9} {'n':>4} {'rec@1':>7} {'rec@5':>7} {'rec@15':>7} {'fam@15':>7} {'MRR':>7}\n"
        sys.stdout.write(header)
        for system in ("BASE", "LEX2", "LEX2_DIM"):
            m = metrics[system][variant]
            sys.stdout.write(
                f"{system:9} {int(m.get('n', 0)):>4} {m.get('recall@1', 0):>7.3f} "
                f"{m.get('recall@5', 0):>7.3f} {m.get('recall@15', 0):>7.3f} "
                f"{m.get('familia@15', 0):>7.3f} {m.get('MRR', 0):>7.3f}\n"
            )


def print_real(report: Sequence[Dict[str, Any]]) -> None:
    """Imprime las consultas reales donde cambia el top-1 o hay etiqueta."""
    sys.stdout.write("\n=== REALES (debug files) ===\n")
    labeled = [r for r in report if r.get("etiquetado")]
    for r in labeled:
        sys.stdout.write(
            f"[ETIQUETADO] {r['query'][:90]}\n"
            f"    BASE     @1={r['BASE_acierta@1']} @5={r['BASE_acierta@5']}\n"
            f"    LEX2     @1={r['LEX2_acierta@1']} @5={r['LEX2_acierta@5']}\n"
            f"    LEX2_DIM @1={r['LEX2_DIM_acierta@1']} @5={r['LEX2_DIM_acierta@5']}\n"
            f"    LEX2_DIM top5: {r['LEX2_DIM_top5']}\n"
        )
    changed = [r for r in report if r["top1_cambia"]]
    sys.stdout.write(f"\nConsultas reales: {len(report)} | top-1 cambia en {len(changed)}\n")
    for r in changed:
        sys.stdout.write(
            f"\nQ: {r['query'][:100]}\n"
            f"  terminos: {r['terminos_informativos']} | dims: {r['dims_detectadas']}\n"
            f"  BASE#1    : {r['BASE_top5'][0]}\n"
            f"  LEX2_DIM#1: {r['LEX2_DIM_top5'][0]}\n"
        )


def load_real_cases(path: Optional[str]) -> List[Dict[str, Any]]:
    """Carga consultas reales: lista de {query, acceptable_ids}."""
    if not path:
        return []
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        raise ValueError("real-queries debe ser una lista JSON")
    for item in data:
        if not isinstance(item, dict) or "query" not in item:
            raise ValueError("cada caso real requiere la clave 'query'")
    return data


def main(argv: Optional[Sequence[str]] = None) -> int:
    """Punto de entrada CLI."""
    parser = argparse.ArgumentParser(description="Evaluacion en sombra del canal lexico y dimensional del RAG")
    parser.add_argument("--per-stratum", type=int, default=6)
    parser.add_argument("--real-queries", default=None)
    parser.add_argument("--out", default=None)
    args = parser.parse_args(argv)

    if not getattr(ai_engine, "is_loaded", False):
        ai_engine.load_brain()
    if not getattr(ai_engine, "is_loaded", False):
        logger.error("El cerebro de embeddings no pudo cargarse; evaluacion abortada")
        return 1

    real_cases = load_real_cases(args.real_queries)
    with get_db_session() as db:
        rows = db.execute(
            text('SELECT "CodPar", "Descri", disciplina, "UniPar" FROM cost360_items')
        ).fetchall()
        desc_map: Dict[str, str] = {r[0]: (r[1] or "") for r in rows}
        index = InformativeLexicalIndex(desc_map)
        sys.stdout.write(
            f"Catalogo: {index.n_docs} partidas | terminos: {len(index.postings)} | "
            f"stop_terms totales: {len(index.stop_terms)}\n"
        )

        synthetic_cases = sample_synthetic_cases(
            [(r[0], r[1], r[2], r[3]) for r in rows], args.per_stratum
        )
        sys.stdout.write(f"Casos sinteticos: {len(synthetic_cases)} partidas x 2 variantes\n")

        with cached_query_encoder():
            synthetic_metrics = evaluate_synthetic(db, synthetic_cases, desc_map, index)
            real_report = evaluate_real(db, real_cases, desc_map, index)

    print_synthetic(synthetic_metrics)
    print_real(real_report)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump({"synthetic": synthetic_metrics, "real": real_report}, fh, ensure_ascii=False, indent=1)
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
