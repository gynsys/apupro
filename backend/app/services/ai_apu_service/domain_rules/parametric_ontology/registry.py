"""Registro declarativo de familias constructivas para MOPTC."""

import re
from typing import List

from .models import ConstructionFamilyOntology, ParametricRequirement
from .patterns import (
    DEMOLITION_OR_REMOVAL_PATTERNS,
    MAINTENANCE_AND_REPAIR_PATTERNS,
    NON_FABRICATION_EXCLUSION_PATTERNS,
    SURFACE_TREATMENTS_AND_FINISHES_PATTERNS,
)

ONTOLOGY_REGISTRY: List[ConstructionFamilyOntology] = [
    # 1. SUPERFICIES Y ACABADOS DE PISO (Sobrepisos, Nivelaciones, Requemados)
    ConstructionFamilyOntology(
        family_id="SUPERFICIES_PISOS_SOBREPISOS",
        name="Sobrepisos y Morteros de Nivelación",
        activation_patterns=[
            re.compile(r"\b(sobrepiso|sobrepisos|sobre-piso|nivelaci[oó]n\s+de\s+piso|carpeta\s+de\s+nivelaci[oó]n|afinado\s+de\s+piso|mortero\s+de\s+piso|requemado)\b", re.IGNORECASE)
        ],
        exclusion_patterns=NON_FABRICATION_EXCLUSION_PATTERNS,
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
        exclusion_patterns=NON_FABRICATION_EXCLUSION_PATTERNS + [
            re.compile(r"\b(met[aá]lic[ao]s?|de\s+acero|de\s+madera|de\s+hierro|conduven|ipe|hea|heb)\b", re.IGNORECASE)
        ],
        required_parameters=[
            ParametricRequirement(
                param_id="resistencia_concreto",
                label="Resistencia del concreto (f'c)",
                detection_patterns=[
                    re.compile(r"\bf'?c\s*=\s*\d+", re.IGNORECASE),
                    re.compile(r"\b\d{3}\s*(kgf?\/cm2?|psi)\b", re.IGNORECASE),
                    re.compile(r"\bconcreto\s+\d{3}\b", re.IGNORECASE),
                    re.compile(r"\br[- ]\d{3}\b", re.IGNORECASE),
                    re.compile(r"\b(150|180|200|210|250|280|300|350)\b", re.IGNORECASE),
                    re.compile(r"\b(resistencia|est[aá]ndar|convencional|seg[uú]n\s+c[aá]lculo|seg[uú]n\s+plano)\b", re.IGNORECASE),
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
            re.compile(r"\b(construcci[oó]n|vaciado|elaboraci[oó]n|fabricaci[oó]n|suministro\s+y\s+vaciado|suministro\s+y\s+colocaci[oó]n)\b.*\b(losa|losas)\b|\b(losa|losas)\b.*\b(concreto|maciza|macizas|nervada|nervadas|reticular|reticulares|entrepiso|entrepisos|aligerada|aligeradas)\b", re.IGNORECASE)
        ],
        exclusion_patterns=NON_FABRICATION_EXCLUSION_PATTERNS,
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
        exclusion_patterns=NON_FABRICATION_EXCLUSION_PATTERNS,
        required_parameters=[
            ParametricRequirement(
                param_id="espesor_bloque",
                label="Espesor del bloque",
                detection_patterns=[
                    re.compile(r"\be\s*=\s*\d+", re.IGNORECASE),
                    re.compile(r"\b(10|12|15|20)\s*(?:cm|cms)?\b", re.IGNORECASE),
                    re.compile(r"\b\d+x\d+x\d+\b", re.IGNORECASE),
                    re.compile(r"\b(?:bloques?\s+de\s+|de\s+)(10|12|15|20)\b", re.IGNORECASE),
                    re.compile(r"\b(espesor|est[aá]ndar|convencional|seg[uú]n\s+plano)\b", re.IGNORECASE),
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
        exclusion_patterns=NON_FABRICATION_EXCLUSION_PATTERNS,
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
            re.compile(r"\b(bomba|bombas|electrobomba|motobomba)\b", re.IGNORECASE),
            re.compile(r"\b(destape|destapar|achique|achicar|limpieza|lavado|desinfecci[oó]n|saneamiento|v[aá]ctor|desobstrucci[oó]n|sondeo)\b", re.IGNORECASE)
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
                    re.compile(r"\b(diametro|di[aá]metro|media\s+pulgada|tres\s+cuartos|una\s+pulgada|dos\s+pulgadas|est[aá]ndar|comercial|seg[uú]n\s+plano)\b", re.IGNORECASE),
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
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS + [
            re.compile(r"\b(mantenimiento|reparaci[oó]n|revisi[oó]n|inspecci[oó]n|servicio|limpieza|lavado)\b", re.IGNORECASE)
        ],
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
                    re.compile(r"\b(3\s*mm|4\s*mm|poliester|fibra|aluminio|autoprotegido|emulsi[oó]n|primer|elastom[eé]ric[ao]|pintura|impermeabilizante|acr[ií]lic[ao]|poliuretano|membrana|cemento|silic[oó]n)\b", re.IGNORECASE)
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
    ),

    # 10. SOPORTES Y MONTAJE DE TELEVISORES / PANTALLAS
    ConstructionFamilyOntology(
        family_id="SOPORTES_PANTALLAS_TV",
        name="Soportes y Montaje de Televisores y Pantallas",
        activation_patterns=[
            re.compile(r"\b(televisor|televisores|pantalla|pantallas|tv|smart\s*tv|monitor|monitores)\b", re.IGNORECASE)
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS,
        required_parameters=[
            ParametricRequirement(
                param_id="tamano_pulgadas",
                label="Tamaño de la pantalla en pulgadas",
                detection_patterns=[
                    re.compile(r"\b\d{2}\s*(pulg|pulgadas?|plg|\"|'|in|inch)\b", re.IGNORECASE),
                    re.compile(r"\b(32|40|42|43|50|55|60|65|70|75|80|85)\b", re.IGNORECASE),
                    re.compile(r"\b(pulgadas?|tamano|medida)\b", re.IGNORECASE),
                ],
                question="¿De cuántas pulgadas es el televisor o pantalla que se va a instalar? (Ej: 32\", 40\"-43\", 50\"-55\", 65\"-75\")",
                default_options=[
                    '32" (32 pulgadas)',
                    '40" - 43" (40 a 43 pulgadas)',
                    '50" - 55" (50 a 55 pulgadas)',
                    '65" - 75" (65 a 75 pulgadas)',
                    'Mayor a 75" (Gran formato)'
                ]
            )
        ]
    ),

    # 11. AIRE ACONDICIONADO Y CLIMATIZACIÓN
    ConstructionFamilyOntology(
        family_id="CLIMATIZACION_AIRE_ACONDICIONADO",
        name="Aire Acondicionado y Climatización",
        activation_patterns=[
            re.compile(r"\b(aire\s+acondicionado|splits?|climatizaci[oó]n|fan\s*coils?|chillers?|uma|fancoil)\b", re.IGNORECASE)
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS,
        required_parameters=[
            ParametricRequirement(
                param_id="capacidad_termica",
                label="Capacidad térmica (BTU o Toneladas)",
                detection_patterns=[
                    re.compile(r"\b\d{1,2}(?:[.,]000|000)?\s*btu\b", re.IGNORECASE),
                    re.compile(r"\b\d+(?:[.,]\d+)?\s*(ton|toneladas?|tr)\b", re.IGNORECASE),
                    re.compile(r"\b(12000|18000|24000|36000|48000|60000)\b", re.IGNORECASE),
                    re.compile(r"\b(1\s*ton|1\.5\s*ton|2\s*ton|3\s*ton|5\s*ton)\b", re.IGNORECASE),
                    re.compile(r"\b(capacidad|toneladas?|btu)\b", re.IGNORECASE),
                ],
                question="¿Qué capacidad térmica tiene el equipo de aire acondicionado? (Ej: 12.000 BTU, 18.000 BTU, 24.000 BTU, 3 Ton, 5 Ton)",
                default_options=[
                    "12.000 BTU (1 Ton)",
                    "18.000 BTU (1.5 Ton)",
                    "24.000 BTU (2 Ton)",
                    "36.000 BTU (3 Ton)",
                    "5 Toneladas (60.000 BTU)"
                ]
            )
        ]
    ),

    # 12. CABLES Y CONDUCTORES ELÉCTRICOS
    ConstructionFamilyOntology(
        family_id="CABLES_CONDUCTORES_ELECTRICOS",
        name="Cables y Conductores Eléctricos",
        activation_patterns=[
            re.compile(r"\b(cables?|conductor(?:es)?)\b.*\b(cobre|aluminio|thw|thhn|ttu|awg|mcm|el[eé]ctrico[s]?)\b|\b(cable\s+thw|cable\s+thhn|cable\s+ttu|cable\s+el[eé]ctrico|tendido\s+de\s+cables?|cableado\s+el[eé]ctrico)\b", re.IGNORECASE)
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS + [
            re.compile(r"\b(tuber[ií]as?|tubos?|canaletas?|bandejas?|escalerillas?)\s+para\s+cables?\b", re.IGNORECASE)
        ],
        required_parameters=[
            ParametricRequirement(
                param_id="calibre_conductor",
                label="Calibre del conductor (AWG o MCM)",
                detection_patterns=[
                    re.compile(r"\bcalibre\s*#?\s*\d+\b", re.IGNORECASE),
                    re.compile(r"\b#\s*\d+\b", re.IGNORECASE),
                    re.compile(r"\b\d+\s*awg\b", re.IGNORECASE),
                    re.compile(r"\b[1-4]\/0\s*(?:awg)?\b", re.IGNORECASE),
                    re.compile(r"\b\d{2,3}\s*mcm\b", re.IGNORECASE),
                    re.compile(r"\b(calibre|secci[oó]n|seccion)\b", re.IGNORECASE),
                ],
                question="¿Qué calibre tiene el cable o conductor eléctrico? (Ej: #14 AWG, #12 AWG, #10 AWG, #8 AWG, #6 AWG, 2/0 AWG, 4/0 AWG)",
                default_options=[
                    "#14 AWG",
                    "#12 AWG",
                    "#10 AWG",
                    "#8 AWG",
                    "#6 AWG",
                    "#4 AWG",
                    "#2 AWG",
                    "2/0 AWG",
                    "4/0 AWG"
                ]
            )
        ]
    ),

    # 13. TABLEROS ELÉCTRICOS Y DISTRIBUCIÓN
    ConstructionFamilyOntology(
        family_id="TABLEROS_ELECTRICOS",
        name="Tableros Eléctricos y Distribución",
        activation_patterns=[
            re.compile(r"\b(tableros?\s+el[eé]ctricos?|tableros?\s+principal(?:es)?|tableros?\s+de\s+distribuci[oó]n|tableros?\s+secundarios?|tableros?\s+de\s+fuerza|tableros?\s+de\s+alumbrado|tablero\s+tipo\s+nlab|tablero\s+tipo\s+cpl|centro\s+de\s+carga)\b", re.IGNORECASE),
            re.compile(r"\b(suministro\s+y\s+colocaci[oó]n|instalaci[oó]n|montaje)\b.*\btablero[s]?\b", re.IGNORECASE)
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS + [
            re.compile(r"\b(interruptor(?:es)?\s+termomagn[eé]ticos?|breakers?|pastillas?\s+termomagn[eé]ticas?)\b", re.IGNORECASE)
        ],
        required_parameters=[
            ParametricRequirement(
                param_id="capacidad_circuitos",
                label="Capacidad de circuitos o polos",
                detection_patterns=[
                    re.compile(r"\b\d{1,2}\s*(?:circuitos?|polos?|ctos?|m[oó]dulos?|posici[oó]n(?:es)?)\b", re.IGNORECASE),
                    re.compile(r"\bcircuitos?\b", re.IGNORECASE),
                ],
                question="¿De cuántos circuitos o polos es el tablero eléctrico? (Ej: 12 circuitos, 18 circuitos, 24 circuitos, 30 circuitos, 42 circuitos)",
                default_options=[
                    "12 circuitos",
                    "18 circuitos",
                    "24 circuitos",
                    "30 circuitos",
                    "42 circuitos"
                ]
            )
        ]
    ),

    # 14. TRANSFORMADORES ELÉCTRICOS Y SUBESTACIONES
    ConstructionFamilyOntology(
        family_id="TRANSFORMADORES_ELECTRICOS",
        name="Transformadores Eléctricos y Subestaciones",
        activation_patterns=[
            re.compile(r"\b(transformador(?:es)?|subestaci[oó]n(?:es)?|banco\s+de\s+transformaci[oó]n|transformador\s+monof[aá]sico|transformador\s+trif[aá]sico|transformador\s+padmounted?)\b", re.IGNORECASE)
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS,
        required_parameters=[
            ParametricRequirement(
                param_id="potencia_kva",
                label="Potencia nominal (kVA)",
                detection_patterns=[
                    re.compile(r"\b\d+(?:[.,]\d+)?\s*(kva|kwa?|kvar)\b", re.IGNORECASE),
                    re.compile(r"\b(potencia|capacidad)\b", re.IGNORECASE),
                ],
                question="¿Qué capacidad o potencia en kVA tiene el transformador? (Ej: 15 kVA, 25 kVA, 37.5 kVA, 50 kVA, 75 kVA, 150 kVA)",
                default_options=[
                    "15 kVA",
                    "25 kVA",
                    "37.5 kVA",
                    "50 kVA",
                    "75 kVA",
                    "150 kVA"
                ]
            )
        ]
    ),

    # 15. LUMINARIAS, LÁMPARAS Y REFLECTORES
    ConstructionFamilyOntology(
        family_id="LUMINARIAS_ILUMINACION",
        name="Luminarias, Lámparas y Reflectores",
        activation_patterns=[
            re.compile(r"\b(luminarias?|reflector(?:es)?|panel(?:es)?\s+led|l[aá]mparas?|focos?\s+led)\b", re.IGNORECASE)
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS + [
            re.compile(r"\b(poste|postes|torre\s+de\s+iluminaci[oó]n)\b", re.IGNORECASE)
        ],
        required_parameters=[
            ParametricRequirement(
                param_id="tipo_o_potencia",
                label="Tipo y potencia de la luminaria (Watts/Formato)",
                detection_patterns=[
                    re.compile(r"\b\d{1,3}\s*w(?:atts?)?\b", re.IGNORECASE),
                    re.compile(r"\b60\s*x\s*60\b", re.IGNORECASE),
                    re.compile(r"\b30\s*x\s*120\b", re.IGNORECASE),
                    re.compile(r"\b[1-4]\s*x\s*(?:18|32|36|40|54)\s*w?\b", re.IGNORECASE),
                    re.compile(r"\b(ojo\s+de\s+buey|downlight|campana|high\s*bay|cobra|alumbrado\s+p[uú]blico)\b", re.IGNORECASE),
                    re.compile(r"\b(potencia|watts?)\b", re.IGNORECASE),
                ],
                question="¿Qué tipo y potencia tiene la luminaria o reflector? (Ej: Panel LED 60x60 cm 40W, Reflector LED 50W, 100W, 200W, Fluorescente 2x32W)",
                default_options=[
                    "Panel LED 60x60 cm (40W)",
                    "Reflector LED 50W",
                    "Reflector LED 100W",
                    "Reflector LED 200W",
                    "Luminaria Fluorescente 2x32W",
                    "Downlight / Ojo de buey LED 18W"
                ]
            )
        ]
    ),

    # 16. BOTES Y ACARREOS DE ESCOMBROS Y TIERRA
    ConstructionFamilyOntology(
        family_id="BOTES_ACARREOS_ESCOMBROS",
        name="Carga, Acarreos y Bote de Escombros",
        activation_patterns=[
            re.compile(r"\b(bote\s+de\s+escombros?|transporte\s+de\s+escombros?|desalojo\s+de\s+escombros?|aca[r]{1,2}eo\s+de\s+escombros?|bote\s+a\s+botadero|bote\s+de\s+tierra|aca[r]{1,2}eo\s+de\s+tierra)\b", re.IGNORECASE),
            re.compile(r"\b(carga\s+y\s+transporte|carga\s+y\s+bote)\b", re.IGNORECASE),
            re.compile(r"\b(bote|desalojo|aca[r]{1,2}eo)\b.*\b(escombros?|material\s+sobrante|desechos?)\b", re.IGNORECASE),
        ],
        exclusion_patterns=[
            re.compile(r"\b(carretilla|a\s+mano\s+hasta\s+\d+\s*m|m3\.m|m3xm|m3\*m)\b", re.IGNORECASE)
        ],
        required_parameters=[
            ParametricRequirement(
                param_id="distancia_km",
                label="Distancia al botadero (km)",
                detection_patterns=[
                    re.compile(r"\b\d+([\.,]\d+)?\s*(km|kms|kil[oó]metros?)\b", re.IGNORECASE),
                    re.compile(r"\b(hasta\s*\d+\s*km|distancia|primer\s*km|km\s*adicional)\b", re.IGNORECASE),
                ],
                question="¿A qué distancia se encuentra el botadero autorizado? (Ej: hasta 5 km, 10 km, 15 km, 20 km)",
                default_options=["Hasta 5 km", "Hasta 10 km", "Hasta 15 km", "Hasta 20 km", "Mayor a 20 km"]
            ),
            ParametricRequirement(
                param_id="metodo_carga",
                label="Método de carga (manual o mecánica)",
                detection_patterns=[
                    re.compile(r"\b(a\s+mano|manual|manualmente|a\s+m[aá]quina|mecanic[ao]|con\s+retro|retroexcavadora|minicargador|cargador|bobcat)\b", re.IGNORECASE),
                ],
                question="¿Cómo se efectuará la carga al camión? (Ej: Carga a mano / manual, Carga a máquina / mecánica)",
                default_options=["Carga a máquina (mecánica)", "Carga manual (a mano)"]
            )
        ],
        composite_options_generator=lambda missing_ids: [
            "Hasta 5 km, Carga a máquina",
            "Hasta 5 km, Carga manual",
            "Hasta 10 km, Carga a máquina",
            "Hasta 15 km, Carga a máquina",
            "Hasta 20 km, Carga a máquina"
        ] if set(missing_ids) == {"distancia_km", "metodo_carga"} else None
    ),

    # 17. PINTURAS Y ACABADOS DE PAREDES Y TECHOS
    ConstructionFamilyOntology(
        family_id="PINTURAS_ACABADOS_SUPERFICIALES",
        name="Pinturas y Revestimientos de Paredes y Techos",
        activation_patterns=[
            re.compile(r"\b(pintura|pintar|aplicaci[oó]n\s+de\s+pintura)\b.*\b(pared|paredes|muros?|techos?|cielo\s*raso|fachada|interior(?:es)?|exterior(?:es)?)\b|\b(pintura\s+de\s+caucho|pintura\s+de\s+esmalte|pintura\s+ep[oó]xica|pintura\s+para\s+tr[aá]fico|fondo\s+anticorrosivo)\b", re.IGNORECASE),
            re.compile(r"\b(pintar\s+(?:las?\s+)?(?:pared|paredes|techos?|fachadas?))\b", re.IGNORECASE),
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS + [
            re.compile(r"\b(demarcaci[oó]n|se[nñ]alizaci[oó]n|impermeabili\w+|manto)\b", re.IGNORECASE)
        ],
        required_parameters=[
            ParametricRequirement(
                param_id="tipo_pintura",
                label="Tipo de pintura",
                detection_patterns=[
                    re.compile(r"\b(caucho|esmalte|ep[oó]xic[ao]|oleo|[oó]leo|satinad[ao]|anticorrosivo|fondo|acrilic[ao]|poliuretano|tr[aá]fico|clase\s+[abc])\b", re.IGNORECASE),
                    re.compile(r"\b(tipo\s+caucho|tipo\s+esmalte)\b", re.IGNORECASE),
                ],
                question="¿Qué tipo de pintura se va a aplicar? (Ej: Pintura de Caucho Clase A, Esmalte brillante, Epóxica, Fondo anticorrosivo)",
                default_options=[
                    "Pintura de Caucho Clase A (Interiores/Exteriores)",
                    "Pintura de Esmalte Sintético Brillante",
                    "Pintura Epóxica de alta resistencia",
                    "Pintura Satinada / Seda",
                    "Fondo Anticorrosivo"
                ]
            )
        ]
    ),

    # 18. PUERTAS, VENTANAS Y PORTONES
    ConstructionFamilyOntology(
        family_id="PUERTAS_VENTANAS_CARPINTERIA",
        name="Puertas, Ventanas y Portones",
        activation_patterns=[
            re.compile(r"\b(suministro\s+(?:y|e)\s+(?:instalaci[oó]n|colocaci[oó]n)|instalaci[oó]n|fabricaci[oó]n|montaje)\b.*\b(puertas?|ventanas?|port[oó]n|portones)\b|\b(puertas?|ventanas?|port[oó]n|portones)\b.*\b(madera|hierro|metal|met[aá]lic[ao]|aluminio|entamborad[ao]|arrollable)\b", re.IGNORECASE),
            re.compile(r"\b(puertas?\s+de\s+madera|puertas?\s+de\s+hierro|puertas?\s+de\s+aluminio|ventanas?\s+de\s+aluminio|port[oó]n\s+met[aá]lico|port[oó]n\s+de\s+hierro)\b", re.IGNORECASE),
        ],
        exclusion_patterns=NON_FABRICATION_EXCLUSION_PATTERNS + [
            re.compile(r"\b(cerradura|cerrojo|pomos?|manilla|bisagra)\b", re.IGNORECASE),
            re.compile(r"\b(reja|rejas|protector(?:es)?\s+de\s+ventana|protectores?\s+para\s+ventanas?|baranda|barandas|pasamanos?)\b", re.IGNORECASE)
        ],
        required_parameters=[
            ParametricRequirement(
                param_id="tipo_material_dimensiones",
                label="Dimensiones y material de la puerta o ventana",
                detection_patterns=[
                    re.compile(r"\b\d+([\.,]\d+)?\s*(?:m|mts|mt|cm|cms|mm)?\s*(?:x|\*|por)\s*\d+([\.,]\d+)?(?:\s*(?:m|mts|mt|cm|cms|mm))?\b", re.IGNORECASE),
                    re.compile(r"\b(0\.90\s*x\s*2\.10|0\.80\s*x\s*2\.10|0\.70\s*x\s*2\.10|1\.00\s*x\s*2\.10|1\.20\s*x\s*1\.50|1\.50\s*x\s*1\.50)\b", re.IGNORECASE),
                    re.compile(r"\b(medidas?|dimensi[oó]n(?:es)?|ancho|alto|altura|largo|est[aá]ndar|comercial|seg[uú]n\s+plano)\b", re.IGNORECASE),
                ],
                question="¿Qué dimensiones (Ancho x Alto) y material tiene la puerta o ventana? (Ej: 0.90x2.10 m madera entamborada, 1.20x1.50 m aluminio y vidrio)",
                default_options=[
                    "Puerta 0.90 x 2.10 m Madera Entamborada",
                    "Puerta 0.80 x 2.10 m Madera Entamborada",
                    "Puerta 0.90 x 2.10 m Metálica (Hierro/Lámina)",
                    "Ventana 1.20 x 1.50 m Aluminio y Vidrio",
                    "Ventana 1.50 x 1.50 m Aluminio y Vidrio",
                    "Portón 3.00 x 2.00 m Metálico Corredizo"
                ]
            )
        ]
    ),

    # 19. ESTRUCTURAS METÁLICAS Y ACERO ESTRUCTURAL
    ConstructionFamilyOntology(
        family_id="ESTRUCTURAS_METALICAS_ACERO",
        name="Estructuras Metálicas y Perfiles de Acero",
        activation_patterns=[
            re.compile(r"\b(estructura\s+met[aá]lica|estructuras\s+met[aá]licas|acero\s+estructural)\b", re.IGNORECASE),
            re.compile(r"\b(suministro\s+(?:y|e)\s+(?:instalaci[oó]n|colocaci[oó]n)|fabricaci[oó]n|montaje)\b.*\b(vigas?\s+met[aá]licas?|columnas?\s+met[aá]licas?|perfil\s+ipe|perfil\s+hea|perfil\s+heb|tubo\s+estructural|conduven)\b", re.IGNORECASE),
            re.compile(r"\b(perfil\s+ipe|perfil\s+hea|perfil\s+heb|perfil\s+conduven|viga\s+ipe|columna\s+hea)\b", re.IGNORECASE),
        ],
        exclusion_patterns=NON_FABRICATION_EXCLUSION_PATTERNS + [
            re.compile(r"\b(pintura|fondo|anticorrosivo)\b", re.IGNORECASE),
            re.compile(r"\b(reja|rejas|protector(?:es)?\s+de\s+ventana|baranda|barandas|pasamanos?)\b", re.IGNORECASE)
        ],
        required_parameters=[
            ParametricRequirement(
                param_id="tipo_perfil_dimension",
                label="Tipo de perfil o sección estructural",
                detection_patterns=[
                    re.compile(r"\b(ipe|hea|heb|conduven|upn|ipn|w)\s*[- ]?\d+\b", re.IGNORECASE),
                    re.compile(r"\b\d+\s*x\s*\d+\s*(?:mm|\"|pulg)?\b", re.IGNORECASE),
                    re.compile(r"\b\d+([\.,]\d+)?\s*(kg\/m|kgf\/m)\b", re.IGNORECASE),
                    re.compile(r"\b(perfil|secci[oó]n|dimensi[oó]n(?:es)?)\b", re.IGNORECASE),
                ],
                question="¿Qué tipo de perfil o sección estructural de acero se utilizará? (Ej: IPE-160, IPE-200, HEA-200, Tubo Conduven 100x100, Conduven 140x140)",
                default_options=[
                    "Perfil IPE-160",
                    "Perfil IPE-200",
                    "Perfil HEA-200",
                    "Tubo Estructural Conduven 100x100 mm",
                    "Tubo Estructural Conduven 140x140 mm",
                    "Perfil Ángulo 2\" x 2\" x 1/4\""
                ]
            )
        ]
    ),

    # 20. CERRAMIENTOS Y CONCERTINAS DE SEGURIDAD
    ConstructionFamilyOntology(
        family_id="CERRAMIENTOS_CONCERTINAS_SEGURIDAD",
        name="Concertinas y Cerramientos de Seguridad",
        activation_patterns=[
            re.compile(r"\b(concertinas?|cercado\s+de\s+seguridad|alambre\s+de\s+p[uú]as|concertina\s+de\s+seguridad)\b", re.IGNORECASE)
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS,
        required_parameters=[
            ParametricRequirement(
                param_id="diametro",
                label="Diámetro de la concertina",
                detection_patterns=[
                    re.compile(r"\b\d+([\.,]\d+)?\s*(cm|cms|pulgadas?|\"|mm)\b", re.IGNORECASE),
                    re.compile(r"\b(di[aá]metro|medida)\b", re.IGNORECASE),
                ],
                question="¿Qué diámetro o formato tiene la concertina de seguridad? (Ej: 45 cm / 18\", 60 cm / 24\")",
                default_options=["45 cm (18\")", "60 cm (24\")", "75 cm (30\")", "90 cm (36\")"]
            )
        ]
    ),

    # 21. TANQUES DE AGUA Y ALMACENAMIENTO
    ConstructionFamilyOntology(
        family_id="TANQUES_ALMACENAMIENTO_AGUA",
        name="Tanques de Agua y Almacenamiento",
        activation_patterns=[
            re.compile(r"\b(tanques?\s+de\s+agua|tanques?\s+pl[aá]sticos?|tanques?\s+para\s+agua|tanques?\s+a[eé]reos?|tanques?\s+subterr[aá]neos?|tanques?\s+cil[ií]ndricos?|tanques?\s+tipo\s+botella)\b|\b(instalaci[oó]n|suministro|suministro\s+e\s+instalaci[oó]n|colocaci[oó]n)\b.*\btanques?\b", re.IGNORECASE),
            re.compile(r"\btanques?\s+(?:de\s+reserva|hidroneum[aá]ticos?)\b", re.IGNORECASE),
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS + [
            re.compile(r"\b(lavado|limpieza|desinfecci[oó]n|mantenimiento|reparaci[oó]n)\b", re.IGNORECASE)
        ],
        required_parameters=[
            ParametricRequirement(
                param_id="capacidad_volumen",
                label="Capacidad o volumen del tanque",
                detection_patterns=[
                    re.compile(r"\b\d+([\.,]\d+)?\s*(lts?|litros?|m3|m³|gal|galones?)\b", re.IGNORECASE),
                    re.compile(r"\b(capacidad|volumen)\b", re.IGNORECASE),
                ],
                question="¿De qué capacidad o volumen es el tanque de agua? (Ej: 500 lts, 1000 lts, 1500 lts, 2000 lts, 5000 lts)",
                default_options=["500 Litros", "1000 Litros", "1500 Litros", "2000 Litros", "2500 Litros", "5000 Litros"]
            )
        ]
    ),

    # 22. ELEMENTOS ESTRUCTURALES DISCRETOS Y ALBAÑILERÍA (Dinteles, Machones, Vigas Corona, Brocales, Mesones, Peldaños)
    ConstructionFamilyOntology(
        family_id="ELEMENTOS_ESTRUCTURALES_DISCRETOS",
        name="Dinteles, Machones y Elementos de Concreto/Mortero",
        activation_patterns=[
            re.compile(r"\b(dintel|dinteles|machon|machones|viga\s+de\s+corona|vigas?\s+corona|brocal|brocales|pedestal|pedestales|riostra|riostras|pollete|polletes|mes[oó]n|mesones|tope\s+de\s+mamposter[ií]a|topes?\s+en\s+mamposter[ií]a|peldano|peldaño|peldanos|peldaños)\b", re.IGNORECASE)
        ],
        exclusion_patterns=NON_FABRICATION_EXCLUSION_PATTERNS,
        required_parameters=[
            ParametricRequirement(
                param_id="dimensiones_seccion",
                label="Dimensiones o sección transversal (Largo x Ancho x Espesor/Alto)",
                detection_patterns=[
                    re.compile(r"\b\d+([\.,]\d+)?\s*(?:m|mts|mt|cm|cms|mm)?\s*(?:x|\*|por)\s*\d+([\.,]\d+)?\b", re.IGNORECASE),
                    re.compile(r"\b(?:ancho|alto|altura|espesor|peralte|largo|longitud|secci[oó]n|dimensiones?|medidas?)\b", re.IGNORECASE),
                    re.compile(r"\be\s*=\s*\d+", re.IGNORECASE),
                    re.compile(r"\bh\s*=\s*\d+", re.IGNORECASE),
                    re.compile(r"\b\d+([\.,]\d+)?\s*(?:cm|cms|mm|m)\s*(?:de\s+espesor|de\s+alto|de\s+ancho|de\s+secci[oó]n)", re.IGNORECASE),
                    re.compile(r"\bsecci[oó]n\b", re.IGNORECASE),
                ],
                question="¿Cuáles son las dimensiones o sección transversal aproximada del elemento (Largo x Ancho x Espesor/Alto)?",
                default_options=[
                    "0.90 m x 15 cm x 5 cm (Dintel puerta estándar)",
                    "1.00 m x 10 cm x 5 cm (Dintel tabique fino)",
                    "1.20 m x 15 cm x 10 cm (Dintel / Machón mediano)",
                    "1.50 m x 20 cm x 15 cm (Viga de corona / Brocal)"
                ]
            )
        ]
    ),

    # 23. HERRERÍA Y CARPINTERÍA METÁLICA (Portones, Rejas, Puertas Metálicas, Protectores)
    ConstructionFamilyOntology(
        family_id="HERRERIA_ESTRUCTURAS_MET_DISCRETAS",
        name="Portones, Rejas y Herrería Metálica",
        activation_patterns=[
            re.compile(r"\b(port[oó]n|portones|reja|rejas|puerta\s+met[aá]lica|puertas\s+met[aá]licas|protector(?:es)?\s+de\s+ventana|protectores?\s+para\s+ventanas?|baranda|barandas|pasamanos?)\b", re.IGNORECASE)
        ],
        exclusion_patterns=NON_FABRICATION_EXCLUSION_PATTERNS + [
            re.compile(r"\b(cerradura|cerrojo|candado|bisagra|manilla|cilindro|manillar|llave)\b", re.IGNORECASE)
        ],
        required_parameters=[
            ParametricRequirement(
                param_id="dimensiones_herreria",
                label="Dimensiones del elemento metálico (Ancho x Alto)",
                detection_patterns=[
                    re.compile(r"\b\d+([\.,]\d+)?\s*(?:m|mts|mt|cm|cms|mm)?\s*(?:x|\*|por)\s*\d+([\.,]\d+)?(?:\s*(?:m|mts|mt|cm|cms|mm))?\b", re.IGNORECASE),
                    re.compile(r"\b\d+([\.,]\d+)?\s*(?:m2|m²|mts2|metros\s+cuadrados)\b", re.IGNORECASE),
                    re.compile(r"\b(?:medidas?|dimensiones?|ancho|alto|altura|largo|secci[oó]n|est[aá]ndar|comercial|seg[uú]n\s+plano|vehicular|residencial|amplio)\b", re.IGNORECASE),
                ],
                question="¿Cuáles son las dimensiones aproximadas (Ancho x Alto) del elemento de herrería o estructura metálica?",
                default_options=[
                    "Portón 3.00 m x 2.00 m (Vehicular residencial)",
                    "Portón 4.00 m x 2.50 m (Vehicular amplio)",
                    "Reja para ventana 1.50 m x 1.20 m",
                    "Reja para ventana 1.00 m x 1.00 m",
                    "Puerta metálica 0.90 m x 2.10 m"
                ]
            )
        ]
    ),

    # 24. PINTURAS Y RECUBRIMIENTOS DE ELEMENTOS ESPECÍFICOS (Rejas, Portones, Fachadas sin área en m2)
    ConstructionFamilyOntology(
        family_id="PINTURA_RECUBRIMIENTOS_DISCRETOS",
        name="Pintura o Recubrimiento de Elementos Específicos",
        activation_patterns=[
            re.compile(r"\b(pintura|pintar|esmaltar?|barnizar?|impermeabilizar?)\b.*\b(reja|rejas|port[oó]n|portones|puerta|puertas|cerca|cercas|ventana|ventanas|jardinera|jardineras|fachada|fachadas)\b", re.IGNORECASE)
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS,
        required_parameters=[
            ParametricRequirement(
                param_id="area_recubrimiento",
                label="Área aproximada de superficie (m²)",
                detection_patterns=[
                    re.compile(r"\b\d+([\.,]\d+)?\s*(?:m2|m²|mts2|metros\s+cuadrados)\b", re.IGNORECASE),
                    re.compile(r"\b\d+([\.,]\d+)?\s*(?:m|mts|mt|cm|cms|mm)?\s*(?:x|\*|por)\s*\d+([\.,]\d+)?(?:\s*(?:m|mts|mt|cm|cms|mm))?\b", re.IGNORECASE),
                    re.compile(r"\b(?:[aá]rea|superficie|desarrollo|est[aá]ndar|aprox|mediano)\b", re.IGNORECASE),
                ],
                question="¿Cuál es el área o desarrollo aproximado de superficie a pintar o tratar?",
                default_options=[
                    "Superficie aprox. 5 m²",
                    "Superficie aprox. 10 m² (Reja / Portón mediano)",
                    "Superficie aprox. 20 m²",
                    "Superficie aprox. 50 m²"
                ]
            )
        ]
    ),

    # 25. GENERADORES Y PLANTAS ELÉCTRICAS
    ConstructionFamilyOntology(
        family_id="GENERADORES_PLANTAS_ELECTRICAS",
        name="Plantas Eléctricas y Generadores",
        activation_patterns=[
            re.compile(r"\b(planta\s+el[eé]ctrica|plantas\s+el[eé]ctricas|generador\s+el[eé]ctrico|generadores\s+el[eé]ctricos|grupo\s+electr[oó]geno)\b", re.IGNORECASE)
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS,
        required_parameters=[
            ParametricRequirement(
                param_id="potencia_kva",
                label="Potencia nominal (kVA o kW)",
                detection_patterns=[
                    re.compile(r"\b\d+(?:[.,]\d+)?\s*(?:kva|kw|kwa)\b", re.IGNORECASE),
                    re.compile(r"\b(?:capacidad|potencia)\b", re.IGNORECASE),
                ],
                question="¿Qué potencia nominal (kVA o kW) tiene la planta eléctrica o generador?",
                default_options=[
                    "15 kVA (Residencial)",
                    "30 kVA (Comercial ligero)",
                    "50 kVA (Edificio / Comercio)",
                    "100 kVA (Industrial mediano)",
                    "150 kVA (Industrial pesado)"
                ]
            )
        ]
    ),

    # 26. INTERRUPTORES TERMOMAGNÉTICOS Y BREAKERS
    ConstructionFamilyOntology(
        family_id="INTERRUPTORES_BREAKERS",
        name="Interruptores Termomagnéticos y Breakers",
        activation_patterns=[
            re.compile(r"\b(breakers?|interruptor(?:es)?\s+termomagn[eé]ticos?|pastillas?\s+termomagn[eé]ticas?)\b", re.IGNORECASE)
        ],
        exclusion_patterns=DEMOLITION_OR_REMOVAL_PATTERNS,
        required_parameters=[
            ParametricRequirement(
                param_id="capacidad_amperaje_polos",
                label="Número de polos y amperaje",
                detection_patterns=[
                    re.compile(r"\b\d{1,3}\s*(?:amp|amperios?|a)\b", re.IGNORECASE),
                    re.compile(r"\b[1-3]\s*(?:x|polo|polos|p)\b", re.IGNORECASE),
                    re.compile(r"\b(?:amperaje|capacidad)\b", re.IGNORECASE),
                ],
                question="¿De cuántos polos y qué amperaje es el interruptor termomagnético / breaker?",
                default_options=[
                    "1 polo x 20 A (1x20 A)",
                    "2 polos x 30 A (2x30 A)",
                    "2 polos x 50 A (2x50 A)",
                    "3 polos x 70 A (3x70 A)",
                    "3 polos x 100 A (3x100 A)"
                ]
            )
        ]
    ),

    # 27. TABIQUERÍA Y TECHOS DRYWALL EN UNIDADES DISCRETAS
    ConstructionFamilyOntology(
        family_id="TABIQUERIA_DRYWALL_DISCRETA",
        name="Tabiquería y Paredes de Drywall",
        activation_patterns=[
            re.compile(r"\b(drywall|durlock|cart[oó]n[- ]yeso|yeso[- ]cart[oó]n|tabiquer[ií]a\s+liviana)\b", re.IGNORECASE)
        ],
        exclusion_patterns=NON_FABRICATION_EXCLUSION_PATTERNS,
        required_parameters=[
            ParametricRequirement(
                param_id="dimensiones_area_drywall",
                label="Área o dimensiones del tabique",
                detection_patterns=[
                    re.compile(r"\b\d+([\.,]\d+)?\s*(?:m2|m²|mts2|metros\s+cuadrados)\b", re.IGNORECASE),
                    re.compile(r"\b\d+([\.,]\d+)?\s*(?:m|mts|mt|cm|cms|mm)?\s*(?:x|\*|por)\s*\d+([\.,]\d+)?(?:\s*(?:m|mts|mt|cm|cms|mm))?\b", re.IGNORECASE),
                    re.compile(r"\b(?:[aá]rea|superficie|medidas?|dimensiones?|est[aá]ndar|comercial)\b", re.IGNORECASE),
                ],
                question="¿Cuál es el área (m²) o las dimensiones aproximadas (Largo x Alto) del tabique de drywall?",
                default_options=[
                    "Tabique 3.00 m x 2.50 m (7.5 m²)",
                    "Tabique 4.00 m x 2.50 m (10 m²)",
                    "Superficie aprox. 15 m²",
                    "Superficie aprox. 25 m²"
                ]
            )
        ]
    )
]
