import os
import sys
import unittest
from typing import Any, Dict, List
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.budget_import import description_enricher as enricher


def _candidate(code: str, description: str, unit: str = "M3", score: float = 0.8) -> Dict[str, Any]:
    return {
        "cod_par": code,
        "cov_par": f"COV-{code}",
        "description": description,
        "unit": unit,
        "score": score,
        "match_type": "description",
    }


class TestDescriptionEnricher(unittest.TestCase):
    """Valida la elección COVENIN + redacción IA y sus degradaciones seguras."""

    def setUp(self) -> None:
        self.candidates: List[Dict[str, Any]] = [
            _candidate("A1", "EXCAVACION MANUAL EN TIERRA PARA ZANJAS HASTA 1.50 M DE PROFUNDIDAD"),
            _candidate("A2", "RELLENO COMPACTADO CON MATERIAL DE EXCAVACION", score=0.5),
        ]

    def test_find_invented_numbers_detects_values_not_in_sources(self) -> None:
        invented = enricher.find_invented_numbers(
            "EXCAVACION DE ZANJA HASTA 2.50 M", "excavacion de zanja", "HASTA 1.50 M"
        )
        self.assertEqual(invented, ["2.50"])

    def test_find_invented_numbers_accepts_comma_decimals(self) -> None:
        self.assertEqual(
            enricher.find_invented_numbers("PARED E=0.15 M", "pared e=0,15 m"),
            [],
        )

    def test_parse_accepts_valid_response_with_chosen_candidate(self) -> None:
        data = {
            "cod_par": "A1",
            "descripcion_final": "excavacion manual en tierra para zanjas hasta 1.50 m de profundidad",
            "confianza": "alta",
            "motivo": "Coincide acción y elemento.",
        }
        result = enricher.parse_enrich_response(data, "excavacion de zanja", self.candidates)
        self.assertEqual(result["source"], "covenin_ia")
        self.assertEqual(result["base_candidate"]["cod_par"], "A1")
        self.assertTrue(result["suggested_description"].isupper())
        self.assertTrue(result["ai_used"])

    def test_parse_ignores_code_outside_candidates(self) -> None:
        data = {"cod_par": "ZZZ", "descripcion_final": "EXCAVACION DE ZANJA", "confianza": "alta"}
        result = enricher.parse_enrich_response(data, "excavacion de zanja", self.candidates)
        self.assertEqual(result["source"], "ia")
        self.assertIsNone(result["base_candidate"])

    def test_parse_rejects_invented_numbers(self) -> None:
        data = {"cod_par": None, "descripcion_final": "CONCRETO F'C=250 KG/CM2 EN LOSA"}
        with self.assertRaises(ValueError):
            enricher.parse_enrich_response(data, "concreto en losa", [])

    def test_parse_rejects_empty_and_non_dict(self) -> None:
        with self.assertRaises(ValueError):
            enricher.parse_enrich_response({"descripcion_final": ""}, "x", [])
        with self.assertRaises(ValueError):
            enricher.parse_enrich_response([], "x", [])

    def test_prompt_contains_candidates_and_anti_invention_rule(self) -> None:
        prompt = enricher.build_enrich_prompt("excavacion de zanja", "M3", self.candidates)
        self.assertIn("A1", prompt)
        self.assertIn("NUNCA inventes valores numéricos", prompt)

    @patch.object(enricher, "find_candidates")
    @patch.object(enricher, "call_llm_json")
    def test_enrich_uses_ai_result(self, mock_llm: MagicMock, mock_find: MagicMock) -> None:
        mock_find.return_value = self.candidates
        mock_llm.return_value = {
            "cod_par": "A1",
            "descripcion_final": "EXCAVACION MANUAL EN TIERRA PARA ZANJAS HASTA 1.50 M DE PROFUNDIDAD",
            "confianza": "alta",
            "motivo": "ok",
        }
        result = enricher.enrich_description(MagicMock(), "excavacion de zanja", "M3")
        self.assertTrue(result["ai_used"])
        self.assertEqual(len(result["candidates"]), 2)

    @patch.object(enricher, "find_candidates")
    @patch.object(enricher, "call_llm_json", side_effect=RuntimeError("sin proveedores"))
    def test_enrich_falls_back_to_official_covenin_when_ai_fails(
        self, mock_llm: MagicMock, mock_find: MagicMock
    ) -> None:
        mock_find.return_value = self.candidates
        result = enricher.enrich_description(MagicMock(), "excavacion de zanja", "M3")
        self.assertFalse(result["ai_used"])
        self.assertEqual(result["source"], "covenin")
        self.assertIn("EXCAVACION MANUAL", result["suggested_description"])
        self.assertTrue(result["warnings"])

    @patch.object(enricher, "find_candidates", return_value=[])
    @patch.object(enricher, "call_llm_json", side_effect=RuntimeError("sin proveedores"))
    def test_enrich_without_candidates_and_without_ai_returns_empty(
        self, mock_llm: MagicMock, mock_find: MagicMock
    ) -> None:
        result = enricher.enrich_description(MagicMock(), "algo muy raro", "UND")
        self.assertEqual(result["source"], "none")
        self.assertEqual(result["suggested_description"], "")

    @patch.object(enricher, "find_candidates")
    @patch.object(enricher, "call_llm_json")
    def test_enrich_without_ai_plan_skips_llm(self, mock_llm: MagicMock, mock_find: MagicMock) -> None:
        mock_find.return_value = self.candidates
        result = enricher.enrich_description(MagicMock(), "excavacion de zanja", "M3", use_ai=False)
        mock_llm.assert_not_called()
        self.assertEqual(result["source"], "covenin")

    def test_enrich_rejects_too_short_description(self) -> None:
        with self.assertRaises(ValueError):
            enricher.enrich_description(MagicMock(), "ab", "M2")


if __name__ == "__main__":
    unittest.main()
