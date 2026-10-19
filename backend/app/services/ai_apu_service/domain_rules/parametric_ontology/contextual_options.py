"""Selector dinámico de opciones de chips contextualizadas según el elemento constructivo."""

import re
from typing import List


def get_contextual_options(
    family_id: str,
    param_id: str,
    raw_query: str,
    norm_query: str,
    default_options: List[str]
) -> List[str]:
    """Selecciona chips de opciones dinámicamente contextualizados según el elemento específico.

    Ejemplos: puertas vs portones vs rejas vs barandas.
    """
    # 1. Herrería y carpintería metálica
    if family_id == "HERRERIA_ESTRUCTURAS_MET_DISCRETAS":
        if re.search(r"\bpuertas?\b", norm_query):
            return [
                "Puerta metálica 0.90 m x 2.10 m (Paso estándar)",
                "Puerta metálica 1.00 m x 2.10 m (Paso amplio)",
                "Puerta metálica 0.80 m x 2.10 m (Paso secundario)",
                "Puerta metálica doble hoja 1.80 m x 2.10 m",
                "Puerta metálica de seguridad 0.90 m x 2.10 m",
            ]
        if re.search(r"\b(porton|portones)\b", norm_query):
            return [
                "Portón 3.00 m x 2.00 m (Vehicular residencial)",
                "Portón 4.00 m x 2.50 m (Vehicular amplio)",
                "Portón corredizo 3.50 m x 2.20 m",
                "Portón batiente de dos hojas 3.00 m x 2.20 m",
                "Portón peatonal / vehicular 2.50 m x 2.00 m",
            ]
        if re.search(r"\b(rejas?|protector(?:es)?)\b", norm_query):
            return [
                "Reja para ventana 1.50 m x 1.20 m",
                "Reja para ventana 1.00 m x 1.00 m",
                "Reja para ventana 1.20 m x 1.50 m",
                "Reja para ventana 2.00 m x 1.50 m",
                "Reja de protección perimetral 2.00 m x 2.00 m",
            ]
        if re.search(r"\b(barandas?|pasamanos?)\b", norm_query):
            return [
                "Baranda metálica h=0.90 m",
                "Baranda metálica h=1.00 m con pasamanos",
                "Pasamanos en tubo redondo 2 pulg",
                "Baranda para escalera con parales y tubos horizontales",
            ]

    # 2. Puertas, ventanas y carpintería general
    elif family_id == "PUERTAS_VENTANAS_CARPINTERIA":
        if re.search(r"\bpuertas?\b", norm_query):
            if re.search(r"\b(metal|met[aá]lic[ao]|hierro|chapa|l[aá]mina)\b", norm_query):
                return [
                    "Puerta metálica 0.90 m x 2.10 m (Paso estándar)",
                    "Puerta metálica 1.00 m x 2.10 m (Paso amplio)",
                    "Puerta metálica 0.80 m x 2.10 m (Paso secundario)",
                    "Puerta metálica doble hoja 1.80 m x 2.10 m",
                    "Puerta metálica de seguridad 0.90 m x 2.10 m",
                ]
            return [
                "Puerta 0.90 m x 2.10 m Madera Entamborada",
                "Puerta 0.80 m x 2.10 m Madera Entamborada",
                "Puerta 1.00 m x 2.10 m Madera Maciza",
                "Puerta metálica 0.90 m x 2.10 m (Hierro/Lámina)",
                "Puerta doble hoja 1.80 m x 2.10 m",
            ]
        if re.search(r"\bventanas?\b", norm_query):
            return [
                "Ventana 1.20 m x 1.50 m Aluminio y Vidrio",
                "Ventana 1.50 m x 1.50 m Aluminio y Vidrio",
                "Ventana 1.00 m x 1.00 m Aluminio y Vidrio",
                "Ventana corrediza 2.00 m x 1.50 m",
                "Ventana basculante 0.60 m x 0.40 m",
            ]
        if re.search(r"\b(porton|portones)\b", norm_query):
            return [
                "Portón 3.00 m x 2.00 m (Vehicular residencial)",
                "Portón 4.00 m x 2.50 m (Vehicular amplio)",
                "Portón corredizo 3.50 m x 2.20 m",
                "Portón batiente de dos hojas 3.00 m x 2.20 m",
                "Portón peatonal / vehicular 2.50 m x 2.00 m",
            ]

    # 3. Pinturas y recubrimientos de elementos discretos
    elif family_id == "PINTURA_RECUBRIMIENTOS_DISCRETOS":
        if re.search(r"\bpuertas?\b", norm_query):
            return [
                "Puerta 1 hoja ambas caras (aprox. 4 m²)",
                "Puerta doble hoja ambas caras (aprox. 8 m²)",
                "Puertas varias (aprox. 15 m²)",
            ]
        if re.search(r"\b(rejas?|protector(?:es)?)\b", norm_query):
            return [
                "Reja para ventana (aprox. 3 m²)",
                "Reja mediana / cerca (aprox. 8 m²)",
                "Rejas perimetrales (aprox. 20 m²)",
            ]
        if re.search(r"\b(porton|portones)\b", norm_query):
            return [
                "Portón mediano ambas caras (aprox. 12 m²)",
                "Portón amplio ambas caras (aprox. 20 m²)",
                "Portón grande industrial (aprox. 35 m²)",
            ]

    # 4. Elementos estructurales discretos (Dinteles, Machones, Vigas de Corona)
    elif family_id == "ELEMENTOS_ESTRUCTURALES_DISCRETOS":
        if re.search(r"\bdintel(?:es)?\b", norm_query):
            return [
                "0.90 m x 15 cm x 5 cm (Dintel puerta estándar)",
                "1.00 m x 10 cm x 5 cm (Dintel tabique fino)",
                "1.20 m x 15 cm x 10 cm (Dintel / Machón mediano)",
                "1.50 m x 20 cm x 15 cm (Dintel amplio)",
            ]
        if re.search(r"\b(machon|machones|columnetas?)\b", norm_query):
            return [
                "Machón 15 cm x 15 cm x 2.50 m de altura",
                "Machón 20 cm x 20 cm x 3.00 m de altura",
                "Machón de amarre 15 cm x 20 cm",
            ]
        if re.search(r"\b(vigas?\s+corona|viga\s+de\s+corona|corona)\b", norm_query):
            return [
                "Viga de corona 15 cm x 20 cm",
                "Viga de corona 20 cm x 20 cm",
                "Viga de corona 15 cm x 15 cm",
            ]

    return default_options
