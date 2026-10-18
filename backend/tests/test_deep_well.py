"""
test_deep_well.py
Pruebas unitarias para salvaguardas de pozos profundos y equipos de bombeo electromecánico.
Valida la purga de carretillas (inoperativas para pozos) y la garantía de vehículos de transporte (pick-up / camión 350).
"""

import os
import sys
import unittest
from typing import Any, Dict

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.ai_apu_service.domain_rules.deep_well import _enforce_deep_well_dimensions


class TestDeepWellEquipments(unittest.TestCase):
    """Pruebas de salvaguarda de equipos para bombas de pozo profundo."""

    def test_wheelbarrow_purged_and_pickup_guaranteed(self) -> None:
        """
        Caso del usuario (APU E511SC001):
        Si el LLM genera una carretilla para un pozo profundo y olvida el vehículo de transporte,
        la regla determinista debe purgar la carretilla e inyectar la camioneta pick-up.
        """
        apu_result: Dict[str, Any] = {
            "partida": {
                "description": "SUMINISTRO E INSTALACIÓN DE BOMBA CENTRÍFUGA SUMERGIBLE PARA POZO PROFUNDO, 5 HP",
                "unit": "und",
            },
            "materials": [
                {
                    "descripcion": "BOMBA SUMERGIBLE PARA POZO PROFUNDO 5 HP",
                    "unidad": "und",
                    "cantidad": 1.0,
                }
            ],
            "equipments": [
                {
                    "descripcion": "HERRAMIENTAS DE PLOMERÍA Y ELÉCTRICAS",
                    "unidad": "día",
                    "cantidad": 1.0,
                    "precio_unitario": 200.0,
                },
                {
                    "descripcion": "TECLE MANUAL DE 1 TONELADA PARA IZAJE DE BOMBA",
                    "unidad": "día",
                    "cantidad": 1.0,
                    "precio_unitario": 150.0,
                },
                {
                    "descripcion": "CARRETILLA PARA ACARREO DE MATERIALES",
                    "unidad": "día",
                    "cantidad": 1.0,
                    "precio_unitario": 50.0,
                },
            ],
            "advertencias": [
                "[PRECIO_REFERENCIAL] Equipo incorporado: 'CARRETILLA PARA ACARREO DE MATERIALES' ($50.00 USD)."
            ]
        }

        user_desc = "Suministro e instalación de bombas de agua Potencia 5 HP pozo profundo Todo incluido unidad und"
        _enforce_deep_well_dimensions(apu_result, user_desc)

        equipments = apu_result["equipments"]
        # 1. Carretilla debe haber sido purgada
        self.assertFalse(any("CARRETILL" in str(eq.get("descripcion", "")).upper() for eq in equipments))

        # 2. Advertencia de carretilla debe haber sido eliminada
        self.assertFalse(any("CARRETILLA" in a for a in apu_result.get("advertencias", [])))

        # 3. Vehículo de transporte (Camioneta Pick-Up o Camión 350) debe estar presente
        has_vehicle = any(
            any(k in str(eq.get("descripcion", "")).upper() for k in ("CAMIONETA", "PICK-UP", "CAMION 350", "CAMIÓN 350"))
            for eq in equipments
        )
        self.assertTrue(has_vehicle, "El APU de pozo profundo debe incluir vehículo de transporte (Pick-up / Camión 350)")


if __name__ == "__main__":
    unittest.main()
