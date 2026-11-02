import json
from decimal import Decimal
from pathlib import Path

import pytest

from app.modules.control_obra.domain import (
    ControlObra,
    ControlObraError,
    dec,
    money,
    q2,
)


FIXTURE = Path(__file__).parent.parent / "fixtures" / "example_budget.json"


@pytest.fixture
def budget_json():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


@pytest.fixture
def obra(budget_json):
    return ControlObra(budget_json)


def non_chapter_items(obra):
    return list(obra.items.values())


def test_original_budget_is_calculated_and_rounded(obra):
    assert obra.original_amount > 0
    assert obra.original_amount == q2(obra.original_amount)
    for item in obra.items.values():
        assert item.unit_price == q2(item.unit_price)
        assert item.original_amount == q2(item.original_amount)


def test_progress_physical_and_financial(obra):
    item = non_chapter_items(obra)[0]
    quantity = q2(item.original_quantity / 2)
    obra.register_progress(item.id, quantity, "2026-11-01")

    expected = q2(quantity * item.unit_price)
    assert obra.executed_amount == expected
    assert obra.executed_amount == q2(obra.executed_amount)
    assert obra.physical_percent == q2(obra.executed_amount / obra.modified_amount * 100)
    assert obra.financial_percent == q2(obra.executed_amount / obra.contract_amount * 100)


def test_decrease_and_increase_within_original(obra):
    items = non_chapter_items(obra)
    decrease_item, increase_item = items[0], items[1]

    before = obra.original_amount
    decrease = obra.add_modification(
        "decrease",
        [{"item_id": decrease_item.id, "quantity_delta": dec("0.10")}],
        code="DIS-001",
        description="Disminución de prueba",
    )
    obra.approve_modification(decrease.id)

    increased_quantity = q2(decrease_item.original_quantity * dec("0.05"))
    increase = obra.add_modification(
        "increase",
        [{"item_id": increase_item.id, "quantity_delta": increased_quantity}],
        code="AUM-001",
        description="Aumento de prueba",
    )
    obra.approve_modification(increase.id)

    assert obra.modified_amount <= obra.original_amount
    assert obra.modified_amount == q2(obra.modified_amount)
    assert obra.available_amount >= 0
    assert obra.modified_amount != before or increase.amount == 0


def test_increase_over_original_is_rejected_without_addendum(obra):
    item = non_chapter_items(obra)[0]
    modification = obra.add_modification(
        "increase",
        [{"item_id": item.id, "quantity_delta": item.original_quantity}],
        code="AUM-002",
        description="Aumento que excede el original",
    )

    with pytest.raises(ControlObraError, match="adendum"):
        obra.approve_modification(modification.id)

    assert modification.status == "draft"
    assert obra.modified_amount == obra.original_amount


def test_addendum_allows_modification_over_original(obra):
    item = non_chapter_items(obra)[0]
    modification = obra.add_modification(
        "increase",
        [{"item_id": item.id, "quantity_delta": dec("5")}],
        code="AUM-003",
        description="Aumento con recursos adicionales",
    )

    with pytest.raises(ControlObraError):
        obra.approve_modification(modification.id)

    addendum = obra.add_addendum(
        q2(modification.amount + dec("100")),
        code="AD-001",
        description="Recursos adicionales aprobados",
    )
    obra.approve_addendum(addendum.id)
    obra.approve_modification(modification.id)

    assert obra.contract_amount == q2(obra.original_amount + addendum.amount)
    assert obra.modified_amount <= obra.contract_amount
    assert obra.modified_amount > obra.original_amount


def test_extra_work_and_financial_percent(obra):
    original = obra.original_amount
    extra = obra.add_modification(
        "extra_work",
        [{
            "item_id": "EXTRA-001",
            "code": "EXTRA-001",
            "description": "Obra extra de prueba",
            "unit": "und",
            "quantity_delta": 1,
            "unit_price": 100,
            "is_new_item": True,
        }],
        code="OE-001",
        description="Obra extra",
    )

    with pytest.raises(ControlObraError):
        obra.approve_modification(extra.id)

    addendum = obra.add_addendum(100, code="AD-002", description="Recursos para obra extra")
    obra.approve_addendum(addendum.id)
    obra.approve_modification(extra.id)

    assert obra.modified_amount == q2(original + dec("100"))
    assert obra.financial_percent == 0
    assert obra.modified_amount == q2(obra.modified_amount)
    assert money(obra.modified_amount) == f"{obra.modified_amount:,.2f}"


def test_negative_progress_is_rejected(obra):
    item = non_chapter_items(obra)[0]
    with pytest.raises(ControlObraError):
        obra.register_progress(item.id, -1, "2026-11-01")
