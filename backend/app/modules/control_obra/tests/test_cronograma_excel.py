"""Pruebas unitarias e integración para el cronograma de obra y generación de Excel."""
from __future__ import annotations

from datetime import date
from io import BytesIO

import openpyxl
import pytest

from app.modules.control_obra.cronograma_domain import (
    build_schedule_dataset,
    calculate_month_fractions,
    calculate_week_dates,
    distribute_weekly_amount,
    get_month_ranges,
    map_item_to_weeks,
)
from app.modules.control_obra.cronograma_excel import generate_cronograma_workbook


def test_calculate_week_dates() -> None:
    start = date(2026, 10, 22)
    weeks = calculate_week_dates(start, 13)
    assert len(weeks) == 13
    assert weeks[0][0] == date(2026, 10, 22)
    assert weeks[0][1] == date(2026, 10, 28)
    # Última semana
    assert weeks[12][0] == date(2027, 1, 14)


def test_get_month_ranges() -> None:
    start = date(2026, 10, 22)
    end = date(2027, 1, 22)
    months = get_month_ranges(start, end)
    assert len(months) == 4
    assert months[0]["code"] == "Oct-26"
    assert months[1]["code"] == "Nov-26"
    assert months[2]["code"] == "Dic-26"
    assert months[3]["code"] == "Ene-27"


def test_calculate_month_fractions() -> None:
    start = date(2026, 10, 22)
    end = date(2027, 1, 22)
    weeks = calculate_week_dates(start, 13, end)
    months = get_month_ranges(start, end)
    fractions = calculate_month_fractions(weeks, months)

    assert len(fractions) == 4
    assert len(fractions[0]) == 13
    # Cada semana debe sumar exactamente 1.0 (100%) entre todos los meses
    for w_idx in range(13):
        total_fraction = sum(fractions[m_idx][w_idx] for m_idx in range(4))
        assert abs(total_fraction - 1.0) < 1e-4


def test_distribute_weekly_amount() -> None:
    amt = 1000.0
    dist = distribute_weekly_amount(amt, start_week=2, end_week=5, total_weeks=10)
    assert len(dist) == 10
    assert dist[0] == 0.0  # Semana 1
    assert dist[1] == 250.0  # Semana 2
    assert dist[2] == 250.0  # Semana 3
    assert dist[3] == 250.0  # Semana 4
    assert dist[4] == 250.0  # Semana 5
    assert dist[5] == 0.0  # Semana 6
    assert sum(dist) == 1000.0


def test_build_schedule_dataset() -> None:
    items = [
        {
            "item_id": "it-1",
            "code": "E01",
            "description": "Estudio de suelos",
            "unit": "und",
            "current_quantity": 1.0,
            "unit_price": 3000.0,
            "current_amount": 3000.0,
            "chapter_name": "Estudios",
            "planned_start": "2026-10-22",
            "planned_end": "2026-11-05",
        },
        {
            "item_id": "it-2",
            "code": "E02",
            "description": "Replanteo",
            "unit": "m2",
            "current_quantity": 100.0,
            "unit_price": 20.0,
            "current_amount": 2000.0,
            "chapter_name": "Obras Preliminares",
            "planned_start": "2026-11-01",
            "planned_end": "2026-11-20",
        },
    ]

    start = date(2026, 10, 22)
    end = date(2027, 1, 22)
    ds = build_schedule_dataset(items, start_date=start, total_weeks=13, end_date=end)

    assert ds["total_budget_amount"] == 5000.0
    assert len(ds["items"]) == 2
    assert len(ds["chapters"]) == 2
    assert len(ds["weekly_totals"]) == 13
    assert abs(ds["curve_s_cumulative"][-1] - 100.0) < 1e-2


def test_generate_cronograma_workbook() -> None:
    items = [
        {
            "item_id": "it-1",
            "code": "E01",
            "description": "Estudio de suelos",
            "unit": "und",
            "current_quantity": 1.0,
            "unit_price": 3000.0,
            "current_amount": 3000.0,
            "chapter_name": "Estudios",
            "planned_start": "2026-10-22",
            "planned_end": "2026-11-05",
        },
    ]
    start = date(2026, 10, 22)
    end = date(2027, 1, 22)
    ds = build_schedule_dataset(items, start_date=start, total_weeks=13, end_date=end)

    buffer = generate_cronograma_workbook(
        dataset=ds,
        budget_name="Obra de Prueba",
        contractor_name="Mi Constructora",
        contractee_name="Cliente Ejemplo",
        location="La Guaira",
    )

    assert isinstance(buffer, BytesIO)
    buffer.seek(0)
    wb = openpyxl.load_workbook(buffer)

    # Verificar 4 hojas requeridas
    expected_sheets = ["Cronograma General", "Cronograma Mensual", "Partidas", "Ponderación"]
    assert wb.sheetnames == expected_sheets

    # Verificar nombres definidos
    names = [n for n in wb.defined_names]
    assert "START" in names
    assert "FIN" in names
    assert "IVA" in names

    # Verificar formato condicional en Cronograma General y Mensual
    assert len(wb["Cronograma General"].conditional_formatting) >= 1
    assert len(wb["Cronograma Mensual"].conditional_formatting) >= 1
