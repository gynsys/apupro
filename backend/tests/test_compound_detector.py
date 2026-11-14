import unittest
from typing import Any, Dict

from app.services.ai_apu_service_v3.compound_detector import (
    detect_compound_activities,
    validate_detected_activities,
)


def _fake_llm(payload: Dict[str, Any]):
    def _call(**_: Any) -> Dict[str, Any]:
        return payload
    return _call


def _raising_llm(**_: Any) -> Dict[str, Any]:
    raise RuntimeError("LLM caido")


# Macro partida de otro dominio (excavacion y relleno) para demostrar que no es caso-especifico
GENERIC_PAYLOAD: Dict[str, Any] = {
    "is_compound": True,
    "activities": [
        {"tag": "EXCAVACION", "description": "excavacion mecanica de zanja", "unit": "m3",
         "material": "tierra", "state": "en_sitio", "share_kind": "all", "order": 1},
        {"tag": "ACARREO", "description": "carga y bote de material sobrante", "unit": "m3",
         "material": "tierra", "state": "suelto", "share_kind": "all", "order": 2},
        {"tag": "METAL", "description": "separacion de tuberias metalicas", "unit": "kg",
         "material": "acero", "state": "suelto", "share_kind": "ferrous", "order": 3},
    ],
}


class TestCompoundDetector(unittest.TestCase):
    def test_generic_payload_builds_plan_with_units_and_carriers(self) -> None:
        plan = detect_compound_activities("x" * 20, llm_call=_fake_llm(GENERIC_PAYLOAD))
        self.assertTrue(plan.is_compound)
        self.assertEqual([a.tag for a in plan.activities], ["EXCAVACION", "ACARREO", "METAL"])
        self.assertEqual([a.carrier for a in plan.activities], ["volume", "volume", "mass"])

    def test_ferrous_share_uses_pct(self) -> None:
        plan = detect_compound_activities("x" * 20, ferrous_pct=4.0, llm_call=_fake_llm(GENERIC_PAYLOAD))
        self.assertAlmostEqual(plan.activities[2].share, 0.04)
        self.assertAlmostEqual(plan.activities[0].share, 1.0)

    def test_non_ferrous_share_is_complement(self) -> None:
        payload = {"is_compound": True, "activities": [
            {"tag": "A", "description": "actividad uno valida", "unit": "m3", "share_kind": "non_ferrous", "order": 1},
            {"tag": "B", "description": "actividad dos valida", "unit": "ton", "share_kind": "all", "order": 2},
        ]}
        plan = detect_compound_activities("x" * 20, ferrous_pct=3.0, llm_call=_fake_llm(payload))
        self.assertAlmostEqual(plan.activities[0].share, 0.97)

    def test_not_compound(self) -> None:
        plan = detect_compound_activities("x" * 20, llm_call=_fake_llm({"is_compound": False, "activities": []}))
        self.assertFalse(plan.is_compound)

    def test_single_valid_activity_is_not_compound(self) -> None:
        payload = {"is_compound": True, "activities": [
            {"tag": "A", "description": "actividad valida", "unit": "m3", "order": 1}]}
        self.assertFalse(validate_detected_activities(payload, 3.0).is_compound)

    def test_invalid_unit_and_duplicate_tags_discarded(self) -> None:
        payload = {"is_compound": True, "activities": [
            {"tag": "A", "description": "actividad valida uno", "unit": "m3", "order": 1},
            {"tag": "A", "description": "duplicada con mismo tag", "unit": "m3", "order": 2},
            {"tag": "B", "description": "unidad inventada", "unit": "furlong", "order": 3},
            {"tag": "C", "description": "actividad valida dos", "unit": "kg", "order": 4},
        ]}
        plan = validate_detected_activities(payload, 3.0)
        self.assertEqual([a.tag for a in plan.activities], ["A", "C"])

    def test_unit_aliases(self) -> None:
        payload = {"is_compound": True, "activities": [
            {"tag": "A", "description": "actividad valida uno", "unit": "Tn", "order": 1},
            {"tag": "B", "description": "actividad valida dos", "unit": "M³", "order": 2},
        ]}
        plan = validate_detected_activities(payload, 3.0)
        self.assertEqual([a.unit for a in plan.activities], ["ton", "m3"])

    def test_llm_failure_falls_back_to_normal_flow(self) -> None:
        plan = detect_compound_activities("x" * 20, llm_call=_raising_llm)
        self.assertFalse(plan.is_compound)

    def test_pct_below_floor_rejected(self) -> None:
        with self.assertRaises(ValueError):
            detect_compound_activities("x" * 20, ferrous_pct=0.5, llm_call=_fake_llm(GENERIC_PAYLOAD))

    def test_empty_text_rejected(self) -> None:
        with self.assertRaises(ValueError):
            detect_compound_activities("  ", llm_call=_fake_llm(GENERIC_PAYLOAD))

    def test_shoring_ambiguity_triggers_question_when_unspecified(self) -> None:
        payload = {
            "is_compound": True,
            "activities": [
                {
                    "tag": "APUNTALAMIENTO",
                    "description": "APUNTALAMIENTO TEMPORAL DE SEGURIDAD METALICO O DE MADERA",
                    "unit": "m2",
                    "material": "concreto_armado",
                    "state": "en_sitio",
                    "share_kind": "all",
                    "order": 1,
                },
                {
                    "tag": "DEMOLICION",
                    "description": "DEMOLICION MECANICA DE EDIFICACION",
                    "unit": "m3",
                    "material": "concreto_armado",
                    "state": "en_sitio",
                    "share_kind": "all",
                    "order": 2,
                },
            ],
        }
        user_desc = "Demolicion integral por medios mecanicos incluyendo apuntalamiento temporal de seguridad"
        plan = detect_compound_activities(user_desc, llm_call=_fake_llm(payload))
        shoring = plan.activities[0]
        self.assertIsNotNone(shoring.ambiguity_question)
        self.assertGreaterEqual(len(shoring.ambiguity_options), 2)
        self.assertNotIn("MADERA", shoring.description)

    def test_shoring_ambiguity_resolved_when_user_specifies_metallic_props(self) -> None:
        payload = {
            "is_compound": True,
            "activities": [
                {
                    "tag": "APUNTALAMIENTO",
                    "description": "APUNTALAMIENTO TEMPORAL DE SEGURIDAD",
                    "unit": "m2",
                    "material": "concreto_armado",
                    "state": "en_sitio",
                    "share_kind": "all",
                    "order": 1,
                },
                {
                    "tag": "DEMOLICION",
                    "description": "DEMOLICION MECANICA DE EDIFICACION",
                    "unit": "m3",
                    "material": "concreto_armado",
                    "state": "en_sitio",
                    "share_kind": "all",
                    "order": 2,
                },
            ],
        }
        user_desc = "Demolicion integral incluyendo apuntalamiento temporal de seguridad, con puntales metalicos telescopicos"
        plan = detect_compound_activities(user_desc, llm_call=_fake_llm(payload))
        shoring = plan.activities[0]
        self.assertIsNone(shoring.ambiguity_question)
        self.assertIn("PUNTALES METALICOS TELESCOPICOS", shoring.description)
        self.assertEqual(shoring.material, "acero_estructural")


if __name__ == "__main__":
    unittest.main()
