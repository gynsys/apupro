import unittest
from typing import Any, Dict, List
from app.services.ai_apu_service.reconciliation.equipment import (
    is_minor_or_manual_tool,
    get_default_minor_tool_deprec,
    enforce_minor_tools_amortization,
    _normalize_equipment_prices,
)


class TestMinorToolsAmortization(unittest.TestCase):
    """
    Suite de pruebas para la regla automática de amortización de herramientas menores
    y manuales en el generador de APUs.
    """

    def test_detection_of_minor_tools(self) -> None:
        """Verifica la detección correcta de herramientas manuales/menores y andamios simples."""
        # Casos positivos
        self.assertTrue(is_minor_or_manual_tool("PALA RECTANGULAR BELLOTA", "EQU-001"))
        self.assertTrue(is_minor_or_manual_tool("PALA REDONDA CON CABO", "ALB081"))
        self.assertTrue(is_minor_or_manual_tool("PICO CON CABO DE MADERA", "ALB072"))
        self.assertTrue(is_minor_or_manual_tool("PIQUETA PUNTA Y PALA", "EQU497"))
        self.assertTrue(is_minor_or_manual_tool("CARRETILLA CAP= 55 LT CAUCHOS DE GOMA", "ALB002"))
        self.assertTrue(is_minor_or_manual_tool("CARRETÓN MANUAL P/VACIADO", "ALB005"))
        self.assertTrue(is_minor_or_manual_tool("ANDAMIO TUBULAR DE UN CUERPO", "SUB023"))
        self.assertTrue(is_minor_or_manual_tool("ANDAMIO COLGANTE", "SUB027"))
        self.assertTrue(is_minor_or_manual_tool("JUEGO DE PALA, MANDARRIA Y CARRETILLA", "ALB084"))
        self.assertTrue(is_minor_or_manual_tool("JUEGO DE PALA, PICO Y CARRETILLA", "ALB013"))
        self.assertTrue(is_minor_or_manual_tool("HERRAMIENTAS MENORES", "ALB004"))
        self.assertTrue(is_minor_or_manual_tool("MANDARRIA DE 5 KG CON CABO", "DEM004"))
        self.assertTrue(is_minor_or_manual_tool("BARRA METALICA DE 1.47 MTS", "ALB048"))
        self.assertTrue(is_minor_or_manual_tool("BARRA PATA DE CABRA", "ALB089"))
        self.assertTrue(is_minor_or_manual_tool("CUCHARA DE ALBAÑIL Y PALUSTRA", "ALB067"))

    def test_exclusion_of_heavy_and_motorized_equipment(self) -> None:
        """Verifica que equipos pesados, motorizados o demoledores eléctricos no se clasifiquen como manuales."""
        # Demoledores eléctricos / rotomartillos
        self.assertFalse(is_minor_or_manual_tool("MARTILLO DEMOLEDOR ELECTRICO GRANDE 30 K", "DEM011"))
        self.assertFalse(is_minor_or_manual_tool("ROTOMARTILLO ELECTRICO BOSCH 11 KG", "DEM005"))
        self.assertFalse(is_minor_or_manual_tool("DEMOLEDOR NEUMATICO", "DEM002"))

        # Maquinaria pesada / vehículos que pudieran contener la palabra pala o rodillo
        self.assertFalse(is_minor_or_manual_tool("RETROEXCAVADORA CON PALA DELANTERA", "MAQ001"))
        self.assertFalse(is_minor_or_manual_tool("MINICARGADOR BOBCAT CON PALA", "MAQ002"))
        self.assertFalse(is_minor_or_manual_tool("CAMION 750 VOLTEO 8 M3", "EQU-PES-750"))
        self.assertFalse(is_minor_or_manual_tool("MEZCLADORA DE CONCRETO TROMPO 1 SACO", "EQ-MIX"))
        self.assertFalse(is_minor_or_manual_tool("VIBRADOR DE CONCRETO A GASOLINA", "EQ-VIB"))
        self.assertFalse(is_minor_or_manual_tool("COMPRESOR DE AIRE 250 CFM", "EQ-COMP"))

    def test_default_depreciation_rates(self) -> None:
        """Verifica que las tasas de amortización asignadas sean coherentes con la práctica de ingeniería."""
        # Andamios: 0.8% diario
        self.assertEqual(get_default_minor_tool_deprec("ANDAMIO TUBULAR DE UN CUERPO"), 0.008)
        # Herramientas de alto desgaste (palas, carretillas, mandarrias, etc.): 2.5% diario
        self.assertEqual(get_default_minor_tool_deprec("JUEGO DE PALA, MANDARRIA Y CARRETILLA"), 0.025)
        self.assertEqual(get_default_minor_tool_deprec("CARRETILLA METALICA 55L"), 0.025)
        self.assertEqual(get_default_minor_tool_deprec("PALA RECTANGULAR BELLOTA"), 0.025)
        # Herramientas generales: 2% diario
        self.assertEqual(get_default_minor_tool_deprec("HERRAMIENTAS MENORES"), 0.02)

    def test_enforce_minor_tools_amortization_alb084(self) -> None:
        """
        Prueba caso real E211SC001:
        ALB084 (Juego de pala, mandarria y carretilla) con deprec=1.0 y PU=$24.91
        debe convertirse a deprec=0.025 y PU=$996.40 manteniendo el costo diario de $24.91.
        """
        apu_result: Dict[str, Any] = {
            "equipments": [
                {
                    "codigo": "ALB048",
                    "descripcion": "BARRA METALICA DE 1.47 MTS",
                    "cantidad": 2.0,
                    "depreciacion": 0.03,
                    "precio_unitario": 127.79,
                },
                {
                    "codigo": "ALB084",
                    "descripcion": "JUEGO DE PALA, MANDARRIA Y CARRETILLA",
                    "cantidad": 5.0,
                    "depreciacion": 1.0,  # Vicio histórico heredado
                    "precio_unitario": 24.91,
                },
                {
                    "codigo": "DEM011",
                    "descripcion": "MARTILLO DEMOLEDOR ELECTRICO GRANDE 30 K",
                    "cantidad": 1.0,
                    "depreciacion": 1.0,  # Alquiler diario legítimo
                    "precio_unitario": 50.0,
                },
            ]
        }

        enforce_minor_tools_amortization(apu_result)

        eqs = apu_result["equipments"]
        alb048 = next(e for e in eqs if e["codigo"] == "ALB048")
        alb084 = next(e for e in eqs if e["codigo"] == "ALB084")
        dem011 = next(e for e in eqs if e["codigo"] == "DEM011")

        # ALB048 ya era equipo propio (< 1.0), se mantiene
        self.assertAlmostEqual(alb048["depreciacion"], 0.03, places=3)
        self.assertAlmostEqual(alb048["precio_unitario"], 127.79, places=2)

        # ALB084 debe convertirse a equipo propio con deprec < 1.0
        self.assertAlmostEqual(alb084["depreciacion"], 0.025, places=3)
        self.assertAlmostEqual(alb084["precio_unitario"], 996.40, places=2)
        # Costo diario equivalente preservado: 996.40 * 0.025 == 24.91
        costo_diario_alb084 = round(alb084["precio_unitario"] * alb084["depreciacion"], 2)
        self.assertAlmostEqual(costo_diario_alb084, 24.91, places=1)

        # DEM011 (martillo eléctrico) NO es herramienta menor: mantiene deprec=1.0 de alquiler
        self.assertAlmostEqual(dem011["depreciacion"], 1.0, places=3)
        self.assertAlmostEqual(dem011["precio_unitario"], 50.0, places=2)

    def test_normalize_equipment_prices_from_base_apu(self) -> None:
        """
        Verifica que al heredar equipos de una partida base antigua con deprec=1.0,
        _normalize_equipment_prices aplique automáticamente la regla.
        """
        base_apu = {
            "equipos": [
                {
                    "codigo": "ALB084",
                    "descripcion": "JUEGO DE PALA, MANDARRIA Y CARRETILLA",
                    "cantidad": 5.0,
                    "depreciacion": 1.0,
                    "precio_unitario": 24.91,
                }
            ]
        }
        generated_result: Dict[str, Any] = {
            "equipments": [
                {
                    "codigo": "ALB084",
                    "descripcion": "JUEGO DE PALA, MANDARRIA Y CARRETILLA",
                    "cantidad": 5.0,
                    "depreciacion": 1.0,
                    "precio_unitario": 24.91,
                }
            ]
        }

        _normalize_equipment_prices(generated_result, base_apu=base_apu)

        eq = generated_result["equipments"][0]
        self.assertLess(eq["depreciacion"], 1.0, "La depreciación no debe ser 1.0")
        self.assertEqual(eq["depreciacion"], 0.025)
        self.assertAlmostEqual(eq["precio_unitario"], 996.40, places=2)


if __name__ == "__main__":
    unittest.main()
