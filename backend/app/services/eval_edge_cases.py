"""
Módulo de Suite Curada de Casos Límite (Edge Cases) para la Evaluación del Motor APU.

Define casos de prueba de alta criticidad en 4 cuadrantes:
1. Acción vs Material (Demolición vs Construcción vs Desmontaje vs Bote)
2. Ambigüedad de Unidades (Metros lineales vs Puntos vs Kilos vs Metros cuadrados)
3. Dimensiones Múltiples Compuestas (Perfiles 100x100x3 mm, Bloques 15x20x40 cm, Cajas 4x4 vs 4x2)
4. Exclusiones y Condiciones Negativas ("a mano sin equipo", "con payloader sin carga manual", "sin mixer")
"""

import re
from typing import Any, Dict, List, Optional, Tuple
from app.core.logging import logger


class EdgeCase:
    """Representa una prueba límite diseñada para verificar precisión conceptual en ingeniería."""

    def __init__(
        self,
        case_id: str,
        category: str,
        query: str,
        description: str,
        expected_positive_terms: Optional[List[str]] = None,
        forbidden_negative_terms: Optional[List[str]] = None,
        expected_units: Optional[List[str]] = None,
        forbidden_units: Optional[List[str]] = None,
    ) -> None:
        if not case_id or not category or not query:
            raise ValueError("case_id, category y query son obligatorios")

        self.case_id: str = case_id
        self.category: str = category
        self.query: str = query
        self.description: str = description
        self.expected_positive_terms: List[str] = [
            t if any(ch in t for ch in ["\\", "|", "?", "*", "+", "(", ")"]) else t.upper()
            for t in (expected_positive_terms or [])
        ]
        self.forbidden_negative_terms: List[str] = [
            t if any(ch in t for ch in ["\\", "|", "?", "*", "+", "(", ")"]) else t.upper()
            for t in (forbidden_negative_terms or [])
        ]
        self.expected_units: List[str] = [u.upper() for u in (expected_units or [])]
        self.forbidden_units: List[str] = [u.upper() for u in (forbidden_units or [])]

    def evaluate(
        self,
        item_id: str,
        item_desc: str,
        item_unit: str,
    ) -> Tuple[bool, List[str]]:
        """
        Evalúa si la partida devuelta cumple estrictamente con el caso límite.
        Retorna (passed, failure_reasons).
        """
        desc_text = item_desc or ""
        unit_upper = (item_unit or "").upper().strip()
        failures: List[str] = []

        # 1. Verificar términos positivos obligatorios (soporta palabras simples o regex)
        for pos_term in self.expected_positive_terms:
            if any(ch in pos_term for ch in ["\\", "|", "?", "*", "+", "(", ")"]):
                pat = re.compile(pos_term, re.IGNORECASE)
            else:
                pat = re.compile(r"\b" + re.escape(pos_term) + r"\b", re.IGNORECASE)
            if not pat.search(desc_text):
                failures.append(f"Falta término obligatorio '{pos_term}'")

        # 2. Verificar términos negativos prohibidos
        for neg_term in self.forbidden_negative_terms:
            if any(ch in neg_term for ch in ["\\", "|", "?", "*", "+", "(", ")"]):
                pat = re.compile(neg_term, re.IGNORECASE)
            else:
                pat = re.compile(r"\b" + re.escape(neg_term) + r"\b", re.IGNORECASE)
            if pat.search(desc_text):
                failures.append(f"Contiene término prohibido '{neg_term}'")

        # 3. Verificar unidades esperadas
        if self.expected_units and unit_upper not in self.expected_units:
            failures.append(f"Unidad devuelta '{unit_upper}' no está en las esperadas {self.expected_units}")

        # 4. Verificar unidades prohibidas
        if self.forbidden_units and unit_upper in self.forbidden_units:
            failures.append(f"Unidad devuelta '{unit_upper}' es inválida para este alcance")

        passed = len(failures) == 0
        return passed, failures


# Batería representativa curada de Casos Límite
EDGE_CASES_SUITE: List[EdgeCase] = [
    # -------------------------------------------------------------
    # CUADRANTE 1: ACCIÓN VS MATERIAL
    # -------------------------------------------------------------
    EdgeCase(
        case_id="ACT_01_DEMO_WALL",
        category="Accion_vs_Material",
        query="demolicion de pared de bloques de arcilla",
        description="Debe retornar una demolición, jamás construcción de pared",
        expected_positive_terms=["DEMOLICION"],
        forbidden_negative_terms=["CONSTRUCCION"],
    ),
    EdgeCase(
        case_id="ACT_02_CONST_WALL",
        category="Accion_vs_Material",
        query="construccion de pared de bloques de arcilla espesor 15cm",
        description="Debe retornar construcción de pared, jamás demolición",
        expected_positive_terms=["CONSTRUCCION", "PARED"],
        forbidden_negative_terms=["DEMOLICION"],
    ),
    EdgeCase(
        case_id="ACT_03_DESMONT_WINDOW",
        category="Accion_vs_Material",
        query="desmontaje de ventanas de aluminio y vidrio",
        description="Debe ser desmontaje/retiro, no suministro ni instalación nueva",
        expected_positive_terms=["DESMONTAJE"],
        forbidden_negative_terms=["SUMINISTRO E INSTALACION"],
    ),
    EdgeCase(
        case_id="ACT_04_BOTE_ESCOMBROS",
        category="Accion_vs_Material",
        query="bote de escombros provenientes de demolicion con camion volteo",
        description="Debe ser transporte/bote de escombros, no excavación ni demolición",
        expected_positive_terms=["TRANSPORTE", "BOTE"],
        forbidden_negative_terms=["CONSTRUCCION"],
    ),

    # -------------------------------------------------------------
    # CUADRANTE 2: AMBIGÜEDAD DE UNIDAD DE MEDIDA
    # -------------------------------------------------------------
    EdgeCase(
        case_id="UNI_01_PIPE_METER",
        category="Ambiguedad_Unidad",
        query="tuberia pvc 1/2 pulgada aguas blancas por metro lineal",
        description="Tubería por longitud continua: la unidad debe ser metro (M o ML), no Punto (PTO)",
        expected_positive_terms=["TUBERIA"],
        expected_units=["M", "ML", "MTS"],
        forbidden_units=["PTO", "PUNTO"],
    ),
    EdgeCase(
        case_id="UNI_02_POINT_PLUMB",
        category="Ambiguedad_Unidad",
        query="punto de aguas blancas pvc 1/2 para lavamanos",
        description="Punto sanitario completo: la unidad debe ser Punto (PTO), no metro lineal",
        expected_positive_terms=["PUNTOS?"],
        expected_units=["PTO", "PUNTO", "PZA", "UND"],
        forbidden_units=["M", "ML"],
    ),
    EdgeCase(
        case_id="UNI_03_REBAR_KG",
        category="Ambiguedad_Unidad",
        query="suministro y colocacion de acero de refuerzo cabilla #4",
        description="Cabillas de refuerzo para concreto: la unidad debe ser KG o KGF, no M2",
        expected_positive_terms=["ACERO", "CABILLA"],
        expected_units=["KG", "KGF", "TON", "TONF"],
        forbidden_units=["M2", "M3"],
    ),
    EdgeCase(
        case_id="UNI_04_MESH_M2",
        category="Ambiguedad_Unidad",
        query="suministro e instalacion de malla electrosoldada truckson",
        description="Malla electrosoldada: se cotiza por superficie (M2), no por kilogramo",
        expected_positive_terms=["MALLA"],
        expected_units=["M2"],
        forbidden_units=["KG", "KGF"],
    ),

    # -------------------------------------------------------------
    # CUADRANTE 3: DIMENSIONES MÚLTIPLES COMPUESTAS
    # -------------------------------------------------------------
    EdgeCase(
        case_id="DIM_01_TUBE_100X100X3",
        category="Dimensiones_Multiples",
        query="perfil tubular estructural conduven 100x100x3 mm",
        description="Perfil cuadrado de 100x100 con 3mm de espesor",
        expected_positive_terms=["100"],
    ),
    EdgeCase(
        case_id="DIM_02_BLOCK_15CM",
        category="Dimensiones_Multiples",
        query="pared de bloques de concreto espesor 15 cm",
        description="Pared de bloques con espesor exacto de 15 cm (no 10 cm ni 20 cm)",
        expected_positive_terms=["15"],
        forbidden_negative_terms=["20 CM", "10 CM"],
    ),
    EdgeCase(
        case_id="DIM_03_BOX_4X4",
        category="Dimensiones_Multiples",
        query="caja de paso metalica para electricidad 4x4 pulgadas",
        description="Caja cuadrada 4x4 (no rectangular 4x2)",
        expected_positive_terms=[r'\b4["\']?\s*X\s*4["\']?\b|\b4X4\b'],
        forbidden_negative_terms=["4X2"],
    ),

    # -------------------------------------------------------------
    # CUADRANTE 4: EXCLUSIONES Y CONDICIONES ESPECIALES
    # -------------------------------------------------------------
    EdgeCase(
        case_id="EXC_01_EXCAV_MANUAL",
        category="Exclusiones_Condiciones",
        query="excavacion a mano para zanjas sin equipo ni maquinaria",
        description="Excavación manual que excluye el uso de retroexcavadora o maquinaria",
        expected_positive_terms=["MANO"],
        forbidden_negative_terms=["RETROEXCAVADORA", "TRACTOR", "MAQUINARIA"],
    ),
    EdgeCase(
        case_id="EXC_02_CONCRETE_TROMPO",
        category="Exclusiones_Condiciones",
        query="concreto hecho en obra mezclado con trompo sin mixer",
        description="Concreto mezclado en sitio con mezcladora/trompo, excluye mixer premezclado",
        expected_positive_terms=["PREPARADO EN (EL )?SITIO|SITIO"],
        forbidden_negative_terms=["PREMEZCLADO", "MIXER"],
    ),
]


def get_all_edge_cases() -> List[EdgeCase]:
    """Retorna la lista completa de casos límite registrados."""
    return list(EDGE_CASES_SUITE)


def get_edge_cases_by_category(category: str) -> List[EdgeCase]:
    """Filtra casos límite por categoría específica."""
    if not category or not isinstance(category, str):
        return []
    cat_lower = category.lower()
    return [ec for ec in EDGE_CASES_SUITE if ec.category.lower() == cat_lower]
