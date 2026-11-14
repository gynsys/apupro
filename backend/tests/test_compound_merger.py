import unittest
from typing import Any, Dict

from app.services.ai_apu_service_v3.compound_merger import (
    ActivityContribution,
    DEFAULT_FERROUS_PCT,
    merge_activity_apus_to_master_ton,
    resolve_ferrous_pct,
    units_per_master_ton,
)
from app.services.ai_apu_service_v3.delta_applier import _calculate_apu_subtotals


def _make_apu(unit: str, perf: float, mat_qty: float = 2.0) -> Dict[str, Any]:
    apu: Dict[str, Any] = {
        "partida": {"unit": unit, "performance": perf},
        "materials": [{"codigo": "M1", "cantidad": mat_qty, "precio_unitario": 10.0, "desperdicio": 0.0}],
        "equipments": [{"codigo": "E1", "cantidad": 1.0, "precio_unitario": 100.0, "depreciacion": 1.0}],
        "labors": [{"codigo": "L1", "cantidad": 4.0, "jornal": 20.0, "bono": 5.0}],
    }
    _calculate_apu_subtotals(apu)
    return apu


class TestFerrousPct(unittest.TestCase):
    def test_default(self) -> None:
        self.assertEqual(resolve_ferrous_pct(None), DEFAULT_FERROUS_PCT)

    def test_floor_rejected(self) -> None:
        with self.assertRaises(ValueError):
            resolve_ferrous_pct(0.5)

    def test_user_value(self) -> None:
        self.assertEqual(resolve_ferrous_pct(4.0), 4.0)


class TestUnitsPerTon(unittest.TestCase):
    def test_mass_units(self) -> None:
        self.assertAlmostEqual(units_per_master_ton("ton", 1.0, 100.0), 1.0)
        self.assertAlmostEqual(units_per_master_ton("kg", 0.03, 100.0), 30.0)

    def test_volume_uses_density(self) -> None:
        self.assertAlmostEqual(units_per_master_ton("m3", 1.0, 100.0, 2.0), 0.5)

    def test_lump_is_prorated_by_total_tons(self) -> None:
        self.assertAlmostEqual(units_per_master_ton("Gl", 1.0, 500.0), 1.0 / 500.0)

    def test_invalid_inputs(self) -> None:
        with self.assertRaises(ValueError):
            units_per_master_ton("m2", 1.0, 100.0)
        with self.assertRaises(ValueError):
            units_per_master_ton("ton", 1.0, 0.0)
        with self.assertRaises(ValueError):
            units_per_master_ton("ton", 1.5, 100.0)


class TestMerge(unittest.TestCase):
    def test_direct_cost_equals_weighted_sum(self) -> None:
        total_tons = 1000.0
        density = 1.5
        a = _make_apu("m3", 40.0)
        b = _make_apu("ton", 80.0, mat_qty=0.0)
        c = _make_apu("Gl", 0.5, mat_qty=5.0)
        contribs = [
            ActivityContribution("DEMOLICION", a, "m3", 1.0),
            ActivityContribution("FERROSOS", b, "ton", 0.03),
            ActivityContribution("APUNTALAMIENTO", c, "Gl", 1.0),
        ]
        merged = merge_activity_apus_to_master_ton(contribs, total_tons, "demolicion integral", density)

        expected = (
            (1.0 / density) * a["costo_directo"]
            + 0.03 * b["costo_directo"]
            + (1.0 / total_tons) * c["costo_directo"]
        )
        self.assertEqual(merged["partida"]["unit"], "ton")
        self.assertAlmostEqual(merged["costo_directo"], expected, delta=expected * 1e-3)

    def test_trace_and_tags(self) -> None:
        a = _make_apu("ton", 10.0)
        merged = merge_activity_apus_to_master_ton(
            [ActivityContribution("CARGA", a, "ton", 0.97)], 100.0, "carga"
        )
        self.assertTrue(all(m["actividad_origen"] == "CARGA" for m in merged["materials"]))
        self.assertEqual(len(merged["compound_trace"]), 1)

    def test_requires_activities_and_valid_rendimiento(self) -> None:
        with self.assertRaises(ValueError):
            merge_activity_apus_to_master_ton([], 100.0, "x")
        bad = _make_apu("ton", 10.0)
        bad["partida"]["performance"] = 0
        with self.assertRaises(ValueError):
            merge_activity_apus_to_master_ton([ActivityContribution("X", bad, "ton")], 100.0, "x")


if __name__ == "__main__":
    unittest.main()
