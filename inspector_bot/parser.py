"""
Parser inteligente de mensajes de inspección de obra.
Extrae información estructurada a partir de textos diarios enviados por mensajería.
"""
import re
from typing import Any, Dict, List


def parse_inspection_message(text: str) -> Dict[str, Any]:
    """
    Parsea el mensaje de texto libre o estructurado de una inspección de obra.
    Extrae: Fecha, Obra, Empresa, Residente, Inspectores, Caporal, Actividades y Personal.
    """
    if not text:
        return {}

    lines = [line.strip() for line in text.splitlines() if line.strip()]

    data: Dict[str, Any] = {
        "fecha": "",
        "fecha_inicio": "",
        "lapso_ejecucion": "",
        "obra": "",
        "empresa": "",
        "ing_residente": "",
        "ing_inspectores": [],
        "caporal": "",
        "actividades": [],
        "obreros": "",
        "caporal_obra": "",
        "raw_text": text,
    }

    current_section: str = ""

    for line in lines:
        # 1. FECHA DE INICIO
        match_inicio = re.match(
            r"^\*?(?:Fecha\s+de\s+inicio|Fecha\s+inicio|Inicio(?:\s+de\s+obra)?)\*?\s*[:=]\s*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_inicio:
            current_section = "fecha_inicio"
            val = match_inicio.group(1).strip().strip("*.")
            if val:
                data["fecha_inicio"] = val
            continue

        # 2. LAPSO / PLAZO DE EJECUCIÓN
        match_lapso = re.match(
            r"^\*?(?:Lapso(?:\s+de\s+ejecuci[oó]n)?|Plazo(?:\s+de\s+ejecuci[oó]n)?|Tiempo(?:\s+de\s+ejecuci[oó]n)?|Duraci[oó]n(?:\s+de\s+la\s+obra)?)\*?\s*[:=]\s*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_lapso:
            current_section = "lapso_ejecucion"
            val = match_lapso.group(1).strip().strip("*.")
            if val:
                data["lapso_ejecucion"] = val
            continue

        # 3. FECHA DEL REPORTE
        match_fecha = re.match(r"^\*?Fecha\*?\s*[:=]\s*(.*)$", line, re.IGNORECASE)
        if match_fecha:
            data["fecha"] = match_fecha.group(1).strip().strip("*.")
            current_section = ""
            continue

        # 2. OBRA
        match_obra = re.match(r"^\*?Obra\*?\s*[:=]\s*(.*)$", line, re.IGNORECASE)
        if match_obra:
            current_section = "obra"
            val = match_obra.group(1).strip().strip("*")
            if val:
                data["obra"] = val
            continue

        # 3. EMPRESA
        match_emp = re.match(r"^\*?(?:Nombre de la empresa|Empresa|Contratista)\*?\s*[:=]\s*(.*)$", line, re.IGNORECASE)
        if match_emp:
            current_section = "empresa"
            val = match_emp.group(1).strip().strip("*")
            if val:
                data["empresa"] = val
            continue

        # 4. ING. RESIDENTE
        match_res = re.match(r"^\*?(?:Ing\.?\s*Residente|Residente)\*?\s*[:=]\s*(.*)$", line, re.IGNORECASE)
        if match_res:
            current_section = "ing_residente"
            val = match_res.group(1).strip().strip("*")
            if val:
                data["ing_residente"] = val
            continue

        # 5. ING. INSPECTOR(ES)
        match_insp = re.match(r"^\*?(?:Ing\.?\s*Inspector(?:es)?|Inspecci[oó]n)\*?\s*[:=]\s*(.*)$", line, re.IGNORECASE)
        if match_insp:
            current_section = "ing_inspectores"
            val = match_insp.group(1).strip().strip("*")
            if val and not re.fullmatch(r"\d+", val):
                data["ing_inspectores"].append(val)
            continue

        # 6. CAPORAL
        match_caporal = re.match(r"^\*?Caporal(?:\s+general)?\*?\s*[:=]?\s*(.*)$", line, re.IGNORECASE)
        if match_caporal and not re.search(r"obra", line, re.IGNORECASE):
            current_section = "caporal"
            val = match_caporal.group(1).strip().strip("*.")
            if val:
                data["caporal"] = val
            continue

        # 7. ACTIVIDADES EN EJECUCIÓN
        match_act = re.match(r"^\*?Actividades(?:\s+en\s+ejecuci[oó]n)?\*?\s*[:=]\s*(.*)$", line, re.IGNORECASE)
        if match_act:
            current_section = "actividades"
            val = match_act.group(1).strip().strip("*")
            if val:
                clean_act = re.sub(r"^(?:[\.\-\*•–\d]+[\.\-\)\s]+)", "", val).strip()
                if clean_act:
                    data["actividades"].append(clean_act)
            continue

        # 8. OBREROS EN OBRA
        match_obreros = re.match(r"^\*?Obreros(?:\s+en\s+obra)?\*?\s*[:=]\s*(.*)$", line, re.IGNORECASE)
        if match_obreros:
            current_section = "obreros"
            val = match_obreros.group(1).strip().strip("*.")
            data["obreros"] = val
            continue

        # 9. CAPORAL DE OBRA (CANTIDAD O NOMBRE)
        match_cap_obra = re.match(r"^\*?Caporal\s+de\s+obra\*?\s*[:=]\s*(.*)$", line, re.IGNORECASE)
        if match_cap_obra:
            current_section = "caporal_obra"
            val = match_cap_obra.group(1).strip().strip("*.")
            data["caporal_obra"] = val
            continue

        # Continuación de la sección actual en líneas subsiguientes
        if current_section == "obra":
            data["obra"] = (data["obra"] + " " + line.strip("*")).strip()
        elif current_section == "fecha_inicio":
            data["fecha_inicio"] = (data["fecha_inicio"] + " " + line.strip("*.")).strip()
        elif current_section == "lapso_ejecucion":
            data["lapso_ejecucion"] = (data["lapso_ejecucion"] + " " + line.strip("*.")).strip()
        elif current_section == "empresa":
            data["empresa"] = (data["empresa"] + " " + line.strip("*")).strip()
        elif current_section == "ing_residente":
            data["ing_residente"] = (data["ing_residente"] + " " + line.strip("*")).strip()
        elif current_section == "ing_inspectores":
            clean_name = line.strip(" \t.-*")
            if clean_name and not re.fullmatch(r"\d+", clean_name):
                data["ing_inspectores"].append(clean_name)
        elif current_section == "caporal":
            data["caporal"] = (data["caporal"] + " " + line.strip("*.")).strip()
        elif current_section == "actividades":
            clean_act = re.sub(r"^(?:[\.\-\*•–\d]+[\.\-\)\s]+)", "", line).strip()
            if clean_act:
                data["actividades"].append(clean_act)

    # Limpieza final de espacios y signos
    data["obra"] = data["obra"].strip()
    data["fecha_inicio"] = data["fecha_inicio"].strip().strip("*.")
    data["lapso_ejecucion"] = data["lapso_ejecucion"].strip().strip("*.")
    data["empresa"] = data["empresa"].strip()
    data["ing_residente"] = data["ing_residente"].strip()
    data["caporal"] = data["caporal"].strip()
    data["obreros"] = data["obreros"].strip()
    data["caporal_obra"] = data["caporal_obra"].strip()
    if isinstance(data["ing_inspectores"], list):
        data["ing_inspectores"] = [i.strip(" .") for i in data["ing_inspectores"] if i.strip(" .") and not re.fullmatch(r"\d+", i.strip(" ."))]

    return data
