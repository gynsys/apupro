import os
import sys
import re
import json
import unicodedata
from collections import Counter
from typing import Set, Dict, List

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.db.base import SessionLocal
from app.core.logging import logger

STOPWORDS: Set[str] = {
    "de", "en", "para", "con", "el", "la", "los", "las", "un", "una",
    "del", "al", "por", "y", "a", "sin", "no", "se", "su", "sus", "lo", "que", "es", "son", "o",
    "hasta", "desde", "sobre", "bajo", "entre", "cada", "mas", "menos", "tipo", "clase",
    "incluye", "incluyendo", "incluir", "excluye", "excluyendo", "excluir", "no incluye",
    "segun", "norma", "normas", "covenin", "especificaciones", "detalles", "planos",
    "calidad", "primera", "segunda", "tercera", "alta", "baja", "media", "variable",
    "color", "acabado", "forma", "tamano", "medida", "medidas", "espesor", "diametro",
    "longitud", "ancho", "alto", "altura", "profundidad", "area", "volumen", "peso",
    "kg", "m", "m2", "m3", "ml", "und", "pza", "pto", "ton", "gl", "lt", "km",
    "cm", "mm", "pulg", "pulgadas", "pies", "yardas", "hrs", "dia", "dias",
}

# Verbos y acciones base indispensables de la construcción y jerga venezolana
ESSENTIAL_ACTIONS: Set[str] = {
    # Demolición y tierra
    "demolicion", "demoler", "tumbar", "derribar", "picar", "desmantelar", "desmantelamiento",
    "excavacion", "excavar", "vaciado", "vaciar", "echar", "armado", "armar", "encofrado", "encofrar",
    "desencofrado", "desencofrar", "relleno", "rellenar", "compactacion", "compactar",
    "nivelacion", "nivelar", "replanteo", "replantear", "trazo", "trazar", "achique", "achicar",
    "desmalezamiento", "desmalezar", "deforestacion", "deforestar", "tala", "talar", "desraizado",
    "bote", "botar", "acarreo", "acarrear", "transporte", "transportar", "traslado", "trasladar",
    "carga", "cargar", "descarga", "descargar", "carguio", "apilamiento", "apilar",
    # Albañilería y estructuras
    "construccion", "construir", "levantar", "fabricacion", "fabricar", "hechura", "elaboracion", "elaborar",
    "asentado", "asentar", "pegado", "pegar", "colocacion", "colocar", "instalacion", "instalar",
    "suministro", "suministrar", "proveer", "dotacion", "confeccion", "confeccionar", "montaje", "montar",
    "desmontaje", "desmontar", "remocion", "remover", "extraccion", "extraer",
    "curado", "curar", "vibrado", "vibrar", "friso", "frisar", "revoque", "revocar",
    "enlucido", "enlucir", "salpicado", "salpicar", "estucado", "estucar", "encamisado", "encamisar",
    "empaste", "empastar", "pintura", "pintar", "impermeabilizacion", "impermeabilizar",
    "revestimiento", "revestir", "enchapado", "enchapar", "adoquinado", "adoquinar",
    "asfaltado", "asfaltar", "pavimentacion", "pavimentar", "escarificado", "escarificar",
    # MEP y mantenimiento
    "canalizacion", "canalizar", "cableado", "cablear", "tendido", "tender", "empalme", "empalmar",
    "conexion", "conectar", "soldadura", "soldar", "termofusion", "termofusionar",
    "limpieza", "limpiar", "reparacion", "reparar", "mantenimiento", "adecuacion", "adecuar",
    "rehabilitacion", "rehabilitar", "sustitucion", "sustituir", "cambio", "cambiar",
    "prueba", "pruebas", "probar", "ensayo", "ensayos", "calibracion", "calibrar",
    "esmerilado", "esmerilar", "pulido", "pulir", "picado", "saneamiento", "sanear"
}

# Elementos físicos y materiales indispensables
ESSENTIAL_ELEMENTS: Set[str] = {
    # Estructuras y tierra
    "pared", "paredes", "muro", "muros", "tabique", "tabiques", "bloque", "bloques", "ladrillo", "ladrillos",
    "piso", "pisos", "pavimento", "pavimentos", "acera", "aceras", "brocal", "brocales", "cuneta", "cunetas",
    "techo", "techos", "cubierta", "cubiertas", "cielo", "cielorraso", "machimbrado",
    "losa", "losas", "viga", "vigas", "columna", "columnas", "zapata", "zapatas", "fundacion", "fundaciones",
    "machon", "machones", "dintel", "dinteles", "pedestal", "pedestales", "pilote", "pilotes", "cabezal", "cabezales",
    "riostra", "riostras", "reticular", "nervada", "maciza", "aligerada", "entrepiso", "escalera", "escaleras",
    "concreto", "hormigon", "cemento", "mortero", "adobe", "arena", "piedra", "ripio", "agregado", "agregados",
    "acero", "cabilla", "cabillas", "malla", "perfil", "perfiles", "correa", "correas", "cercha", "cerchas",
    "zanja", "zanjas", "terreno", "tierra", "roca", "talud", "escombro", "escombros", "asfalto", "subbase", "rasante",
    # Instalaciones MEP
    "tuberia", "tuberias", "tubo", "tubos", "punto", "puntos", "canal", "canales", "canaleta", "canaletas",
    "bomba", "bombas", "valvula", "valvulas", "tanque", "tanques", "fregadero", "lavamanos", "inodoro", "ducha", "batea",
    "cachimbo", "boca", "visita", "bajante", "bajantes", "sumidero", "sumideros", "filtro", "filtros",
    "cable", "cables", "conductor", "conductores", "tablero", "tableros", "tomacorriente", "tomacorrientes",
    "interruptor", "interruptores", "luminaria", "luminarias", "lampara", "lamparas", "acometida", "transformador",
    "breaker", "breakers", "caja", "cajas", "ducto", "ductos", "conduit",
    "agua", "aguas", "blanca", "blancas", "servida", "servidas", "negra", "negras", "pluvial", "pluviales",
    # Acabados y cerramientos
    "puerta", "puertas", "ventana", "ventanas", "vidrio", "vidrios", "reja", "rejas", "porton", "portones",
    "drywall", "yeso", "teja", "tejas", "manto", "ceramica", "porcelanato", "granito", "caico",
    "marco", "marcos", "cerradura", "cerraduras", "pasamanos", "baranda", "barandas", "antepecho", "alfeizar",
    "baño", "cocina", "sala", "fachada", "cuarto", "terraza", "sotano", "planta"
}


def normalize_token(text_val: str) -> str:
    """Normaliza un token removiendo acentos y caracteres no alfabeticos."""
    if not text_val:
        return ""
    nfkd = unicodedata.normalize("NFD", text_val.lower().strip())
    without_accents = "".join(c for c in nfkd if unicodedata.category(c) != "Mn")
    cleaned = re.sub(r"[^a-z0-9]", "", without_accents)
    return cleaned


def compile_lexicon() -> Dict[str, List[str]]:
    """
    Extrae y clasifica palabras clave constructivas de las partidas reales de la base de datos.
    """
    db = SessionLocal()
    try:
        rows = db.execute(text("SELECT \"Descri\" FROM cost360_items WHERE \"Descri\" IS NOT NULL")).fetchall()
        logger.info(f"Analizando {len(rows)} partidas COVENIN de la base de datos...")
    finally:
        db.close()

    action_counter: Counter = Counter()
    element_counter: Counter = Counter()

    for row in rows:
        desc = row[0]
        if not desc or len(desc.strip()) < 5:
            continue

        raw_tokens = [normalize_token(t) for t in desc.split() if len(t) > 2]
        tokens = [t for t in raw_tokens if t and t not in STOPWORDS]

        if not tokens:
            continue

        # La primera o segunda palabra suele ser la acción en títulos COVENIN
        first_token = tokens[0]
        if first_token in ESSENTIAL_ACTIONS or first_token.endswith(("cion", "miento", "je", "ado", "ura", "ura")):
            action_counter[first_token] += 1
        elif len(tokens) > 1 and tokens[1] in ESSENTIAL_ACTIONS:
            action_counter[tokens[1]] += 1

        # El resto de palabras nutre el conjunto de elementos/materiales
        for tok in tokens[1:]:
            if tok in ESSENTIAL_ACTIONS:
                action_counter[tok] += 1
            elif tok in ESSENTIAL_ELEMENTS:
                element_counter[tok] += 1
            elif len(tok) >= 4 and tok not in STOPWORDS:
                element_counter[tok] += 1

    final_actions: Set[str] = set(ESSENTIAL_ACTIONS)
    for word, count in action_counter.items():
        if count >= 2 and len(word) >= 3 and word not in STOPWORDS and not word.isdigit():
            final_actions.add(word)

    final_elements: Set[str] = set(ESSENTIAL_ELEMENTS)
    for word, count in element_counter.items():
        if count >= 3 and len(word) >= 3 and word not in STOPWORDS and not word.isdigit():
            final_elements.add(word)

    result = {
        "actions": sorted(list(final_actions)),
        "elements": sorted(list(final_elements))
    }

    output_dir = os.path.join(os.path.dirname(__file__), "..", "app", "services", "data")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "construction_lexicon.json")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    logger.info(f"Léxico compilado exitosamente: {len(final_actions)} acciones, {len(final_elements)} elementos.")
    logger.info(f"Guardado en: {output_path}")
    print(f"Léxico guardado: {len(final_actions)} acciones y {len(final_elements)} elementos en {output_path}")
    return result


if __name__ == "__main__":
    compile_lexicon()
