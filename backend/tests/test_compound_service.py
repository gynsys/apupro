import unittest

from app.services.ai_apu_service_v3.compound_service import (
    _resolve_indicator,
    _units_are_equivalent,
    base_affinity,
)
from app.services.ai_apu_service_v3.conversion_registry import MissingConversionData
from app.services.ai_apu_service_v3.schemas import ActivityScope


def _act(tag: str = "X", material: str = "tierra", state: str = "suelto") -> ActivityScope:
    return ActivityScope(tag=tag, description="actividad de prueba", material=material, state=state)


class TestBaseAffinity(unittest.TestCase):
    def test_matching_base_scores_high(self) -> None:
        score = base_affinity(
            "DEMOLICION INTEGRAL MECANICA DE EDIFICACION EXISTENTE",
            "DEMOLICION DE EDIFICIOS CON EQUIPO PESADO S/RECUPERAC. EXCLUYE EL BOTE",
        )
        self.assertGreaterEqual(score, 0.25)

    def test_unrelated_base_scores_low(self) -> None:
        score = base_affinity(
            "APUNTALAMIENTO TEMPORAL DE SEGURIDAD DE EDIFICACION EXISTENTE",
            "APUNTALAMIENTO CON MADERA PARA SOSTENIMIENTO DE ELEMENTOS ESTRUCTURALES PARA VACIADO EN PUENTE",
        )
        self.assertLess(score, 0.6)

    def test_empty_activity(self) -> None:
        self.assertEqual(base_affinity("", "algo"), 0.0)


class TestResolveIndicator(unittest.TestCase):
    def test_mass_and_lump_need_no_data(self) -> None:
        self.assertIsNone(_resolve_indicator(_act(), "kgf", "x", None, {})["density"])
        self.assertIn("suma global", _resolve_indicator(_act(), "gl", "x", None, {})["source"])

    def test_volume_uses_table_then_user_override(self) -> None:
        from_table = _resolve_indicator(_act(material="tierra"), "m3", "x", None, {})
        self.assertGreater(from_table["density"], 0)
        from_user = _resolve_indicator(_act(), "m3", "x", 2.0, {})
        self.assertEqual(from_user["density"], 2.0)

    def test_area_uses_library_default_when_matching(self) -> None:
        ind = _resolve_indicator(_act(tag="DEMO"), "m2", "DEMOLICION DE EDIFICIOS CON EQUIPO PESADO", None, {})
        self.assertAlmostEqual(ind["override"], round(1.0 / 0.90, 4))
        self.assertIn("biblioteca de literatura", ind["source"])

    def test_area_requires_indication_when_unmatched(self) -> None:
        with self.assertRaises(MissingConversionData) as ctx:
            _resolve_indicator(_act(tag="PINT"), "m2", "PINTURA DE CAUCHO EN PAREDES", None, {})
        self.assertEqual(ctx.exception.param_key, "units_per_ton:PINT")

    def test_user_factor_wins(self) -> None:
        ind = _resolve_indicator(_act(tag="DEMO"), "m2", "DEMOLICION DE EDIFICIOS", None, {"DEMO": 3.5})
        self.assertEqual(ind["override"], 3.5)

    def test_unknown_material_in_volume_requests_density(self) -> None:
        with self.assertRaises(MissingConversionData) as ctx:
            _resolve_indicator(_act(material="polvora"), "m3", "x", None, {})
        self.assertEqual(ctx.exception.param_key, "density_t_per_m3")

    def test_unit_equivalence(self) -> None:
        self.assertTrue(_units_are_equivalent("kgf", "kg"))
        self.assertTrue(_units_are_equivalent("Tn", "ton"))
        self.assertFalse(_units_are_equivalent("m2", "m3"))


if __name__ == "__main__":
    unittest.main()
