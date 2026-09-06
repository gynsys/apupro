"""
Módulo de Generación de Consultas Sintéticas y Perturbación para Minería Inversa.

Convierte descripciones técnicas y normativas COVENIN en consultas realistas de obra
(simulando la forma en que contratistas, ingenieros y maestros de obra redactan solicitudes)
para evaluar y estresar el motor de búsqueda híbrido.
"""

import random
import re
from typing import Any, Dict, List, Optional
from app.core.logging import logger
from app.services.dimension_service import extract_unified_dimensions

# Mapeos inversos: de términos formales/normativos a jergas o siglas comerciales
REVERSE_TERM_MAP: List[tuple[str, str]] = [
    (r"\bPOLIPROPILENO\b", "ppr"),
    (r"\bPOLIETILENO\s+DE\s+ALTA\s+DENSIDAD\b", "pead"),
    (r"\bPOLICLORURO\s+DE\s+VINILO\s+CLORADO\b", "cpvc"),
    (r"\bPOLICLORURO\s+DE\s+VINILO\b", "pvc"),
    (r"\bHIERRO\s+GALVANIZADO\b", "hg"),
    (r"\bHIERRO\s+FUNDIDO\b", "hf"),
    (r"\bAGUAS\s+CLARAS\b", "aguas blancas"),
    (r"\bAGUAS\s+SERVIDAS\b", "aguas negras"),
    (r"\bCONCRETO\s+F'?C\s*=?\s*(\d+)\s*KG/?CM2\b", r"concreto \1"),
    (r"\bCONCRETO\s+PREMEZCLADO\b", "concreto mixer"),
    (r"\bCONCRETO\s+POBRE\b", "concreto 100"),
    (r"\bACERO\s+DE\s+REFUERZO\s+CABILLAS\s+DIAMETRO\s+3/8\"?\s*\(9\.5\s*MM\)\b", "cabilla #3"),
    (r"\bACERO\s+DE\s+REFUERZO\s+CABILLAS\s+DIAMETRO\s+1/2\"?\s*\(12\.7\s*MM\)\b", "cabilla #4"),
    (r"\bACERO\s+DE\s+REFUERZO\s+CABILLAS\s+DIAMETRO\s+5/8\"?\s*\(15\.9\s*MM\)\b", "cabilla #5"),
    (r"\bACERO\s+DE\s+REFUERZO\s+CABILLAS\s+DIAMETRO\s+3/4\"?\s*\(19\.1\s*MM\)\b", "cabilla #6"),
    (r"\bMALLA\s+ELECTROSOLDADA\s+TRUCKSON\b", "malla truckson"),
    (r"\bTABIQUERIA\s+LAMINA\s+DE\s+YESO\s+DRYWALL\b", "drywall"),
    (r"\bLAMINA\s+DE\s+FIBROCEMENTO\b", "plycem"),
    (r"\bCAMION\s+HORMIGONERA\s+MIXER\b", "mixer"),
    (r"\bTRACTOR\s+DE\s+ORUGAS\s+BULLDOZER\b", "d6"),
    (r"\bMINICARGADOR\s+FRONTAL\s+BOBCAT\b", "bobcat"),
    (r"\bCARGADOR\s+FRONTAL\s+SOBRE\s+RUEDAS\s+PAYLOADER\b", "payloader"),
    (r"\bCAMION\s+VOLTEO\b", "volqueta"),
]

# Prefijos formales a remover o transformar
FORMAL_PREFIX_PATTERN: re.Pattern = re.compile(
    r"^(?:I\.E\.\s+|I\.S\.\s+|"
    r"SUMINISTRO[,\s]+(?:TRANSPORTE\s+)?E\s+INSTALACION\s+DE\s+|"
    r"SUMINISTRO\s+Y\s+COLOCACION\s+DE\s+|"
    r"SUMINISTRO\s+E\s+INSTALACION\s+DE\s+|"
    r"SUMINISTRO[,\s]+TRANSPORTE\s+Y\s+COLOCACION\s+DE\s+|"
    r"CONSTRUCCION\s+DE\s+|"
    r"SUMINISTRO\s+DE\s+|"
    r"INSTALACION\s+DE\s+|"
    r"ELABORACION\s+DE\s+|"
    r"COLOCACION\s+DE\s+)",
    re.IGNORECASE,
)

# Cláusulas contractuales o de alcance secundario a recortar
SECONDARY_CLAUSES_PATTERN: re.Pattern = re.compile(
    r"(?:,\s*SOLDADA\s+MEDIANTE\s+PROCESO\s+DE\s+TERMOFUSION.*|"
    r",\s*INCLUYE\s+TRANSPORTE.*|"
    r",\s*NO\s+INCLUYE\s+TRANSPORTE.*|"
    r",\s*SEGUN\s+NORMAS\s+COVENIN.*|"
    r",\s*MEDIDO\s+EN\s+ASIENTO\s+DE\s+VACIADO.*|"
    r",\s*A\s+LOS\s+28\s+DIAS.*|"
    r",\s*ACABADO\s+CORRIENTE.*|"
    r",\s*PARA\s+EDIFICACIONES.*|"
    r",\s*INCLUYE\s+CONEXIONES.*|"
    r",\s*JUNTA\s+SOLDADA.*)$",
    re.IGNORECASE,
)


class PerturbationResult:
    """Resultado del proceso de perturbación sintética de una partida."""

    def __init__(
        self,
        original_codpar: str,
        original_desc: str,
        perturbed_query: str,
        original_unit: str,
        expected_materials: List[str],
        expected_dims: List[str],
        transformations: List[str],
    ) -> None:
        self.original_codpar: str = original_codpar
        self.original_desc: str = original_desc
        self.perturbed_query: str = perturbed_query
        self.original_unit: str = original_unit
        self.expected_materials: List[str] = expected_materials
        self.expected_dims: List[str] = expected_dims
        self.transformations: List[str] = transformations

    def to_dict(self) -> Dict[str, Any]:
        return {
            "original_codpar": self.original_codpar,
            "original_desc": self.original_desc,
            "perturbed_query": self.perturbed_query,
            "original_unit": self.original_unit,
            "expected_materials": self.expected_materials,
            "expected_dims": self.expected_dims,
            "transformations": self.transformations,
        }


def perturb_description(
    desc: str,
    codpar: str = "",
    unit: str = "",
    random_seed: Optional[int] = None,
) -> PerturbationResult:
    """
    Toma una descripción técnica formal de la base de datos y la perturba
    simulando la consulta concisa y coloquial que haría un usuario real.
    """
    if not desc or not isinstance(desc, str):
        raise ValueError("desc debe ser un string no vacío")

    if random_seed is not None:
        random.seed(random_seed)

    transformations: List[str] = []
    text_clean: str = desc.strip()

    # 1. Extraer dimensiones y materiales originales como Ground Truth antes de perturbar
    orig_dims = extract_unified_dimensions(text_clean)
    dim_strings: List[str] = [d.raw_text for d in orig_dims]

    materials_detected: List[str] = []
    for mat_token in ["POLIPROPILENO", "PPR", "PEAD", "PVC", "CPVC", "CONCRETO", "ACERO", "DRYWALL", "COBRE", "HG", "HF"]:
        if re.search(r"\b" + re.escape(mat_token) + r"\b", text_clean, re.IGNORECASE):
            materials_detected.append(mat_token)

    # 2. Recortar cláusulas accesorias secundarias
    if SECONDARY_CLAUSES_PATTERN.search(text_clean):
        text_clean = SECONDARY_CLAUSES_PATTERN.sub("", text_clean).strip()
        transformations.append("removed_secondary_clauses")

    # 3. Remover o simplificar prefijos formales
    if FORMAL_PREFIX_PATTERN.search(text_clean):
        text_clean = FORMAL_PREFIX_PATTERN.sub("", text_clean).strip()
        transformations.append("stripped_formal_prefix")
        # Con 50% de probabilidad, anteponer un prefijo coloquial
        prefixes = ["instalacion de ", "suministro de ", "colocar ", "poner ", ""]
        chosen_prefix = random.choice(prefixes)
        if chosen_prefix:
            text_clean = chosen_prefix + text_clean
            transformations.append(f"added_colloquial_prefix('{chosen_prefix.strip()}')")

    # 4. Mapeo inverso de términos normativos a comerciales/siglas
    for pattern_str, rep in REVERSE_TERM_MAP:
        pat = re.compile(pattern_str, re.IGNORECASE)
        if pat.search(text_clean):
            text_clean = pat.sub(rep, text_clean)
            transformations.append(f"reverse_synonym('{rep}')")

    # 5. Comprimir espaciado dimensional con 60% de probabilidad (ej. '20 mm' -> '20mm', '1/2 "' -> '1/2"')
    if random.random() < 0.70:
        compressed = re.sub(r"(\d+)\s*(mm|cm|m)\b", r"\1\2", text_clean, flags=re.IGNORECASE)
        compressed = re.sub(r'(\d+/\d+|\d+)\s*["”]', r'\1"', compressed)
        compressed = re.sub(r"(\d+)\s*(kg/?cm2)\b", r"\1\2", compressed, flags=re.IGNORECASE)
        if compressed != text_clean:
            text_clean = compressed
            transformations.append("compressed_dimension_spacing")

    # 6. Limpieza final de espacios dobles y signos residuales
    text_clean = re.sub(r"\s+", " ", text_clean).strip(" ,.-")
    text_clean = text_clean.lower()

    return PerturbationResult(
        original_codpar=codpar,
        original_desc=desc,
        perturbed_query=text_clean,
        original_unit=unit,
        expected_materials=materials_detected,
        expected_dims=dim_strings,
        transformations=transformations,
    )
