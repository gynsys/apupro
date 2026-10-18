import os
import sys
import unittest
from typing import Any, Dict

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.ai_apu_service.domain_rules.parametric_ontology import (
    evaluate_parametric_ontology_contract,
    ONTOLOGY_REGISTRY,
)
from app.services.ai_apu_service.domain_rules.structural_requirements import (
    enforce_fine_mix_plausibility,
)
from app.services.apu_input_validator import validate_rag_signals


class TestParametricOntology(unittest.TestCase):
    """
    Suite de pruebas para validar la Ontología Paramétrica Universal de Obras Civiles (MOPTC).
    Verifica que las consultas sin parámetros indispensables sean interceptadas antes del RAG
    sin asumir mezclas ni rendimientos erróneos, y que las respuestas con parámetros pasen limpiamente.
    """

    def test_sobrepiso_missing_both_thickness_and_mix(self) -> None:
        """Caso del usuario: sobrepiso requemado sin espesor ni mezcla debe pedir ambas cosas."""
        query = "costruccion de sobrepiso requemado utilizando oxido color negro"
        result = evaluate_parametric_ontology_contract(query)

        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "clarification_needed")
        self.assertEqual(result["clarification_type"], "parametric_specification_required")
        self.assertEqual(result["_internal_code"], "ONTOLOGY_MISSING_ESPESOR_AND_TIPO_MEZCLA")
        self.assertEqual(len(result["questions"]), 2)
        self.assertIn("espesor", result["questions"][0].lower())
        self.assertIn("mortero", result["questions"][1].lower())
        self.assertTrue(len(result["options"]) >= 3)
        self.assertTrue(any("e=3.0 cm" in opt for opt in result["options"]))
        self.assertTrue(any("1:3" in opt for opt in result["options"]))

    def test_sobrepiso_satisfied_passes(self) -> None:
        """Sobrepiso con espesor y mezcla explicitados debe pasar el contrato ontológico."""
        query = "construccion de sobrepiso requemado con oxido negro, e=3.0 cm, mortero cemento-arena 1:3"
        result = evaluate_parametric_ontology_contract(query)
        self.assertIsNone(result)

    def test_sobrepiso_demolition_is_excluded(self) -> None:
        """Demolición o picado de sobrepiso no debe pedir espesor de vaciado ni dosificación de mortero."""
        query = "demolicion y picado de sobrepiso existente con rotomartillo"
        result = evaluate_parametric_ontology_contract(query)
        self.assertIsNone(result)

    def test_concreto_estructural_missing_fc(self) -> None:
        """Vigas de concreto sin f'c debe exigir resistencia."""
        query = "vaciado de concreto en vigas de carga y columnas"
        result = evaluate_parametric_ontology_contract(query)

        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "clarification_needed")
        self.assertEqual(result["_internal_code"], "ONTOLOGY_MISSING_RESISTENCIA_CONCRETO")
        self.assertTrue(any("210" in opt for opt in result["options"]))
        self.assertTrue(any("250" in opt for opt in result["options"]))

    def test_concreto_estructural_satisfied(self) -> None:
        """Vigas de concreto con f'c=250 kgf/cm2 pasa limpiamente."""
        query = "vaciado de concreto en vigas de carga f'c=250 kgf/cm2, incluye encofrado"
        result = evaluate_parametric_ontology_contract(query)
        self.assertIsNone(result)

    def test_pared_bloques_missing_thickness(self) -> None:
        """Pared de bloques sin espesor debe pedir espesor."""
        query = "construccion de pared de bloques de arcilla piñata"
        result = evaluate_parametric_ontology_contract(query)

        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "clarification_needed")
        self.assertEqual(result["_internal_code"], "ONTOLOGY_MISSING_ESPESOR_BLOQUE")
        self.assertIn("e=15 cm", result["options"])

    def test_pared_bloques_demolition_excluded(self) -> None:
        """Demolición de pared no pide espesor de bloque."""
        query = "demolicion de pared de bloques de arcilla con mandarria"
        result = evaluate_parametric_ontology_contract(query)
        self.assertIsNone(result)

    def test_tuberia_missing_diameter(self) -> None:
        """Tubería sin diámetro debe exigir diámetro."""
        query = "suministro e instalacion de tuberia de pvc para aguas blancas"
        result = evaluate_parametric_ontology_contract(query)

        self.assertIsNotNone(result)
        self.assertEqual(result["_internal_code"], "ONTOLOGY_MISSING_DIAMETRO")
        self.assertTrue(any('1/2"' in opt for opt in result["options"]))

    def test_tuberia_satisfied(self) -> None:
        """Tubería con diámetro especificado pasa."""
        query = "suministro e instalacion de tuberia pvc 1/2 pulgada para aguas blancas"
        result = evaluate_parametric_ontology_contract(query)
        self.assertIsNone(result)

    def test_bomba_missing_power(self) -> None:
        """Bomba sin HP exige potencia."""
        query = "suministro e instalacion de bomba centrifuga para sistema hidroneumatico"
        result = evaluate_parametric_ontology_contract(query)

        self.assertIsNotNone(result)
        self.assertEqual(result["_internal_code"], "ONTOLOGY_MISSING_POTENCIA")
        self.assertTrue(any("2 HP" in opt for opt in result["options"]))

    def test_validate_rag_signals_integration(self) -> None:
        """Verifica que validate_rag_signals integre de forma transparente la ontología."""
        query = "costruccion de sobrepiso requemado utilizando oxido color negro"
        res = validate_rag_signals(query, candidates=None)

        self.assertIsNotNone(res)
        veredicto, mensaje, codigo, options = res
        self.assertEqual(veredicto, "clarification_needed")
        self.assertEqual(codigo, "ONTOLOGY_MISSING_ESPESOR_AND_TIPO_MEZCLA")
        self.assertTrue(len(options) >= 3)
 
    def test_pintura_impermeabilizante_en_losas_not_asking_slab_thickness(self) -> None:
        """Pintura o acabado impermeabilizante sobre losa no debe activar contrato de losa de concreto ni pedir espesor."""
        query = "Pintura en losas con pintura impermeabilizante en exteriores todo incluido unidad m2"
        result = evaluate_parametric_ontology_contract(query)
        self.assertIsNone(result)

    def test_impermeabilizacion_con_pintura_impermeabilizante_passes(self) -> None:
        """Impermeabilización con pintura impermeabilizante especificada pasa ontología sin requerir aclaratorias."""
        query = "Impermeabilizacion de losa de techo con pintura impermeabilizante elastomerica en exteriores unidad m2"
        result = evaluate_parametric_ontology_contract(query)
        self.assertIsNone(result)

    def test_construccion_losa_concreto_missing_thickness_triggers(self) -> None:
        """Vaciado o construcción de losa de concreto sin espesor sí debe activar ONTOLOGY_MISSING_ESPESOR."""
        query = "Construccion de losa maciza de concreto en entrepiso f'c=250 kgf/cm2"
        result = evaluate_parametric_ontology_contract(query)
        self.assertIsNotNone(result)
        self.assertEqual(result["_internal_code"], "ONTOLOGY_MISSING_ESPESOR")

    def test_pintura_impermeabilizante_en_losas_validate_rag_signals(self) -> None:
        """Pintura en losas con pintura impermeabilizante pasa validate_rag_signals sin pedir espesor de losa."""
        query = "Pintura en losas con pintura impermeabilizante en exteriores todo incluido unidad m2"
        res = validate_rag_signals(query, candidates=None)
        self.assertIsNone(res)

    def test_dintel_und_missing_dimensions(self) -> None:
        """Caso del usuario: dintel en unidad und sin dimensiones debe pedir dimensiones físicas y mezcla."""
        query = "Construcción de dintel para puertas con mezcla de arena-cemento elaborada manualmente En interiores unidad und"
        result = evaluate_parametric_ontology_contract(query, "und")

        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "clarification_needed")
        self.assertEqual(result["_internal_code"], "ONTOLOGY_MISSING_DIMENSIONES_SECCION")
        self.assertTrue(len(result["options"]) >= 3)
        self.assertTrue(any("0.90 m x 15 cm x 5 cm" in opt for opt in result["options"]))

    def test_dintel_und_with_dimensions_passes(self) -> None:
        """Dintel en unidad und con dimensiones y mezcla explicitadas pasa limpiamente."""
        query = "Construcción de dintel para puertas con mezcla arena-cemento 0.90 m x 15 cm x 5 cm unidad und"
        result = evaluate_parametric_ontology_contract(query, "und")
        self.assertIsNone(result)

    def test_dintel_und_with_range_dimensions_passes(self) -> None:
        """Dintel en unidad und con especificación de rango dimensional pasa limpiamente."""
        query = "Construcción de dintel para puertas de entre 0.8 a 1.00 m con ancho entre 0.10 y 0.15 de ancho y alto de 5 cm unidad und"
        result = evaluate_parametric_ontology_contract(query, "und")
        self.assertIsNone(result)

    def test_porton_metalico_missing_dimensions(self) -> None:
        """Portón metálico en unidad und sin dimensiones exige dimensiones."""
        query = "Fabricación e instalación de portón metálico corredizo en lámina estriada unidad und"
        result = evaluate_parametric_ontology_contract(query, "und")

        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "clarification_needed")
        self.assertEqual(result["_internal_code"], "ONTOLOGY_MISSING_TIPO_MATERIAL_DIMENSIONES")
        self.assertTrue(len(result["options"]) >= 3)

    def test_generador_electrico_missing_capacity(self) -> None:
        """Generador eléctrico / planta eléctrica sin kVA exige capacidad."""
        query = "Suministro e instalación de planta eléctrica a gasoil con transferencia automática unidad und"
        result = evaluate_parametric_ontology_contract(query, "und")

        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "clarification_needed")
        self.assertEqual(result["_internal_code"], "ONTOLOGY_MISSING_POTENCIA_KVA")
        self.assertTrue(any("kVA" in opt for opt in result["options"]))

    def test_breaker_missing_poles_amps(self) -> None:
        """Breaker termomagnético sin polos o amperaje exige especificación."""
        query = "Suministro e instalación de interruptor termomagnético en tablero principal unidad pza"
        result = evaluate_parametric_ontology_contract(query, "pza")

        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "clarification_needed")
        self.assertEqual(result["_internal_code"], "ONTOLOGY_MISSING_CAPACIDAD_AMPERAJE_POLOS")
        self.assertTrue(any("polo" in opt.lower() or "1x" in opt or "2x" in opt for opt in result["options"]))

    def test_enforce_fine_mix_plausibility_dintel_volumetric(self) -> None:
        """
        Verifica que enforce_fine_mix_plausibility calibre automáticamente el cemento
        cuando el LLM produce un valor sobredimensionado (0.50 sacos) para un dintel discreto
        de dimensiones reales (0.90 m x 15 cm x 5 cm -> V=0.00675 m3 -> 0.0716 sacos).
        """
        result = {
            "partida": {
                "unit": "und",
                "description": "Construcción de dintel para puertas con mezcla arena-cemento 0.90 m x 15 cm x 5 cm"
            },
            "materials": [
                {
                    "descripcion": "CEMENTO PORTLAND GRIS TIPO I",
                    "unidad": "saco",
                    "cantidad": 0.50,
                    "precio_unitario": 9.5
                },
                {
                    "descripcion": "ARENA LAVADA",
                    "unidad": "m3",
                    "cantidad": 0.05,
                    "precio_unitario": 28.0
                },
                {
                    "descripcion": "AGUA",
                    "unidad": "m3",
                    "cantidad": 0.015,
                    "precio_unitario": 5.0
                }
            ],
            "notas_adaptacion": []
        }
        user_desc = "Construcción de dintel para puertas con mezcla arena-cemento 0.90 m x 15 cm x 5 cm unidad und"
        enforce_fine_mix_plausibility(result, user_desc)

        cement = next(m for m in result["materials"] if "CEMENTO" in m["descripcion"])
        sand = next(m for m in result["materials"] if "ARENA" in m["descripcion"])
        water = next(m for m in result["materials"] if "AGUA" in m["descripcion"])

        # Cemento debe estar calibrado a ~0.0716 sacos (no 0.50)
        self.assertAlmostEqual(cement["cantidad"], 0.0716, places=3)
        # Arena debe estar acotada proporcionalmente al saco calibrado
        self.assertLessEqual(sand["cantidad"], 0.012)
        # Agua acotada al máximo físico admisible (0.0036 m3 redondeado a 4 decimales)
        self.assertLessEqual(water["cantidad"], 0.004)

    def test_herreria_reja_options_and_free_text_satisfied(self) -> None:
        """
        Verifica que las opciones sugeridas por la aclaratoria y las respuestas libres
        con dimensiones intermedias (1.50 m x 1.20 m) o palabras estándar pasen sin volver a pedir aclaratoria.
        """
        # Caso 1: Opción sugerida por el chatbot con unidades intermedias ('m x')
        query_chip = "Construcción de portones, rejas y estructuras metálicas, Reja para ventana 1.50 m x 1.20 m"
        result_chip = evaluate_parametric_ontology_contract(query_chip)
        self.assertIsNone(result_chip, "El chip '1.50 m x 1.20 m' no debe volver a pedir aclaratoria (anti-loop)")

        # Caso 2: Opción de portón vehicular amplio
        query_porton = "Fabricación de portón 4.00 m x 2.50 m (Vehicular amplio)"
        result_porton = evaluate_parametric_ontology_contract(query_porton)
        self.assertIsNone(result_porton)

        # Caso 3: Entrada libre con medida estándar
        query_std = "Construcción de reja metálica para ventana medida estándar"
        result_std = evaluate_parametric_ontology_contract(query_std)
        self.assertIsNone(result_std)

        # Caso 4: Entrada libre 'según plano'
        query_plano = "Fabricación de portón metálico de dos hojas según plano"
        result_plano = evaluate_parametric_ontology_contract(query_plano)
        self.assertIsNone(result_plano)

    def test_puertas_ventanas_options_satisfied(self) -> None:
        """Verifica que 'Portón 3.00 x 2.00 m Metálico Corredizo' y puertas con medidas pasen limpiamente."""
        query_corredizo = "Suministro e instalación de Portón 3.00 x 2.00 m Metálico Corredizo"
        result_corredizo = evaluate_parametric_ontology_contract(query_corredizo)
        self.assertIsNone(result_corredizo)

        query_madera = "Puerta 0.90 x 2.10 m Madera Entamborada"
        result_madera = evaluate_parametric_ontology_contract(query_madera)
        self.assertIsNone(result_madera)

    def test_flexible_numeric_and_standard_inputs(self) -> None:
        """Verifica que respuestas flexibles numéricas o con 'estándar' sean aceptadas."""
        # Concreto con solo el número de resistencia
        self.assertIsNone(evaluate_parametric_ontology_contract("vaciado de concreto en vigas de carga 250"))
        self.assertIsNone(evaluate_parametric_ontology_contract("columnas de concreto resistencia estándar"))

        # Mampostería con 'bloque de 15'
        self.assertIsNone(evaluate_parametric_ontology_contract("construcción de pared con bloque de 15"))

        # Tubería con 'diámetro estándar'
        self.assertIsNone(evaluate_parametric_ontology_contract("instalación de tubería pvc diámetro estándar"))

    def test_reparacion_puertas_metalicas_gl_passes(self) -> None:
        """Caso real del usuario: Reparación de puertas metálicas con unidad Gl (2 días) no debe pedir aclaratorias."""
        query = "Reparación de puertas metálicas cepillado de óxido, aplicación de fondo anticorrosivo y esmalte unidad Gl 2 días"
        result = evaluate_parametric_ontology_contract(query, "Gl")
        self.assertIsNone(result, "Reparación en Gl con días de cuadrilla no debe pedir dimensiones físicas de fabricación")

    def test_reparacion_puertas_metalicas_pza_passes(self) -> None:
        """Reparación o cepillado de puertas metálicas en unidad pza no debe pedir fabricación nueva."""
        query = "Reparación de puertas metálicas cepillado de óxido, aplicación de fondo anticorrosivo y esmalte unidad pza"
        result = evaluate_parametric_ontology_contract(query, "pza")
        self.assertIsNone(result, "Reparación de elemento existente no debe pedir dimensiones de fabricación de taller")

    def test_contextual_chips_puerta_prioritizes_doors(self) -> None:
        """Cuando la obra es una fabricación de puerta nueva, las opciones deben ser de puertas y no mezclar portones/rejas."""
        query = "Fabricación e instalación de puertas metálicas en exteriores unidad und"
        result = evaluate_parametric_ontology_contract(query, "und")
        self.assertIsNotNone(result)
        self.assertEqual(result["status"], "clarification_needed")
        self.assertIn("puertas metálicas", result["clarification_message"])
        # Las opciones sugeridas deben contener medidas de puertas
        options = result["options"]
        self.assertTrue(any("0.90 m x 2.10 m" in opt for opt in options))
        self.assertTrue(any("doble hoja" in opt for opt in options))
        self.assertTrue(all("Portón" not in opt and "Reja" not in opt for opt in options))

    def test_contextual_chips_porton_prioritizes_gates(self) -> None:
        """Cuando la obra es un portón nuevo, las opciones deben ser de portones."""
        query = "Fabricación de portón de lámina estriada unidad und"
        result = evaluate_parametric_ontology_contract(query, "und")
        self.assertIsNotNone(result)
        self.assertIn("portones", result["clarification_message"])
        options = result["options"]
        self.assertTrue(any("3.00 m x 2.00 m" in opt for opt in options))
        self.assertTrue(all("Reja" not in opt and "Puerta metálica" not in opt for opt in options))

    def test_contextual_chips_reja_prioritizes_window_grilles(self) -> None:
        """Cuando la obra es una reja nueva, las opciones deben ser de rejas de ventana."""
        query = "Construcción de reja para ventana con cabilla cuadrada unidad und"
        result = evaluate_parametric_ontology_contract(query, "und")
        self.assertIsNotNone(result)
        self.assertIn("rejas", result["clarification_message"])
        options = result["options"]
        self.assertTrue(any("1.50 m x 1.20 m" in opt for opt in options))
        self.assertTrue(any("1.00 m x 1.00 m" in opt for opt in options))
        self.assertTrue(all("Portón" not in opt and "Puerta metálica" not in opt for opt in options))

    def test_saneamiento_trampa_grasa_vactor_passes(self) -> None:
        """Saneamiento de trampa de grasa colapsada con camión váctor no debe pedir tuberías ni concreto."""
        query = "Saneamiento de trampas de grasa colapsadas vaciado y limpieza profunda con camión váctor unidad Gl"
        result = evaluate_parametric_ontology_contract(query, "Gl")
        self.assertIsNone(result)

    def test_mantenimiento_bomba_passes(self) -> None:
        """Mantenimiento preventivo de bomba de agua no debe pedir HP."""
        query = "Mantenimiento preventivo y revisión de electrobomba hidroneumática unidad Gl"
        result = evaluate_parametric_ontology_contract(query, "Gl")
        self.assertIsNone(result)

    def test_resane_vigas_concreto_passes(self) -> None:
        """Resane o reparación de fisuras en vigas de concreto no debe pedir f'c estructural."""
        query = "Reparación y resanado superficial de fisuras en vigas de concreto con mortero epóxico unidad ml"
        result = evaluate_parametric_ontology_contract(query, "ml")
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()


