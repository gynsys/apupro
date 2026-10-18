"""
test_all_23_actions_simulation.py
Simulación exhaustiva y automatizada de los 23 chips de acción principales del chatbot guiado
frente al Motor Ontológico Paramétrico Universal (MOPTC).

Objetivos:
1. Validar que ninguna de las 23 acciones en unidad Global (Gl / días de cuadrilla) active falsos positivos.
2. Validar que las labores de mantenimiento, reparación, saneamiento, limpieza, demolición y desmontaje
   no exijan parámetros de fabricación nueva (f'c, espesor de bloque, dimensiones de taller).
3. Validar que en obras nuevas donde SÍ aplica aclaratoria técnica, los chips sugeridos estén
   100% contextualizados al elemento solicitado (puertas vs portones vs rejas).
"""

import os
import sys
import unittest
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.ai_apu_service.domain_rules.parametric_ontology import (
    evaluate_parametric_ontology_contract,
    ONTOLOGY_REGISTRY,
)


class TestAll23ActionsSimulation(unittest.TestCase):
    """Pruebas de cobertura total para las 23 acciones del chatbot guiado."""

    ACTIONS_23: List[str] = [
        "Suministro e instalación",
        "Instalación",
        "Construcción",
        "Demolición",
        "Remoción",
        "Pintura",
        "Vaciado de concreto",
        "Excavación",
        "Compactación",
        "Relleno",
        "Acarreo",
        "Transporte",
        "Deforestación",
        "Colocación",
        "Reparación",
        "Mantenimiento",
        "Restauración",
        "Saneamiento",
        "Confección",
        "Tratamiento",
        "Impermeabilización",
        "Desmontaje",
        "Limpieza",
    ]

    ELEMENTS_SAMPLE: List[str] = [
        "puertas metálicas",
        "portón vehicular",
        "rejas para ventanas",
        "vigas de concreto",
        "columnas",
        "tuberías de aguas negras",
        "trampas de grasa",
        "tanques de agua",
        "bombas hidroneumáticas",
        "paredes de bloques",
        "aceras de concreto",
        "tableros eléctricos",
        "transformadores",
    ]

    def test_all_23_actions_with_unit_gl_never_trigger_false_positive(self) -> None:
        """
        Garantía Absoluta: Ninguna acción con unidad Gl y días de cuadrilla
        debe ser bloqueada por la ontología paramétrica.
        """
        failures: List[Tuple[str, str, Dict[str, Any]]] = []

        for action in self.ACTIONS_23:
            for element in self.ELEMENTS_SAMPLE:
                query = f"{action} de {element} con cuadrilla especializada unidad Gl 2 días"
                result = evaluate_parametric_ontology_contract(query, "Gl")
                if result is not None:
                    failures.append((action, element, result))

        if failures:
            msg = f"Se detectaron {len(failures)} falsos positivos en unidad Gl:\n"
            for act, elem, res in failures[:5]:
                msg += f" - [{act}] {elem} -> Bloqueado por {res.get('_internal_code')}\n"
            self.fail(msg)

    def test_maintenance_and_repair_actions_in_discrete_units_never_demand_fabrication(self) -> None:
        """
        Labores de reparación, mantenimiento, saneamiento, limpieza, demolición o desmontaje
        en unidades pza, und o ml no deben exigir f'c ni dimensiones de taller.
        """
        service_actions: List[str] = [
            "Reparación",
            "Mantenimiento",
            "Saneamiento",
            "Limpieza",
            "Demolición",
            "Desmontaje",
            "Restauración",
        ]

        test_cases: List[Tuple[str, str, str]] = [
            ("Reparación", "puertas metálicas cepillado de óxido y pintura", "pza"),
            ("Mantenimiento", "electrobomba hidroneumática y cambio de rodamientos", "und"),
            ("Saneamiento", "trampa de grasa colapsada con camión váctor", "und"),
            ("Limpieza", "tanque de almacenamiento de agua potable", "und"),
            ("Demolición", "pared de bloques de arcilla con mandarria", "m2"),
            ("Desmontaje", "portón metálico existente con oxicorte", "pza"),
            ("Restauración", "reja perimetral con soldadura y aplicación de fondo", "ml"),
        ]

        for action, desc, unit in test_cases:
            query = f"{action} de {desc} unidad {unit}"
            result = evaluate_parametric_ontology_contract(query, unit)
            self.assertIsNone(
                result,
                f"Falso positivo en labor de servicio: '{query}' activó {result and result.get('_internal_code')}"
            )

    def test_new_construction_actions_demand_parameters_with_contextual_chips(self) -> None:
        """
        Obras nuevas que sí requieren parámetros indispensables deben activarse
        y contextualizar estrictamente los chips de opciones según el elemento.
        """
        # Caso 1: Puerta metálica nueva -> chips exclusivos de puertas
        res_puerta = evaluate_parametric_ontology_contract("Fabricación e instalación de puertas metálicas unidad und", "und")
        self.assertIsNotNone(res_puerta)
        self.assertIn("puertas metálicas", res_puerta["clarification_message"])
        self.assertTrue(any("0.90 m x 2.10 m" in o for o in res_puerta["options"]))
        self.assertTrue(all("Portón" not in o and "Reja" not in o for o in res_puerta["options"]))

        # Caso 2: Portón metálico nuevo -> chips exclusivos de portones
        res_porton = evaluate_parametric_ontology_contract("Fabricación de portón vehicular corredizo unidad und", "und")
        self.assertIsNotNone(res_porton)
        self.assertIn("portones", res_porton["clarification_message"])
        self.assertTrue(any("3.00 m x 2.00 m" in o for o in res_porton["options"]))
        self.assertTrue(all("Puerta metálica" not in o and "Reja" not in o for o in res_porton["options"]))

        # Caso 3: Reja nueva -> chips exclusivos de rejas
        res_reja = evaluate_parametric_ontology_contract("Construcción de reja para ventana en hierro unidad und", "und")
        self.assertIsNotNone(res_reja)
        self.assertIn("rejas", res_reja["clarification_message"])
        self.assertTrue(any("1.50 m x 1.20 m" in o for o in res_reja["options"]))
        self.assertTrue(all("Portón" not in o and "Puerta metálica" not in o for o in res_reja["options"]))

        # Caso 4: Concreto estructural nuevo -> f'c requerido
        res_concreto = evaluate_parametric_ontology_contract("Vaciado de concreto en vigas y columnas unidad m3", "m3")
        self.assertIsNotNone(res_concreto)
        self.assertEqual(res_concreto["_internal_code"], "ONTOLOGY_MISSING_RESISTENCIA_CONCRETO")

        # Caso 5: Tubería nueva -> diámetro requerido
        res_tubo = evaluate_parametric_ontology_contract("Suministro e instalación de tubería de pvc unidad ml", "ml")
        self.assertIsNotNone(res_tubo)
        self.assertEqual(res_tubo["_internal_code"], "ONTOLOGY_MISSING_DIAMETRO")


if __name__ == "__main__":
    unittest.main()
