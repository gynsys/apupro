"""Pruebas de aislamiento de componentes APU y administración de usuarios."""
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.budgets.apu_components import _owned_item_or_404
from app.api.v1.endpoints.users import _require_superadmin
from app.db.models.arko import ArkoAdmin
from app.db.models.budget import Budget, BudgetItem


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Budget.__table__.create(engine)
    BudgetItem.__table__.create(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    session.add(Budget(id="budget-1", user_id="1", name="Presupuesto A"))
    session.add(BudgetItem(
        id="item-1", budget_id="budget-1", cod_par="A-1",
        description="Partida A", unit="und", quantity=1,
    ))
    session.commit()
    yield session
    session.close()
    BudgetItem.__table__.drop(engine)
    Budget.__table__.drop(engine)
    engine.dispose()


def test_component_owner_is_required(db):
    owner = ArkoAdmin(id=1, email="owner@example.com")
    other = ArkoAdmin(id=2, email="other@example.com")

    assert _owned_item_or_404(db, "budget-1", "item-1", owner).id == "item-1"
    with pytest.raises(HTTPException) as exc:
        _owned_item_or_404(db, "budget-1", "item-1", other)
    assert exc.value.status_code == 404


def test_only_superadmin_can_manage_users():
    regular = ArkoAdmin(id=16, email="roomelt@costbase.net")
    admin = ArkoAdmin(id=1, email="admin@arko360.net")

    with pytest.raises(HTTPException) as exc:
        _require_superadmin(regular)
    assert exc.value.status_code == 403
    _require_superadmin(admin)
