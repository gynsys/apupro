import unittest

from app.services.dimension_service import (
    extract_unified_dimensions,
    score_dimension_match,
)
from app.services.ai_search import (
    _stem_spanish_token,
    _strip_negative_exclusion_clauses,
    _tokenize_for_lexical_idf,
    ai_engine,
    detect_materials,
)
from app.services.synonyms_service import expand_technical_synonyms
from app.services.ai_apu_service.generator.anchored_generator import (
    _are_units_physically_equivalent,
    apply_specialty_coherence_contract_to_base,
)
from app.services.ai_apu_service.domain_rules.discordant_pruning import (
    classify_pipe_mounting_condition,
    enforce_discordant_inputs_purging,
    is_explicit_mortar_without_coarse_concrete,
    is_manual_mixing_requested,
    resolve_effective_pipe_mounting,
)
from app.services.ai_apu_service.domain_rules.sanitize_partida import (
    _sanitize_partida_description,
    infer_covenin_prefix,
)
from app.services.ai_apu_service.rag_context.candidates import (
    _apply_technical_scoring_adjustments_detailed,
)
from app.services.ai_apu_service.reconciliation.specs_matcher import (
    _build_canonical_material_queries,
    _extract_technical_specs,
    _has_technical_spec_conflict,
)
from app.services.ai_apu_service.domain_rules.structural_requirements import (
    align_description_with_requested_mix,
    enforce_fine_mix_plausibility,
    enforce_reinforcement_for_structural_elements,
)
from app.services.element_geometry import extract_linear_length_m, is_linear_element
from app.services.apu_labor_calibrator import (
    EMPERICAL_HH_BENCHMARKS,
    classify_activity_typology,
    consolidate_labor_crew,
    validate_and_calibrate_hh,
)


class TestHybridSearchRootFixes(unittest.TestCase):
    def test_ppr_iso4065_nominal_equivalences(self) -> None:
        """
        Verifica que 'ppr 1/2' (sin comillas) se normalice a 12.7 mm y haga match exacto
        con 'POLIPROPILENO, DIAMETRO 20 MM' (EST253), mientras que '1"' (25.4 mm)
        penalice contra 25 mm (que es 3/4" en PPR) y premie 32 mm (que es 1" en PPR).
        """
        q_raw = "Suministro e instalación de Tubería con ppr 1/2 en instalaciones domesticas Incluye conexiones y accesorios unidad ml"
        q_expanded = expand_technical_synonyms(q_raw)
        q_dims = extract_unified_dimensions(q_expanded)
        self.assertTrue(any(t.dim_type == "diameter_mm" and t.canonical_value == 12.7 for t in q_dims))

        est253_desc = (
            "I.S. SUMINISTRO, TRANSPORTE E INSTALACION DE TUBERIA DE AGUAS CLARAS DE PLASTICO "
            "POLIPROPILENO, DIAMETRO 20 MM, SOLDADA MEDIANTE PROCESO DE TERMOFUSION / POLIFUSION"
        )
        est253_dims = extract_unified_dimensions(est253_desc)
        delta_253, matches_253 = score_dimension_match(q_dims, est253_dims)
        self.assertAlmostEqual(delta_253, 0.15, msg=f"EST253 debe recibir bono dimensional (matches={matches_253})")

        est254_desc = (
            "I.S. SUMINISTRO, TRANSPORTE E INSTALACION DE TUBERIA DE AGUAS CLARAS DE PLASTICO "
            "POLIPROPILENO, DIAMETRO 25 MM, SOLDADA MEDIANTE PROCESO DE TERMOFUSION / POLIFUSION"
        )
        est254_dims = extract_unified_dimensions(est254_desc)
        delta_254, _ = score_dimension_match(q_dims, est254_dims)
        self.assertLess(delta_254, 0.0, "EST254 (25 mm = 3/4\") debe recibir penalización contra 1/2\"")

        # Verificar que 1" (25.4 mm) NO colisione falsamente con 25 mm en PPR, sino que premie 32 mm
        q_one_inch = extract_unified_dimensions('Tubería de polipropileno PPR de 1" para agua potable')
        delta_1in_vs_25mm, _ = score_dimension_match(q_one_inch, est254_dims)
        self.assertLess(delta_1in_vs_25mm, 0.0, "1\" no debe coincidir con 25 mm (3/4\") en PPR")

        est255_desc = (
            "I.S. SUMINISTRO, TRANSPORTE E INSTALACION DE TUBERIA DE AGUAS CLARAS DE PLASTICO "
            "POLIPROPILENO, DIAMETRO 32 MM, SOLDADA MEDIANTE PROCESO DE TERMOFUSION / POLIFUSION"
        )
        est255_dims = extract_unified_dimensions(est255_desc)
        delta_1in_vs_32mm, _ = score_dimension_match(q_one_inch, est255_dims)
        self.assertAlmostEqual(delta_1in_vs_32mm, 0.15, msg="1\" debe coincidir exactamente con 32 mm en PPR")

        # Verificar que fracciones mixtas con espacio ('2 1/2"') se parseen como 63.5 mm y NO como 1/2" (12.7 mm)
        tor524_dims = extract_unified_dimensions(
            'TUBERIA DE ACERO DIAMETRO 2 1/2", SIN COSTURA ASTM A-53 GRADO B, SCHEDULE 40'
        )
        self.assertTrue(any(t.dim_type == "diameter_mm" and abs(t.canonical_value - 63.5) < 0.2 for t in tor524_dims))
        delta_tor524, _ = score_dimension_match(q_dims, tor524_dims)
        self.assertLess(delta_tor524, 0.0, '2 1/2" debe recibir penalización de conflicto contra 1/2"')

    def test_thickness_cm_extraction_and_scoring(self) -> None:
        """Verifica la extracción y comparación de espesores en cm y m (e=20 cm, 0.10 m de espesor)."""
        q_wall = extract_unified_dimensions("Construcción de paredes de bloques de concreto e=20 cm unidad m2")
        self.assertTrue(any(t.dim_type == "thickness_cm" and t.canonical_value == 20.0 for t in q_wall))

        item_20cm = extract_unified_dimensions("CONSTRUCCION DE PAREDES DE BLOQUES HUECOS DE ARCILLA, E= 20 CM.")
        item_15cm = extract_unified_dimensions("CONSTRUCCION DE PAREDES DE BLOQUES HUECOS DE ARCILLA, E= 15 CM.")
        delta_ok, _ = score_dimension_match(q_wall, item_20cm)
        delta_bad, _ = score_dimension_match(q_wall, item_15cm)
        self.assertAlmostEqual(delta_ok, 0.15)
        self.assertLess(delta_bad, 0.0)

        q_demol = extract_unified_dimensions("Demolición de pavimento de concreto con espesor de 10 cm")
        item_010m = extract_unified_dimensions("DEMOLICION DE PAVIMENTO DE CONCRETO HASTA 0,10 M DE ESPESOR")
        item_25cm = extract_unified_dimensions("DEMOLICION DE PAVIMENTO DE CONCRETO DE 25 CM DE ESPESOR")
        delta_demol_ok, _ = score_dimension_match(q_demol, item_010m)
        delta_demol_bad, _ = score_dimension_match(q_demol, item_25cm)
        self.assertAlmostEqual(delta_demol_ok, 0.15)
        self.assertLess(delta_demol_bad, 0.0)

    def test_universal_dimensions_across_disciplines(self) -> None:
        """
        Verifica equivalencias físicas universales en otras disciplinas:
        - Climatización: BTU <-> TR / Toneladas (24.000 BTU == 2 TR == 2 Toneladas)
        - Transformadores: kVA (37.5 kVA == 37,5 kVA != 75 kVA)
        - Tanques: Galones <-> Litros (82 galones ≈ 310 litros != 1.500 litros)
        - Vialidad/Acarreo: km (15 km != 5 km) y Tableros: circuitos (12 circuitos == 12 ctos != 24 circuitos)
        - Conductores eléctricos: #8 AWG y 2/0 AWG sin confundirse con cabillas (#8 rebar)
        - Secciones/Formatos: 60x60 cm == 0.60x0.60 m != 30x30 cm
        """
        # 1. Climatización BTU <-> TR <-> Toneladas
        q_hvac = extract_unified_dimensions("Suministro e instalación de aire acondicionado split de 24.000 BTU")
        it_2tr = extract_unified_dimensions("UNIDAD DE AIRE ACONDICIONADO TIPO SPLIT DE 2 TR")
        it_2ton = extract_unified_dimensions("SUMINISTRO E INSTALACION DE AIRE ACONDICIONADO DE 2 TONELADAS")
        it_5tr = extract_unified_dimensions("UNIDAD DE AIRE ACONDICIONADO TIPO SPLIT DE 5 TR")
        self.assertAlmostEqual(score_dimension_match(q_hvac, it_2tr)[0], 0.15)
        self.assertAlmostEqual(score_dimension_match(q_hvac, it_2ton)[0], 0.15)
        self.assertLess(score_dimension_match(q_hvac, it_5tr)[0], 0.0)

        # 2. Transformadores kVA
        q_kva = extract_unified_dimensions("Suministro de transformador monofásico de 37.5 kVA")
        it_kva_ok = extract_unified_dimensions("TRANSFORMADOR DE DISTRIBUCION MONOFASICO DE 37,5 KVA")
        it_kva_bad = extract_unified_dimensions("TRANSFORMADOR DE DISTRIBUCION MONOFASICO DE 75 KVA")
        self.assertAlmostEqual(score_dimension_match(q_kva, it_kva_ok)[0], 0.15)
        self.assertLess(score_dimension_match(q_kva, it_kva_bad)[0], 0.0)

        # 3. Tanques: Galones <-> Litros (82 gal ≈ 310.4 L)
        q_tank = extract_unified_dimensions("Tanque hidroneumático de 82 galones")
        it_tank_ok = extract_unified_dimensions("TANQUE DE PRESION HIDRONEUMATICO DE 310 LITROS")
        it_tank_bad = extract_unified_dimensions("TANQUE DE AGUA DE POLIETILENO DE 1.500 LTS")
        self.assertAlmostEqual(score_dimension_match(q_tank, it_tank_ok)[0], 0.15)
        self.assertLess(score_dimension_match(q_tank, it_tank_bad)[0], 0.0)

        # 4. Acarreo (km) y Tableros (circuitos)
        q_km = extract_unified_dimensions("Acarreo de escombros en camión volteo a 15 km")
        it_km_ok = extract_unified_dimensions("TRANSPORTE DE ESCOMBROS HASTA 15 KM")
        it_km_bad = extract_unified_dimensions("TRANSPORTE DE ESCOMBROS HASTA 5 KM")
        self.assertAlmostEqual(score_dimension_match(q_km, it_km_ok)[0], 0.15)
        self.assertLess(score_dimension_match(q_km, it_km_bad)[0], 0.0)

        q_tab = extract_unified_dimensions("Instalación de tablero eléctrico de 12 circuitos")
        it_tab_ok = extract_unified_dimensions("TABLERO METALICO EMBUTIDO DE 12 CTOS")
        it_tab_bad = extract_unified_dimensions("TABLERO METALICO EMBUTIDO DE 24 CIRCUITOS")
        self.assertAlmostEqual(score_dimension_match(q_tab, it_tab_ok)[0], 0.15)
        self.assertLess(score_dimension_match(q_tab, it_tab_bad)[0], 0.0)

        # 5. Calibres AWG (#8 AWG y 2/0 AWG) sin colisión con cabilla #8
        q_awg8 = extract_unified_dimensions("Suministro de cable de cobre #8 AWG")
        self.assertFalse(any(t.dim_type == "rebar_num" for t in q_awg8), "#8 AWG no debe extraerse como cabilla #8")
        self.assertTrue(any(t.dim_type == "gauge_awg" and t.canonical_value == 8.0 for t in q_awg8))

        q_awg20 = extract_unified_dimensions("Conductor de cobre calibre 2/0 AWG")
        it_awg40 = extract_unified_dimensions("CONDUCTOR DE COBRE 4/0 AWG")
        self.assertLess(score_dimension_match(q_awg20, it_awg40)[0], 0.0)

        # 6. Secciones / Formatos Bidimensionales (60x60 cm vs 0.60x0.60 m vs 30x30 cm)
        q_tile = extract_unified_dimensions("Piso de porcelanato formato 60x60 cm")
        it_tile_ok = extract_unified_dimensions("PISO DE PORCELANATO DE 0,60 X 0,60 M")
        it_tile_bad = extract_unified_dimensions("PISO DE PORCELANATO DE 30 X 30 CM")
        self.assertAlmostEqual(score_dimension_match(q_tile, it_tile_ok)[0], 0.25)
        self.assertLess(score_dimension_match(q_tile, it_tile_bad)[0], 0.0)

        # 7. Categorías de materiales insensibles a tildes
        mats_cu = detect_materials("Suministro de cable de cobre THW #12 AWG")
        self.assertIn("COBRE", mats_cu.get("conductores_electricos", set()))
        mats_cer = detect_materials("Revestimiento de cerámica en paredes")
        self.assertIn("CERAMICA", mats_cer.get("pisos_revestimiento", set()))

    def test_spanish_phonotactic_stemming_and_ui_unit_stripping(self) -> None:
        """Verifica la regla fonotáctica de plurales en español y la limpieza del sufijo 'unidad <u_med>'."""
        self.assertEqual(_stem_spanish_token("PAREDES"), "PARED")
        self.assertEqual(_stem_spanish_token("MATERIALES"), "MATERIAL")
        self.assertEqual(_stem_spanish_token("PANELES"), "PANEL")
        self.assertEqual(_stem_spanish_token("INTERIORES"), "INTERIOR")
        self.assertEqual(_stem_spanish_token("CONEXIONES"), "CONEXION")
        self.assertEqual(_stem_spanish_token("CABLES"), "CABLE")
        self.assertEqual(_stem_spanish_token("COBRES"), "COBRE")
        self.assertEqual(_stem_spanish_token("BLOQUES"), "BLOQUE")
        self.assertEqual(_stem_spanish_token("TUBERIAS"), "TUBERIA")
        self.assertEqual(_stem_spanish_token("LUCES"), "LUZ")

        tokens = _tokenize_for_lexical_idf("Construcción de paredes exteriores unidad m2")
        self.assertIn("PARED", tokens)
        self.assertIn("EXTERIOR", tokens)
        self.assertNotIn("UNIDAD", tokens)

    def test_extract_main_chunk_preserves_utilizando_and_strips_ui_unit(self) -> None:
        """Verifica que extract_main_chunk no trunque frases con 'utilizando' y elimine 'unidad <u_med>'."""
        q = "Construcción de Columnas y vigas utilizando varilla de fibra como refuerzo y concreto fc 250 unidad m3"
        chunk = ai_engine.extract_main_chunk(q)
        self.assertIn("varilla de fibra", chunk)
        self.assertIn("concreto fc 250", chunk)
        self.assertNotIn("unidad m3", chunk.lower())

    def test_principio3_specialty_coherence_contract_unanchoring(self) -> None:
        """
        Verifica el Principio 3 (Desanclaje Automático por Contrato de Coherencia de Especialidad):
        - Cuando D_base == D_user y M_base == M_user, conserva materiales y equipos intactos.
        - Cuando D_base != D_user o M_base != M_user, revoca materiales y equipos específicos,
          conservando únicamente rendimiento, mano de obra y herramientas menores.
        """
        # 1. Caso coherente: solicitud de PPR 1/2" con base EST253 (PPR 20 mm)
        coherent_base = {
            "codpar": "EST253",
            "descripcion": "TUBERIA DE AGUAS CLARAS DE PLASTICO POLIPROPILENO, DIAMETRO 20 MM, TERMOFUSION",
            "unidad": "m",
            "rendimiento": 25.0,
            "materiales": [{"codigo": "M1", "descripcion": "TUBO PPR 20 MM"}],
            "equipos": [
                {"codigo": "E1", "descripcion": "MAQUINA POLIFUSORA"},
                {"codigo": "E2", "descripcion": "HERRAMIENTAS MENORES"},
            ],
            "mano_obra": [{"codigo": "O1", "descripcion": "PLOMERO DE 1RA"}],
        }
        out_ok, is_ok, reason_ok = apply_specialty_coherence_contract_to_base(
            coherent_base,
            "Suministro e instalación de Tubería con ppr 1/2 en instalaciones domesticas",
        )
        self.assertTrue(is_ok, f"Debe ser coherente: {reason_ok}")
        self.assertEqual(len(out_ok["materiales"]), 1)
        self.assertEqual(len(out_ok["equipos"]), 2)

        # 2. Caso incoherente de especialidad: solicitud de agua potable PPR con base eléctrica EIB275
        divergent_base = {
            "codpar": "EIB275",
            "descripcion": 'SUMINISTRO E INSTALACION DE TUBERIA PVC ELECTRICIDAD D=1/2" CON RIEL UNISTRUT',
            "unidad": "m",
            "rendimiento": 20.0,
            "materiales": [
                {"codigo": "M_ELEC", "descripcion": 'TUBO PVC ELECTRICIDAD 1/2"'},
                {"codigo": "M_UNI", "descripcion": 'PERFIL RIEL UNISTRUT 1 1/2" X 3/4"'},
            ],
            "equipos": [
                {"codigo": "EQ_ELEC", "descripcion": "EQUIPO PARA TUBERIA ELECTRICA"},
                {"codigo": "EQ_HM", "descripcion": "HERRAMIENTAS MENORES"},
            ],
            "mano_obra": [{"codigo": "O_EL", "descripcion": "ELECTRICISTA DE 1RA"}],
        }
        out_div, is_div, reason_div = apply_specialty_coherence_contract_to_base(
            divergent_base,
            "Suministro e instalación de Tubería con ppr 1/2 en instalaciones domesticas",
        )
        self.assertFalse(is_div)
        self.assertTrue(len(reason_div) > 0)
        self.assertEqual(out_div["materiales"], [], "El ancla de materiales debe quedar revocada")
        self.assertEqual(len(out_div["equipos"]), 1, "Solo debe conservar herramientas menores")
        self.assertEqual(out_div["equipos"][0]["descripcion"], "HERRAMIENTAS MENORES")
        self.assertEqual(out_div["rendimiento"], 20.0)

    def test_global_pipe_mounting_classification_and_pruning(self) -> None:
        """
        Verifica la diferenciación global de tuberías según condición de montaje:
        - EMBUTIDA / EN INTERIORES: purga carretilla, cinta de topógrafo 50m y escuadra metálica 60x40cm,
          y desambigua 'EMBUTIDA O ENTERRADA' a 'EMBUTIDA'.
        - ENTERRADA / EN ZANJA: conserva carretilla y cinta de topógrafo, pero purga andamios/escaleras/abrazaderas
          y desambigua 'EMBUTIDA O ENTERRADA' a 'ENTERRADA'.
        - SUPERFICIAL / COLGANTE: conserva soportes/andamios y purga carretilla y cinta de topógrafo.
        """
        base_m611081013 = {
            "codpar": "M611081013",
            "descripcion": 'TUBERIA DE AGUAS CLARAS, DE PVC CPVC SOLDADA PARA AGUA CALIENTE, DIAMETRO 1/2" (13mm), ASTM, EMBUTIDA O ENTERRADA. INCLUYE CONEXIONES.',
        }
        self.assertEqual(classify_pipe_mounting_condition(base_m611081013["descripcion"]), "AMBIGUA_EMBUTIDA_ENTERRADA")
        self.assertEqual(
            resolve_effective_pipe_mounting(
                'Suministro e instalación de Tubería con CPVC 1/2" En interiores Incluye conexiones y accesorios unidad ml',
                base_m611081013["descripcion"],
            ),
            "EMBUTIDA",
        )
        self.assertEqual(
            resolve_effective_pipe_mounting(
                'Suministro e instalación de Tubería de PVC 2" enterrada en zanja exterior',
                base_m611081013["descripcion"],
            ),
            "ENTERRADA",
        )
        self.assertEqual(
            resolve_effective_pipe_mounting(
                'Tubería de acero galvanizado 2" colgante en techo',
                base_m611081013["descripcion"],
            ),
            "SUPERFICIAL_COLGANTE",
        )

        # Caso 1: Tubería EMBUTIDA / en interiores -> elimina carretilla, cinta de topógrafo y escuadra 60x40
        apu_embutida = {
            "partida": {
                "description": 'SUMINISTRO E INSTALACIÓN DE TUBERÍA DE CPVC 1/2" (13MM), ASTM, EMBUTIDA O ENTERRADA EN INTERIORES.'
            },
            "materials": [
                {"codigo": "MAT-TUB-392", "descripcion": 'TUBO DE AGUA CALIENTE CPVC D= 1/2"'},
                {"codigo": "MAT-SOP-001", "descripcion": 'ABRAZADERA COLGANTE TIPO PERA D= 1/2"'},
            ],
            "equipments": [
                {"codigo": "EQU-BOM-024", "descripcion": "BOMBA MANUAL PARA PRUEBAS HIDRAULICAS C/FILTRO"},
                {"codigo": "EQU-HER-030", "descripcion": "CARRETILLA DE RUEDAS NEUMATICAS DE CAPACIDAD= 55 l"},
                {"codigo": "EQU-GEN-170", "descripcion": "CINTA METRICA T/TOPOGRAFO DE LARGO= 50 m, MARCA STANLEY"},
                {"codigo": "EQU-GEN-491", "descripcion": "ESCUADRA METALICA DE ALUMINIO DE 60x40 cm"},
                {"codigo": "EQU-GEN-847", "descripcion": 'NIVEL DE 3 BURBUJAS DE LARGO= 14", MARCA STANLEY'},
                {"codigo": "EQU-GEN-964", "descripcion": "SEGUETA AJUSTABLE"},
            ],
            "labors": [],
        }
        enforce_discordant_inputs_purging(
            apu_embutida,
            'Suministro e instalación de Tubería con CPVC 1/2" En interiores Incluye conexiones y accesorios unidad ml',
            base_m611081013,
        )
        _sanitize_partida_description(
            apu_embutida,
            'Suministro e instalación de Tubería con CPVC 1/2" En interiores Incluye conexiones y accesorios unidad ml',
        )
        eq_descs = [e["descripcion"] for e in apu_embutida["equipments"]]
        mat_descs = [m["descripcion"] for m in apu_embutida["materials"]]
        self.assertNotIn("CARRETILLA DE RUEDAS NEUMATICAS DE CAPACIDAD= 55 l", eq_descs)
        self.assertNotIn("CINTA METRICA T/TOPOGRAFO DE LARGO= 50 m, MARCA STANLEY", eq_descs)
        self.assertNotIn("ESCUADRA METALICA DE ALUMINIO DE 60x40 cm", eq_descs)
        self.assertIn("BOMBA MANUAL PARA PRUEBAS HIDRAULICAS C/FILTRO", eq_descs)
        self.assertNotIn('ABRAZADERA COLGANTE TIPO PERA D= 1/2"', mat_descs)
        self.assertIn("EMBUTIDA", apu_embutida["partida"]["description"])
        self.assertNotIn("ENTERRADA", apu_embutida["partida"]["description"])

        # Caso 2: Tubería ENTERRADA -> conserva carretilla y cinta de topógrafo, pero elimina andamios/abrazaderas
        apu_enterrada = {
            "partida": {
                "description": 'TUBERÍA DE AGUAS CLARAS PVC 2", EMBUTIDA O ENTERRADA. INCLUYE CONEXIONES.'
            },
            "materials": [
                {"codigo": "MAT-TUB-001", "descripcion": 'TUBO PVC D= 2"'},
                {"codigo": "MAT-SOP-001", "descripcion": 'ABRAZADERA COLGANTE TIPO PERA D= 2"'},
            ],
            "equipments": [
                {"codigo": "EQU-HER-030", "descripcion": "CARRETILLA DE RUEDAS NEUMATICAS DE CAPACIDAD= 55 l"},
                {"codigo": "EQU-GEN-170", "descripcion": "CINTA METRICA T/TOPOGRAFO DE LARGO= 50 m, MARCA STANLEY"},
                {"codigo": "EQU-AND-001", "descripcion": "ANDAMIO TUBULAR 2,00 x 1,20 x 1,80 m"},
                {"codigo": "EQU-HIL-001", "descripcion": "PISTOLA DE FIJACION HILTI DX460"},
            ],
            "labors": [],
        }
        enforce_discordant_inputs_purging(
            apu_enterrada,
            'Suministro e instalación de Tubería de aguas claras PVC 2" enterrada en zanja',
            base_m611081013,
        )
        _sanitize_partida_description(
            apu_enterrada,
            'Suministro e instalación de Tubería de aguas claras PVC 2" enterrada en zanja',
        )
        eq_ent_descs = [e["descripcion"] for e in apu_enterrada["equipments"]]
        self.assertIn("CARRETILLA DE RUEDAS NEUMATICAS DE CAPACIDAD= 55 l", eq_ent_descs)
        self.assertIn("CINTA METRICA T/TOPOGRAFO DE LARGO= 50 m, MARCA STANLEY", eq_ent_descs)
        self.assertNotIn("ANDAMIO TUBULAR 2,00 x 1,20 x 1,80 m", eq_ent_descs)
        self.assertNotIn("PISTOLA DE FIJACION HILTI DX460", eq_ent_descs)
        self.assertIn("ENTERRADA", apu_enterrada["partida"]["description"])
        self.assertNotIn("EMBUTIDA", apu_enterrada["partida"]["description"])

    def test_dual_tabulator_labor_deduplication_and_cpvc_typology(self) -> None:
        """
        Verifica que la cuadrilla contaminada por doble tabulador en M611081013
        (Plomero -N5 + Plomero de 1ra., Ayudante -N2 + Ayudante, Obrero -N1 + Obrero de 1ra.)
        se consolide a 1 Plomero, 1 Ayudante, 1 Obrero y 0.25 Caporal, y que la tipología
        sea SANITARIAS (no ESTRUCTURAS_METALICAS) y unidad 'ml' == 'm'.
        """
        raw_labors = [
            {"codigo": "MO-DIR-58", "descripcion": "MAESTRO PLOMERO DE 1ra.", "cantidad": 0.25, "jornal": 4.24, "bono": 0.0},
            {"codigo": "MO-DIR-59", "descripcion": "MAESTRO PLOMERO DE 1RA -N7", "cantidad": 0.25, "jornal": 3.18, "bono": 3.22},
            {"codigo": "MO-OBR-07", "descripcion": "AYUDANTE", "cantidad": 1.0, "jornal": 4.0, "bono": 0.0},
            {"codigo": "MO-OBR-20", "descripcion": "AYUDANTE - TABULADOR CONSTRUCCION -N2", "cantidad": 1.0, "jornal": 2.44, "bono": 3.22},
            {"codigo": "MO-OBR-25", "descripcion": "OBRERO DE 1ra.", "cantidad": 1.0, "jornal": 4.0, "bono": 0.0},
            {"codigo": "MO-OBR-26", "descripcion": "OBRERO DE 1RA -N1", "cantidad": 1.0, "jornal": 2.25, "bono": 3.22},
            {"codigo": "MO-OFI-127", "descripcion": "PLOMERO DE 1ra.", "cantidad": 1.0, "jornal": 4.0, "bono": 0.0},
            {"codigo": "MO-OFI-128", "descripcion": "PLOMERO DE 1RA -N5", "cantidad": 1.0, "jornal": 3.0, "bono": 3.22},
        ]
        consolidated, notes = consolidate_labor_crew(raw_labors)
        self.assertEqual(len(consolidated), 4, f"Deben quedar 4 cargos únicos, obtuvo {consolidated}")
        codes = {item["codigo"] for item in consolidated}
        self.assertIn("MO-OFI-128", codes)
        self.assertIn("MO-OBR-20", codes)
        self.assertIn("MO-OBR-26", codes)
        self.assertIn("MO-DIR-59", codes)
        self.assertTrue(any("doble tabulador" in n for n in notes))

        # Tipología y equivalencia de unidades
        desc_cpvc = 'SUMINISTRO E INSTALACION DE TUBERIA DE AGUAS CLARAS DE CPVC SOLDADA PARA AGUA CALIENTE D= 1/2"'
        self.assertEqual(classify_activity_typology(desc_cpvc, "ml", "E511SC001"), "SANITARIAS")
        self.assertEqual(infer_covenin_prefix(desc_cpvc, "M611081013"), "E511")
        self.assertTrue(_are_units_physically_equivalent("ml", "m"))
        self.assertFalse(_are_units_physically_equivalent("und", "m"))

    def test_dinteles_mortero_five_root_fixes(self) -> None:
        """
        Verifica integralmente las 5 correcciones raíz para el caso de dinteles con mortero:
        1. B02007 ('S/C DE DINTELES Y MACHONES...') supera a B04001 ('CONSTRUCCION DE MEDIA CANA...')
           y las cláusulas negativas ('NO INCLUYE MACHONES, DINTELES...') son recortadas antes de indexar.
        2. infer_covenin_prefix asigna 'E334' a dinteles/machones (y nunca 'E511' de plomería).
        3. Cuando el usuario solicita 'con mortero de arena - cemento En interiores', se conservan
           el acero de refuerzo (CABILLA + ALAMBRE) y el encofrado ligero (MADERA + CLAVOS), pero
           se podan la PIEDRA PICADA, el VIBRADOR, la MEZCLADORA pesada y la CARRETILLA en interiores.
        4. El calibrador clasifica la partida compuesta en 'ml'/'m' como 'ALBANILERIA' (con benchmark
           'ALBANILERIA_m' ~ 22 m/día) y NO como 'ACERO' (700 kgf/día).
        5. El generador de consultas canónicas de materiales mapea cabilla 3/8", madera de encofrado,
           clavos y alambre N° 18 a la nomenclatura de cost360_materials.
        """
        q_dintel = "Construcción de dinteles con mortero de arena - cemento En interiores unidad ml"

        # 1a. Recorte de cláusulas negativas en paredes de bloques (E411011015)
        desc_pared_con_exclusion = (
            "CONSTRUCCION DE PAREDES DE BLOQUES HUECOS DE ARCILLA E=15 CM. "
            "NO INCLUYE MACHONES, DINTELES NI VIGAS DE CORONA."
        )
        stripped = _strip_negative_exclusion_clauses(desc_pared_con_exclusion)
        self.assertNotIn("DINTELES", stripped.upper())
        tokens_pared = _tokenize_for_lexical_idf(desc_pared_con_exclusion)
        self.assertNotIn(_stem_spanish_token("DINTELES"), tokens_pared)

        # 1b. Identidad de elemento constructivo civil y equivalencia física de unidad (ml == m)
        mats_q = detect_materials(q_dintel)
        self.assertIn("DINTEL_MACHON", mats_q.get("elemento_constructivo_civil", []))

        adj_b02007, _ = _apply_technical_scoring_adjustments_detailed(
            query_text=q_dintel,
            item_desc="S/C DE DINTELES Y MACHONES, INCLUYE ACERO DE REFUERZO",
            current_score=0.58,
            item_unit="m",
        )
        adj_b04001, _ = _apply_technical_scoring_adjustments_detailed(
            query_text=q_dintel,
            item_desc="CONSTRUCCION DE MEDIA CANA CON MORTERO DE CEMENTO-ARENA",
            current_score=0.61,
            item_unit="m3",
        )
        self.assertGreater(
            adj_b02007,
            adj_b04001,
            f"B02007 ({adj_b02007}) debe superar ampliamente a B04001 ({adj_b04001})",
        )

        # 2. Prefijo COVENIN correcto E334 (nunca E511)
        self.assertEqual(infer_covenin_prefix(q_dintel, "B04001"), "E334")
        self.assertEqual(infer_covenin_prefix("Construcción de media caña con mortero", "B04001"), "E418")

        # 3. Contrato de coherencia y poda: mortero sin concreto conserva acero y encofrado,
        #    pero elimina piedra picada, vibrador, mezcladora pesada y carretilla en interiores
        self.assertTrue(is_explicit_mortar_without_coarse_concrete(q_dintel))
        base_dintel = {
            "codpar": "B02007",
            "descripcion": "S/C DE DINTELES Y MACHONES, INCLUYE ACERO DE REFUERZO",
            "unidad": "m",
            "rendimiento": 25.0,
            "materiales": [
                {"codigo": "MAT-CON-0090", "descripcion": "CEMENTO GRIS PORTLAND SACO DE 42,5 KG", "unidad": "saco", "cantidad": 0.14},
                {"codigo": "MAT-CON-0028", "descripcion": "ARENA LAVADA", "unidad": "m3", "cantidad": 0.015},
                {"codigo": "MAT-AGR-009", "descripcion": "PIEDRA PICADA", "unidad": "m3", "cantidad": 0.025},
                {"codigo": "MAT-VAR-0783", "descripcion": "CABILLA ESTRIADA N60 FY = 4200 KGF/CM2", "unidad": "kgf", "cantidad": 2.25},
            ],
            "equipos": [
                {"codigo": "EQU-HER-001", "descripcion": "HERRAMIENTAS MENORES", "cantidad": 0.05},
                {"codigo": "EQU-GEN-599", "descripcion": "HERRAMIENTAS P/CORTAR Y DOBLAR ACERO/CAB", "cantidad": 0.1},
                {"codigo": "EQU-CON-045", "descripcion": "VIBRADOR A GASOLINA", "cantidad": 0.25},
                {"codigo": "EQU-CON-028", "descripcion": "MEZCLADORA DE CONCRETO TROMPO DE CAP= 0,40 M3 (1 SACO)", "cantidad": 0.25},
                {"codigo": "EQU-HER-030", "descripcion": "CARRETILLA DECAP= 55 LITROS CAUCHOS NEUMATICOS", "cantidad": 1.0},
            ],
            "mano_obra": [
                {"codigo": "MO-OFI-011", "descripcion": "ALBAÑIL DE 1RA -N5", "cantidad": 1.0},
                {"codigo": "MO-OFI-109", "descripcion": "MAQUINISTA DE CONCRETO DE 1RA -N5", "cantidad": 1.0},
                {"codigo": "MO-OBR-26", "descripcion": "OBRERO DE 1RA -N1", "cantidad": 2.0},
            ],
        }
        adapted_base, is_coherent, _ = apply_specialty_coherence_contract_to_base(base_dintel, q_dintel)
        self.assertTrue(is_coherent)
        adapted_mats = [m["descripcion"] for m in adapted_base["materiales"]]
        adapted_eqs = [e["descripcion"] for e in adapted_base["equipos"]]
        adapted_labs = [l["descripcion"] for l in adapted_base["mano_obra"]]
        self.assertIn("CABILLA ESTRIADA N60 FY = 4200 KGF/CM2", adapted_mats)
        self.assertNotIn("PIEDRA PICADA", adapted_mats)
        self.assertNotIn("VIBRADOR A GASOLINA", adapted_eqs)
        self.assertNotIn("MEZCLADORA DE CONCRETO TROMPO DE CAP= 0,40 M3 (1 SACO)", adapted_eqs)
        self.assertNotIn("CARRETILLA DECAP= 55 LITROS CAUCHOS NEUMATICOS", adapted_eqs)
        self.assertNotIn("MAQUINISTA DE CONCRETO DE 1RA -N5", adapted_labs)

        # 4. Clasificación de tipología y benchmark lineal en calibrador
        desc_generada = "S/C DE DINTELES CON MORTERO DE ARENA-CEMENTO EN INTERIORES, INCLUYE ACERO DE REFUERZO, ENCOFRADO Y DESENCOFRADO."
        self.assertEqual(classify_activity_typology(desc_generada, "ml", "E334SC001"), "ALBANILERIA")
        self.assertIn("ALBANILERIA_m", EMPERICAL_HH_BENCHMARKS)
        self.assertIn("CONCRETO_m", EMPERICAL_HH_BENCHMARKS)
        # Verificar que una partida real de acero en kgf sigue clasificándose como ACERO
        self.assertEqual(
            classify_activity_typology("PREPARACION Y COLOCACION DE ACERO DE REFUERZO FY=4200 KGF/CM2", "kgf", "E351"),
            "ACERO",
        )

        # 5. Consultas canónicas para reconciliación de materiales de obra civil
        q_cab = _build_canonical_material_queries('CABILLA DE ACERO CORRUGADO 3/8" (9.5 mm) GRADO 60', "kgf")
        self.assertTrue(any(kws == ["CABILLA", "3/8"] for kws, _ in q_cab))
        q_mad = _build_canonical_material_queries("MADERA ASERRADA PARA ENCOFRADO (TABLAS Y CUARTONES)", "m2")
        self.assertTrue(any(kws == ["ENCOFRADO", "MADERA"] for kws, _ in q_mad))
        q_clv = _build_canonical_material_queries('CLAVOS PARA ENCOFRADO DE 2 1/2"', "kg")
        self.assertTrue(any(kws[:2] == ["CLAVOS", "ACERO"] for kws, _ in q_clv))
        q_ala = _build_canonical_material_queries("ALAMBRE NEGRO N° 18 PARA AMARRE", "kg")
        self.assertTrue(any("ALAMBRE" in kws and "18" in kws for kws, _ in q_ala))

    def test_linear_element_by_unit_generalized_fixes(self) -> None:
        """
        Verifica las correcciones globales (no específicas de dintel) para elementos lineales pedidos en 'und':
        geometría, afinidad de unidad por longitud, benchmark lineal escalado, mezcla manual y refuerzo por defecto.
        """
        q = "Construcción de dintel entre 0.80 y 1.00 m con mezcla arena-cemento hecha manualmente En interiores unidad und"

        # Geometría compartida
        self.assertEqual(extract_linear_length_m(q), 0.9)
        self.assertEqual(extract_linear_length_m("viga de corona L=2.50 m"), 2.5)
        self.assertEqual(extract_linear_length_m("losa de 0.15 m de espesor"), None)
        self.assertTrue(is_linear_element(q))
        self.assertFalse(is_linear_element("pintura de paredes"))

        # Detección de mezcla fina y manual con distintas redacciones
        self.assertTrue(is_explicit_mortar_without_coarse_concrete(q))
        self.assertTrue(is_explicit_mortar_without_coarse_concrete("dintel con mezcla de arena y cemento"))
        self.assertFalse(is_explicit_mortar_without_coarse_concrete("dintel de concreto con mezcla arena-cemento"))
        self.assertTrue(is_manual_mixing_requested(q))
        self.assertFalse(is_manual_mixing_requested("dintel con mortero En interiores"))

        # A. Afinidad de unidad: 'und' + longitud declarada se comporta como 'm' y castiga bases volumétricas
        linear_score, linear_bd = _apply_technical_scoring_adjustments_detailed(
            query_text=q, item_desc="S/C DE DINTELES Y MACHONES, INCLUYE ACERO DE REFUERZO",
            current_score=0.60, item_unit="m",
        )
        volumetric_score, volumetric_bd = _apply_technical_scoring_adjustments_detailed(
            query_text=q, item_desc="CONCRETO DE F'C 180 PARA DINTELES, MACHONES Y VIGAS DE CORONA",
            current_score=0.60, item_unit="m3",
        )
        self.assertGreater(linear_score, volumetric_score + 0.20)

        # B. Calibrador: benchmark lineal escalado (CONCRETO_m x 0.9 m), no el CONCRETO_und de piezas pesadas
        labors = [
            {"codigo": "MO-OFI-06", "descripcion": "ALBAÑIL DE 1RA -N5", "cantidad": 0.5},
            {"codigo": "MO-OBR-26", "descripcion": "OBRERO DE 1RA -N1", "cantidad": 1.0},
        ]
        partida = {
            "description": "DINTEL DE MORTERO ARMADO ENTRE 0,80 Y 1,00 M DE LONGITUD, INCLUYE ENCOFRADO",
            "unit": "und",
            "performance": 6.0,
        }
        _, notes, trace = validate_and_calibrate_hh(partida, labors, "CONCRETO", return_trace=True)
        expected_p50 = round(EMPERICAL_HH_BENCHMARKS["CONCRETO_m"]["median"] * 0.9, 4)
        self.assertEqual(trace["benchmark_aplicado"]["mediana_p50"], expected_p50)
        self.assertLess(trace["benchmark_aplicado"]["mediana_p50"], 2.0)
        self.assertEqual(partida["performance"], 6.0, "HH=2.0 está dentro de banda: no se debe forzar rendimiento")

        # Sin longitud declarada: se preserva el rendimiento, jamás se impone CONCRETO_und
        partida_sin_largo = {"description": "DINTEL DE MORTERO ARMADO", "unit": "und", "performance": 6.0}
        _, _, trace2 = validate_and_calibrate_hh(partida_sin_largo, labors, "CONCRETO", return_trace=True)
        self.assertFalse(trace2["calibracion_aplicada"])
        self.assertEqual(partida_sin_largo["performance"], 6.0)

        # C. Poda: mezcla manual elimina mezcladora y operador; mortero elimina vibrador y piedra picada
        result = {
            "partida": {"description": "DINTEL", "unit": "und"},
            "materials": [{"codigo": "M1", "descripcion": "PIEDRA PICADA PARA CONCRETO", "unidad": "m3", "cantidad": 0.02}],
            "equipments": [
                {"codigo": "E1", "descripcion": "MEZCLADORA P/CONCRETO CAP=0,40 M3 12,2 H", "cantidad": 0.1},
                {"codigo": "E2", "descripcion": "VIBRADOR A GASOLINA PARA CONCRETO", "cantidad": 1},
                {"codigo": "E3", "descripcion": "HERRAMIENTAS MENORES", "cantidad": 1},
            ],
            "labors": [
                {"codigo": "L1", "descripcion": "MAQUINISTA DE CONCRETO DE 2DA -N3", "cantidad": 1},
                {"codigo": "L2", "descripcion": "ALBAÑIL DE 1RA -N5", "cantidad": 1},
            ],
        }
        enforce_discordant_inputs_purging(result, q, {})
        eq_names = [e["descripcion"] for e in result["equipments"]]
        self.assertEqual(eq_names, ["HERRAMIENTAS MENORES"])
        self.assertEqual([m["descripcion"] for m in result["materials"]], [])
        self.assertEqual([l["descripcion"] for l in result["labors"]], ["ALBAÑIL DE 1RA -N5"])

        # D/E. Refuerzo por defecto, descripción coherente con la mezcla pedida y dosificación plausible
        apu = {
            "partida": {
                "description": "CONSTRUCCIÓN DE DINTEL DE CONCRETO ARMADO ENTRE 0,80 Y 1,00 M DE LONGITUD. NO INCLUYE REFUERZO METÁLICO.",
                "unit": "und",
            },
            "materials": [
                {"descripcion": "CEMENTO GRIS PORTLAND SACO DE 42,5 KG", "unidad": "sco", "cantidad": 0.45},
                {"descripcion": "ARENA LAVADA", "unidad": "m3", "cantidad": 0.01},
                {"descripcion": "AGUA PARA USO INDUSTRIAL - RED HIDROVEN", "unidad": "m3", "cantidad": 0.1},
            ],
            "notas_adaptacion": [],
        }
        align_description_with_requested_mix(apu, q)
        enforce_reinforcement_for_structural_elements(apu, q)
        enforce_fine_mix_plausibility(apu, q)
        mats = {m["descripcion"]: m for m in apu["materials"]}
        steel = next(m for d, m in mats.items() if d.startswith("CABILLA"))
        self.assertAlmostEqual(steel["cantidad"], round(2.8 * 0.9, 3))
        self.assertTrue(any(d.startswith("ALAMBRE") for d in mats))
        self.assertTrue(any(d.startswith("MADERA") for d in mats))
        self.assertNotIn("NO INCLUYE REFUERZO", apu["partida"]["description"].upper().replace("Á", "A"))
        self.assertIn("INCLUYE ACERO DE REFUERZO", apu["partida"]["description"].upper())
        self.assertNotIn("CONCRETO", apu["partida"]["description"].upper())
        self.assertGreaterEqual(mats["ARENA LAVADA"]["cantidad"], 0.45 * 0.06)
        self.assertLessEqual(mats["AGUA PARA USO INDUSTRIAL - RED HIDROVEN"]["cantidad"], 0.45 * 0.05 + 1e-9)
        self.assertTrue(any("[SUPUESTO]" in n for n in apu["notas_adaptacion"]))

        # El usuario puede excluir explícitamente el acero: se respeta
        apu2 = {"partida": {"description": "DINTEL", "unit": "m"}, "materials": [], "notas_adaptacion": []}
        enforce_reinforcement_for_structural_elements(apu2, "dintel sin acero de refuerzo ni encofrado unidad m")
        self.assertEqual(apu2["materials"], [])

        # Elementos no estructurales no reciben refuerzo
        apu3 = {"partida": {"description": "FRISO", "unit": "m2"}, "materials": [], "notas_adaptacion": []}
        enforce_reinforcement_for_structural_elements(apu3, "friso liso unidad m2")
        self.assertEqual(apu3["materials"], [])

    def test_valve_mixed_inches_and_truncated_diameter_guard(self) -> None:
        """
        Verifica que en specs_matcher:
        1. Pulgadas mixtas ('1 1/2"', '2 1/2"') NO se extraigan como '1/2"' y generen conflicto contra '1/2"'.
        2. Descripciones truncadas que terminan en ' D' o ' D=' (sin diámetro) generen conflicto
           cuando la consulta pide un diámetro específico (ej. 1/2" o 13 mm).
        """
        specs_half = _extract_technical_specs('LLAVE DE PASO TIPO COMPUERTA DE BRONCE D= 1/2" (13 MM)')
        specs_two_half = _extract_technical_specs('LLAVE DE PASO TIPO COMPUERTA DE BRONCE D= 2 1/2" (64 MM)')
        specs_trunc = _extract_technical_specs("LLAVE DE PASO TIPO COMPUERTA DE BRONCE D")

        self.assertEqual(specs_half["inches"], {"1/2"})
        self.assertEqual(specs_two_half["inches"], {"2 1/2"})
        self.assertEqual(specs_trunc["truncated_diam"], {"TRUNCATED"})

        self.assertFalse(
            _has_technical_spec_conflict(
                'LLAVE DE PASO TIPO COMPUERTA DE BRONCE D= 1/2"',
                'LLAVE DE PASO TIPO COMPUERTA DE BRONCE D= 1/2" (13 MM)',
            )
        )
        self.assertTrue(
            _has_technical_spec_conflict(
                'LLAVE DE PASO TIPO COMPUERTA DE BRONCE D= 1/2"',
                'LLAVE DE PASO TIPO COMPUERTA DE BRONCE D= 2 1/2" (64 MM)',
            )
        )
        self.assertTrue(
            _has_technical_spec_conflict(
                'LLAVE DE PASO TIPO COMPUERTA DE BRONCE D= 1/2"',
                "LLAVE DE PASO TIPO COMPUERTA DE BRONCE D",
            )
        )


if __name__ == "__main__":
    unittest.main()


