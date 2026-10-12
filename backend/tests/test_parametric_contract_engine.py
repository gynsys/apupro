import os
import sys
import unittest
from typing import Any, Dict

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import app.services.parametric_contract_engine as pce_module
from app.services.parametric_contract_engine.contract_evaluator import (
    evaluate_parametric_contract,
    is_surface_treatment,
    is_demolition_action,
)
from app.services.parametric_contract_engine.taxonomy import (
    find_family_for_prompt,
    normalize_dimension_string,
)


class TestParametricContractEngine(unittest.TestCase):
    """
    Suite de pruebas para verificar el módulo aislado Parametric Contract Engine.
    Verifica contratos data-driven, exclusiones y capacidad de desconexión inmediata.
    """

    def setUp(self) -> None:
        pce_module.ENABLE_PARAMETRIC_ENGINE = True

    def test_switch_desconexion_inmediata(self) -> None:
        """Al apagar ENABLE_PARAMETRIC_ENGINE, no intercepta ninguna consulta (desconexión total)."""
        pce_module.ENABLE_PARAMETRIC_ENGINE = False
        res = evaluate_parametric_contract("vaciado de losa maciza")
        self.assertIsNone(res)

        pce_module.ENABLE_PARAMETRIC_ENGINE = True
        res_active = evaluate_parametric_contract("vaciado de losa maciza")
        self.assertIsNotNone(res_active)
        self.assertEqual(res_active["_internal_code"], "PARAMETRIC_ENGINE_MISSING_LOSA_ESPESOR")

    def test_pintura_en_losas_no_pide_espesor(self) -> None:
        """Pintura impermeabilizante sobre losa no debe pedir espesor de vaciado."""
        query = "Pintura en losas con pintura impermeabilizante elastomérica en exteriores unidad m2"
        res = evaluate_parametric_contract(query)
        self.assertIsNone(res)

    def test_sobrepiso_incompleto_detecta_parametros(self) -> None:
        """Sobrepiso sin espesor ni mortero debe exigir parámetros."""
        query = "Construccion de sobrepiso requemado con oxido negro"
        res = evaluate_parametric_contract(query)
        self.assertIsNotNone(res)
        self.assertEqual(res["_internal_code"], "PARAMETRIC_ENGINE_MISSING_SOBREPISO_PARAMS")

    def test_sobrepiso_completo_pasa(self) -> None:
        """Sobrepiso con espesor y mortero pasa limpio."""
        query = "Construccion de sobrepiso e=3.0 cm con mortero 1:3 en interiores"
        res = evaluate_parametric_contract(query)
        self.assertIsNone(res)

    def test_tuberia_faltante_diametro(self) -> None:
        """Tubería sin diámetro exige diámetro."""
        query = "Suministro e instalacion de tuberia de pvc para aguas blancas"
        res = evaluate_parametric_contract(query)
        self.assertIsNotNone(res)
        self.assertEqual(res["_internal_code"], "PARAMETRIC_ENGINE_MISSING_TUBERIA_DIAMETRO")

    def test_tuberia_con_diametro_pasa(self) -> None:
        """Tubería con 1/2 pulgada pasa sin problemas."""
        query = 'Suministro e instalacion de tuberia pvc 1/2" para aguas blancas'
        res = evaluate_parametric_contract(query)
        self.assertIsNone(res)

    def test_normalizacion_fracciones_excel(self) -> None:
        """Verifica que los artefactos de Excel (1-feb, 3-abr) se traduzcan a pulgadas."""
        self.assertEqual(normalize_dimension_string('1-feb"'), '1/2"')
        self.assertEqual(normalize_dimension_string('3-abr"'), '3/4"')
        self.assertEqual(normalize_dimension_string('5-ago"'), '5/8"')


if __name__ == "__main__":
    unittest.main()
