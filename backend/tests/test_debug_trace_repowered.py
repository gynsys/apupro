import os
import sys
import unittest
from typing import Any, Dict, List
from unittest.mock import MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.apu_labor_calibrator import calibrate_apu_crew_and_equipment
from app.services.ai_apu_service.domain_rules.discordant_pruning import enforce_discordant_inputs_purging
from app.services.ai_apu_service.rag_context.candidates import _apply_technical_scoring_adjustments_detailed
from app.services.ai_apu_service.reconciliation.materials import _execute_material_reconciliation
from app.services.ai_apu_service.reconciliation.equipment import _execute_equipment_reconciliation
from app.services.ai_apu_service.reconciliation.labor import _execute_labor_reconciliation


class TestDebugTraceRepowered(unittest.TestCase):
    """
    Pruebas unitarias para verificar la generación exhaustiva y estructurada
    de trazabilidad en el archivo de Debug JSON (Repotenciación Diagnóstica).
    """

    def test_candidates_scoring_breakdown_structure(self) -> None:
        """Verifica que el desglose de scoring RAG contenga todos los factores matemáticos."""
        query = "bomba centrifuga de 5 hp"
        item_desc = "suministro e instalacion de split de aire acondicionado 12000 btu"
        base_hybrid = {
            "score": 0.75,
            "sem_score": 0.80,
            "lex_score": 0.70,
        }
        final_score, breakdown = _apply_technical_scoring_adjustments_detailed(
            query_text=query,
            item_desc=item_desc,
            current_score=0.75,
            base_hybrid_info=base_hybrid,
            prefix_bonus=0.05,
        )

        self.assertIsInstance(breakdown, dict)
        self.assertIn("raw_hybrid_score", breakdown)
        self.assertIn("sem_score", breakdown)
        self.assertIn("lex_score", breakdown)
        self.assertIn("prefix_bonus", breakdown)
        self.assertIn("polarity_penalty", breakdown)
        self.assertIn("discipline_adjustment", breakdown)
        self.assertIn("action_bonus", breakdown)
        self.assertIn("final_score", breakdown)
        self.assertIn("detalles_ajustes", breakdown)

        # Conflicto hidráulica vs HVAC debe penalizar con -0.40
        self.assertLessEqual(breakdown["discipline_adjustment"], -0.30)
        self.assertEqual(breakdown["prefix_bonus"], 0.05)

    def test_calibrator_trace_attached_to_result(self) -> None:
        """Verifica que calibrate_apu_crew_and_equipment inyecte debug_calibrator_trace."""
        raw_apu: Dict[str, Any] = {
            "status": "completed",
            "partida": {
                "cod_par": "E411SC001",
                "description": "CONSTRUCCION DE PARED DE BLOQUE DE ARCILLA E=15CM",
                "unit": "m2",
                "quantity": 1.0,
                "performance": 150.0,  # Rendimiento extremo que debe recalibrarse
            },
            "labors": [
                {"codigo": "19-2.2", "descripcion": "ALBAÑIL DE 1RA", "cantidad": 1.0, "jornal": 3.0, "bono": 3.22},
                {"codigo": "1-1.2", "descripcion": "AYUDANTE DE CONSTRUCCION", "cantidad": 1.0, "jornal": 2.44, "bono": 3.22},
            ],
            "equipments": [
                {"codigo": "ALB050", "descripcion": "EQUIPO LIVIANO DE ALBAÑILERIA", "cantidad": 1.0, "depreciacion": 1.0, "precio_unitario": 20.0}
            ],
            "notas_adaptacion": [],
            "advertencias": []
        }

        calibrated = calibrate_apu_crew_and_equipment(raw_apu)
        self.assertIn("debug_calibrator_trace", calibrated)
        trace = calibrated["debug_calibrator_trace"]

        self.assertEqual(trace["tipologia_constructiva"], "ALBANILERIA")
        self.assertEqual(trace["unidad"], "m2")
        self.assertTrue(trace["ajuste_rendimiento_aplicado"])
        self.assertIn("metricas_horas_hombre", trace)
        hh = trace["metricas_horas_hombre"]
        self.assertTrue(hh["benchmark_encontrado"])
        self.assertIn("p10", hh["benchmark_aplicado"])
        self.assertIn("mediana_p50", hh["benchmark_aplicado"])

    def test_pruning_trace_attached_to_result(self) -> None:
        """Verifica que enforce_discordant_inputs_purging inyecte debug_pruning_trace con detalle."""
        raw_apu: Dict[str, Any] = {
            "status": "completed",
            "materials": [
                {"codigo": "MAT-01", "descripcion": "BOMBA CENTRIFUGA 5 HP", "cantidad": 1.0},
                {"codigo": "MAT-02", "descripcion": "CILINDRO DE OXIGENO INDUSTRIAL", "cantidad": 1.0},
                {"codigo": "MAT-03", "descripcion": "GAS REFRIGERANTE R-410A", "cantidad": 1.0},
                {"codigo": "MAT-01", "descripcion": "BOMBA CENTRIFUGA 5 HP", "cantidad": 1.0},  # Duplicado
            ],
            "equipments": [
                {"codigo": "EQ-01", "descripcion": "EQUIPO DE OXICORTE COMPLETO", "cantidad": 1.0},
                {"codigo": "EQ-02", "descripcion": "SENORITA DE CADENA DE 5 TON", "cantidad": 1.0},
            ],
            "advertencias": [
                "Verificar precio de BOMBA CENTRIFUGA",
                "Verificar precio de BOMBA CENTRIFUGA",  # Duplicada
            ]
        }

        enforce_discordant_inputs_purging(raw_apu, "desmontaje de bomba centrifuga de 3 hp", {})
        self.assertIn("debug_pruning_trace", raw_apu)
        pt = raw_apu["debug_pruning_trace"]

        self.assertGreater(pt["total_eliminados"], 0)
        self.assertGreaterEqual(len(pt["insumos_purgados"]), 2)
        self.assertGreaterEqual(len(pt["equipos_purgados"]), 1)

        # Regla ZERO_SUPPLY_DESMONTAJE y DEDUPLICACION deben estar registradas
        reglas_purgadas = {item["regla"] for item in pt["insumos_purgados"]}
        self.assertIn("ZERO_SUPPLY_DESMONTAJE", reglas_purgadas)

    def test_reconciliation_trace_attached_to_result(self) -> None:
        """Verifica que la reconciliación clasifique insumos en reconciliados vs referenciales."""
        mock_db = MagicMock()
        # Simular coincidencia para cemento
        mock_mat_row = MagicMock()
        mock_mat_row.CodMat = "C-0001"
        mock_mat_row.ref_code = "CEM001"
        mock_mat_row.Descri = "CEMENTO PORTLAND GRIS"
        mock_mat_row.UniMat = "saco"
        mock_mat_row.CosMat = 8.50

        # Para cemento encuentra mock_mat_row, para óxido no encuentra
        def execute_side_effect(sql: Any, params: Dict[str, Any]) -> Any:
            mock_res = MagicMock()
            if "CEMENTO" in str(params.get("c", "")).upper() or "C-0001" in str(params.get("c", "")).upper():
                mock_res.fetchone.return_value = mock_mat_row
                mock_res.fetchall.return_value = [mock_mat_row]
            else:
                mock_res.fetchone.return_value = None
                mock_res.fetchall.return_value = []
            return mock_res

        mock_db.execute.side_effect = execute_side_effect

        raw_apu: Dict[str, Any] = {
            "materials": [
                {"codigo": "C-0001", "descripcion": "CEMENTO GRIS", "cantidad": 10.0, "precio_unitario": 8.0, "origen": "ia"},
                {"codigo": "MAT-IA-01", "descripcion": "OXIDO DE HIERRO COLOR NEGRO", "cantidad": 2.0, "precio_unitario": 4.5, "origen": "ia"}
            ]
        }

        _execute_material_reconciliation(raw_apu, mock_db)
        self.assertIn("debug_reconciliation_trace", raw_apu)
        rt = raw_apu["debug_reconciliation_trace"]["materiales"]

        self.assertEqual(rt["total_insumos"], 2)
        self.assertEqual(len(rt["reconciliados_historico"]), 1)
        self.assertEqual(len(rt["mantenidos_referencial"]), 1)
        self.assertEqual(rt["reconciliados_historico"][0]["cod_mat"], "C-0001")
        self.assertEqual(rt["mantenidos_referencial"][0]["descripcion"], "OXIDO DE HIERRO COLOR NEGRO")


if __name__ == "__main__":
    unittest.main()
