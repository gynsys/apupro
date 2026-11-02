"""Pruebas de integración de los endpoints de control de obra.

Usan SQLite en memoria y reemplazan las dependencias de FastAPI. No tocan la
base de datos de producción.
"""
from __future__ import annotations

from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base, get_db
from app.db.models.arko import ArkoAdmin
from app.db.models.budget import (
    Budget,
    BudgetAPUEquipment,
    BudgetAPULabor,
    BudgetAPUMaterial,
    BudgetItem,
)
from app.modules.control_obra.models import (
    ControlObraAddendum,
    ControlObraAudit,
    ControlObraModification,
    ControlObraModificationItem,
    ControlObraPeriod,
    ControlObraPlan,
    ControlObraProgressEntry,
)
from app.modules.control_obra.router import router as control_obra_router
from app.api.v1.endpoints.arko import get_current_arko_admin


TABLES = [
    Budget.__table__,
    BudgetItem.__table__,
    BudgetAPUMaterial.__table__,
    BudgetAPUEquipment.__table__,
    BudgetAPULabor.__table__,
    ControlObraModification.__table__,
    ControlObraModificationItem.__table__,
    ControlObraAddendum.__table__,
    ControlObraProgressEntry.__table__,
    ControlObraPeriod.__table__,
    ControlObraPlan.__table__,
    ControlObraAudit.__table__,
]


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=TABLES)
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    db = Session()
    budget = Budget(
        id="budget-test",
        user_id="1",
        name="Presupuesto de prueba",
        currency="USD",
        fcas_percent=417,
        admin_percent=15,
        profit_percent=10,
        iva_percent=16,
    )
    item = BudgetItem(
        id="item-1",
        budget_id=budget.id,
        cod_par="TEST-001",
        cov_par="TEST-001",
        description="Partida de prueba",
        unit="m2",
        quantity=10,
        performance=1,
        order=1,
        is_chapter=False,
    )
    db.add_all([budget, item])
    db.add(BudgetAPUMaterial(
        budget_item_id=item.id,
        codigo="MAT-1",
        descripcion="Material de prueba",
        unidad="und",
        precio_unitario=10,
        cantidad=1,
        desperdicio=0,
    ))
    db.add(BudgetAPULabor(
        budget_item_id=item.id,
        codigo="LAB-1",
        descripcion="Mano de obra de prueba",
        cantidad=1,
        jornal=5,
        bono=0,
    ))
    db.commit()

    def override_db():
        try:
            yield db
        finally:
            pass

    def override_user():
        return ArkoAdmin(id=1, email="test@example.com", is_active=True)

    app = FastAPI()
    app.include_router(control_obra_router)
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_arko_admin] = override_user

    with TestClient(app) as test_client:
        yield test_client

    db.close()
    Base.metadata.drop_all(engine, tables=TABLES)
    engine.dispose()


def test_summary_and_progress(client):
    response = client.get("/budgets/budget-test/control-obra")
    assert response.status_code == 200
    data = response.json()
    assert data["original_amount"] > 0
    assert data["items"][0]["code"] == "TEST-001"

    response = client.post("/budgets/budget-test/control-obra/progress", json={
        "item_id": "item-1",
        "quantity": 2.5,
        "entry_date": "2026-11-01",
        "notes": "avance de prueba",
    })
    assert response.status_code == 201

    data = client.get("/budgets/budget-test/control-obra").json()
    expected = round(data["items"][0]["unit_price"] * 2.5, 2)
    assert data["executed_amount"] == expected
    assert data["physical_percent"] == 25.0
    assert data["financial_percent"] == 25.0


def test_period_close_reopen_and_progress(client):
    response = client.post("/budgets/budget-test/control-obra/periods", json={
        "name": "Noviembre",
        "start_date": "2026-11-01",
        "end_date": "2026-11-30",
    })
    assert response.status_code == 201
    period_id = response.json()["id"]

    assert client.post(f"/budgets/budget-test/control-obra/periods/{period_id}/close").status_code == 200

    closed = client.post("/budgets/budget-test/control-obra/progress", json={
        "item_id": "item-1",
        "quantity": 1,
        "entry_date": "2026-11-10",
    })
    assert closed.status_code == 422

    reopened = client.post(
        f"/budgets/budget-test/control-obra/periods/{period_id}/reopen",
        json={"reason": "Corrección autorizada"},
    )
    assert reopened.status_code == 200

    allowed = client.post("/budgets/budget-test/control-obra/progress", json={
        "item_id": "item-1",
        "quantity": 1,
        "entry_date": "2026-11-10",
    })
    assert allowed.status_code == 201


def test_extra_work_requires_addendum(client):
    response = client.post("/budgets/budget-test/control-obra/modifications", json={
        "kind": "extra_work",
        "code": "OE-001",
        "description": "Obra extra",
        "lines": [{
            "item_id": None,
            "code": "EXTRA-1",
            "description": "Obra extra",
            "unit": "und",
            "quantity_delta": 1,
            "unit_price": 100,
            "is_new_item": True,
        }],
    })
    assert response.status_code == 201
    modification_id = response.json()["id"]

    assert client.post(
        f"/budgets/budget-test/control-obra/modifications/{modification_id}/approve"
    ).status_code == 422

    addendum = client.post("/budgets/budget-test/control-obra/addenda", json={
        "amount": 100,
        "code": "AD-001",
        "description": "Recursos adicionales",
    })
    assert addendum.status_code == 201
    addendum_id = addendum.json()["id"]
    assert client.post(
        f"/budgets/budget-test/control-obra/addenda/{addendum_id}/approve"
    ).status_code == 200
    assert client.post(
        f"/budgets/budget-test/control-obra/modifications/{modification_id}/approve"
    ).status_code == 200

    summary = client.get("/budgets/budget-test/control-obra").json()
    assert summary["addendum_amount"] == 100.0
    assert summary["contract_amount"] == summary["original_amount"] + 100.0


def test_curve_and_report(client):
    assert client.post("/budgets/budget-test/control-obra/plan", json={
        "item_id": "item-1",
        "planned_start": "2026-11-01",
        "planned_end": "2026-11-30",
    }).status_code == 200
    assert client.post("/budgets/budget-test/control-obra/progress", json={
        "item_id": "item-1",
        "quantity": 5,
        "entry_date": "2026-11-15",
    }).status_code == 201

    curve = client.get("/budgets/budget-test/control-obra/curve")
    assert curve.status_code == 200
    assert len(curve.json()) >= 1

    report = client.get("/budgets/budget-test/control-obra/report.xlsx")
    assert report.status_code == 200
    assert report.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert len(report.content) > 100
