"""
Servicio para consolidar inspecciones diarias en un Informe Resumen Semanal.
1. Filtra y agrupa las inspecciones seleccionadas de la obra.
2. Deduplica inteligentemente las actividades ejecutadas en la semana.
3. Agrupa y numera todas las fotografías de las jornadas.
4. Establece el rango de fechas de la semana (ej: 'Semana del 26/10/2026 al 30/10/2026').
"""
import re
from datetime import datetime
from typing import Any, Dict, List, Tuple


def _normalize_activity(act: str) -> str:
    """Limpia puntuaciones, mayúsculas y acentos para comparación y deduplicación."""
    clean = act.strip().lower()
    clean = re.sub(r"^[\s.\-_*•]+", "", clean)
    clean = re.sub(r"[\s.]+$", "", clean)
    # Remover tildes simples
    repl = {"á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "ñ": "n"}
    for k, v in repl.items():
        clean = clean.replace(k, v)
    return clean


def consolidate_weekly_inspection(daily_entries: List[Dict[str, Any]]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Consolida una lista de inspecciones diarias en un único reporte semanal con fotos.
    Retorna (report_consolidado, fotos_consolidadas).
    """
    if not daily_entries:
        raise ValueError("No hay inspecciones diarias para consolidar.")

    base_report = daily_entries[0].get("report", {})
    obra = base_report.get("obra", "Obra")
    empresa = base_report.get("empresa", "")
    residente = base_report.get("ing_residente", "")
    inspectores = base_report.get("ing_inspectores", [])
    caporal = base_report.get("caporal", "") or base_report.get("caporal_obra", "")
    lapso = base_report.get("lapso_ejecucion", "")
    fecha_inicio = base_report.get("fecha_inicio", "")

    # 1. Recopilar fechas reales para determinar el rango semanal
    fechas = []
    all_activities_raw = []
    all_photos = []
    obreros_set = set()

    for item in daily_entries:
        rep = item.get("report", {})
        photos = item.get("photos", [])

        f_str = rep.get("fecha") or item.get("fecha") or ""
        if f_str:
            fechas.append(f_str)

        # Actividades
        for a in rep.get("actividades", []):
            if a and a.strip():
                all_activities_raw.append(a.strip())

        # Fotos
        for p in photos:
            p_copy = dict(p)
            # Agregar fecha en caption si no la tiene
            orig_cap = p_copy.get("caption") or ""
            if f_str and f_str not in orig_cap:
                p_copy["caption"] = f"[{f_str}] {orig_cap}".strip()
            all_photos.append(p_copy)

        # Personal
        if rep.get("obreros"):
            obreros_set.add(rep["obreros"])

    # 2. Deduplicar actividades conservando el mejor texto original
    seen_normalized = set()
    dedup_activities = []
    for act in all_activities_raw:
        norm = _normalize_activity(act)
        if norm and norm not in seen_normalized:
            seen_normalized.add(norm)
            clean_display = act.strip().lstrip(".-").strip()
            dedup_activities.append(clean_display)

    # 3. Formatear rango de fecha semanal
    if len(fechas) == 1:
        fecha_semanal = f"Semana al {fechas[0]}"
    elif fechas:
        fecha_semanal = f"Semana del {fechas[0]} al {fechas[-1]}"
    else:
        fecha_semanal = f"Semana {datetime.now().strftime('%d/%m/%Y')}"

    consolidated_report = {
        "obra": obra,
        "fecha": fecha_semanal,
        "fecha_inicio": fecha_inicio,
        "lapso_ejecucion": lapso,
        "empresa": empresa,
        "ing_residente": residente,
        "ing_inspectores": inspectores,
        "caporal": caporal,
        "actividades": dedup_activities,
        "obreros": ", ".join(obreros_set) if obreros_set else "Personal de obra",
        "es_resumen_semanal": True,
        "total_jornadas_consolidadas": len(daily_entries),
    }

    return consolidated_report, all_photos
