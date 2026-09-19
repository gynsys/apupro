import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from typing import Any, Dict, List
from unittest.mock import MagicMock, patch
from app.services.apu_labor_calibrator import (
    classify_activity_typology,
    consolidate_labor_crew,
    balance_crew_specialties,
    balance_crew_and_equipments,
    validate_and_calibrate_hh,
    calibrate_apu_crew_and_equipment,
)
from app.services.ai_apu_service import reconcile_equipment_with_database


class TestApuLaborCalibrator(unittest.TestCase):
    """
    Banco de pruebas unitarias para el motor determinista de calibración
    de cuadrillas, equipos y Horas-Hombre (HH) en APUpro.
    """

    def test_user_debug_case_acarreo(self) -> None:
        """
        Caso Real del Usuario (debug_apu_2026-09-16T16-32-44-367Z.json):
        Acarreo de piedra bruta en carretilla a mano (m3.m).
        - Cuadrilla base: 10 Obreros de 1ra + 2 Caporales (11-1.3 y MOB013).
        - Equipos base: 2 Palas + 1 Carretilla (incorporada por IA).
        Verifica:
        1. Deduplicación de Caporales a 1 sola línea acotada a <= 0.25.
        2. Carretillas escaladas a 4 unidades (40% de 10 obreros en circuito continuo).
        3. Palas ajustadas a 3 unidades (30% de 10 obreros para carga/descarga).
        4. Notas técnicas de adaptación generadas con justificación constructiva.
        """
        raw_apu: Dict[str, Any] = {
            "status": "completed",
            "partida": {
                "cod_par": "C900SC001",
                "description": "ACARREO A MANO EN CARRETILLA DE PIEDRA BRUTA A DISTANCIAS HASTA 50 METROS.",
                "unit": "m3.m",
                "quantity": 1.0,
                "performance": 595.44,
            },
            "labors": [
                {
                    "codigo": "1-1.1",
                    "descripcion": "OBRERO DE 1RA -N1",
                    "unidad": "día",
                    "cantidad": 10.0,
                    "jornal": 2.25,
                    "bono": 3.22,
                },
                {
                    "codigo": "11-1.3",
                    "descripcion": "CAPORAL -N3",
                    "unidad": "día",
                    "cantidad": 0.25,
                    "jornal": 2.54,
                    "bono": 3.22,
                },
                {
                    "codigo": "MOB013",
                    "descripcion": "CAPORAL",
                    "unidad": "día",
                    "cantidad": 0.25,
                    "jornal": 4.0,
                    "bono": 0.0,
                },
            ],
            "equipments": [
                {
                    "codigo": "EQU-240577",
                    "descripcion": "PALA RECTANGULAR (M/METAL NEGRO) BELLOTA",
                    "unidad": "día",
                    "cantidad": 2.0,
                    "depreciacion": 0.01,
                    "precio_unitario": 16.50,
                },
                {
                    "codigo": "EQU-CARRETILLA",
                    "descripcion": "CARRETILLA METÁLICA DE MANO CAPACIDAD 3 CUFT",
                    "unidad": "día",
                    "cantidad": 1.0,
                    "depreciacion": 0.01,
                    "precio_unitario": 35.00,
                },
            ],
            "notas_adaptacion": [],
            "advertencias": [],
        }

        calibrated = calibrate_apu_crew_and_equipment(raw_apu)

        # 1. Verificar deduplicación de Caporal
        caporales = [
            l for l in calibrated["labors"]
            if "CAPORAL" in str(l.get("descripcion", "")).upper()
        ]
        self.assertEqual(len(caporales), 1, "Debe existir exactamente 1 línea de Caporal tras la consolidación.")
        self.assertAlmostEqual(caporales[0]["cantidad"], 0.25, places=2, msg="La asignación de Caporal debe estar acotada a 0.25.")

        # Total líneas de mano de obra = 2 (1 de obreros + 1 de caporal)
        self.assertEqual(len(calibrated["labors"]), 2)

        # 2. Verificar sincronización de carretillas en circuito continuo (40% de 10 = 4 carretillas)
        carretilla = next(
            (e for e in calibrated["equipments"] if "CARRETILLA" in str(e.get("descripcion", "")).upper()),
            None
        )
        self.assertIsNotNone(carretilla, "Debe existir la carretilla en la lista de equipos.")
        self.assertAlmostEqual(
            carretilla["cantidad"], 4.0, places=1,
            msg="Para 10 obreros en acarreo continuo, deben calibrarse 4 carretillas (ratio 40%)."
        )

        # 3. Verificar sincronización de palas para carga y descarga (30% de 10 = 3 palas)
        pala = next(
            (e for e in calibrated["equipments"] if "PALA" in str(e.get("descripcion", "")).upper()),
            None
        )
        self.assertIsNotNone(pala, "Debe existir la pala en la lista de equipos.")
        self.assertAlmostEqual(
            pala["cantidad"], 3.0, places=1,
            msg="Para 10 obreros, las palas deben ser al menos 3 unidades (30% para carga y descarga)."
        )

        # 4. Verificar que se registraron las notas técnicas explicativas
        notas = " ".join(calibrated["notas_adaptacion"])
        self.assertIn("Caporal", notas)
        self.assertIn("Carretillas ajustadas", notas)

    def test_albanileria_crew_balance_and_tools(self) -> None:
        """
        Disciplina 1: Albañilería y Paredes (E411, m2).
        Verifica:
        - Ratio ayudantes/oficial se acota cuando está desproporcionado (ej: 4 ayudantes para 1 albañil -> max 2).
        - Caporal duplicado se unifica.
        - Herramientas manuales (cuchara de albañil, nivel) se sincronizan 1:1 con albañiles.
        """
        apu: Dict[str, Any] = {
            "status": "completed",
            "partida": {
                "cod_par": "E411SC001",
                "description": "CONSTRUCCIÓN DE PARED DE BLOQUES DE ARCILLA E=15 CM ACABADO OBRA LIMPIA",
                "unit": "m2",
                "quantity": 1.0,
                "performance": 18.0,
            },
            "labors": [
                {"codigo": "MO-01", "descripcion": "ALBAÑIL DE 1RA", "cantidad": 1.0, "jornal": 5.0, "bono": 0.0},
                {"codigo": "MO-02", "descripcion": "AYUDANTE", "cantidad": 4.0, "jornal": 3.0, "bono": 0.0},
                {"codigo": "MO-03", "descripcion": "CAPORAL", "cantidad": 0.50, "jornal": 6.0, "bono": 0.0},
            ],
            "equipments": [
                {"codigo": "EQ-01", "descripcion": "CUCHARA DE ALBAÑIL", "cantidad": 1.0, "depreciacion": 0.01, "precio_unitario": 8.0},
                {"codigo": "EQ-02", "descripcion": "NIVEL DE MANO 24 PULG", "cantidad": 1.0, "depreciacion": 0.01, "precio_unitario": 12.0},
            ],
            "notas_adaptacion": [],
        }

        calibrated = calibrate_apu_crew_and_equipment(apu)

        # Ayudantes calibrados a max 2.0 por albañil
        ayudante = next(l for l in calibrated["labors"] if "AYUDANTE" in str(l.get("descripcion", "")).upper())
        self.assertLessEqual(ayudante["cantidad"], 2.0, "Los ayudantes no deben superar el ratio 2:1 respecto al oficial.")

        # Caporal acotado a 0.25 para cuadrilla pequeña
        caporal = next(l for l in calibrated["labors"] if "CAPORAL" in str(l.get("descripcion", "")).upper())
        self.assertAlmostEqual(caporal["cantidad"], 0.25, places=2)

    def test_concreto_estructural_sync(self) -> None:
        """
        Disciplina 2: Concreto Estructural (E31/E32, m3).
        Verifica sincronización de vaciado con trompo mezclador y vibrador.
        """
        apu: Dict[str, Any] = {
            "status": "completed",
            "partida": {
                "cod_par": "E313SC001",
                "description": "VACIADO DE CONCRETO EN LOSA DE TECHO RCR=210 KG/CM2 CON TROMPO",
                "unit": "m3",
                "quantity": 1.0,
                "performance": 12.0,
            },
            "labors": [
                {"codigo": "MO-01", "descripcion": "OFICIAL CONCRETERO", "cantidad": 1.0, "jornal": 5.0, "bono": 0.0},
                {"codigo": "MO-02", "descripcion": "OBRERO DE 1RA", "cantidad": 4.0, "jornal": 3.0, "bono": 0.0},
                {"codigo": "MO-03", "descripcion": "CAPORAL", "cantidad": 0.25, "jornal": 6.0, "bono": 0.0},
            ],
            "equipments": [
                {"codigo": "EQ-MIX", "descripcion": "MEZCLADORA DE CONCRETO TROMPO 1 SACO", "cantidad": 1.0, "depreciacion": 1.0, "precio_unitario": 35.0},
                {"codigo": "EQ-VIB", "descripcion": "VIBRADOR DE CONCRETO A GASOLINA CON TRIPETA", "cantidad": 1.0, "depreciacion": 1.0, "precio_unitario": 20.0},
            ],
            "notas_adaptacion": [],
        }

        calibrated = calibrate_apu_crew_and_equipment(apu)
        typology = classify_activity_typology(calibrated["partida"]["description"], calibrated["partida"]["unit"])
        self.assertEqual(typology, "CONCRETO")

        # Rendimiento se mantiene en rango de la mediana histórica (12.0 m3/día para cuadrilla de 5 personas)
        self.assertGreaterEqual(calibrated["partida"]["performance"], 8.0)
        self.assertLessEqual(calibrated["partida"]["performance"], 20.0)

    def test_pintura_tools_parity(self) -> None:
        """
        Disciplina 3: Pintura y Acabados (E8, m2).
        Verifica paridad de brochas y rodillos con respecto al número de pintores activos.
        """
        apu: Dict[str, Any] = {
            "status": "completed",
            "partida": {
                "cod_par": "E811SC001",
                "description": "APLICACIÓN DE PINTURA DE CAUCHO CLASE A EN PAREDES INTERIORES",
                "unit": "m2",
                "quantity": 1.0,
                "performance": 60.0,
            },
            "labors": [
                {"codigo": "MO-P1", "descripcion": "PINTOR DE 1RA", "cantidad": 2.0, "jornal": 4.5, "bono": 0.0},
                {"codigo": "MO-AY", "descripcion": "AYUDANTE DE PINTOR", "cantidad": 1.0, "jornal": 3.0, "bono": 0.0},
                {"codigo": "MO-CP", "descripcion": "CAPORAL", "cantidad": 0.15, "jornal": 5.5, "bono": 0.0},
            ],
            "equipments": [
                {"codigo": "EQ-BR", "descripcion": "BROCHA DE CERDAS 4 PULG", "cantidad": 1.0, "depreciacion": 0.01, "precio_unitario": 5.0},
                {"codigo": "EQ-RO", "descripcion": "RODILLO PARA PINTAR CON MANGO", "cantidad": 1.0, "depreciacion": 0.01, "precio_unitario": 7.0},
            ],
            "notas_adaptacion": [],
        }

        calibrated = calibrate_apu_crew_and_equipment(apu)

        # 2 pintores -> las herramientas deben escalar a 2.0 unidades cada una
        brocha = next(e for e in calibrated["equipments"] if "BROCHA" in str(e.get("descripcion", "")).upper())
        rodillo = next(e for e in calibrated["equipments"] if "RODILLO" in str(e.get("descripcion", "")).upper())
        self.assertAlmostEqual(brocha["cantidad"], 2.0, places=1)
        self.assertAlmostEqual(rodillo["cantidad"], 2.0, places=1)

    def test_instalaciones_sanitarias_classification(self) -> None:
        """
        Disciplina 4: Instalaciones Hidráulicas y Sanitarias (E5, m).
        Verifica clasificación y validación de HH en tubería PVC.
        """
        apu: Dict[str, Any] = {
            "status": "completed",
            "partida": {
                "cod_par": "E511SC001",
                "description": "SUMINISTRO E INSTALACIÓN DE TUBERÍA SANITARIA PVC D=4 PULGADAS",
                "unit": "m",
                "quantity": 1.0,
                "performance": 35.0,
            },
            "labors": [
                {"codigo": "MO-PL", "descripcion": "PLOMERO DE 1RA", "cantidad": 1.0, "jornal": 5.0, "bono": 0.0},
                {"codigo": "MO-AY", "descripcion": "AYUDANTE", "cantidad": 1.0, "jornal": 3.0, "bono": 0.0},
                {"codigo": "MO-CP", "descripcion": "CAPORAL", "cantidad": 0.15, "jornal": 6.0, "bono": 0.0},
            ],
            "equipments": [],
            "notas_adaptacion": [],
        }

        calibrated = calibrate_apu_crew_and_equipment(apu)
        typology = classify_activity_typology(calibrated["partida"]["description"], calibrated["partida"]["unit"])
        self.assertEqual(typology, "SANITARIAS")
        self.assertAlmostEqual(calibrated["partida"]["performance"], 35.0, delta=5.0)

    def test_hh_extreme_outlier_recalibration(self) -> None:
        """
        Verificación de Recalibración Paramétrica:
        Si el LLM genera un rendimiento físicamente absurdo (ej: 400 m2/día de pared con 2 obreros,
        lo cual arroja 0.04 HH/m2 cuando el mínimo físico P10 es 0.72 HH/m2), el motor debe
        recalibrar el rendimiento a la mediana histórica constructiva.
        """
        absurd_apu: Dict[str, Any] = {
            "status": "completed",
            "partida": {
                "cod_par": "E411SC001",
                "description": "CONSTRUCCIÓN DE PARED DE BLOQUES DE ARCILLA E=15 CM",
                "unit": "m2",
                "quantity": 1.0,
                "performance": 400.0,  # Físicamente imposible para 2 albañiles
            },
            "labors": [
                {"codigo": "MO-ALB", "descripcion": "ALBAÑIL DE 1RA", "cantidad": 1.0, "jornal": 5.0, "bono": 0.0},
                {"codigo": "MO-AYU", "descripcion": "AYUDANTE", "cantidad": 1.0, "jornal": 3.0, "bono": 0.0},
                {"codigo": "MO-CAP", "descripcion": "CAPORAL", "cantidad": 0.20, "jornal": 6.0, "bono": 0.0},
            ],
            "equipments": [],
            "notas_adaptacion": [],
        }

        calibrated = calibrate_apu_crew_and_equipment(absurd_apu)

        # Rendimiento debe haber sido recalibrado hacia el benchmark P50 (~15 - 25 m2/día)
        calibrated_perf = calibrated["partida"]["performance"]
        self.assertLess(calibrated_perf, 100.0, "Un rendimiento sobrehumano de 400 m2/día debe ser acotado.")
        self.assertGreaterEqual(calibrated_perf, 5.0)

        # Confirmar que se generó una nota de calibración de rendimiento
        notas = " ".join(calibrated["notas_adaptacion"])
        self.assertIn("Calibración de rendimiento", notas)

    def test_acero_refuerzo_hh(self) -> None:
        """
        Disciplina 5: Acero de Refuerzo / Cabillas (E3, kgf).
        Verifica clasificación por unidad kgf y descripción técnica de acero.
        """
        apu: Dict[str, Any] = {
            "status": "completed",
            "partida": {
                "cod_par": "E321SC001",
                "description": "SUMINISTRO, CORTE, DOBLADO Y COLOCACIÓN DE ACERO DE REFUERZO FY=4200 KG/CM2",
                "unit": "kgf",
                "quantity": 1.0,
                "performance": 700.0,
            },
            "labors": [
                {"codigo": "MO-CAB", "descripcion": "CABILLERO DE 1RA", "cantidad": 4.0, "jornal": 5.0, "bono": 0.0},
                {"codigo": "MO-AYU", "descripcion": "AYUDANTE", "cantidad": 6.0, "jornal": 3.0, "bono": 0.0},
                {"codigo": "MO-CAP", "descripcion": "CAPORAL", "cantidad": 0.50, "jornal": 6.0, "bono": 0.0},
            ],
            "equipments": [
                {"codigo": "EQ-CIZ", "descripcion": "CIZALLA MANUAL PARA CORTE DE CABILLAS", "cantidad": 2.0, "depreciacion": 0.01, "precio_unitario": 25.0},
            ],
            "notas_adaptacion": [],
        }

        calibrated = calibrate_apu_crew_and_equipment(apu)
        typology = classify_activity_typology(calibrated["partida"]["description"], calibrated["partida"]["unit"])
        self.assertEqual(typology, "ACERO")
        self.assertAlmostEqual(calibrated["partida"]["performance"], 700.0, delta=100.0)

    def test_excavacion_manual_and_tools(self) -> None:
        """
        Disciplina 6: Excavación Manual en Tierra (E1, m3).
        Verifica que se componga predominantemente de obreros y herramientas manuales.
        """
        apu: Dict[str, Any] = {
            "status": "completed",
            "partida": {
                "cod_par": "E121SC001",
                "description": "EXCAVACIÓN A MANO EN TIERRA PARA ZANJAS Y FUNDACIONES HASTA 1.50 M DE PROFUNDIDAD",
                "unit": "m3",
                "quantity": 1.0,
                "performance": 10.0,
            },
            "labors": [
                {"codigo": "MO-OB", "descripcion": "OBRERO DE 1RA", "cantidad": 3.0, "jornal": 3.0, "bono": 0.0},
                {"codigo": "MO-CP", "descripcion": "CAPORAL", "cantidad": 0.15, "jornal": 5.0, "bono": 0.0},
            ],
            "equipments": [
                {"codigo": "EQ-PAL", "descripcion": "PALA REDONDA", "cantidad": 2.0, "depreciacion": 0.01, "precio_unitario": 15.0},
                {"codigo": "EQ-PIC", "descripcion": "PICO CON MANGO", "cantidad": 1.0, "depreciacion": 0.01, "precio_unitario": 18.0},
            ],
            "notas_adaptacion": [],
        }

        calibrated = calibrate_apu_crew_and_equipment(apu)
        typology = classify_activity_typology(calibrated["partida"]["description"], calibrated["partida"]["unit"])
        self.assertEqual(typology, "EXCAVACION_MANUAL")
        self.assertEqual(len(calibrated["labors"]), 2)

    def test_demolicion_classification(self) -> None:
        """
        Disciplina 7: Demoliciones (R, m2/m3).
        Verifica tipología de demolición y acotamiento de cuadrilla.
        """
        apu: Dict[str, Any] = {
            "status": "completed",
            "partida": {
                "cod_par": "R111SC001",
                "description": "DEMOLICIÓN A MANO DE PARED DE BLOQUES DE ARCILLA E=15 CM",
                "unit": "m2",
                "quantity": 1.0,
                "performance": 25.0,
            },
            "labors": [
                {"codigo": "MO-OB", "descripcion": "OBRERO DE 1RA", "cantidad": 2.0, "jornal": 3.0, "bono": 0.0},
                {"codigo": "MO-CP", "descripcion": "CAPORAL", "cantidad": 0.15, "jornal": 5.0, "bono": 0.0},
            ],
            "equipments": [],
            "notas_adaptacion": [],
        }

        calibrated = calibrate_apu_crew_and_equipment(apu)
        typology = classify_activity_typology(calibrated["partida"]["description"], calibrated["partida"]["unit"])
        self.assertEqual(typology, "DEMOLICION")

    def test_edge_cases_empty_or_clarification(self) -> None:
        """
        Verifica robustez y fail-fast: entradas no válidas o en clarificación no causan excepción.
        """
        # Clarificación requerida
        clarification_result: Dict[str, Any] = {
            "status": "clarification_needed",
            "clarification_message": "Entrada ambigua",
            "partida": None,
        }
        res1 = calibrate_apu_crew_and_equipment(clarification_result)
        self.assertEqual(res1["status"], "clarification_needed")

        # Partida con listas vacías
        empty_apu: Dict[str, Any] = {
            "status": "completed",
            "partida": {"description": "PARTIDA TEST", "unit": "und", "performance": 1.0},
            "labors": [],
            "equipments": [],
        }
        res2 = calibrate_apu_crew_and_equipment(empty_apu)
        self.assertEqual(res2["status"], "completed")

    def test_user_debug_case_tobo_haulage_no_carretilla(self) -> None:
        """
        Caso Real del Usuario (debug_apu_2026-09-16T21-55-05-702Z.json):
        Acarreo en interiores / pisos superiores a mano en tobos / sacos (m3.m).
        - 10 Obreros de 1ra + 1 Caporal.
        - Equipos base: 15 Tobos plásticos + 3 Palas + 1 Carretilla (incorporada erróneamente).
        Verifica:
        1. Carretilla eliminada por incompatibilidad física con pisos superiores/tobos.
        2. Tobos y palas conservados en proporción de circuito (15 tobos, 3 palas).
        3. Caporal consolidado a 0.25 para cuadrilla activa de 10 obreros.
        4. Advertencias referenciales sobre carretilla purgadas.
        """
        raw_apu: Dict[str, Any] = {
            "status": "completed",
            "partida": {
                "cod_par": "E211SC001",
                "description": "ACARREO MANUAL DE PIEDRA PICADA EN INTERIORES Y PISOS SUPERIORES UTILIZANDO TOBOS Y SACOS",
                "unit": "m3.m",
                "quantity": 1.0,
                "performance": 500.0,
            },
            "labors": [
                {
                    "codigo": "MO-OBR-26",
                    "descripcion": "OBRERO DE 1RA -N1",
                    "unidad": "día",
                    "cantidad": 10.0,
                    "jornal": 2.25,
                    "bono": 3.22,
                },
                {
                    "codigo": "MO-DIR-08",
                    "descripcion": "CAPORAL -N3",
                    "unidad": "día",
                    "cantidad": 1.0,
                    "jornal": 2.54,
                    "bono": 3.22,
                },
            ],
            "equipments": [
                {
                    "codigo": "EQU-GEN-1077",
                    "descripcion": "TOBO PLASTICO DE ALBAÑIL/ACARREO/EXC",
                    "unidad": "día",
                    "cantidad": 15.0,
                    "depreciacion": 0.067,
                    "precio_unitario": 20.59,
                    "origen": "historico",
                },
                {
                    "codigo": "EQU-PES-168",
                    "descripcion": "PALA CON CABO DE MADERA BELLOTA O SIM #",
                    "unidad": "día",
                    "cantidad": 3.0,
                    "depreciacion": 0.034,
                    "precio_unitario": 58.13,
                    "origen": "historico",
                },
                {
                    "codigo": "e-ia-carretilla",
                    "descripcion": "CARRETILLA METALICA DE ALBAÑILERIA CAPACIDAD 3.5 P3",
                    "unidad": "día",
                    "cantidad": 1.0,
                    "depreciacion": 0.02,
                    "precio_unitario": 50.0,
                    "origen": "ia",
                },
            ],
            "advertencias": [
                "[PRECIO_REFERENCIAL] El insumo 'CARRETILLA METALICA DE ALBAÑILERIA CAPACIDAD 3.5 P3' fue incorporado con un precio estimado de mercado en USD ($50.00)."
            ],
            "notas_adaptacion": [],
        }

        calibrated = calibrate_apu_crew_and_equipment(raw_apu)

        # 1. Verificar eliminación de carretilla
        eq_descs = [str(e.get("descripcion", "")).upper() for e in calibrated["equipments"]]
        self.assertFalse(any("CARRETILLA" in d for d in eq_descs), "Carretilla debe ser eliminada en acarreo vertical/tobos")

        # 2. Verificar conservación de tobos y palas
        self.assertTrue(any("TOBO" in d for d in eq_descs), "Tobos deben estar presentes")
        self.assertTrue(any("PALA" in d for d in eq_descs), "Palas deben estar presentes")

        # 3. Verificar consolidación de supervisión
        caporales = [l for l in calibrated["labors"] if "CAPORAL" in str(l.get("descripcion", "")).upper()]
        self.assertEqual(len(caporales), 1)
        self.assertAlmostEqual(caporales[0]["cantidad"], 0.25, places=2)

        # 4. Verificar purga de advertencias de carretilla
        adv_text = " ".join(calibrated.get("advertencias", []))
        self.assertNotIn("carretilla", adv_text.lower())

    def test_reconcile_equipment_with_database(self) -> None:
        """
        Verifica que reconcile_equipment_with_database consulte cost360_equipment
        para reemplazar insumos generados con origen 'ia' por insumos certificados
        de la base de datos de Costbase, purgando las alertas de precio referencial.
        """
        apu: Dict[str, Any] = {
            "status": "completed",
            "partida": {
                "cod_par": "R910SC001",
                "description": "ACARREO EN CARRETILLA",
                "unit": "m3.m",
                "performance": 1000.0,
            },
            "equipments": [
                {
                    "codigo": "e-ia-carretilla-test",
                    "descripcion": "CARRETILLA METALICA CAPACIDAD 55L",
                    "unidad": "día",
                    "cantidad": 2.0,
                    "depreciacion": 1.0,
                    "precio_unitario": 45.0,
                    "origen": "ia",
                }
            ],
            "materials": [],
            "labors": [],
            "advertencias": [
                "[PRECIO_REFERENCIAL] El insumo 'CARRETILLA METALICA CAPACIDAD 55L' fue incorporado con un precio estimado de mercado."
            ],
        }

        with patch("app.services.ai_apu_service.get_db_session") as mock_session_ctx:
            mock_session = MagicMock()
            mock_session_ctx.return_value.__enter__.return_value = mock_session
            with patch("app.services.ai_apu_service._execute_equipment_reconciliation") as mock_exec:
                def fake_reconcile(res: Dict[str, Any], session: Any) -> None:
                    res["equipments"][0]["origen"] = "historico"
                    res["equipments"][0]["codigo"] = "ALB112"
                    res["equipments"][0]["depreciacion"] = 0.02
                    res["equipments"][0]["precio_unitario"] = 194.88
                    res["advertencias"] = []
                mock_exec.side_effect = fake_reconcile
                reconcile_equipment_with_database(apu)

        eq = apu["equipments"][0]
        self.assertEqual(eq["origen"], "historico")
        self.assertEqual(eq["codigo"], "ALB112")
        self.assertAlmostEqual(eq["depreciacion"], 0.02, places=3)
        self.assertGreater(eq["precio_unitario"], 0.0)
        self.assertEqual(len(apu["advertencias"]), 0)

    def test_metal_structures_stair_zanca_calibration(self) -> None:
        """
        Caso Real del Usuario (debug_apu_2026-09-16T23-10-19-553Z.json):
        Reconstrucción y reparación de conexiones críticas en zancas de escalera (tubos 140x60) en 'und'.
        Verifica:
        1. Clasificación exacta en ESTRUCTURAS_METALICAS.
        2. Cuadrilla equilibrada: sustitución de Cabillero por Herrero de 1ra, Soldador preservado,
           ayudantes acotados (ratio <= 1.5).
        3. Preservación del Camión F-350 estacas (0.25 día) y su Chofer (0.25 día).
        4. Sincronización de soldadora y esmeril angular.
        5. Calibración del rendimiento de 12.0 und/día a la realidad física de obra (1.0 a 1.5 und/día).
        """
        raw_apu: Dict[str, Any] = {
            "status": "completed",
            "partida": {
                "cod_par": "E361SC001",
                "description": "RECONSTRUCCIÓN Y REPARACIÓN ESTRUCTURAL DE CONEXIONES CRÍTICAS EN ZANCAS DE ESCALERA CON TUBOS ESTRUCTURALES DE 140 mm x 60 mm. INCLUYE CORTE Y REMOCIÓN, SUMINISTRO Y REPOSICIÓN DE TUBO Y TAPA PLETINA.",
                "unit": "und",
                "quantity": 1.0,
                "performance": 12.0,
            },
            "labors": [
                {"codigo": "MO-DIR-33", "descripcion": "MAESTRO CABILLERO -N7", "unidad": "día", "cantidad": 0.5, "jornal": 3.18, "bono": 3.22},
                {"codigo": "MO-OBR-20", "descripcion": "AYUDANTE - TABULADOR CONSTRUCCION -N2", "unidad": "día", "cantidad": 4.0, "jornal": 2.44, "bono": 3.22},
                {"codigo": "MO-OBR-26", "descripcion": "OBRERO DE 1RA -N1", "unidad": "día", "cantidad": 2.0, "jornal": 2.25, "bono": 3.22},
                {"codigo": "MO-OFI-23", "descripcion": "CABILLERO DE 1RA -N5", "unidad": "día", "cantidad": 1.0, "jornal": 3.0, "bono": 3.22},
                {"codigo": "MO-OFI-148", "descripcion": "SOLDADOR DE 2DA -N4", "unidad": "día", "cantidad": 1.0, "jornal": 2.74, "bono": 3.22},
                {"codigo": "MO-OPR-12", "descripcion": "CHOFER DE 2DA (DE 3 A 8 TON) -N4", "unidad": "día", "cantidad": 0.25, "jornal": 2.74, "bono": 3.22},
            ],
            "equipments": [
                {"codigo": "EQU-PES-054", "descripcion": "CAMION FORD F- 350 ESTACAS", "unidad": "día", "cantidad": 0.25, "depreciacion": 0.004429, "precio_unitario": 96278.52},
                {"codigo": "EQU-HER-152", "descripcion": "SOLDADORA LINCOLN SA-200", "unidad": "día", "cantidad": 0.5, "depreciacion": 0.005282, "precio_unitario": 26559.59},
                {"codigo": "EQU-GEN-377", "descripcion": "EQUIPO OXIACETILENO C/ACCESORIOS", "unidad": "día", "cantidad": 1.0, "depreciacion": 1.0, "precio_unitario": 24.91},
            ],
            "materials": [],
            "notas_adaptacion": [],
            "advertencias": [],
        }

        calibrated = calibrate_apu_crew_and_equipment(raw_apu)

        # 1. Rendimiento calibrado a la realidad física de obra (1.0 a 1.5 und/día)
        perf = calibrated["partida"]["performance"]
        self.assertLessEqual(perf, 1.6, f"El rendimiento {perf} und/día excede el límite físico razonable de 1.5 und/día")
        self.assertGreaterEqual(perf, 0.9, f"El rendimiento {perf} und/día es demasiado bajo")

        # 2. Oficios de la cuadrilla
        labors = calibrated["labors"]
        labor_descs = [l["descripcion"].upper() for l in labors]
        self.assertTrue(any("HERRERO" in d for d in labor_descs), "Debe haber Herrero de 1ra sustituyendo al Cabillero")
        self.assertTrue(any("SOLDADOR" in d for d in labor_descs), "Debe haber Soldador en cuadrilla de herrería")
        self.assertFalse(any("CABILLERO" in d for d in labor_descs), "No deben quedar Cabilleros en estructuras metálicas")

        # 3. Preservación del Camión F-350 estacas y Chofer
        eq_descs = [e["descripcion"].upper() for e in calibrated["equipments"]]
        self.assertTrue(any("F- 350" in d or "F-350" in d for d in eq_descs), "Debe preservarse el Camión F-350 estacas")
        self.assertTrue(any("CHOFER" in d for d in labor_descs), "Debe preservarse el Chofer para el vehículo de apoyo")

        # 4. Sincronización de herramientas (esmeril angular para corte/desbaste)
        self.assertTrue(any("ESMERIL" in d or "AMOLADORA" in d for d in eq_descs), "Debe sincronizarse el Esmeril Angular")

    def test_heavy_truck_intelligent_downgrade(self) -> None:
        """
        Verifica que si una partida base pesada (ej: pilotaje o vialidad) incluye un Camión 750,
        el calibrador lo degrade a Camión utilitario F-350 estacas (0.25 día) con su chofer.
        """
        heavy_apu: Dict[str, Any] = {
            "status": "completed",
            "partida": {
                "cod_par": "R411SC001",
                "description": "REPARACIÓN DE MURO DE BLOQUES Y REPARACIÓN PUNTUAL EN SITIO",
                "unit": "und",
                "performance": 1.0,
            },
            "labors": [
                {"codigo": "1-1.1", "descripcion": "ALBAÑIL DE 1RA", "unidad": "día", "cantidad": 1.0},
                {"codigo": "1-1.2", "descripcion": "AYUDANTE", "unidad": "día", "cantidad": 1.0},
            ],
            "equipments": [
                {"codigo": "EQU-PES-750", "descripcion": "CAMION 750 VOLTEO 8 M3", "unidad": "día", "cantidad": 1.0, "depreciacion": 0.005, "precio_unitario": 85000.0},
            ],
            "materials": [],
        }

        calibrated = calibrate_apu_crew_and_equipment(heavy_apu)
        eq_descs = [e["descripcion"].upper() for e in calibrated["equipments"]]
        self.assertFalse(any("750" in d for d in eq_descs), "El camión 750 debió ser degradado")
        self.assertTrue(any("F- 350" in d or "F-350" in d for d in eq_descs), "Debió incorporarse Camión F-350 estacas a escala utilitaria")

        # Chofer debe haber sido incorporado a 0.25
        labors = calibrated["labors"]
        driver = next((l for l in labors if "CHOFER" in l["descripcion"].upper()), None)
        self.assertIsNotNone(driver, "Debe sincronizarse el chofer con el vehículo utilitario")
        self.assertAlmostEqual(driver["cantidad"], 0.25, places=2)

    def test_site_repairs_und_performance_calibration(self) -> None:
        """
        Verifica que para reparaciones puntuales (R4/R6 en 'und'), el rendimiento
        alucinado por el LLM (ej. 15 und/día) sea calibrado a la mediana empírica de 1.0 und/día.
        """
        repair_apu: Dict[str, Any] = {
            "status": "completed",
            "partida": {
                "cod_par": "R421SC001",
                "description": "REPARACIÓN Y SANEAMIENTO PUNTUAL DE FILTRACIÓN EN LOSA DE TECHO",
                "unit": "und",
                "performance": 15.0,
            },
            "labors": [
                {"codigo": "1-1.1", "descripcion": "OFICIAL DE REPARACIONES DE 1RA", "unidad": "día", "cantidad": 1.0},
                {"codigo": "1-1.2", "descripcion": "AYUDANTE", "unidad": "día", "cantidad": 1.0},
            ],
            "equipments": [],
            "materials": [],
        }

        calibrated = calibrate_apu_crew_and_equipment(repair_apu)
        perf = calibrated["partida"]["performance"]
        self.assertLessEqual(perf, 1.5, f"Rendimiento {perf} und/día excede el límite razonable de reparación")
        self.assertGreaterEqual(perf, 0.8, f"Rendimiento {perf} und/día está por debajo del rango empírico")


if __name__ == "__main__":
    unittest.main()

