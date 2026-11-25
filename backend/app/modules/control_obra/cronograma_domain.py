"""Reglas de negocio y motor de cálculo para el cronograma de obra.

Calcula la distribución semanal uniforme, ponderación de capítulos,
prorrateo por mes calendario y Curva S financiera/física.
"""
from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging import logger


def calculate_week_dates(start_date: date, total_weeks: int, end_date: Optional[date] = None) -> List[Tuple[date, date]]:
    """Calcula las fechas de inicio y fin para cada semana del cronograma."""
    if not isinstance(start_date, date):
        raise ValueError("start_date debe ser una instancia de date")
    if total_weeks < 1:
        raise ValueError("total_weeks debe ser al menos 1")

    computed_end = end_date or (start_date + timedelta(days=total_weeks * 7 - 1))
    weeks: List[Tuple[date, date]] = []
    for w in range(1, total_weeks + 1):
        w_start = start_date + timedelta(days=7 * (w - 1))
        if w == total_weeks:
            w_end = computed_end
        else:
            w_end = start_date + timedelta(days=7 * w - 1)
        weeks.append((w_start, w_end))
    return weeks


def get_month_ranges(start_date: date, end_date: date) -> List[Dict[str, Any]]:
    """Genera la lista de meses calendario involucrados en el proyecto."""
    if not isinstance(start_date, date) or not isinstance(end_date, date):
        raise ValueError("start_date y end_date deben ser instancias de date")
    if end_date < start_date:
        raise ValueError("end_date no puede ser anterior a start_date")

    months: List[Dict[str, Any]] = []
    curr_year = start_date.year
    curr_month = start_date.month

    MONTH_NAMES_ES = [
        "", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
        "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
    ]

    while True:
        first_day = date(curr_year, curr_month, 1)
        _, last_day_num = monthrange(curr_year, curr_month)
        last_day = date(curr_year, curr_month, last_day_num)

        effective_start = max(first_day, start_date)
        effective_end = min(last_day, end_date)

        m_code = f"{MONTH_NAMES_ES[curr_month]}-{str(curr_year)[-2:]}"
        if effective_start.day != 1 or effective_end.day != last_day_num:
            label = f"{m_code} ({effective_start.day}–{effective_end.day})"
        else:
            label = m_code

        months.append({
            "year": curr_year,
            "month": curr_month,
            "code": m_code,
            "label": label,
            "first_day": effective_start,
            "last_day": effective_end,
            "calendar_first": first_day,
            "calendar_last": last_day,
        })

        if curr_year == end_date.year and curr_month == end_date.month:
            break

        curr_month += 1
        if curr_month > 12:
            curr_month = 1
            curr_year += 1

    return months


def calculate_month_fractions(
    week_ranges: List[Tuple[date, date]],
    month_ranges: List[Dict[str, Any]],
) -> List[List[float]]:
    """Calcula la matriz de fracciones de tiempo de cada semana por mes calendario."""
    if not week_ranges or not month_ranges:
        return []

    matrix: List[List[float]] = []
    for m in month_ranges:
        row: List[float] = []
        m_start = m["calendar_first"]
        m_end = m["calendar_last"]
        for w_start, w_end in week_ranges:
            overlap_start = max(w_start, m_start)
            overlap_end = min(w_end, m_end)
            if overlap_end >= overlap_start:
                days_in_month = (overlap_end - overlap_start).days + 1
            else:
                days_in_month = 0
            w_total_days = max(1, (w_end - w_start).days + 1)
            frac = days_in_month / w_total_days
            row.append(frac)
        matrix.append(row)
    return matrix


def map_item_to_weeks(
    item: Dict[str, Any],
    project_start: date,
    total_weeks: int,
) -> Tuple[int, int]:
    """Determina la semana de inicio y fin (1 a total_weeks) de una partida."""
    p_start_str = item.get("planned_start")
    p_end_str = item.get("planned_end")

    if not p_start_str or not p_end_str:
        return 1, total_weeks

    try:
        p_start = date.fromisoformat(p_start_str) if isinstance(p_start_str, str) else p_start_str
        p_end = date.fromisoformat(p_end_str) if isinstance(p_end_str, str) else p_end_str
    except Exception:
        logger.error("Error convirtiendo fechas de planificación para partida %s", item.get("item_id"), exc_info=True)
        return 1, total_weeks

    start_delta = (p_start - project_start).days
    end_delta = (p_end - project_start).days

    start_week = max(1, min(total_weeks, (start_delta // 7) + 1))
    end_week = max(start_week, min(total_weeks, (end_delta // 7) + 1))
    return int(start_week), int(end_week)


def distribute_weekly_amount(
    amount: float,
    start_week: int,
    end_week: int,
    total_weeks: int,
) -> List[float]:
    """Distribuye uniformemente el monto de una partida entre las semanas asignadas."""
    if total_weeks < 1:
        raise ValueError("total_weeks debe ser al menos 1")
    if start_week < 1 or end_week > total_weeks or start_week > end_week:
        start_week = max(1, min(total_weeks, start_week))
        end_week = max(start_week, min(total_weeks, end_week))

    duration_weeks = end_week - start_week + 1
    weekly_val = amount / duration_weeks if duration_weeks > 0 else 0.0

    result: List[float] = []
    for w in range(1, total_weeks + 1):
        if start_week <= w <= end_week:
            result.append(weekly_val)
        else:
            result.append(0.0)
    return result


def build_schedule_dataset(
    items: List[Dict[str, Any]],
    start_date: date,
    total_weeks: int = 13,
    end_date: Optional[date] = None,
    iva_rate: float = 0.16,
) -> Dict[str, Any]:
    """Construye la estructura completa de datos del cronograma, capítulos, curva S y prorrateo mensual."""
    if not isinstance(start_date, date):
        raise ValueError("start_date debe ser una instancia de date")
    if total_weeks < 1:
        raise ValueError("total_weeks debe ser al menos 1")

    computed_end = end_date or (start_date + timedelta(days=total_weeks * 7 - 1))
    week_ranges = calculate_week_dates(start_date, total_weeks, computed_end)
    month_ranges = get_month_ranges(start_date, computed_end)
    month_fractions = calculate_month_fractions(week_ranges, month_ranges)

    total_budget_amount = sum(float(it.get("current_amount") or 0.0) for it in items)
    if total_budget_amount <= 0:
        total_budget_amount = 1.0

    # Procesar partidas individuales
    processed_items: List[Dict[str, Any]] = []
    weekly_item_distributions: List[List[float]] = []

    for idx, it in enumerate(items, start=1):
        amt = float(it.get("current_amount") or 0.0)
        s_w, e_w = map_item_to_weeks(it, start_date, total_weeks)
        dist = distribute_weekly_amount(amt, s_w, e_w, total_weeks)
        weekly_item_distributions.append(dist)

        weight_pct = (amt / total_budget_amount) * 100.0
        processed_items.append({
            "num": idx,
            "item_id": it.get("item_id"),
            "code": it.get("code") or f"P{idx}",
            "description": it.get("description") or "",
            "unit": it.get("unit") or "UND",
            "quantity": float(it.get("current_quantity") or 0.0),
            "unit_price": float(it.get("unit_price") or 0.0),
            "total_amount": amt,
            "chapter": it.get("chapter_name") or "General",
            "weight_percent": weight_pct,
            "start_week": s_w,
            "end_week": e_w,
            "weekly_amounts": dist,
        })

    # Agrupar por capítulos
    chapters_dict: Dict[str, Dict[str, Any]] = {}
    for it in processed_items:
        chap_name = it["chapter"]
        if chap_name not in chapters_dict:
            chapters_dict[chap_name] = {
                "name": chap_name,
                "count": 0,
                "amount": 0.0,
                "min_week": total_weeks,
                "max_week": 1,
                "items": [],
                "weekly_amounts": [0.0] * total_weeks,
            }
        c = chapters_dict[chap_name]
        c["count"] += 1
        c["amount"] += it["total_amount"]
        c["min_week"] = min(c["min_week"], it["start_week"])
        c["max_week"] = max(c["max_week"], it["end_week"])
        c["items"].append(it)
        for w_idx in range(total_weeks):
            c["weekly_amounts"][w_idx] += it["weekly_amounts"][w_idx]

    chapters_list: List[Dict[str, Any]] = []
    cum_weight = 0.0
    for idx, (c_name, c_data) in enumerate(chapters_dict.items(), start=1):
        weight_pct = (c_data["amount"] / total_budget_amount) * 100.0
        cum_weight += weight_pct

        c_start_date = start_date + timedelta(days=7 * (c_data["min_week"] - 1))
        if c_data["max_week"] >= total_weeks:
            c_end_date = computed_end
        else:
            c_end_date = start_date + timedelta(days=7 * c_data["max_week"] - 1)
        duration_days = max(1, (c_end_date - c_start_date).days + 1)

        chapters_list.append({
            "num": idx,
            "name": c_name,
            "item_count": c_data["count"],
            "amount": c_data["amount"],
            "weight_percent": weight_pct,
            "cum_weight_percent": cum_weight,
            "start_week": c_data["min_week"],
            "end_week": c_data["max_week"],
            "start_date": c_start_date,
            "end_date": c_end_date,
            "duration_days": duration_days,
            "weekly_amounts": c_data["weekly_amounts"],
        })

    # Totales semanales y Curva S
    weekly_totals: List[float] = [0.0] * total_weeks
    for it in processed_items:
        for w in range(total_weeks):
            weekly_totals[w] += it["weekly_amounts"][w]

    weekly_percents: List[float] = [(w_amt / total_budget_amount) * 100.0 for w_amt in weekly_totals]
    curve_s_cumulative: List[float] = []
    running_pct = 0.0
    for wp in weekly_percents:
        running_pct += wp
        curve_s_cumulative.append(min(100.0, running_pct))

    # Prorrateo mensual por capítulo
    monthly_chapter_amounts: List[List[float]] = []
    for chap in chapters_list:
        chap_row: List[float] = []
        for m_idx, _ in enumerate(month_ranges):
            m_sum = 0.0
            for w_idx in range(total_weeks):
                m_sum += chap["weekly_amounts"][w_idx] * month_fractions[m_idx][w_idx]
            chap_row.append(m_sum)
        monthly_chapter_amounts.append(chap_row)

    monthly_totals: List[float] = [0.0] * len(month_ranges)
    for chap_row in monthly_chapter_amounts:
        for m_idx in range(len(month_ranges)):
            monthly_totals[m_idx] += chap_row[m_idx]

    monthly_percents: List[float] = [(m_amt / total_budget_amount) * 100.0 for m_amt in monthly_totals]
    monthly_cumulative: List[float] = []
    running_m_pct = 0.0
    for mp in monthly_percents:
        running_m_pct += mp
        monthly_cumulative.append(min(100.0, running_m_pct))

    return {
        "start_date": start_date,
        "end_date": computed_end,
        "total_weeks": total_weeks,
        "iva_rate": iva_rate,
        "total_budget_amount": total_budget_amount,
        "iva_amount": total_budget_amount * iva_rate,
        "total_with_iva": total_budget_amount * (1.0 + iva_rate),
        "week_ranges": week_ranges,
        "month_ranges": month_ranges,
        "month_fractions": month_fractions,
        "items": processed_items,
        "chapters": chapters_list,
        "weekly_totals": weekly_totals,
        "weekly_percents": weekly_percents,
        "curve_s_cumulative": curve_s_cumulative,
        "monthly_chapter_amounts": monthly_chapter_amounts,
        "monthly_totals": monthly_totals,
        "monthly_percents": monthly_percents,
        "monthly_cumulative": monthly_cumulative,
    }
