"""
Motor Ontológico de Contratos Paramétricos de Obras Civiles (MOPTC) — Capa Pre-RAG.

Propósito:
    Interceptar de forma global, declarativa y determinista cualquier descripción de obra
    que pertenezca a una familia constructiva crítica antes de consultar el RAG híbrido.
    Verifica que la consulta cumpla con los parámetros físicos, dimensionales y de materiales
    indispensables en ingeniería de costos (espesor, tipo de mezcla, diámetro, potencia, etc.),
    evitando que el sistema asuma insumos erróneos (como morteros de cal) o busque partidas disparatadas.

Reglas:
    - Costo computacional cero tokens y < 1ms de ejecución.
    - Cero dependencia de LLMs externos o librerías de terceros (sin Jev).
    - Tipado estricto en todas las firmas y funciones.
"""

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple

from app.core.logging import logger


def _strip_accents(text: str) -> str:
    """Elimina acentos y normaliza a minúsculas para comparaciones robustas."""
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


# Patrones genéricos de demolición y desmontaje (donde no aplica exigir dosificación de mezcla o fabricación nueva)
DEMOLITION_OR_REMOVAL_PATTERNS: List[re.Pattern] = [
    re.compile(r"\b(demolici[oó]n|demoler|picar|picado|tumbar|derribar|desmontaje|desmontar|desinstalaci[oó]n|desinstalar|retiro|retirar|desmantelamiento|desmantelar|desarme|desarmar|extracci[oó]n|extraer)\b", re.IGNORECASE)
]


@dataclass
class ParametricRequirement:
    """Define un parámetro técnico requerido por una familia constructiva."""
    param_id: str
    label: str
    detection_patterns: List[re.Pattern]
    question: str
    default_options: List[str]


@dataclass
class ConstructionFamilyOntology:
    """Define una familia constructiva y su contrato de parámetros técnicos."""
    family_id: str
    name: str
    activation_patterns: List[re.Pattern]
    exclusion_patterns: List[re.Pattern] = field(default_factory=list)
    required_parameters: List[ParametricRequirement] = field(default_factory=list)
    composite_options_generator: Optional[Callable[[List[str]], List[str]]] = None


# ---------------------------------------------------------------------------
# DEFINICIÓN DECLARATIVA DE LA ONTOLOGÍA CONSTRUCTIVA UNIVERSAL
# ---------------------------------------------------------------------------

ONTOLOGY_REGISTRY: List[ConstructionFamilyOntology] = [
    # 1. SUPERFICIES Y ACABADOS DE PISO (Sobrepisos, Nivelaciones, Requemados)
    ConstructionFamilyOntology(
        family_id="SUPERFICIES_PISOS_SOBREPISOS",
        name="Sobrepisos y Morteros de Nivelación",
        activation_patterns=[
            re.compile(r"\b(sobrepiso|sobrepisos|sobre-piso|nivelaci[oó]n\s+de\s+piso|carpeta\s+de\s+nivelaci[oó]n|afinado\s+de\s+piso|mortero\s+de\s+piso|requemado)\b", re.IGNORECASE)
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS,
        required_parameters=[
            ParametricRequirement(
                param_id="espesor",
                label="Espesor del sobrepiso",
                detection_patterns=[
                    re.compile(r"\be\s*=\s*\d+", re.IGNORECASE),
                    re.compile(r"\b\d+([\.,]\d+)?\s*(cm|cms|mm|m)\b", re.IGNORECASE),
                    re.compile(r"\bespesor\s*(?:de)?\s*\d+", re.IGNORECASE),
                ],
                question="¿Qué espesor tendrá el sobrepiso o carpeta de nivelación? (Ej: e=2.5 cm, e=3.0 cm, e=4.0 cm, e=5.0 cm)",
                default_options=["e=2.5 cm", "e=3.0 cm", "e=4.0 cm", "e=5.0 cm"]
            ),
            ParametricRequirement(
                param_id="tipo_mezcla",
                label="Tipo de mortero o dosificación",
                detection_patterns=[
                    re.compile(r"\b1\s*:\s*\d+\b", re.IGNORECASE),
                    re.compile(r"\b(cemento[- ]arena|mortero\s+\d:\d|mortero\s+de\s+cemento|concreto|cal|dosificaci[oó]n|mezcla\s+\d:\d)\b", re.IGNORECASE),
                ],
                question="¿Qué dosificación o tipo de mortero se empleará? (Ej: Mortero Cemento-Arena 1:3, Mortero 1:4, Concreto premezclado)",
                default_options=["Mortero Cemento-Arena 1:3", "Mortero Cemento-Arena 1:4", "Concreto f'c=150 kgf/cm²"]
            )
        ],
        composite_options_generator=lambda missing_ids: [
            "e=2.5 cm, Mortero Cemento-Arena 1:3",
            "e=3.0 cm, Mortero Cemento-Arena 1:3",
            "e=3.0 cm, Mortero Cemento-Arena 1:4",
            "e=4.0 cm, Mortero Cemento-Arena 1:3",
            "e=5.0 cm, Mortero Cemento-Arena 1:4"
        ] if set(missing_ids) == {"espesor", "tipo_mezcla"} else None
    ),

    # 2. CONCRETO ESTRUCTURAL (Vigas, Columnas, Losas, Zapatas, Fundaciones, Pedestales)
    ConstructionFamilyOntology(
        family_id="CONCRETO_ESTRUCTURAL",
        name="Elementos de Concreto Estructural",
        activation_patterns=[
            re.compile(r"\b(viga|vigas|columna|columnas|zapata|zapatas|fundaci[oó]n|fundaciones|pedestal|pedestales|muro\s+de\s+concreto|losa\s+de\s+techo|losa\s+de\s+concreto|losa\s+de\s+entrepiso)\b", re.IGNORECASE)
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS,
        required_parameters=[
            ParametricRequirement(
                param_id="resistencia_concreto",
                label="Resistencia del concreto (f'c)",
                detection_patterns=[
                    re.compile(r"\bf'?c\s*=\s*\d+", re.IGNORECASE),
                    re.compile(r"\b\d{3}\s*(kgf?\/cm2?|psi)\b", re.IGNORECASE),
                    re.compile(r"\bconcreto\s+\d{3}\b", re.IGNORECASE),
                    re.compile(r"\br[- ]\d{3}\b", re.IGNORECASE),
                ],
                question="¿Qué resistencia a la compresión (f'c) tiene el concreto estructural? (Ej: 210 kgf/cm², 250 kgf/cm², 280 kgf/cm²)",
                default_options=["f'c = 210 kgf/cm²", "f'c = 250 kgf/cm²", "f'c = 280 kgf/cm²", "f'c = 300 kgf/cm²"]
            )
        ]
    ),

    # 3. LOSAS DE CONCRETO (Requieren espesor dimensional adicional)
    ConstructionFamilyOntology(
        family_id="LOSAS_CONCRETO_ESPESOR",
        name="Losas de Concreto (Espesor)",
        activation_patterns=[
            re.compile(r"\b(losa|losas)\b", re.IGNORECASE)
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS,
        required_parameters=[
            ParametricRequirement(
                param_id="espesor",
                label="Espesor o canto de la losa",
                detection_patterns=[
                    re.compile(r"\be\s*=\s*\d+", re.IGNORECASE),
                    re.compile(r"\b\d+([\.,]\d+)?\s*(cm|cms)\b", re.IGNORECASE),
                    re.compile(r"\bespesor\b", re.IGNORECASE),
                ],
                question="¿Qué espesor o canto tiene la losa de concreto? (Ej: e=15 cm, e=20 cm, e=25 cm, e=30 cm)",
                default_options=["e=10 cm", "e=15 cm", "e=20 cm", "e=25 cm", "e=30 cm"]
            )
        ]
    ),

    # 4. MAMPOSTERÍA Y PAREDES DE BLOQUES
    ConstructionFamilyOntology(
        family_id="MAMPOSTERIA_PAREDES",
        name="Paredes y Mampostería de Bloques",
        activation_patterns=[
            re.compile(r"\b(pared|paredes|muro|muros|tabique|tabiques)\b.*\b(bloque|bloques|ladrillo|ladrillos|arcilla)\b|\b(bloque|bloques|ladrillo|ladrillos)\b.*\b(pared|paredes|muro|muros)\b", re.IGNORECASE)
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS + [
            re.compile(r"\b(pintura|pintar|esmalte|caucho|lavado|limpieza|sellado)\b", re.IGNORECASE)
        ],
        required_parameters=[
            ParametricRequirement(
                param_id="espesor_bloque",
                label="Espesor del bloque",
                detection_patterns=[
                    re.compile(r"\be\s*=\s*\d+", re.IGNORECASE),
                    re.compile(r"\b(10|12|15|20)\s*(cm|cms)\b", re.IGNORECASE),
                    re.compile(r"\b\d+x\d+x\d+\b", re.IGNORECASE),
                ],
                question="¿De qué espesor o medida es el bloque de la pared? (Ej: e=10 cm, e=12 cm, e=15 cm, e=20 cm)",
                default_options=["e=10 cm", "e=12 cm", "e=15 cm", "e=20 cm"]
            )
        ]
    ),

    # 5. PAVIMENTOS, ACERAS Y VIALIDAD
    ConstructionFamilyOntology(
        family_id="PAVIMENTOS_ACERAS",
        name="Pavimentos y Aceras de Concreto",
        activation_patterns=[
            re.compile(r"\b(pavimento|pavimentos|acera|aceras|brocal|brocales)\b", re.IGNORECASE)
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS,
        required_parameters=[
            ParametricRequirement(
                param_id="espesor",
                label="Espesor del pavimento o acera",
                detection_patterns=[
                    re.compile(r"\be\s*=\s*\d+", re.IGNORECASE),
                    re.compile(r"\b\d+([\.,]\d+)?\s*(cm|cms)\b", re.IGNORECASE),
                    re.compile(r"\bespesor\b", re.IGNORECASE),
                ],
                question="¿Qué espesor tiene el pavimento o acera? (Ej: e=10 cm, e=15 cm, e=20 cm)",
                default_options=["e=10 cm", "e=12 cm", "e=15 cm", "e=20 cm"]
            )
        ]
    ),

    # 6. TUBERÍAS Y VÁLVULAS
    ConstructionFamilyOntology(
        family_id="TUBERIAS_VALVULAS",
        name="Tuberías y Válvulas",
        activation_patterns=[
            re.compile(r"\b(tuberia|tuberias|tubo|tubos|valvula|valvulas)\b", re.IGNORECASE)
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS + [
            re.compile(r"\b(bomba|bombas|electrobomba|motobomba)\b", re.IGNORECASE)
        ],
        required_parameters=[
            ParametricRequirement(
                param_id="diametro",
                label="Diámetro nominal",
                detection_patterns=[
                    re.compile(r"\bd\s*=\s*", re.IGNORECASE),
                    re.compile(r"\b\d+([\.,]\d+)?\s*(pulg|pulgadas?|\"|mm)\b", re.IGNORECASE),
                    re.compile(r"\b\d+\s*\/\s*\d+\s*(pulg|\"|mm)?\b", re.IGNORECASE),
                    re.compile(r"\b(1\/2|3\/4|1|1-1\/2|2|3|4|6)\s*(pulg|\"|in)?\b", re.IGNORECASE),
                    re.compile(r"\bdiametro\b", re.IGNORECASE),
                ],
                question="¿Qué diámetro nominal tiene la tubería o válvula? (Ej: 1/2\", 3/4\", 1\", 2\", 3\", 4\")",
                default_options=['1/2"', '3/4"', '1"', '1 1/2"', '2"', '3"', '4"', '6"']
            )
        ]
    ),

    # 7. BOMBAS Y EQUIPOS HIDRÁULICOS
    ConstructionFamilyOntology(
        family_id="BOMBAS_EQUIPOS_HIDRAULICOS",
        name="Bombas y Equipos Hidráulicos",
        activation_patterns=[
            re.compile(r"\b(bomba|bombas|electrobomba|electrobombas|motobomba|motobombas)\b", re.IGNORECASE)
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS,
        required_parameters=[
            ParametricRequirement(
                param_id="potencia",
                label="Potencia o Caudal",
                detection_patterns=[
                    re.compile(r"\b\d+([\.,]\d+)?\s*(hp|cv|kw|lps|gpm)\b", re.IGNORECASE),
                    re.compile(r"\b(0\.5|1\.5|1\/2|3\/4)\s*hp\b", re.IGNORECASE),
                ],
                question="¿Qué potencia (HP, kW) o capacidad tiene la bomba? (Ej: 0.5 HP, 1 HP, 2 HP, 5 HP)",
                default_options=["0.5 HP", "1 HP", "1.5 HP", "2 HP", "3 HP", "5 HP", "7.5 HP", "10 HP"]
            )
        ]
    ),

    # 8. EXCAVACIONES Y MOVIMIENTO DE TIERRAS
    ConstructionFamilyOntology(
        family_id="EXCAVACIONES_TIERRAS",
        name="Excavaciones y Zanjas",
        activation_patterns=[
            re.compile(r"\b(excavaci[oó]n|excavaciones|excavar|excabaci[oó]n|excabaciones|excabar)\b", re.IGNORECASE)
        ],
        exclusion_patterns=[],
        required_parameters=[
            ParametricRequirement(
                param_id="profundidad_metodo",
                label="Profundidad y Método de Excavación",
                detection_patterns=[
                    re.compile(r"\b(hasta\s*\d+(\.\d+)?\s*m|profundidad|\d+(\.\d+)?\s*m|\d+\s*metros?)\b", re.IGNORECASE),
                    re.compile(r"\b(a\s*mano|manual|manualmente|a\s*maquina|mecanic[ao]|retroexcavadora|jumbo|tractor)\b", re.IGNORECASE),
                ],
                question="¿Qué profundidad tiene la excavación y con qué método se ejecutará? (Ej: hasta 1.50 m a mano, 1.50 a 3.00 m a máquina)",
                default_options=["hasta 1.50 m a mano", "1.50 a 3.00 m a máquina", "hasta 1.50 m a máquina", "mayor a 3.00 m a máquina"]
            )
        ]
    ),

    # 9. IMPERMEABILIZACIONES DE TECHOS / LOSAS
    ConstructionFamilyOntology(
        family_id="IMPERMEABILIZACIONES",
        name="Impermeabilizaciones y Mantos Asfálticos",
        activation_patterns=[
            re.compile(r"\b(impermeabilizaci[oó]n|impermeabilizar|manto\s+asf[aá]ltico|manto\s+real)\b", re.IGNORECASE)
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS,
        required_parameters=[
            ParametricRequirement(
                param_id="tipo_manto_espesor",
                label="Tipo de Manto o Sistema Impermeabilizante",
                detection_patterns=[
                    re.compile(r"\b(3\s*mm|4\s*mm|poliester|fibra|aluminio|autoprotegido|emulsi[oó]n|primer|elastom[eé]ric[ao])\b", re.IGNORECASE)
                ],
                question="¿Qué tipo de manto o sistema impermeabilizante se aplicará? (Ej: Manto asfáltico 3 mm autoprotegido con aluminio, Manto 4 mm poliéster)",
                default_options=[
                    "Manto asfáltico 3 mm autoprotegido con aluminio",
                    "Manto asfáltico 4 mm refuerzo poliéster",
                    "Manto asfáltico 3 mm con gravilla",
                    "Pintura elastomérica impermeable"
                ]
            )
        ]
    )
]


# ---------------------------------------------------------------------------
# EVALUADOR DE CONTRATO ONTOLÓGICO (MOTOR PÚBLICO)
# ---------------------------------------------------------------------------

def evaluate_parametric_ontology_contract(
    query: str
) -> Optional[Dict[str, Any]]:
    """
    Evalúa la descripción de obra contra la Ontología Paramétrica Universal.
    Si faltan parámetros físicos indispensables para la familia constructiva detectada,
    devuelve un payload estructurado de aclaratoria interactiva para detener el pipeline
    ANTES de entrar a la búsqueda RAG y antes de consumir cualquier LLM.

    Args:
        query: Descripción textual ingresada por el usuario.

    Returns:
        Dict con la aclaratoria estructurada (status: 'clarification_needed') o None si cumple.
    """
    if not query or not isinstance(query, str):
        return None

    norm_query = _strip_accents(query.strip())
    raw_query = query.strip()

    for ontology in ONTOLOGY_REGISTRY:
        # 1. Verificar si la consulta activa esta familia constructiva
        is_activated = any(p.search(raw_query) or p.search(norm_query) for p in ontology.activation_patterns)
        if not is_activated:
            continue

        # 2. Verificar si aplica alguna regla de exclusión (ej: demolición, desmontaje)
        is_excluded = any(p.search(raw_query) or p.search(norm_query) for p in ontology.exclusion_patterns)
        if is_excluded:
            continue

        # 3. Evaluar cada parámetro requerido
        missing_params: List[ParametricRequirement] = []
        for req in ontology.required_parameters:
            has_param = any(p.search(raw_query) or p.search(norm_query) for p in req.detection_patterns)
            if not has_param:
                missing_params.append(req)

        # Si todos los parámetros están satisfechos, pasa al siguiente control
        if not missing_params:
            continue

        # 4. Construir la respuesta interactiva estructurada para los parámetros faltantes
        logger.info(
            "Ontological contract missing parameters for family [%s]: %s (query: '%.80s')",
            ontology.family_id,
            [p.param_id for p in missing_params],
            raw_query
        )

        missing_ids = [p.param_id for p in missing_params]
        questions_list: List[str] = [p.question for p in missing_params]

        # Determinar opciones: si hay generador compuesto (ej: espesor + tipo_mezcla combinados), usarlo
        options_list: List[str] = []
        if ontology.composite_options_generator:
            composite = ontology.composite_options_generator(missing_ids)
            if composite:
                options_list = composite

        if not options_list:
            # Si no hay generador compuesto, concatenar o usar las opciones del primer parámetro
            if len(missing_params) == 1:
                options_list = missing_params[0].default_options
            else:
                # Combinar opciones razonables
                options_list = missing_params[0].default_options[:4]

        # Mensaje técnico contextualizado
        if len(missing_params) == 1:
            clarification_msg = (
                f"Para calcular con exactitud un APU de {ontology.name.lower()}, es indispensable "
                f"especificar el siguiente parámetro técnico: {missing_params[0].label.lower()}."
            )
        else:
            labels_str = " y ".join(p.label.lower() for p in missing_params)
            clarification_msg = (
                f"Para calcular con exactitud un APU de {ontology.name.lower()}, se requieren "
                f"dos especificaciones técnicas indispensables en ingeniería de costos: {labels_str}."
            )

        internal_code = f"ONTOLOGY_MISSING_{'_AND_'.join(missing_ids).upper()}"

        return {
            "status": "clarification_needed",
            "clarification_type": "parametric_specification_required",
            "_internal_code": internal_code,
            "clarification_message": clarification_msg,
            "questions": questions_list,
            "options": options_list,
            "recommendation": (
                "Indica o selecciona los parámetros solicitados para dimensionar los insumos y "
                "el rendimiento exacto de la cuadrilla sin asumir especificaciones arbitrarias."
            ),
            "guia_redaccion": (
                f"Especifica los parámetros requeridos ({', '.join(missing_ids)}) en tu respuesta "
                "para continuar directamente con la generación del APU."
            )
        }

    return None
