"""
Unit and Integration Test Suite for AI APU Service v3.0 (Best-Match Base Selection + Delta Patching).
"""

import unittest
from typing import Any, Dict
from unittest.mock import MagicMock, patch

from app.services.ai_apu_service.domain_rules.discordant_pruning import (
    enforce_discordant_inputs_purging,
)
from app.services.ai_apu_service.domain_rules.parametric_ontology import (
    evaluate_parametric_ontology_contract,
)
from app.services.ai_apu_service_v3.delta_applier import (
    _apply_equipment_deltas,
    _apply_labor_deltas,
    _apply_material_deltas,
    apply_v3_deltas_to_base_apu,
)
from app.services.ai_apu_service_v3.schemas import (
    V3AdaptationPlan,
    V3EquipmentDeltaOp,
    V3LaborDeltaOp,
    V3MaterialDeltaOp,
)
from app.services.ai_apu_service_v3.selector_planner import (
    _format_candidate_recipe_summary,
    plan_v3_selection_and_deltas,
)


class TestV3Engine(unittest.TestCase):
    """Pruebas unitarias del Motor v3.0 (Selección de Mejor Partida Base + Ajustes Delta)."""

    def setUp(self) -> None:
        self.sample_base_apu: Dict[str, Any] = {
            "codpar": "E411011015",
            "covenin": "E411.011.015",
            "descripcion": "CONSTRUCCION DE PAREDES DE BLOQUES HUECOS DE ARCILLA ACABADO CORRIENTE E=15 CM",
            "unidad": "m2",
            "rendimiento": 16.0,
            "materiales": [
                {
                    "codigo": "BLO001",
                    "descripcion": "BLOQUE DE ARCILLA E=15 CM (15X20X40)",
                    "unidad": "und",
                    "cantidad": 12.5,
                    "desperdicio": 5.0,
                    "precio_unitario": 0.45,
                },
                {
                    "codigo": "CEM001",
                    "descripcion": "CEMENTO PORTLAND GRIS TIPO I (SACO 42.5 KG)",
                    "unidad": "saco",
                    "cantidad": 0.18,
                    "desperdicio": 3.0,
                    "precio_unitario": 9.50,
                },
                {
                    "codigo": "ARE001",
                    "descripcion": "ARENA LAVADA",
                    "unidad": "m3",
                    "cantidad": 0.025,
                    "desperdicio": 5.0,
                    "precio_unitario": 22.00,
                },
            ],
            "equipos": [
                {
                    "codigo": "HER001",
                    "descripcion": "HERRAMIENTAS MENORES",
                    "cantidad": 1.0,
                    "depreciacion": 0.02,
                    "precio_unitario": 50.0,
                },
                {
                    "codigo": "AND001",
                    "descripcion": "ANDAMIO TUBULAR",
                    "cantidad": 1.0,
                    "depreciacion": 0.01,
                    "precio_unitario": 180.0,
                },
            ],
            "mano_obra": [
                {
                    "codigo": "MO001",
                    "descripcion": "ALBAÑIL DE 1RA",
                    "cantidad": 1.0,
                    "jornal": 25.0,
                    "bono": 5.0,
                },
                {
                    "codigo": "MO002",
                    "descripcion": "AYUDANTE",
                    "cantidad": 1.0,
                    "jornal": 15.0,
                    "bono": 3.0,
                },
            ],
        }

    def test_candidate_recipe_formatting(self) -> None:
        """Verifica que el resumen de cada candidata exponga su código, rendimiento e insumos reales."""
        summary = _format_candidate_recipe_summary(1, 0.85, self.sample_base_apu)
        self.assertIn('codpar="E411011015"', summary)
        self.assertIn("[BLO001] BLOQUE DE ARCILLA E=15 CM", summary)
        self.assertIn("[MO001] ALBAÑIL DE 1RA", summary)

    def test_surgical_material_deltas_preserve_untouched_items(self) -> None:
        """Verifica que al reemplazar un material y agregar otro, el resto quede 100% intacto."""
        ops = [
            V3MaterialDeltaOp(
                op="replace",
                target_code="BLO001",
                new_description="BLOQUE DE CONCRETO E=15 CM",
                new_unit="und",
                new_quantity=12.5,
                new_waste_pct=5.0,
                estimated_price_usd=0.65,
                reason="Solicitud de bloque de concreto en lugar de arcilla",
            ),
            V3MaterialDeltaOp(
                op="add",
                new_description="ADITIVO IMPERMEABILIZANTE EN POLVO PARA MORTERO",
                new_unit="kgf",
                new_quantity=0.35,
                estimated_price_usd=3.20,
                reason="Impermeabilización del mortero solicitada por el usuario",
            ),
        ]
        log = []
        updated_mats = _apply_material_deltas(self.sample_base_apu["materiales"], ops, log)

        self.assertEqual(len(updated_mats), 4)
        # El bloque fue reemplazado en la posición 0
        self.assertEqual(updated_mats[0]["descripcion"], "BLOQUE DE CONCRETO E=15 CM")
        self.assertEqual(updated_mats[0]["origen"], "ia")
        # El cemento y la arena no se tocaron en absoluto
        self.assertEqual(updated_mats[1]["codigo"], "CEM001")
        self.assertEqual(updated_mats[1]["precio_unitario"], 9.50)
        self.assertEqual(updated_mats[2]["codigo"], "ARE001")
        self.assertEqual(updated_mats[2]["precio_unitario"], 22.00)
        # El aditivo fue agregado al final
        self.assertEqual(updated_mats[3]["descripcion"], "ADITIVO IMPERMEABILIZANTE EN POLVO PARA MORTERO")
        self.assertEqual(len(log), 2)

    @patch("app.services.ai_apu_service_v3.delta_applier.reconcile_materials_with_database")
    @patch("app.services.ai_apu_service_v3.delta_applier.reconcile_equipment_with_database")
    @patch("app.services.ai_apu_service_v3.delta_applier.reconcile_labor_with_database")
    def test_apply_v3_deltas_end_to_end(
        self,
        mock_rec_lab: MagicMock,
        mock_rec_eq: MagicMock,
        mock_rec_mat: MagicMock,
    ) -> None:
        """Verifica que apply_v3_deltas_to_base_apu preserve rendimiento, cuadrilla e insumos históricos intactos."""
        mock_db = MagicMock()
        plan = V3AdaptationPlan(
            selected_codpar="E411011015",
            selection_reason="Misma actividad de mampostería e=15cm, solo cambia el material del bloque.",
            adapted_description="CONSTRUCCION DE PAREDES DE BLOQUES DE CONCRETO ACABADO CORRIENTE E=15 CM",
            target_unit="m2",
            keep_base_performance=True,
            material_ops=[
                V3MaterialDeltaOp(
                    op="replace",
                    target_code="BLO001",
                    new_description="BLOQUE DE CONCRETO E=15 CM",
                    new_unit="und",
                    new_quantity=12.5,
                    new_waste_pct=5.0,
                    estimated_price_usd=0.60,
                    reason="Sustitución de bloque de arcilla por bloque de concreto",
                )
            ],
            equipment_ops=[],
            labor_ops=[],
            technical_assumptions=["Se preserva mortero de pega y cuadrilla oficial COVENIN."],
        )

        result, latency_ms = apply_v3_deltas_to_base_apu(
            plan=plan,
            base_apu=self.sample_base_apu,
            user_description="Construcción de pared de bloques de concreto e=15cm",
            db=mock_db,
            requested_unit="m2",
        )

        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["generation_engine"], "v3_delta")
        self.assertEqual(result["partida"]["performance"], 16.0)
        self.assertEqual(result["partida"]["unit"], "m2")
        self.assertTrue(result["partida"]["cod_par"].endswith("SC001"))
        # Equipos y mano de obra quedaron intactos con origen='historico'
        self.assertEqual(len(result["equipments"]), 2)
        self.assertEqual(result["equipments"][0]["origen"], "historico")
        self.assertEqual(len(result["labors"]), 2)
        self.assertEqual(result["labors"][0]["origen"], "historico")
        self.assertGreater(result["costo_directo"], 0.0)
        self.assertGreaterEqual(latency_ms, 0.0)

    @patch("app.services.ai_apu_service_v3.selector_planner.call_llm_json")
    def test_selector_picks_best_candidate_even_if_not_first(self, mock_llm: MagicMock) -> None:
        """Verifica que la IA pueda elegir la candidata #2 o #3 como mejor molde constructivo."""
        cand_1 = {
            "codpar": "E611001",
            "score": 0.82,
            "apu": {
                "codpar": "E611001",
                "covenin": "E611.001",
                "descripcion": "TUBERIA DE AGUAS BLANCAS PVC ENTERRADA EN ZANJA D=2 PULG",
                "unidad": "m",
                "rendimiento": 25.0,
                "materiales": [],
                "equipos": [],
                "mano_obra": [],
            },
        }
        cand_2 = {
            "codpar": "E611009",
            "score": 0.77,
            "apu": self.sample_base_apu,
        }

        mock_llm.return_value = {
            "selected_codpar": "E411011015",
            "selection_reason": "La candidata #2 corresponde exactamente a la mampostería solicitada.",
            "adapted_description": "CONSTRUCCION DE PAREDES DE BLOQUES DE ARCILLA E=15 CM",
            "target_unit": "m2",
            "keep_base_performance": True,
            "material_ops": [],
            "equipment_ops": [],
            "labor_ops": [],
            "technical_assumptions": [],
        }

        plan, selected_apu, _, _ = plan_v3_selection_and_deltas(
            user_description="Construcción de pared de bloques de arcilla e=15cm",
            enriched_candidates=[cand_1, cand_2],
            requested_unit="m2",
        )

        self.assertEqual(plan.selected_codpar, "E411011015")
        self.assertEqual(selected_apu["codpar"], "E411011015")

    def test_remocion_manto_asks_winche_clarification(self) -> None:
        """Verifica que 'Remoción de manto asfáltico' sin especificar logística pregunte por el winche."""
        eval_missing = evaluate_parametric_ontology_contract("Remoción de manto asfáltico en azotea", "m2")
        self.assertIsNotNone(eval_missing)
        self.assertEqual(eval_missing["status"], "clarification_needed")
        self.assertIn("winche", eval_missing["questions"][0].lower())

        # Al responder 'Sin winche ni camión', ya cumple el contrato ontológico
        eval_complete = evaluate_parametric_ontology_contract(
            "Remoción de manto asfáltico en azotea, Sin winche ni camión (remoción manual y apilado en obra)",
            "m2",
        )
        self.assertIsNone(eval_complete)

    def test_other_ambiguous_equipment_clarifications(self) -> None:
        """Verifica aclaratorias para demolición, impermeabilización, desmontaje, compactación y altura."""
        # Demolición sin método
        dem_eval = evaluate_parametric_ontology_contract("Demolición de losa de concreto e=15 cm", "m2")
        self.assertIsNotNone(dem_eval)
        self.assertIn("equipo", dem_eval["questions"][0].lower())

        # Impermeabilización con manto 4mm pero sin definir winche
        imp_eval = evaluate_parametric_ontology_contract("Impermeabilización de techo con manto asfáltico 4 mm", "m2")
        self.assertIsNotNone(imp_eval)
        self.assertIn("winche", imp_eval["questions"][0].lower())

        # Compactación sin definir pisón manual vs vibrocompactador
        comp_eval = evaluate_parametric_ontology_contract("Compactación de relleno en zanjas", "m3")
        self.assertIsNotNone(comp_eval)
        self.assertIn("vibrocompactador", comp_eval["questions"][0].lower())

        # Limpieza de fachada sin definir método (manual vs hidrolavadora)
        limp_eval = evaluate_parametric_ontology_contract("Limpieza y lavado de fachada de ladrillo", "m2")
        self.assertIsNotNone(limp_eval)
        self.assertIn("hidrolavadora", limp_eval["questions"][0].lower())

    def test_15_ambiguous_equipments_purged_by_default(self) -> None:
        """Verifica que los 15 equipos de logística pesada/ambigua se depuren si no fueron solicitados."""
        apu_heavy: Dict[str, Any] = {
            "materials": [],
            "equipments": [
                {"codigo": "E1", "descripcion": "PLANTA ELECTRICA 15 KVA", "cantidad": 0.2},
                {"codigo": "E2", "descripcion": "BOMBA DE ACHIQUE A GASOLINA 3 PULG", "cantidad": 0.5},
                {"codigo": "E3", "descripcion": "PLATAFORMA ELEVADORA MANLIFT 12M", "cantidad": 0.2},
                {"codigo": "E4", "descripcion": "EQUIPO DE TOPOGRAFIA ESTACION TOTAL", "cantidad": 0.1},
                {"codigo": "E5", "descripcion": "CONO DE ABRAMS Y CILINDROS PARA ENSAYO", "cantidad": 0.1},
                {"codigo": "E6", "descripcion": "MONTACARGAS DE HORQUILLA 3 TON", "cantidad": 0.1},
                {"codigo": "E7", "descripcion": "MINICARGADOR BOBCAT S185", "cantidad": 0.1},
                {"codigo": "E8", "descripcion": "BOMBA DE CONCRETO ESTACIONARIA", "cantidad": 0.1},
                {"codigo": "E9", "descripcion": "HERRAMIENTAS MENORES", "cantidad": 1.0},
            ],
            "labors": [
                {"codigo": "M1", "descripcion": "TOPOGRAFO", "cantidad": 0.1},
                {"codigo": "M2", "descripcion": "OPERADOR DE MONTACARGAS", "cantidad": 0.1},
                {"codigo": "M3", "descripcion": "ALBAÑIL DE 1RA", "cantidad": 1.0},
            ],
            "advertencias": [],
        }
        enforce_discordant_inputs_purging(
            apu_heavy,
            "Excavación y vaciado de zapata de concreto f'c=210 kgf/cm2",
            {"codpar": "E311", "descripcion": "ZAPATA"},
        )
        self.assertEqual([e["codigo"] for e in apu_heavy["equipments"]], ["E9"])
        self.assertEqual([m["codigo"] for m in apu_heavy["labors"]], ["M3"])

    def test_winche_and_truck_purged_unless_explicitly_requested(self) -> None:
        """Verifica que Winche+Güinchero y Camión+Chofer se depuren si no se piden, y se conserven si se piden."""
        base_manto = {
            "codpar": "E42001",
            "descripcion": "REMOCION DE MANTO ASFALTICO",
        }
        apu_no_winch: Dict[str, Any] = {
            "materials": [],
            "equipments": [
                {"codigo": "EQ-W", "descripcion": "WINCHE CABRESTANTE CON MOTOR ELECTRICO", "cantidad": 0.2},
                {"codigo": "EQ-C", "descripcion": "CAMION FORD F-350 ESTACAS", "cantidad": 0.1},
                {"codigo": "EQ-H", "descripcion": "HERRAMIENTAS MENORES", "cantidad": 1.0},
            ],
            "labors": [
                {"codigo": "MO-G", "descripcion": "GÜINCHERO -N3", "cantidad": 0.2},
                {"codigo": "MO-CH", "descripcion": "CHOFER DE 2DA -N4", "cantidad": 0.1},
                {"codigo": "MO-OB", "descripcion": "OBRERO DE 1RA", "cantidad": 2.0},
            ],
            "advertencias": [],
        }
        enforce_discordant_inputs_purging(
            apu_no_winch,
            "Remoción de manto asfáltico en techo, Sin winche ni camión",
            base_manto,
        )
        eq_codes = [e["codigo"] for e in apu_no_winch["equipments"]]
        mo_codes = [m["codigo"] for m in apu_no_winch["labors"]]
        self.assertEqual(eq_codes, ["EQ-H"])
        self.assertEqual(mo_codes, ["MO-OB"])

        # Si el usuario pide explícitamente 'Con winche eléctrico y camión', se conservan
        apu_with_winch: Dict[str, Any] = {
            "materials": [],
            "equipments": [
                {"codigo": "EQ-W", "descripcion": "WINCHE CABRESTANTE CON MOTOR ELECTRICO", "cantidad": 0.2},
                {"codigo": "EQ-C", "descripcion": "CAMION FORD F-350 ESTACAS", "cantidad": 0.1},
            ],
            "labors": [
                {"codigo": "MO-G", "descripcion": "GÜINCHERO -N3", "cantidad": 0.2},
                {"codigo": "MO-CH", "descripcion": "CHOFER DE 2DA -N4", "cantidad": 0.1},
            ],
            "advertencias": [],
        }
        enforce_discordant_inputs_purging(
            apu_with_winch,
            "Remoción de manto asfáltico en techo, Con winche eléctrico y camión para bote de escombros",
            base_manto,
        )
        self.assertEqual(len(apu_with_winch["equipments"]), 2)
        self.assertEqual(len(apu_with_winch["labors"]), 2)

    @patch("app.services.ai_apu_service_v3.delta_applier.reconcile_labor_with_database")
    @patch("app.services.ai_apu_service_v3.delta_applier.reconcile_equipment_with_database")
    @patch("app.services.ai_apu_service_v3.delta_applier.reconcile_materials_with_database")
    @patch("app.services.ai_apu_service_v3.selector_planner.call_llm_json")
    def test_v3_regulated_creation_from_scratch_when_no_base_match(
        self,
        mock_llm: MagicMock,
        mock_rec_mat: MagicMock,
        mock_rec_eq: MagicMock,
        mock_rec_lab: MagicMock,
    ) -> None:
        """Verifica que cuando no hay coincidencia de base (selected_codpar='NONE' o candidatas vacías), V3 cree el APU desde cero bajo reglas COVENIN."""
        mock_llm.return_value = {
            "selected_codpar": "NONE",
            "selection_reason": "Actividad moderna sin partida equivalente en catálogo histórico; síntesis regulada COVENIN.",
            "adapted_description": "SUMINISTRO E INSTALACION DE GEOMEMBRANA HDPE E=1.5MM TERMOSOLDADA",
            "target_unit": "m2",
            "keep_base_performance": False,
            "new_performance": 80.0,
            "performance_reason": "Cuadrilla de termosoldadura rinde 80 m2/día",
            "material_ops": [
                {
                    "op": "add",
                    "new_description": "GEOMEMBRANA HDPE E=1.5 MM",
                    "new_unit": "m2",
                    "new_quantity": 1.0,
                    "new_waste_pct": 8.0,
                    "estimated_price_usd": 6.50,
                    "reason": "Material principal solicitado",
                }
            ],
            "equipment_ops": [
                {
                    "op": "add",
                    "new_description": "CUÑA TERMICA PARA SOLDADURA HDPE",
                    "new_quantity": 1.0,
                    "depreciation_factor": 0.008,
                    "estimated_price_usd": 1800.0,
                    "reason": "Equipo de termosoldadura",
                }
            ],
            "labor_ops": [
                {
                    "op": "add",
                    "new_description": "MAESTRO DE OBRA",
                    "new_quantity": 0.1,
                    "reason": "Supervisión",
                },
                {
                    "op": "add",
                    "new_description": "IMPERMEABILIZADOR",
                    "new_quantity": 1.0,
                    "reason": "Oficial especialista",
                },
                {
                    "op": "add",
                    "new_description": "AYUDANTE",
                    "new_quantity": 2.0,
                    "reason": "Apoyo en extendido de membrana",
                },
            ],
            "technical_assumptions": ["Síntesis regulada COVENIN"],
        }

        plan, selected_apu, _, _ = plan_v3_selection_and_deltas(
            user_description="Suministro e instalación de geomembrana HDPE e=1.5mm termosoldada",
            enriched_candidates=[],
            requested_unit="m2",
        )
        self.assertEqual(plan.selected_codpar, "NONE")
        self.assertEqual(selected_apu, {})

        mock_db = MagicMock()
        result, _ = apply_v3_deltas_to_base_apu(
            plan=plan,
            base_apu=selected_apu,
            user_description="Suministro e instalación de geomembrana HDPE e=1.5mm termosoldada",
            db=mock_db,
            requested_unit="m2",
        )
        self.assertEqual(result["status"], "completed")
        self.assertEqual(len(result["materials"]), 1)
        # Debe incluir el equipo de cuña térmica + HERRAMIENTAS MENORES inyectadas automáticamente
        eq_descs = [e["descripcion"] for e in result["equipments"]]
        self.assertIn("CUÑA TERMICA PARA SOLDADURA HDPE", eq_descs)
        self.assertIn("HERRAMIENTAS MENORES", eq_descs)
        self.assertEqual(len(result["labors"]), 3)
        self.assertGreater(result["costo_directo"], 0.0)


if __name__ == "__main__":
    unittest.main()
