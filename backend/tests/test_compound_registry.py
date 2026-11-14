import unittest

from app.services.ai_apu_service_v3.compound_merger import (
    ActivityContribution,
    merge_activity_apus_to_master_ton,
    units_per_master_ton,
)
from app.services.ai_apu_service_v3.conversion_registry import MissingConversionData, density_for
from app.services.ai_apu_service_v3.delta_applier import _calculate_apu_subtotals


class TestDensityRegistry(unittest.TestCase):
    def test_in_situ_concrete(self) -> None:
        value, _ = density_for("concreto_armado", "en_sitio")
        self.assertAlmostEqual(value, 2.4)

    def test_loose_applies_swelling(self) -> None:
        value, _ = density_for("concreto_armado", "suelto")
        self.assertAlmostEqual(value, round(2.4 / 1.3, 4))
        self.assertLess(value, 2.4)

    def test_loose_direct_for_mixed_rubble(self) -> None:
        value, _ = density_for("escombro_mixto", "suelto")
        self.assertAlmostEqual(value, 1.35)

    def test_mixed_rubble_in_situ_uses_mixed_building_reference(self) -> None:
        value, note = density_for("escombro_mixto", "en_sitio")
        self.assertAlmostEqual(value, 2.0)
        self.assertIn("2,0 t/m3", note)

    def test_unknown_material_requires_user_data(self) -> None:
        with self.assertRaises(MissingConversionData) as ctx:
            density_for("polvora", "suelto")
        self.assertEqual(ctx.exception.param_key, "density_t_per_m3")

    def test_invalid_state(self) -> None:
        with self.assertRaises(MissingConversionData):
            density_for("tierra", "mojado")


class TestAreaLengthFactors(unittest.TestCase):
    def test_area_without_factor_requests_user_data(self) -> None:
        with self.assertRaises(MissingConversionData):
            units_per_master_ton("m2", 1.0, 100.0)

    def test_area_with_user_factor(self) -> None:
        self.assertAlmostEqual(units_per_master_ton("m2", 1.0, 100.0, units_per_ton_override=2.5), 2.5)

    def test_merge_names_activity_when_data_missing(self) -> None:
        apu = {
            "partida": {"unit": "m2", "performance": 10.0},
            "materials": [], "equipments": [], "labors": [],
        }
        _calculate_apu_subtotals(apu)
        with self.assertRaises(MissingConversionData) as ctx:
            merge_activity_apus_to_master_ton([ActivityContribution("FACHADA", apu, "m2")], 100.0, "macro")
        self.assertEqual(ctx.exception.param_key, "units_per_ton:FACHADA")

    def test_per_activity_density_is_used(self) -> None:
        self.assertAlmostEqual(units_per_master_ton("m3", 1.0, 100.0, 2.0), 0.5)


if __name__ == "__main__":
    unittest.main()
