import os
import sys
import unittest
from typing import Any, Dict, List

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.ai_apu_service.domain_rules.discordant_pruning import (
    enforce_discordant_inputs_purging,
)
from app.services.apu_labor_calibrator import (
    balance_crew_and_equipments,
    balance_crew_specialties,
)


class TestDiscordantPruningAndCalibration(unittest.TestCase):
    """
    Suite de pruebas para validar la poda determinista de insumos discordantes
    y la calibración de equipos en partidas de pisos y acabados.
    """

    def test_purge_concrete_pipe_in_floor_finish(self) -> None:
        """
        Verifica que un tubo de concreto de gran diámetro (heredado erróneamente de partidas
        históricas como EAA207) sea eliminado en partidas de sobrepiso o acabado de piso.
        """
        description = "CONSTRUCCION DE REVESTIMIENTO DE PISOS CON LECHADA DE CEMENTO TIPO REQUEMADO ROJO"
        apu_result: Dict[str, Any] = {
            "materials": [
                {"codigo": "MAT-CEM-001", "descripcion": "CEMENTO PORTLAND TIPO I", "cantidad": 0.25, "unidad": "saco"},
                {"codigo": "MAT-ARE-002", "descripcion": "ARENA LAVADA", "cantidad": 0.03, "unidad": "m3"},
                {"codigo": "MAT-CON-0550", "descripcion": "TUBO DE CONCRETO JUNTA GOMA DIAMETRO = 0,70 M (27\")", "cantidad": 1.0, "unidad": "kgf"},
            ],
            "equipments": [
                {"codigo": "EQU-MEZ-001", "descripcion": "MEZCLADORA DE CONCRETO 1 SACO", "cantidad": 1.0, "unidad": "dia"},
            ],
            "labor": [
                {"codigo": "MO-ALB-01", "descripcion": "ALBANIL DE PRIMERA", "cantidad": 1.0, "unidad": "dia"}
            ]
        }

        enforce_discordant_inputs_purging(
            result=apu_result,
            user_description=description,
            base_apu={"partida_code": "EAA207", "descripcion": description},
        )

        clean_mat = apu_result["materials"]
        trace = apu_result.get("debug_pruning_trace", {})

        # El tubo de concreto debe haber sido purgado
        self.assertEqual(len(clean_mat), 2)
        descriptions = [m["descripcion"] for m in clean_mat]
        self.assertNotIn("TUBO DE CONCRETO JUNTA GOMA DIAMETRO = 0,70 M (27\")", descriptions)
        self.assertIn("CEMENTO PORTLAND TIPO I", descriptions)

        # La traza debe reflejar la regla DISCIPLINA_AJENA_PISOS
        purgados = trace.get("insumos_purgados", [])
        self.assertTrue(any(p.get("regla") == "DISCIPLINA_AJENA_PISOS" for p in purgados))

    def test_purge_rebar_cutter_in_floor_finish(self) -> None:
        """
        Verifica que una cortadora automática de cabilla o cizalla industrial sea purgada
        si aparece en una partida de sobrepisos o pisos de acabado.
        """
        description = "CONSTRUCCION DE SOBREPISO REQUEMADO UTILIZANDO OXIDO NEGRO ESPESOR 3 CM"
        apu_result: Dict[str, Any] = {
            "materials": [
                {"codigo": "MAT-CEM-001", "descripcion": "CEMENTO PORTLAND TIPO I", "cantidad": 0.3, "unidad": "saco"},
            ],
            "equipments": [
                {"codigo": "HER064", "descripcion": "CORTADORA AUTOMATICA DE CABILLA HASTA D= 1 1/2\"", "cantidad": 1.0, "unidad": "dia"},
                {"codigo": "HER001", "descripcion": "HERRAMIENTAS MENORES", "cantidad": 1.0, "unidad": "dia"},
            ],
            "labor": [
                {"codigo": "MO-ALB-01", "descripcion": "ALBANIL DE PRIMERA", "cantidad": 1.0, "unidad": "dia"}
            ]
        }

        enforce_discordant_inputs_purging(
            result=apu_result,
            user_description=description,
            base_apu={"partida_code": "EAA207", "descripcion": description},
        )

        clean_eq = apu_result["equipments"]
        trace = apu_result.get("debug_pruning_trace", {})

        self.assertEqual(len(clean_eq), 1)
        eq_descriptions = [e["descripcion"] for e in clean_eq]
        self.assertNotIn("CORTADORA AUTOMATICA DE CABILLA HASTA D= 1 1/2\"", eq_descriptions)
        self.assertIn("HERRAMIENTAS MENORES", eq_descriptions)

        eq_purgados = trace.get("equipos_purgados", [])
        self.assertTrue(any(p.get("regla") == "EQUIPO_DISCORDANTE_PISOS" for p in eq_purgados))

    def test_pigment_oxido_does_not_inject_wire_brush_grinder(self) -> None:
        """
        Verifica que en una partida de sobrepiso con óxido negro (pigmento mineral),
        el calibrador de cuadrilla no inyecte una amoladora con cepillo de alambre por confusión semántica.
        """
        description = "construccion de sobrepiso requemado utilizando oxido negro, e=3.0 cm, mortero 1:3"
        equipments: List[Dict[str, Any]] = [
            {"codigo": "EQU-MEZ-01", "descripcion": "MEZCLADORA 1 SACO", "cantidad": 1.0, "unidad": "dia"}
        ]
        labors: List[Dict[str, Any]] = [
            {"codigo": "MO-ALB-01", "descripcion": "ALBANIL", "cantidad": 1.0, "unidad": "dia"}
        ]

        calibrated_eq, notes = balance_crew_and_equipments(
            labors=labors,
            equipments=equipments,
            typology="ALBANILERIA",
            description=description,
            unit="m2",
        )

        # No debe haberse inyectado amoladora ni cepillo de alambre
        eq_codes = [e.get("codigo") for e in calibrated_eq]
        self.assertNotIn("EQU-HER-045", eq_codes)
        self.assertNotIn("EQU-IA-AMOLADORA", eq_codes)

    def test_metal_rust_removal_properly_injects_or_calibrates_grinder(self) -> None:
        """
        Verifica que en una partida de carpintería metálica con remoción de óxido/corrosión,
        sí se calibre o incorpore la amoladora adecuada para saneamiento mecánico.
        """
        description = "Pintura de esmalte sobre barandas y rejas metalicas con cepillado mecanico de oxido"
        equipments: List[Dict[str, Any]] = []
        labors: List[Dict[str, Any]] = [
            {"codigo": "MO-PIN-01", "descripcion": "PINTOR", "cantidad": 1.0, "unidad": "dia"}
        ]

        calibrated_eq, notes = balance_crew_and_equipments(
            labors=labors,
            equipments=equipments,
            typology="PINTURA",
            description=description,
            unit="m2",
        )

        eq_codes = [e.get("codigo") for e in calibrated_eq]
        self.assertIn("EQU-IA-AMOLADORA", eq_codes)
        amoladora = next(e for e in calibrated_eq if e.get("codigo") == "EQU-IA-AMOLADORA")
        self.assertEqual(amoladora.get("origen"), "ia")
        self.assertIn("CEPILLO DE ALAMBRE", amoladora.get("descripcion", ""))

    def test_purge_electrical_conduit_and_unistrut_in_potable_water(self) -> None:
        """
        Verifica que en una partida de tubería de agua potable / PPR:
        1. Se purguen los insumos eléctricos (tubo PVC electricidad, riel unistrut).
        2. Se purgue el equipo eléctrico ('EQUIPO PARA TUBERIA ELECTRICA').
        3. Se preserven la tubería PPR y herramientas manuales.
        """
        description = "Suministro e instalación de Tubería con ppr 1/2 en instalaciones domesticas Incluye conexiones y accesorios unidad ml"
        apu_result: Dict[str, Any] = {
            "materials": [
                {"codigo": "ELE798", "descripcion": "TUBO PVC ELECTRICIDAD DIÁMETRO = 1\" RÍGIDO/PESADO", "cantidad": 1.0, "unidad": "m", "origen": "historico"},
                {"codigo": "ELE550", "descripcion": "PERFIL RIEL UNISTRUD 1 1/2\" X 3/4\" L= 2,", "cantidad": 0.5, "unidad": "pza", "origen": "historico"},
                {"codigo": "MAT-PPR-01", "descripcion": "TUBERÍA DE POLIPROPILENO PPR D=1/2\" PN20", "cantidad": 1.05, "unidad": "m", "origen": "ia"},
                {"codigo": "MAT-PPR-02", "descripcion": "CONEXIONES Y ACCESORIOS PPR D=1/2\"", "cantidad": 1.0, "unidad": "pza", "origen": "ia"},
            ],
            "equipments": [
                {"codigo": "ELE005", "descripcion": "EQUIPO PARA TUBERIA ELECTRICA", "cantidad": 1.0, "unidad": "dia"},
                {"codigo": "ESP012", "descripcion": "HERRAMIENTAS MENORES", "cantidad": 1.0, "unidad": "dia"},
            ],
            "labor": [
                {"codigo": "19-215", "descripcion": "ELECTRICISTA DE 1RA -N5", "cantidad": 1.0, "unidad": "dia"},
                {"codigo": "1-1.2", "descripcion": "AYUDANTE - TABULADOR CONSTRUCCION -N2", "cantidad": 1.0, "unidad": "dia"}
            ]
        }

        enforce_discordant_inputs_purging(
            result=apu_result,
            user_description=description,
            base_apu={"partida_code": "EIB275", "descripcion": description},
        )

        clean_mat = apu_result["materials"]
        clean_eq = apu_result["equipments"]
        trace = apu_result.get("debug_pruning_trace", {})

        # Materiales: deben quedar solo los PPR
        self.assertEqual(len(clean_mat), 2)
        mat_descs = [m["descripcion"] for m in clean_mat]
        self.assertNotIn("TUBO PVC ELECTRICIDAD DIÁMETRO = 1\" RÍGIDO/PESADO", mat_descs)
        self.assertNotIn("PERFIL RIEL UNISTRUD 1 1/2\" X 3/4\" L= 2,", mat_descs)
        self.assertIn("TUBERÍA DE POLIPROPILENO PPR D=1/2\" PN20", mat_descs)

        # Equipos: debe quedar solo herramientas menores
        self.assertEqual(len(clean_eq), 1)
        eq_descs = [e["descripcion"] for e in clean_eq]
        self.assertNotIn("EQUIPO PARA TUBERIA ELECTRICA", eq_descs)
        self.assertIn("HERRAMIENTAS MENORES", eq_descs)

        # Traza
        purgados_mat = trace.get("insumos_purgados", [])
        purgados_eq = trace.get("equipos_purgados", [])
        self.assertTrue(any(p.get("regla") == "DISCIPLINA_AJENA_SANITARIAS" for p in purgados_mat))
        self.assertTrue(any(p.get("regla") == "EQUIPO_DISCORDANTE_SANITARIAS" for p in purgados_eq))

    def test_sanitary_labor_calibration_replaces_electrician(self) -> None:
        """
        Verifica que en una partida con tipología SANITARIAS, si la base histórica
        traía un electricista, el calibrador de mano de obra lo sustituya por PLOMERO DE 1RA.
        """
        labors: List[Dict[str, Any]] = [
            {"codigo": "19-215", "descripcion": "ELECTRICISTA DE 1RA -N5", "cantidad": 1.0, "unidad": "dia"},
            {"codigo": "1-1.2", "descripcion": "AYUDANTE - TABULADOR CONSTRUCCION -N2", "cantidad": 1.0, "unidad": "dia"}
        ]

        balanced_labors, notes = balance_crew_specialties(
            labors=labors,
            typology="SANITARIAS"
        )

        specialist_names = [l["descripcion"] for l in balanced_labors]
        self.assertIn("PLOMERO DE 1RA", specialist_names)
        self.assertNotIn("ELECTRICISTA DE 1RA -N5", specialist_names)


if __name__ == "__main__":
    unittest.main()

