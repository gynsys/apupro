import sys
import os
from datetime import date
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.base import Base
from app.db.models.arko import ArkoAdmin
from app.db.models.budget import Budget, BudgetItem
from app.db.models.schedule import ScheduleProject, ScheduleActivity, ScheduleDependency
from app.schemas.schedule import (
    ActivityCreate, ActivityUpdate, DependencyCreate, ScheduleUpdate, ImportItemsRequest
)
from app.api.v1.endpoints.schedule import (
    get_or_create_budget_schedule,
    create_activity,
    update_activity,
    delete_activity,
    create_dependency,
    delete_dependency,
    calculate_schedule_endpoint,
    update_schedule
)
from fastapi import HTTPException


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    tables = [
        Budget.__table__,
        BudgetItem.__table__,
        ScheduleProject.__table__,
        ScheduleActivity.__table__,
        ScheduleDependency.__table__
    ]
    Base.metadata.create_all(bind=engine, tables=tables)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine, tables=tables)
        engine.dispose()


@pytest.fixture
def test_user():
    admin = ArkoAdmin(
        id=1,
        email="test@costbase.net",
        hashed_password="fake",
        is_active=True
    )
    return admin


def test_schedule_full_lifecycle(db_session: Session, test_user: ArkoAdmin):
    # 1. Crear un presupuesto con 3 partidas
    budget = Budget(
        id="b-100",
        user_id=str(test_user.id),
        name="Proyecto Galpón Industrial",
        description="Presupuesto base de prueba"
    )
    db_session.add(budget)
    db_session.flush()

    item1 = BudgetItem(
        id="item-1",
        budget_id=budget.id,
        cod_par="E111",
        description="Excavación en zanja",
        unit="m3",
        quantity=9.0,
        performance=3.0,  # 9 / 3 = 3 días
        is_chapter=False,
        order=1
    )
    item2 = BudgetItem(
        id="item-2",
        budget_id=budget.id,
        cod_par="E222",
        description="Concreto ciclópeo",
        unit="m3",
        quantity=10.0,
        performance=4.0,  # 10 / 4 = 2.5 -> ceil = 3 días
        is_chapter=False,
        order=2
    )
    item3 = BudgetItem(
        id="item-3",
        budget_id=budget.id,
        cod_par="E333",
        description="Vigas de riostra",
        unit="m3",
        quantity=8.0,
        performance=4.0,  # 8 / 4 = 2 días
        is_chapter=False,
        order=3
    )
    chapter = BudgetItem(
        id="chap-1",
        budget_id=budget.id,
        cod_par="CAP1",
        description="1. ESTRUCTURAS",
        unit="",
        quantity=0.0,
        is_chapter=True,
        order=0
    )
    db_session.add_all([chapter, item1, item2, item3])
    db_session.commit()

    # 2. Obtener / Crear cronograma automático desde el presupuesto
    sched_out = get_or_create_budget_schedule(budget.id, db=db_session, current_user=test_user)
    assert sched_out.budget_id == budget.id
    # No debe importar el capítulo, solo las 3 partidas con cantidad > 0
    assert len(sched_out.activities) == 3

    act1 = next(a for a in sched_out.activities if a.budget_item_id == "item-1")
    act2 = next(a for a in sched_out.activities if a.budget_item_id == "item-2")
    act3 = next(a for a in sched_out.activities if a.budget_item_id == "item-3")

    assert act1.duration == 3.0
    assert act2.duration == 3.0  # ceil(10 / 4) = 3
    assert act3.duration == 2.0

    # 3. Crear dependencias en serie: act1 (3d) -> act2 (3d) -> act3 (2d)
    dep1 = create_dependency(
        schedule_id=sched_out.id,
        dep_in=DependencyCreate(predecessor_id=act1.id, successor_id=act2.id, type="FS", lag=0.0),
        db=db_session,
        current_user=test_user
    )
    assert dep1.predecessor_id == act1.id

    dep2 = create_dependency(
        schedule_id=sched_out.id,
        dep_in=DependencyCreate(predecessor_id=act2.id, successor_id=act3.id, type="FS", lag=0.0),
        db=db_session,
        current_user=test_user
    )
    assert dep2.predecessor_id == act2.id

    # 4. Calcular cronograma CPM
    calc_res = calculate_schedule_endpoint(sched_out.id, db=db_session, current_user=test_user)
    # Duración total = 3 + 3 + 2 = 8 días
    assert calc_res.total_duration == 8.0
    assert calc_res.critical_path == [act1.id, act2.id, act3.id]

    # 5. Probar que una dependencia circular lanza HTTP 400
    with pytest.raises(HTTPException) as exc:
        create_dependency(
            schedule_id=sched_out.id,
            dep_in=DependencyCreate(predecessor_id=act3.id, successor_id=act1.id, type="FS"),
            db=db_session,
            current_user=test_user
        )
    assert exc.value.status_code == 400
    assert "circular" in exc.value.detail or "ciclo" in exc.value.detail

    # 6. Actualizar duración de act1 a 5 días y recalcular
    updated_act1 = update_activity(
        schedule_id=sched_out.id,
        activity_id=act1.id,
        activity_in=ActivityUpdate(duration=5.0),
        db=db_session,
        current_user=test_user
    )
    assert updated_act1.duration == 5.0
    # Nueva duración total = 5 + 3 + 2 = 10 días
    calc_res_updated = calculate_schedule_endpoint(sched_out.id, db=db_session, current_user=test_user)
    assert calc_res_updated.total_duration == 10.0
