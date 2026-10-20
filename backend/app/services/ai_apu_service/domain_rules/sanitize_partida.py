import re
from typing import Any, Dict
from app.services.ai_apu_service.domain_rules.discordant_pruning import (
    is_pipe_or_conduit_activity,
    resolve_effective_pipe_mounting,
)


def _sanitize_partida_description(result: Dict[str, Any], user_description: str = "") -> None:
    """
    Limpia y normaliza la descripción técnica de la partida COVENIN generada o adaptada.

    Reglas:
    1. Elimina tipos de inmueble coloquiales particulares ('EN CASA', 'EN QUINTA', 'EN APARTAMENTO',
       'EN MI CASA', 'EN RESIDENCIA PRIVADA', 'EN APTO') que no corresponden a especificaciones técnicas
       generales de partidas presupuestarias. Conserva términos técnicos de obra como 'CASA DE BOMBAS'
       o 'CASA DE MÁQUINAS'.
    2. Desambigua globalmente la condición de montaje en partidas de tuberías ('EMBUTIDA O ENTERRADA')
       según la modalidad efectiva solicitada ('EMBUTIDA', 'ENTERRADA' o 'SUPERFICIAL/COLGANTE').
    3. Limpia puntuación redundante generada por la podadura (comas consecutivas, espacios dobles, etc.).
    """
    if not isinstance(result, dict) or "partida" not in result:
        return
    partida = result.get("partida")
    if not isinstance(partida, dict) or "description" not in partida:
        return

    desc = str(partida.get("description") or "").strip()
    if not desc:
        return

    # Patrón para eliminar tipos de inmuebles particulares
    # Excluye 'casa de bombas', 'casa de maquinas', 'casa de válvulas' mediante negative lookahead
    residential_pattern = re.compile(
        r"\b(?:EN|DE|SOBRE|PARA)\s+(?:UNA?\s+|LA\s+|MI\s+|SU\s+)?(?:CASA|QUINTA|APARTAMENTO|APTO|CHALET|RESIDENCIA\s+PRIVADA|VIVIENDA\s+UNIFAMILIAR)(?!\s+DE\s+(?:BOMBAS?|M[AÁ]QUINAS?|VALVULAS?|EQUIPOS?|GENERADORES?|FUERZA))\b",
        re.IGNORECASE
    )

    cleaned_desc = residential_pattern.sub("", desc)

    # Desambiguación global de condición de montaje de tuberías (EMBUTIDA vs ENTERRADA vs SUPERFICIAL/COLGANTE)
    if is_pipe_or_conduit_activity(cleaned_desc) or is_pipe_or_conduit_activity(user_description):
        effective_mounting = resolve_effective_pipe_mounting(user_description, cleaned_desc)
        dual_mounting_re = re.compile(
            r"\b(?:EMBUTIDA\s+O\s+ENTERRADA|ENTERRADA\s+O\s+EMBUTIDA|EMBUTIDO\s+O\s+ENTERRADO)\b",
            re.IGNORECASE,
        )
        if effective_mounting == "ENTERRADA":
            cleaned_desc = dual_mounting_re.sub("ENTERRADA", cleaned_desc)
        elif effective_mounting == "SUPERFICIAL_COLGANTE":
            u_up = (user_description or "").upper()
            target_label = "COLGANTE" if "COLGANTE" in u_up else "SUPERFICIAL"
            cleaned_desc = dual_mounting_re.sub(target_label, cleaned_desc)
        elif effective_mounting == "EMBUTIDA":
            cleaned_desc = dual_mounting_re.sub("EMBUTIDA", cleaned_desc)

    # Limpieza de puntuaciones y espacios dobles
    cleaned_desc = re.sub(r"\s+,\s*", ", ", cleaned_desc)
    cleaned_desc = re.sub(r",\s*,+", ", ", cleaned_desc)
    cleaned_desc = re.sub(r"\s{2,}", " ", cleaned_desc)
    cleaned_desc = re.sub(r"\s+\.", ".", cleaned_desc)
    cleaned_desc = re.sub(r"\(\s*\)", "", cleaned_desc)
    cleaned_desc = cleaned_desc.strip(" ,")

    partida["description"] = cleaned_desc


def infer_covenin_prefix(description: str, base_code: str = "") -> str:
    """
    Infiere heurísticamente el prefijo normativo de capítulo COVENIN más adecuado
    según la naturaleza técnica de la actividad descrita.
    Garantiza que una partida libre sin prefijo previo no copie códigos arbitrarios (ej. E411).
    """
    if not description or not isinstance(description, str):
        return "E411"

    d = description.upper()

    # 0. Demoliciones, Desmontes y Remociones (E211) - Máxima prioridad sobre materiales soporte
    if any(k in d for k in [
        "DEMOLICION", "DEMOLER", "REMOCION", "REMOVER", "DESMONTE", "DESMONTAR",
        "RETIRO", "RETIRAR", "DESMANTELAMIENTO", "DESMANTELAR", "PICADO", "DESINSTALACION"
    ]):
        return "E211"

    # 1. Pinturas y Acabados Especiales (E46)
    if any(k in d for k in ["EPOXI", "POLIURETANO", "TRAFICO", "MICROESFERA"]):
        return "E465"  # Pinturas especiales / epóxicas
    if any(k in d for k in ["ESMALTE", "ALQUIDIC", "ANTICORROSIV"]):
        return "E462"  # Esmaltes y barnices
    if any(k in d for k in ["PINTURA", "CAUCHO", "LATEX", "EMULSION"]):
        return "E461"  # Pintura de caucho / emulsión

    # 2. Revestimientos de Pisos y Pavimentos (E43)
    if any(k in d for k in ["PORCELANATO", "CERAMICA", "BALDOSA", "GRANITO PULIDO", "CAICO", "PISO VINIL", "RODAPIE"]):
        return "E431"  # Revestimientos de pisos

    # 3. Albañilería, Paredes, Dinteles, Machones y Tabiquería (E334 / E41)
    if any(k in d for k in ["DRYWALL", "TABIQUERIA", "YESO", "PLYCEM", "SUPERBOARD"]):
        return "E412"  # Tabiquería liviana
    if any(k in d for k in ["DINTEL", "DINTELES", "MACHON", "MACHONES", "VIGA DE CORONA", "VIGAS DE CORONA", "ARRIOSTRAMIENTO"]):
        return "E334"  # Elementos de confinamiento: dinteles, machones y vigas de corona
    if any(k in d for k in ["MEDIA CAÑA", "MEDIA CANA", "GOTERO", "ALFEIZAR", "PENDIENTE EN LOSA", "PENDIENTES EN LOSA"]):
        return "E418"  # Obras varias de albañilería y remates de mortero
    if any(k in d for k in ["BLOQUE", "PARED", "ALBAÑILERIA", "ALBANILERIA", "LADRILLO", "FRISO", "REVOQUE", "TARRAJEO", "REPELLO", "ENCAMISADO"]):
        return "E411"  # Mampostería / Albañilería

    # 4. Impermeabilización (E45)
    if any(k in d for k in ["IMPERMEABILIZ", "MANTO", "PRIMER ASFALTICO", "ASFALTIC"]):
        return "E451"

    # 5. Instalaciones Hidráulicas / Aguas Claras (E51 / E61)
    if any(k in d for k in [
        "BOMBA", "HIDRONEUMATICO", "POZO", "AGUAS BLANCAS", "AGUAS CLARAS", "AGUA POTABLE",
        "TUBERIA PVC PRESION", "PPR", "POLIPROPILENO", "CPVC", "PEAD", "VALVULA", "LLAVE DE PASO"
    ]):
        return "E511"

    # 6. Instalaciones Sanitarias / Aguas Servidas (E52 / E62)
    if any(k in d for k in ["AGUAS SERVIDAS", "AGUAS NEGRAS", "AGUAS RESIDUALES", "CLOACA", "DRENAJE", "PVC SANITARI", "BAJANTE"]):
        return "E521"

    # 7. Instalaciones Eléctricas (E6)
    if any(k in d for k in ["TABLERO", "CABLE", "TRANSFORMADOR", "ACOMETIDA", "TOMACORRIENTE", "INTERRUPTOR", "LUMINARIA", "PUESTA A TIERRA", "COPPERWELD", "CONDUIT", "TUBERIA EMT"]):
        return "E611"

    # 8. Estructuras de Concreto (E31) y Metálicas (E32)
    if any(k in d for k in ["CONCRETO ARMADO", "VACIADO DE CONCRETO", "VIGA", "COLUMNA", "LOSA", "FUNDACION", "CABILLA", "BROCAL"]):
        return "E313"
    if any(k in d for k in ["ESTRUCTURA METALICA", "PERFIL CONDUVEN", "VIGA IPE"]) or (
        "SOLDADURA" in d and not any(p in d for p in ["SOLDADURA LIQUIDA", "PVC", "CPVC", "AGUAS CLARAS", "AGUAS BLANCAS", "AGUAS RESIDUALES", "AGUAS NEGRAS"])
    ):
        return "E321"

    # 9. Movimiento de Tierras (E1) y Demoliciones (E2)
    if any(k in d for k in ["EXCAVACION", "RELLENO", "COMPACTACION", "MOVIMIENTO DE TIERRA", "ZANJA"]):
        return "E121"
    if any(k in d for k in ["DEMOLICION", "BOTE", "DESMANTELAMIENTO"]):
        return "E211"
    if "MORTERO" in d:
        return "E411"

    # Si se pasó un base_code y tiene prefijo COVENIN válido de 3 o 4 letras:
    if base_code:
        clean = re.sub(r'[^A-Z0-9]', '', str(base_code).upper())
        if len(clean) >= 3 and clean[0] in ("E", "C", "U") and clean[1:3].isdigit():
            return clean[:4] if len(clean) >= 4 else clean[:3]

    return "E411"
