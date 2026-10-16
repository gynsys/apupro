import unittest

from app.services.dimension_service import (
    extract_unified_dimensions,
    score_dimension_match,
)
from app.services.ai_search import (
    _stem_spanish_token,
    _tokenize_for_lexical_idf,
    ai_engine,
)
from app.services.synonyms_service import expand_technical_synonyms


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


if __name__ == "__main__":
    unittest.main()
