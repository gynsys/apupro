"""
Parser inteligente de mensajes de inspección de obra.
Extrae información estructurada a partir de textos diarios enviados por mensajería.
"""
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple


def extract_civ_from_text(text: str) -> Tuple[str, str]:
    """
    Extrae el número de CIV de un texto que contiene el nombre del profesional o su cargo.
    Retorna (nombre_limpio, civ_extraido).
    Ejemplos:
      'Génesis Quintero C.I.V. 123456' -> ('Génesis Quintero', '123456')
      'Pablo Milano (CIV: 789.012)' -> ('Pablo Milano', '789.012')
      'Pablo Milano CIV Nro. 789012' -> ('Pablo Milano', '789012')
      'Pablo Milano CIV #789012' -> ('Pablo Milano', '789012')
    """
    if not text:
        return "", ""
    pattern = re.compile(
        r'(?:[\(\[\,\-\/\•]?\s*)?'
        r'(?:C\.?I\.?V\.?|CIV|Colegio\s+de\s+Ingenieros(?:\s+de\s+Venezuela)?|Matr[ií]cula)'
        r'(?:\s*(?:del?)?\s*(?:Ing\.?|Ingeniero|Profesional)?\s*(?:Inspector|Residente))?'
        r'(?:\s*(?:N[oº°\.]*|Nro\.?|N[uú]m(?:ero)?\.?|\#))?'
        r'\s*[:=;\-]?\s*([0-9\.\-]+)\s*[\)\]]?',
        re.IGNORECASE,
    )
    m = pattern.search(text)
    if m:
        civ = m.group(1).strip(" .)-")
        clean_name = (text[:m.start()] + " " + text[m.end():]).strip(" ,.-/()[]•")
        clean_name = re.sub(r"\s+", " ", clean_name).strip()
        clean_name = re.sub(
            r"^(?:Firma\s+del\s+Profesional\s+(?:Inspector|Residente)?|Profesional\s+(?:Inspector|Residente))\s*",
            "",
            clean_name,
            flags=re.IGNORECASE,
        ).strip(" ,.-/()[]•")
        return clean_name, civ
    return text.strip(" ,.-/()[]•"), ""


def normalize_date_string(d_str: str) -> str:
    """Normaliza cadenas de fecha a formato estándar DD/MM/YYYY."""
    if not d_str:
        return ""
    clean_val = d_str.strip().strip("*._-").lower()
    if clean_val in ("hoy", "fecha de hoy", "el día de hoy", "el dia de hoy"):
        return datetime.now().strftime("%d/%m/%Y")
    if clean_val in ("ayer", "el día de ayer", "el dia de ayer"):
        return (datetime.now() - timedelta(days=1)).strftime("%d/%m/%Y")

    m = re.search(r"\b([0-9]{1,2})[/\-\.]([0-9]{1,2})[/\-\.]([0-9]{2,4})\b", d_str)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= d <= 31 and 1 <= mo <= 12:
            if y < 100:
                y += 2000
            return f"{d:02d}/{mo:02d}/{y}"
            
    m2 = re.search(r"\b([0-9]{1,2})\s+de\s+([a-zñáéíóú]+)\s+de(?:l)?\s+([0-9]{2,4})\b", d_str, re.I)
    if m2:
        d = int(m2.group(1))
        mes_txt = m2.group(2).lower()
        y = int(m2.group(3))
        meses = {
            "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
            "julio": 7, "agosto": 8, "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12
        }
        mo = meses.get(mes_txt)
        if mo and 1 <= d <= 31:
            if y < 100:
                y += 2000
            return f"{d:02d}/{mo:02d}/{y}"
            
    return d_str.strip().strip("*._-")


def extract_date_from_text(text: str) -> str:
    """
    Extrae la fecha del reporte de obra de forma robusta tolerando markdown
    (**Fecha:**, *Fecha:*, emojis 📅, viñetas -, etc.) o patrones libres.
    """
    if not text:
        return ""
        
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    
    # 1. Búsqueda por etiquetas explícitas de fecha
    for line in lines:
        if re.search(r"fecha\s+de\s+inicio|inicio\s+de\s+obra|contrato|civ", line, re.I):
            continue
        m = re.search(
            r"(?:[\*\_\#\-\•\>\s]*|📅|🗓️)?(?:Fecha(?:\s+del?\s+(?:reporte|informe|d[ií]a|inspecci[oó]n))?|D[ií]a|Jornada)[\s\*\_\#]*[:=][\s\*\_\#]*(.*)$",
            line,
            re.I
        )
        if m:
            val = m.group(1).strip().strip("*._#")
            norm_d = normalize_date_string(val)
            if norm_d:
                return norm_d

    # 2. Búsqueda de cualquier fecha DD/MM/YYYY en líneas del reporte
    for line in lines:
        if re.search(r"fecha\s+de\s+inicio|inicio\s+de\s+obra", line, re.I):
            continue
        m = re.search(r"\b([0-9]{1,2})[/\-\.]([0-9]{1,2})[/\-\.]([0-9]{2,4})\b", line)
        if m:
            norm_d = normalize_date_string(m.group(0))
            if norm_d:
                return norm_d

    return ""


def format_engineer_name(name: str) -> str:
    """
    Normaliza el nombre del profesional asegurando el prefijo oficial 'Ing.'.
    Ejemplo: 'Génesis Quintero' -> 'Ing. Génesis Quintero'
             'Ing. Pablo Milano' -> 'Ing. Pablo Milano'
    No añade 'Ing.' si el rol especificado es Maestro, Caporal, Obrero o Técnico.
    """
    if not name:
        return ""
    clean = name.strip(" \t\r\n*.,-")
    if re.match(r"^(?:Maestro|Caporal|Obrero|T[eé]cnico|Alba[ñn]il)\b", clean, re.IGNORECASE):
        return clean
    m = re.match(r"^(?:Ingenier[oa]|Ing)\.?\s*(.*)$", clean, re.IGNORECASE)
    if m:
        sub_name = m.group(1).strip(" \t\r\n*.,-")
        return f"Ing. {sub_name}" if sub_name else "Ing."
    return f"Ing. {clean}"


def resolve_single_inspector(
    inspectores: List[str],
    existing: Optional[str] = None,
) -> str:
    """
    Determina un único Ingeniero Inspector oficial (en el Libro de Obra legal CIV
    la firma del Profesional Inspector es unipersonal).
    Si se listan varios inspectores (ej. 'Guido Farroni', 'Pablo Milano'):
    - Si 'Pablo Milano' o 'Milano' está presente, se selecciona 'Ing. Pablo Milano'.
    - Si existe uno previamente configurado y no tiene comas, se prioriza el oficial.
    - De lo contrario, se toma un único inspector garantizando el prefijo 'Ing.'.
    """
    if existing and "," not in existing and existing.strip():
        return format_engineer_name(existing.strip())

    if not inspectores:
        if existing:
            first = existing.split(",")[0].strip()
            return format_engineer_name(first)
        return ""

    # Buscar si Pablo Milano está en la lista reportada
    for insp in inspectores:
        if "milano" in insp.lower() or "pablo" in insp.lower():
            return format_engineer_name(insp)

    # Si hay un existente configurado, priorizarlo
    if existing and existing.strip():
        first_ex = existing.split(",")[0].strip()
        return format_engineer_name(first_ex)

    # De lo contrario tomar el primero (un solo inspector)
    return format_engineer_name(inspectores[0])


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
        "civ_residente": "",
        "ing_inspectores": [],
        "ing_inspector": "",
        "civ_inspector": "",
        "maestro_obra": "",
        "caporal": "",
        "actividades": [],
        "obreros": "",
        "caporal_obra": "",
        "clima": "",
        "horas_trabajadas": "",
        "personal_obra": "",
        "equipos": "",
        "observaciones": "",
        "control_calidad": "",
        "ensayos": "",
        "revisado_por": "",
        "raw_text": text,
    }

    current_section: str = ""

    for line in lines:
        # 1. FECHA DE INICIO
        match_inicio = re.match(
            r"^[\s\*\_\#\-\•\>]*(?:Fecha\s+de\s+inicio|Fecha\s+inicio|Inicio(?:\s+de\s+obra)?)[\s\*\_\#]*[:=][\s\*\_\#]*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_inicio:
            current_section = "fecha_inicio"
            val = match_inicio.group(1).strip().strip("*._#")
            if val:
                data["fecha_inicio"] = val
            continue

        # 2. LAPSO / PLAZO DE EJECUCIÓN
        match_lapso = re.match(
            r"^[\s\*\_\#\-\•\>]*(?:Lapso(?:\s+de\s+ejecuci[oó]n)?|Plazo(?:\s+de\s+ejecuci[oó]n)?|Tiempo(?:\s+de\s+ejecuci[oó]n)?|Duraci[oó]n(?:\s+de\s+la\s+obra)?)[\s\*\_\#]*[:=][\s\*\_\#]*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_lapso:
            current_section = "lapso_ejecucion"
            val = match_lapso.group(1).strip().strip("*._#")
            if val:
                data["lapso_ejecucion"] = val
            continue

        # 3. FECHA DEL REPORTE
        match_fecha = re.match(
            r"^[\s\*\_\#\-\•\>]*(?:Fecha(?:\s+del?\s+(?:reporte|informe|d[ií]a|inspecci[oó]n))?|D[ií]a|Jornada)[\s\*\_\#]*[:=][\s\*\_\#]*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_fecha:
            val_f = match_fecha.group(1).strip().strip("*._#")
            data["fecha"] = normalize_date_string(val_f) if val_f else ""
            current_section = ""
            continue

        # 2. OBRA
        match_obra = re.match(
            r"^[\s\*\_\#\-\•\>]*(?:Obra|Proyecto|Nombre\s+de\s+la\s+obra)[\s\*\_\#]*[:=][\s\*\_\#]*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_obra:
            current_section = "obra"
            val = match_obra.group(1).strip().strip("*_#\"'")
            if val:
                data["obra"] = val
            continue

        # 3. EMPRESA
        match_emp = re.match(
            r"^[\s\*\_\#\-\•\>]*(?:Nombre\s+de\s+la\s+empresa|Empresa|Contratista)[\s\*\_\#]*[:=][\s\*\_\#]*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_emp:
            current_section = "empresa"
            val = match_emp.group(1).strip().strip("*_#\"'")
            if val:
                data["empresa"] = val
            continue

        # 4. ING. RESIDENTE Y SU C.I.V.
        match_civ_res = (
            re.match(
                r"^[\s\*\_\#\-\•\>]*(?:(?:Firma\s+del\s+)?Profesional\s+Residente\s+)?(?:C\.?I\.?V\.?|CIV|Colegio\s+de\s+Ingenieros|Matr[ií]cula)\s*(?:del?)?\s*(?:Ing\.?|Ingeniero|Profesional)?\s*Residente[\s\*\_\#]*(?:N[oº°\.]*|Nro\.?|N[uú]m(?:ero)?\.?|\#)?[\s\*\_\#]*[:=;\-]?[\s\*\_\#]*(.*)$",
                line,
                re.IGNORECASE,
            )
            or re.match(
                r"^[\s\*\_\#\-\•\>]*(?:Firma\s+del\s+)?(?:Profesional\s+)?Residente\s+(?:C\.?I\.?V\.?|CIV|Colegio\s+de\s+Ingenieros)[\s\*\_\#]*(?:N[oº°\.]*|Nro\.?|N[uú]m(?:ero)?\.?|\#)?[\s\*\_\#]*[:=;\-]?[\s\*\_\#]*(.*)$",
                line,
                re.IGNORECASE,
            )
        )
        if match_civ_res:
            val = match_civ_res.group(1).strip().strip("*._#")
            m_num = re.search(r"([0-9\.\-]+)", val)
            if m_num:
                data["civ_residente"] = m_num.group(1).strip(" .-")
            elif val:
                data["civ_residente"] = val
            continue

        match_res = re.match(
            r"^[\s\*\_\#\-\•\>]*(?:Ing\.?\s*Residente|Residente)[\s\*\_\#]*[:=;][\s\*\_\#]*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_res:
            current_section = "ing_residente"
            val = match_res.group(1).strip().strip("*_#")
            if val:
                c_name, ext_civ = extract_civ_from_text(val)
                data["ing_residente"] = c_name
                if ext_civ:
                    data["civ_residente"] = ext_civ
            continue

        # 5. ING. INSPECTOR(ES) Y SU C.I.V.
        match_civ_insp = (
            re.match(
                r"^[\s\*\_\#\-\•\>]*(?:(?:Firma\s+del\s+)?Profesional\s+Inspector\s+)?(?:C\.?I\.?V\.?|CIV|Colegio\s+de\s+Ingenieros|Matr[ií]cula)\s*(?:del?)?\s*(?:Ing\.?|Ingeniero|Profesional)?\s*Inspector[\s\*\_\#]*(?:N[oº°\.]*|Nro\.?|N[uú]m(?:ero)?\.?|\#)?[\s\*\_\#]*[:=;\-]?[\s\*\_\#]*(.*)$",
                line,
                re.IGNORECASE,
            )
            or re.match(
                r"^[\s\*\_\#\-\•\>]*(?:Firma\s+del\s+)?(?:Profesional\s+)?Inspector\s+(?:C\.?I\.?V\.?|CIV|Colegio\s+de\s+Ingenieros)[\s\*\_\#]*(?:N[oº°\.]*|Nro\.?|N[uú]m(?:ero)?\.?|\#)?[\s\*\_\#]*[:=;\-]?[\s\*\_\#]*(.*)$",
                line,
                re.IGNORECASE,
            )
        )
        if match_civ_insp:
            val = match_civ_insp.group(1).strip().strip("*._#")
            m_num = re.search(r"([0-9\.\-]+)", val)
            if m_num:
                data["civ_inspector"] = m_num.group(1).strip(" .-")
            elif val:
                data["civ_inspector"] = val
            current_section = None
            continue

        match_insp = re.match(
            r"^[\s\*\_\#\-\•\>]*(?:Personal\s+de\s+Inspecci[oó]n|Ing\.?\s*Inspector(?:es)?|Inspecci[oó]n|Inspectores)[\s\*\_\#]*[:=;\-]?[\s\*\_\#]*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_insp:
            current_section = "ing_inspectores"
            val = match_insp.group(1).strip().strip("*_#")
            if val and not re.fullmatch(r"\d+", val):
                c_name, ext_civ = extract_civ_from_text(val)
                data["ing_inspectores"].append(c_name)
                if ext_civ:
                    data["civ_inspector"] = ext_civ
            continue

        # Línea genérica de CIV (aplica a la sección activa o asigna al profesional pendiente)
        match_civ_generic = re.match(
            r"^[\s\*\_\#\-\•\>]*(?:C\.?I\.?V\.?|CIV|Colegio\s+de\s+Ingenieros|Matr[ií]cula)\s*(?:N[oº°\.]*|Nro\.?|N[uú]m(?:ero)?\.?|\#)?[\s\*\_\#]*[:=;\-]?[\s\*\_\#]*([0-9\.\-]+).*$",
            line,
            re.IGNORECASE,
        )
        if match_civ_generic:
            val = match_civ_generic.group(1).strip().strip("*._#")
            if current_section == "ing_residente" and not data.get("civ_residente"):
                data["civ_residente"] = val
                current_section = None
                continue
            elif current_section == "ing_inspectores" and not data.get("civ_inspector"):
                data["civ_inspector"] = val
                current_section = None
                continue
            elif not data.get("civ_residente"):
                data["civ_residente"] = val
                continue
            elif not data.get("civ_inspector"):
                data["civ_inspector"] = val
                continue

        # 5.1 MAESTRO DE OBRA
        match_maestro = re.match(
            r"^[\s\*\_\#\-\•\>]*(?:Maestro(?:\s+de\s+obra)?|Maestro\s+mayor)[\s\*\_\#]*[:=;\-]?[\s\*\_\#]*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_maestro:
            current_section = "maestro_obra"
            val = match_maestro.group(1).strip().strip("*._#")
            if val:
                has_existing_name = bool(data.get("maestro_obra") and not re.fullmatch(r"\d+", data["maestro_obra"]))
                is_digit_count = bool(re.fullmatch(r"\d+", val))
                if not (has_existing_name and is_digit_count):
                    data["maestro_obra"] = val
            continue

        # 6. CAPORAL
        match_caporal = re.match(
            r"^[\s\*\_\#\-\•\>]*Caporal(?:\s+general)?[\s\*\_\#]*[:=]?[\s\*\_\#]*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_caporal and not re.search(r"obra", line, re.IGNORECASE):
            current_section = "caporal"
            val = match_caporal.group(1).strip().strip("*._#")
            if val:
                data["caporal"] = val
            continue

        # 7. ACTIVIDADES EN EJECUCIÓN
        match_act = re.match(
            r"^[\s\*\_\#\-\•\>]*Actividades(?:\s+en\s+ejecuci[oó]n)?[\s\*\_\#]*[:=][\s\*\_\#]*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_act:
            current_section = "actividades"
            val = match_act.group(1).strip().strip("*_#")
            if val:
                clean_act = re.sub(r"^(?:[\.\-\*•–\d]+[\.\-\)\s]+)", "", val).strip()
                if clean_act:
                    data["actividades"].append(clean_act)
            continue

        # 8. OBREROS EN OBRA
        match_obreros = re.match(
            r"^[\s\*\_\#\-\•\>]*Obreros(?:\s+en\s+obra)?[\s\*\_\#]*[:=][\s\*\_\#]*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_obreros:
            current_section = "obreros"
            val = match_obreros.group(1).strip().strip("*._#")
            data["obreros"] = val
            continue

        # 8.1 PERSONAL EN OBRA / CUADRILLA
        match_pers_obra = re.match(
            r"^[\s\*\_\#\-\•\>]*(?:Personal\s+en\s+obra|Personal\s+obrero|Cuadrilla(?:\s+en\s+obra)?)[\s\*\_\#]*[:=;\-]?[\s\*\_\#]*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_pers_obra:
            current_section = "personal_obra"
            val = match_pers_obra.group(1).strip().strip("*._#")
            if val:
                data["personal_obra"] = val
                m_maestro = re.search(r"maestro(?:\s+de\s+obra)?\s*[:\*\.\-]*\s*([^,\r\n]+)", val, re.IGNORECASE)
                if m_maestro and not data.get("maestro_obra"):
                    data["maestro_obra"] = m_maestro.group(1).strip(" *.-")
                m_cap = re.search(r"caporal(?:\s+de\s+obra)?\s*[:\*\.\-]*\s*([^,\r\n]+)", val, re.IGNORECASE)
                if m_cap and not data.get("caporal"):
                    data["caporal"] = m_cap.group(1).strip(" *.-")
                m_ob = re.search(r"(\d+\s*obreros?)", val, re.IGNORECASE)
                if m_ob and not data.get("obreros"):
                    data["obreros"] = m_ob.group(1).strip()
            continue

        # 9. CAPORAL DE OBRA (CANTIDAD O NOMBRE)
        match_cap_obra = re.match(
            r"^[\s\*\_\#\-\•\>]*Caporal\s+de\s+obra[\s\*\_\#]*[:=][\s\*\_\#]*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_cap_obra:
            current_section = "caporal_obra"
            val = match_cap_obra.group(1).strip().strip("*._#")
            data["caporal_obra"] = val
            continue

        # 10. CLIMA / ESTADO DEL TIEMPO
        match_clima = re.match(
            r"^[\s\*\_\#\-\•\>]*(?:Estado\s+del\s+tiempo|Clima|Tiempo|Condici[oó]n\s+clim[aá]tica)[\s\*\_\#]*[:=;][\s\*\_\#]*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_clima:
            current_section = "clima"
            val = match_clima.group(1).strip().strip("*._#")
            if val:
                if not data.get("clima") or data["clima"].lower() in ("soleado", "nublado", "lluvioso"):
                    data["clima"] = val
                else:
                    data["clima"] = f"{data['clima']} / {val}"
            continue

        # 11. HORAS TRABAJADAS / JORNADA
        match_horas = re.match(
            r"^[\s\*\_\#\-\•\>]*(?:Horas(?:\s+trabajadas|\s+de\s+trabajo)?|Jornada(?:\s+laboral)?)[\s\*\_\#]*[:=;\-]?[\s\*\_\#]*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_horas:
            current_section = "horas_trabajadas"
            val = match_horas.group(1).strip().strip("*._#")
            if val:
                num_m = re.search(r"(\d+)", val)
                if num_m and "hora" not in val.lower():
                    data["horas_trabajadas"] = f"{num_m.group(1)} horas"
                else:
                    data["horas_trabajadas"] = val
            continue

        # 12. MOVIMIENTO DE MAQUINARIA Y EQUIPO / HERRAMIENTAS
        match_equipos = re.match(
            r"^[\s\*\_\#\-\•\>]*(?:Movimientos?\s+de\s+(?:Maquinarias?(?:\s+y\s+Equipos?)?|Equipos?(?:\s+y\s+Maquinarias?)?|Herramientas(?:\s+y\s+Equipos?)?)|(?:Maquinarias?\s+y\s+Equipos?|Equipos?\s+y\s+Maquinarias?)|Equipos?(?:\s+y\s+Maquinarias?|\s+en\s+obra|\s+y\s+Herramientas)?|Maquinarias?|Herramientas\s+y\s+Equipos?|Herramientas(?=[\s\*\_\#]*[:=;\-]))[\s\*\_\#]*[:=;\-]?[\s\*\_\#]*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_equipos:
            current_section = "equipos"
            val = match_equipos.group(1).strip().strip("*._#")
            if val:
                data["equipos"] = val
            continue

        # 13. OBSERVACIONES
        match_obs = re.match(
            r"^[\s\*\_\#\-\•\>]*(?:Observaciones?(?:\s+generales|\s+de\s+la\s+jornada|\s+de\s+inspecci[oó]n|\s+del\s+d[ií]a|\s+de\s+obra|\s+en\s+obra|\s+t[eé]cnicas)?|Notas?(?:\s+importantes?|\s+de\s+obra|\s+t[eé]cnicas)?)[\s\*\_\#]*[:=;\-]?[\s\*\_\#]*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_obs:
            current_section = "observaciones"
            val = match_obs.group(1).strip().strip("*._#")
            if val:
                data["observaciones"] = val
            continue

        # 14. CONTROL DE CALIDAD Y ENSAYOS
        match_cc = re.match(
            r"^[\s\*\_\#\-\•\>]*(?:Control\s+de\s+calidad|Calidad|Ensayos?(?:\s+realizados?|\s+de\s+laboratorio|\s+de\s+campo)?|Pruebas?(?:\s+y\s+ensayos?|\s+de\s+calidad)?)[\s\*\_\#]*[:=;\-][\s\*\_\#]*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_cc:
            current_section = "control_calidad"
            val = match_cc.group(1).strip().strip("*._#")
            if val:
                data["control_calidad"] = val
                data["ensayos"] = val
            continue

        # 15. REVISADO POR
        match_rev = re.match(
            r"^[\s\*\_\#\-\•\>]*(?:Revisado(?:\s+por)?|Revisi[oó]n(?:\s+por)?)[\s\*\_\#]*[:=;][\s\*\_\#]*(.*)$",
            line,
            re.IGNORECASE,
        )
        if match_rev:
            current_section = "revisado_por"
            val = match_rev.group(1).strip().strip("*._#")
            if val:
                data["revisado_por"] = val
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
            if not re.search(r"personal|inspecci|inspector|caporal|obrero|actividad|clima|fecha|obra|empresa", line, re.IGNORECASE):
                data["ing_residente"] = (data["ing_residente"] + " " + line.strip("*")).strip()
        elif current_section == "ing_inspectores":
            m_maestro_sub = re.match(
                r"^[\s\*\_\#\-\•\>]*(?:Maestro(?:\s+de\s+obra)?|Maestro\s+mayor)[\s\*\_\#]*[:=;\-]?[\s\*\_\#]*(.*)$",
                line,
                re.IGNORECASE,
            )
            if m_maestro_sub:
                current_section = "maestro_obra"
                val = m_maestro_sub.group(1).strip().strip("*._#")
                if val:
                    has_existing_name = bool(data.get("maestro_obra") and not re.fullmatch(r"\d+", data["maestro_obra"]))
                    is_digit_count = bool(re.fullmatch(r"\d+", val))
                    if not (has_existing_name and is_digit_count):
                        data["maestro_obra"] = val
                continue
            m_cap_sub = re.match(
                r"^[\s\*\_\#\-\•\>]*(?:Caporal(?:\s+general)?)[\s\*\_\#]*[:=]?[\s\*\_\#]*(.*)$",
                line,
                re.IGNORECASE,
            )
            if m_cap_sub and not re.search(r"obra", line, re.IGNORECASE):
                current_section = "caporal"
                val = m_cap_sub.group(1).strip().strip("*._#")
                if val:
                    data["caporal"] = val
                continue
            if re.search(r"obrero|actividad|clima|equipo|observaci|residente", line, re.IGNORECASE):
                current_section = None
                continue
            clean_name = line.strip(" \t.-*")
            if clean_name and not re.fullmatch(r"\d+", clean_name):
                data["ing_inspectores"].append(clean_name)
        elif current_section == "maestro_obra":
            data["maestro_obra"] = (data["maestro_obra"] + " " + line.strip("*.")).strip()
        elif current_section == "caporal":
            data["caporal"] = (data["caporal"] + " " + line.strip("*.")).strip()
        elif current_section == "clima":
            if not re.search(r"horas|trabajad|jornada|obrero|caporal|actividad", line, re.IGNORECASE):
                data["clima"] = (data["clima"] + " " + line.strip("*.")).strip()
        elif current_section == "horas_trabajadas":
            data["horas_trabajadas"] = (data["horas_trabajadas"] + " " + line.strip("*.")).strip()
        elif current_section == "equipos":
            clean_item = re.sub(r"^[\s\*\_\#\-\•\>]+(?:\.\s*)?", "", line).strip()
            if clean_item:
                if data["equipos"]:
                    data["equipos"] = f"{data['equipos']}\n{clean_item}"
                else:
                    data["equipos"] = clean_item
        elif current_section == "observaciones":
            clean_item = re.sub(r"^[\s\*\_\#\-\•\>]+(?:\.\s*)?", "", line).strip()
            if clean_item:
                if data["observaciones"]:
                    data["observaciones"] = f"{data['observaciones']}\n{clean_item}"
                else:
                    data["observaciones"] = clean_item
        elif current_section == "control_calidad":
            data["control_calidad"] = (data["control_calidad"] + " " + line.strip("*.")).strip()
            data["ensayos"] = data["control_calidad"]
        elif current_section == "revisado_por":
            data["revisado_por"] = (data["revisado_por"] + " " + line.strip("*.")).strip()
        elif current_section == "actividades":
            clean_act = re.sub(r"^(?:[\.\-\*•–\d]+[\.\-\)\s]+)", "", line).strip()
            if clean_act:
                data["actividades"].append(clean_act)

    # Limpieza final de espacios y signos
    data["obra"] = data["obra"].strip()
    data["fecha_inicio"] = data["fecha_inicio"].strip().strip("*.")
    data["lapso_ejecucion"] = data["lapso_ejecucion"].strip().strip("*.")
    data["empresa"] = data["empresa"].strip()
    # Limpieza y formateo de Residente y CIV
    if data["ing_residente"]:
        clean_res, ext_civ = extract_civ_from_text(data["ing_residente"])
        if clean_res:
            data["ing_residente"] = format_engineer_name(clean_res)
        if ext_civ and not data["civ_residente"]:
            data["civ_residente"] = ext_civ
    data["civ_residente"] = data["civ_residente"].strip().strip("*.")

    # Limpieza y formateo de Inspectores y CIV
    if isinstance(data["ing_inspectores"], list):
        clean_inspectores: List[str] = []
        for insp_item in data["ing_inspectores"]:
            clean_item = insp_item.strip(" .*")
            if not clean_item or re.fullmatch(r"\d+", clean_item):
                continue
            if re.search(r"maestro(?:\s+de\s+obra)?", clean_item, re.IGNORECASE):
                m_clean = re.sub(r"^(?:Ing\.?\s*)?(?:Maestro(?:\s+de\s+obra)?)\s*[:\*\.\-]*\s*", "", clean_item, flags=re.IGNORECASE).strip(" *.-")
                if m_clean:
                    has_existing_name = bool(data.get("maestro_obra") and not re.fullmatch(r"\d+", data["maestro_obra"]))
                    is_digit_count = bool(re.fullmatch(r"\d+", m_clean))
                    if not (has_existing_name and is_digit_count):
                        data["maestro_obra"] = m_clean
                continue
            if re.search(r"caporal", clean_item, re.IGNORECASE):
                c_clean = re.sub(r"^(?:Ing\.?\s*)?(?:Caporal(?:\s+de\s+obra)?)\s*[:\*\.\-]*\s*", "", clean_item, flags=re.IGNORECASE).strip(" *.-")
                if c_clean and not data.get("caporal"):
                    data["caporal"] = c_clean
                continue
            c_name, ext_civ = extract_civ_from_text(clean_item)
            if c_name and not re.fullmatch(r"\d+", c_name):
                clean_inspectores.append(format_engineer_name(c_name))
            if ext_civ and not data["civ_inspector"]:
                data["civ_inspector"] = ext_civ
        data["ing_inspectores"] = clean_inspectores
    data["ing_inspector"] = resolve_single_inspector(data["ing_inspectores"])
    data["civ_inspector"] = data["civ_inspector"].strip().strip("*.")

    # Respaldo global para extraer CIV de Inspector o Residente de todo el texto
    if not data["civ_inspector"]:
        insp_patterns = [
            r"(?:inspector|inspecci[oó]n|pablo|milano)[^\n\r]*?(?:C\.?I\.?V\.?|CIV|Colegio|Matr[ií]cula)\s*(?:N[oº°\.]*|Nro\.?|N[uú]m(?:ero)?\.?|\#)?\s*[:=;\-]?\s*([0-9\.\-]+)",
            r"(?:C\.?I\.?V\.?|CIV|Colegio|Matr[ií]cula)\s*(?:N[oº°\.]*|Nro\.?|N[uú]m(?:ero)?\.?|\#)?\s*[:=;\-]?\s*([0-9\.\-]+)[^\n\r]*?(?:inspector|inspecci[oó]n|pablo|milano)",
            r"Firma\s+del\s+Profesional\s+Inspector\s+C\.?I\.?V\.?\s*(?:N[oº°\.]*|Nro\.?|\#)?\s*[:=;\-]?\s*([0-9\.\-]+)",
        ]
        for pat in insp_patterns:
            m_insp = re.search(pat, text, re.IGNORECASE)
            if m_insp:
                data["civ_inspector"] = m_insp.group(1).strip().strip("*._-")
                break

    if not data["civ_residente"]:
        res_patterns = [
            r"(?:residente|residencia|g[eé]nesis|quintero)[^\n\r]*?(?:C\.?I\.?V\.?|CIV|Colegio|Matr[ií]cula)\s*(?:N[oº°\.]*|Nro\.?|N[uú]m(?:ero)?\.?|\#)?\s*[:=;\-]?\s*([0-9\.\-]+)",
            r"(?:C\.?I\.?V\.?|CIV|Colegio|Matr[ií]cula)\s*(?:N[oº°\.]*|Nro\.?|N[uú]m(?:ero)?\.?|\#)?\s*[:=;\-]?\s*([0-9\.\-]+)[^\n\r]*?(?:residente|residencia|g[eé]nesis|quintero)",
            r"Firma\s+del\s+Profesional\s+Residente\s+C\.?I\.?V\.?\s*(?:N[oº°\.]*|Nro\.?|\#)?\s*[:=;\-]?\s*([0-9\.\-]+)",
        ]
        for pat in res_patterns:
            m_res = re.search(pat, text, re.IGNORECASE)
            if m_res:
                data["civ_residente"] = m_res.group(1).strip().strip("*._-")
                break

    data["maestro_obra"] = data.get("maestro_obra", "").strip().strip("*.")
    data["caporal"] = data["caporal"].strip()
    data["obreros"] = data["obreros"].strip()
    data["caporal_obra"] = data["caporal_obra"].strip()
    data["clima"] = data["clima"].strip().strip("*.")
    data["horas_trabajadas"] = data["horas_trabajadas"].strip().strip("*.")
    data["equipos"] = data["equipos"].strip().strip("*.")
    data["observaciones"] = data["observaciones"].strip().strip("*.")
    data["control_calidad"] = data["control_calidad"].strip().strip("*.")
    data["ensayos"] = data["control_calidad"]
    data["revisado_por"] = data["revisado_por"].strip().strip("*.")

    # Depuración estricta de actividades: eliminar clima o tiempo que se haya colado
    filtered_acts: List[str] = []
    weather_keywords_pattern = re.compile(
        r"^(?:estado\s+del\s+tiempo|clima|condici[oó]n\s+clim[aá]tica|tiempo)\b",
        re.IGNORECASE,
    )
    for act in data["actividades"]:
        act_clean = act.strip()
        if weather_keywords_pattern.search(act_clean):
            clima_val = re.sub(weather_keywords_pattern, "", act_clean).strip(" :.-*")
            if clima_val and not data["clima"]:
                data["clima"] = clima_val
            continue
        if act_clean.lower() in ("soleado", "nublado", "lluvioso", "lluvia", "buen tiempo", "despejado"):
            if not data["clima"]:
                data["clima"] = act_clean.upper()
            continue
        filtered_acts.append(act_clean)
    data["actividades"] = filtered_acts

    # Extracción de fecha ultra-robusta si no se capturó por encabezado exacto
    if not data["fecha"]:
        extracted_d = extract_date_from_text(text)
        if extracted_d:
            data["fecha"] = extracted_d

    return data
