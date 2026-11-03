"""
Módulo de Inteligencia Artificial para el Bot Inspector.
Genera la redacción formal de ingeniería civil ('DESCRIPCIÓN DE LA LABOR')
en formato de párrafo descriptivo continuo, estrictamente apegado al resumen de actividades,
tomando en cuenta el movimiento de maquinarias y equipos en sitio,
e incorporando lo correspondiente a ensayos y controles de calidad si son reportados.
Utiliza Google Gemini si la API key está disponible, o un motor heurístico experto
de ingeniería civil como fallback de alta fidelidad.
"""
import logging
import os
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def _clean_activity_text(act: str) -> str:
    """Elimina viñetas, guiones, numeraciones y descarta líneas de clima o meteorología."""
    if not act:
        return ""
    cleaned = act.strip()
    cleaned = re.sub(r"^[\s\.\-\*•\d\(\)]+", "", cleaned).strip()
    # Descartar líneas de clima o tiempo
    if re.search(r"^(?:estado\s+del\s+tiempo|clima|condici[oó]n\s+clim[aá]tica|tiempo)\b", cleaned, re.IGNORECASE):
        return ""
    if cleaned.lower() in ("soleado", "nublado", "lluvioso", "lluvia", "buen tiempo", "despejado"):
        return ""
    return cleaned.rstrip(".")


def _clean_equipment_text(eq: str) -> str:
    """Normaliza y limpia la lista o texto de maquinaria y equipos presentes en obra."""
    if not eq:
        return ""
    raw_lines = eq.strip().splitlines()
    clean_items: List[str] = []
    ignored = {"ninguno", "ninguna", "n/a", "no aplica", "s/e", "sin maquinaria", "sin equipos", "0", "ninguna maquinaria"}

    for line in raw_lines:
        line_clean = line.strip()
        if not line_clean:
            continue
        parts = [p.strip() for p in line_clean.split(",") if p.strip()]
        for p in parts:
            item = re.sub(r"^[\s\.\-\*•\>]+", "", p).strip()
            if item and item.lower() not in ignored:
                clean_items.append(item)

    return ", ".join(clean_items)


def _clean_ensayos_text(ens: str) -> str:
    """Normaliza y limpia el texto de ensayos o control de calidad reportados."""
    if not ens:
        return ""
    raw_lines = ens.strip().splitlines()
    clean_items: List[str] = []
    ignored = {"ninguno", "ninguna", "n/a", "no aplica", "s/e", "sin ensayos", "sin pruebas", "0", "ningún ensayo", "ninguna prueba"}

    for line in raw_lines:
        line_clean = line.strip()
        if not line_clean:
            continue
        parts = [p.strip() for p in line_clean.split(",") if p.strip()]
        for p in parts:
            item = re.sub(r"^[\s\.\-\*•\>]+", "", p).strip()
            if item and item.lower() not in ignored:
                clean_items.append(item)

    return ", ".join(clean_items)


def _heuristic_generate_civil_description(
    actividades: List[str],
    obra: str = "",
    empresa: str = "",
    obreros: str = "",
    equipos: str = "",
    ensayos: str = "",
) -> str:
    """
    Genera un único párrafo descriptivo continuo, profesional y de ingeniería civil,
    estrictamente apegado a las actividades suministradas, vinculando el movimiento
    de maquinarias y equipos en obra e incorporando los ensayos y controles de calidad
    reportados, sin clima y sin redundancias.
    """
    clean_eq = _clean_equipment_text(equipos)
    clean_ens = _clean_ensayos_text(ensayos)

    if not actividades:
        eq_mention = f", coordinando el apoyo operativo de maquinaria y equipos: {clean_eq}" if clean_eq else ""
        ens_mention = f", efectuándose las pruebas y ensayos de rigor: {clean_ens}" if clean_ens else ""
        return (
            "Durante la jornada laboral se llevaron a cabo labores de inspección técnica "
            f"y seguimiento de los frentes de trabajo en el sitio{eq_mention}{ens_mention}, verificando la conformidad "
            "con las especificaciones del proyecto y normativas de seguridad correspondientes."
        )

    cleaned_acts = [_clean_activity_text(a) for a in actividades if _clean_activity_text(a)]
    if not cleaned_acts:
        cleaned_acts = [a.strip().rstrip(".") for a in actividades if a.strip()]

    # Limpiar prefijos redundantes que el usuario pueda haber escrito
    clean_parts: List[str] = []
    for act in cleaned_acts:
        act_text = re.sub(
            r"^(?:se\s+(?:ejecut[oó]|realiz[oó]|llevaron?\s+a\s+cabo)\s+(?:labores\s+de|trabajos\s+de)?|trabajos\s+de\s+|labores\s+de\s+)",
            "",
            act,
            flags=re.IGNORECASE,
        ).strip()
        if act_text:
            first_char = act_text[0].lower() if len(act_text) > 1 else act_text.lower()
            clean_parts.append(first_char + act_text[1:] if len(act_text) > 1 else first_char)

    equipos_mencion = ""
    if clean_eq:
        equipos_mencion = f", disponiendo operativamente de la maquinaria y equipos en sitio: {clean_eq}"

    ensayos_mencion = ""
    if clean_ens:
        ensayos_mencion = f", ejecutándose asimismo los controles técnicos y ensayos correspondientes: {clean_ens}"

    if not clean_parts:
        return (
            f"Durante la jornada se realizaron verificaciones de avance en los frentes de obra{equipos_mencion}{ensayos_mencion} "
            "conforme a las especificaciones constructivas del proyecto."
        )

    # Conectar las actividades fluidamente sin muletillas redundantes
    if len(clean_parts) == 1:
        cuerpo = f"se ejecutó {clean_parts[0]}"
    elif len(clean_parts) == 2:
        cuerpo = f"se ejecutó {clean_parts[0]}, coordinando simultáneamente {clean_parts[1]}"
    else:
        primeras = ", ".join(f"se procedió con {p}" if i == 0 else p for i, p in enumerate(clean_parts[:-1]))
        cuerpo = f"{primeras}, y de manera continua {clean_parts[-1]}"

    personal_mencion = f" ({obreros})" if obreros else ""

    parrafo = (
        f"Durante la jornada se avanzó en los frentes de trabajo programados con el personal en sitio{personal_mencion}: "
        f"{cuerpo}{equipos_mencion}{ensayos_mencion}, ejecutándose los trabajos según lo planificado y conforme a las especificaciones técnicas del proyecto y la normativa de seguridad laboral correspondiente."
    )
    return parrafo


def generate_labor_description_ai(
    actividades: List[str],
    obra: str = "",
    empresa: str = "",
    fecha: str = "",
    obreros: str = "",
    equipos: str = "",
    ensayos: str = "",
) -> str:
    """
    Genera la redacción técnica para 'DESCRIPCIÓN DE LA LABOR' del Libro de Obra
    en formato de párrafo descriptivo continuo y estrictamente apegado a las actividades,
    al movimiento de maquinarias y equipos, y a los ensayos/controles de calidad reportados en la jornada.
    Si GEMINI_API_KEY está configurada, utiliza Google Gemini; de lo contrario, el generador heurístico fiel.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key and api_key != "your_gemini_api_key_here":
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")

            actividades_txt = "\n".join(f"- {act}" for act in actividades)
            equipos_clean = _clean_equipment_text(equipos) or "Herramientas menores y equipos estándar de obra"
            ensayos_clean = _clean_ensayos_text(ensayos)
            ensayos_line = f"Ensayos / Control de Calidad reportados: {ensayos_clean}\n" if ensayos_clean else ""

            prompt = (
                "Eres un Ingeniero Inspector Senior de Obras Civiles en Venezuela.\n"
                "Tu tarea es redactar la 'DESCRIPCIÓN DE LA LABOR' para la hoja oficial de control diario del Libro de Obra (Página 15 del CIV).\n\n"
                f"Obra: {obra}\n"
                f"Contratista: {empresa}\n"
                f"Fecha: {fecha}\n"
                f"Personal en sitio: {obreros}\n"
                f"Movimiento de Maquinarias y Equipos: {equipos_clean}\n"
                f"{ensayos_line}"
                f"Resumen de Actividades ejecutadas en la jornada:\n{actividades_txt}\n\n"
                "REGLAS ESTRICTAS Y OBLIGATORIAS:\n"
                "1. Redacta en un ÚNICO PÁRRAFO DESCRIPTIVO CONTINUO. NO uses viñetas (•), guiones ni listas numeradas.\n"
                "2. INTEGRACIÓN DE MAQUINARIAS Y EQUIPOS: Incorpora en la redacción técnica el movimiento y apoyo operativo de la maquinaria y equipos reportados en la jornada (por ejemplo, camiones volteo, retroexcavadora, mezcladora, compresor, herramientas menores, etc.), relacionándolos armónicamente con las actividades correspondientes.\n"
                "3. INTEGRACIÓN DE ENSAYOS Y CONTROL DE CALIDAD: Si en la información suministrada se reportan ensayos, pruebas o controles técnicos (por ejemplo, cono de Abrams, toma de cilindros de concreto, pruebas hidrostáticas, densidades de campo, etc.), INCORPÓRALOS explícitamente en el relato técnico de la jornada, indicando su ejecución y verificación.\n"
                "4. APEGO TOTAL Y ABSOLUTO: Describe ÚNICAMENTE las actividades, personal, equipos y ensayos que figuran explícitamente en la información anterior. "
                "ESTÁ TOTALMENTE PROHIBIDO inventar o suponer labores, maquinarias o ensayos que no figuren en los datos suministrados.\n"
                "5. PROHIBICIÓN ESTRICTA DE CLIMA O ESTADO DEL TIEMPO: NO menciones bajo ninguna circunstancia el estado del tiempo, el sol, la lluvia, cielo despejado ni temperatura. El clima ya tiene su propia casilla oficial independiente en el formato.\n"
                "6. SIN REDUNDANCIAS NI MULETILLAS: Conecta las actividades, el personal, la maquinaria y los ensayos de forma técnica, fluida y profesional en tercera persona. "
                "Evita repetir fórmulas como 'se llevaron a cabo trabajos de', 'se ejecutaron labores de' de manera sucesiva.\n"
                "7. PROHIBICIÓN ESTRICTA DE FRASES CLICHÉ O TÉRMINOS IRRELEVANTES: NO uses frases genéricas prefabricadas ni términos que no correspondan con las labores indicadas. Mantén la redacción estrictamente apegada a la naturaleza de los trabajos reportados.\n"
                "8. Extensión: entre 70 y 140 palabras, en un solo párrafo bien hilvanado y técnico.\n"
                "9. Devuelve EXCLUSIVAMENTE el párrafo, sin títulos, introducciones, comillas ni despedidas."
            )
            response = model.generate_content(prompt)
            if response and response.text:
                cleaned_text = response.text.strip().strip('"')
                if cleaned_text:
                    return cleaned_text
        except Exception as exc:
            logger.warning("Fallo al consultar Gemini AI para redacción de labor: %s. Usando generador heurístico fiel.", exc)

    return _heuristic_generate_civil_description(actividades, obra, empresa, obreros, equipos, ensayos)
