import os
import sys
import unittest
from typing import Any, Dict

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.ai_apu_service.domain_rules.parametric_ontology import (
    evaluate_parametric_ontology_contract,
    ONTOLOGY_REGISTRY,
)
from app.services.apu_input_validator import validate_rag_signals


class TestParametricOntology(unittest.TestCase):
    """
    Suite de pruebas para validar la Ontología Paramétrica Universal de Obras Civiles (MOPTC).
    Verifica que las consultas sin parámetros indispensables sean interceptadas antes del RAG
    sin asumir mezclas ni rendimientos erróneos, y que las respuestas con parámetros pasen limpiamente.
    """

    def test_sobrepiso_missing_both_thickness_and_mix(self) -> None:
        """Caso del usuario: sobrepiso requemado sin espesor ni mezcla debe pedir ambas cosas."""
        query = "costruccion de sobrepiso requemado utilizando oxido color negro"
        result = evaluate_parametric_ontology_contract(query)

        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "clarification_needed")
        self.assertEqual(result["clarification_type"], "parametric_specification_required")
        self.assertEqual(result["_internal_code"], "ONTOLOGY_MISSING_ESPESOR_AND_TIPO_MEZCLA")
        self.assertEqual(len(result["questions"]), 2)
        self.assertIn("espesor", result["questions"][0].lower())
        self.assertIn("mortero", result["questions"][1].lower())
        self.assertTrue(len(result["options"]) >= 3)
        self.assertTrue(any("e=3.0 cm" in opt for opt in result["options"]))
        self.assertTrue(any("1:3" in opt for opt in result["options"]))

    def test_sobrepiso_satisfied_passes(self) -> None:
        """Sobrepiso con espesor y mezcla explicitados debe pasar el contrato ontológico."""
        query = "construccion de sobrepiso requemado con oxido negro, e=3.0 cm, mortero cemento-arena 1:3"
        result = evaluate_parametric_ontology_contract(query)
        self.assertIsNone(result)

    def test_sobrepiso_demolition_is_excluded(self) -> None:
        """Demolición o picado de sobrepiso no debe pedir espesor de vaciado ni dosificación de mortero."""
        query = "demolicion y picado de sobrepiso existente con rotomartillo"
        result = evaluate_parametric_ontology_contract(query)
        self.assertIsNone(result)

    def test_concreto_estructural_missing_fc(self) -> None:
        """Vigas de concreto sin f'c debe exigir resistencia."""
        query = "vaciado de concreto en vigas de carga y columnas"
        result = evaluate_parametric_ontology_contract(query)

        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "clarification_needed")
        self.assertEqual(result["_internal_code"], "ONTOLOGY_MISSING_RESISTENCIA_CONCRETO")
        self.assertTrue(any("210" in opt for opt in result["options"]))
        self.assertTrue(any("250" in opt for opt in result["options"]))

    def test_concreto_estructural_satisfied(self) -> None:
        """Vigas de concreto con f'c=250 kgf/cm2 pasa limpiamente."""
        query = "vaciado de concreto en vigas de carga f'c=250 kgf/cm2, incluye encofrado"
        result = evaluate_parametric_ontology_contract(query)
        self.assertIsNone(result)

    def test_pared_bloques_missing_thickness(self) -> None:
        """Pared de bloques sin espesor debe pedir espesor."""
        query = "construccion de pared de bloques de arcilla piñata"
        result = evaluate_parametric_ontology_contract(query)

        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "clarification_needed")
        self.assertEqual(result["_internal_code"], "ONTOLOGY_MISSING_ESPESOR_BLOQUE")
        self.assertIn("e=15 cm", result["options"])

    def test_pared_bloques_demolition_excluded(self) -> None:
        """Demolición de pared no pide espesor de bloque."""
        query = "demolicion de pared de bloques de arcilla con mandarria"
        result = evaluate_parametric_ontology_contract(query)
        self.assertIsNone(result)

    def test_tuberia_missing_diameter(self) -> None:
        """Tubería sin diámetro debe exigir diámetro."""
        query = "suministro e instalacion de tuberia de pvc para aguas blancas"
        result = evaluate_parametric_ontology_contract(query)

        self.assertIsNotNone(result)
        self.assertEqual(result["_internal_code"], "ONTOLOGY_MISSING_DIAMETRO")
        self.assertTrue(any('1/2"' in opt for opt in result["options"]))

    def test_tuberia_satisfied(self) -> None:
        """Tubería con diámetro especificado pasa."""
        query = "suministro e instalacion de tuberia pvc 1/2 pulgada para aguas blancas"
        result = evaluate_parametric_ontology_contract(query)
        self.assertIsNone(result)

    def test_bomba_missing_power(self) -> None:
        """Bomba sin HP exige potencia."""
        query = "suministro e instalacion de bomba centrifuga para sistema hidroneumatico"
        result = evaluate_parametric_ontology_contract(query)

        self.assertIsNotNone(result)
        self.assertEqual(result["_internal_code"], "ONTOLOGY_MISSING_POTENCIA")
        self.assertTrue(any("2 HP" in opt for opt in result["options"]))

    def test_validate_rag_signals_integration(self) -> None:
        """Verifica que validate_rag_signals integre de forma transparente la ontología."""
        query = "costruccion de sobrepiso requemado utilizando oxido color negro"
        res = validate_rag_signals(query, candidates=None)

        self.assertIsNotNone(res)
        veredicto, mensaje, codigo, options = res
        self.assertEqual(veredicto, "clarification_needed")
        self.assertEqual(codigo, "ONTOLOGY_MISSING_ESPESOR_AND_TIPO_MEZCLA")
        self.assertTrue(len(options) >= 3)


if __name__ == "__main__":
    unittest.main()
