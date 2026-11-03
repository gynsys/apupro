"""Aislamiento de APUs personalizados entre usuarios."""
import sys
from unittest.mock import MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Evita cargar el modelo de embeddings al probar únicamente el CRUD.
sys.modules.setdefault("app.services.user_semantic_cache", MagicMock())

from app.crud.crud_costbase import delete_custom_apu
from app.db.models.costbase import CustomCostItem


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    CustomCostItem.__table__.create(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    session.add_all([
        CustomCostItem(id="apu-user-1", user_id=1, description="APU uno", unit="und", performance=1, apu_data="{}"),
        CustomCostItem(id="apu-user-2", user_id=2, description="APU dos", unit="und", performance=1, apu_data="{}"),
        CustomCostItem(id="apu-sin-dueno", user_id=None, description="APU legado", unit="und", performance=1, apu_data="{}"),
    ])
    session.commit()
    yield session
    session.close()
    CustomCostItem.__table__.drop(engine)
    engine.dispose()


def test_user_cannot_delete_another_users_apu(db):
    with pytest.raises(PermissionError):
        delete_custom_apu(db, "apu-user-1", user_id=2)

    assert db.query(CustomCostItem).filter_by(id="apu-user-1").first() is not None


def test_user_cannot_delete_legacy_apu_without_owner(db):
    with pytest.raises(PermissionError):
        delete_custom_apu(db, "apu-sin-dueno", user_id=2)


def test_delete_requires_exact_id(db):
    assert delete_custom_apu(db, "apu-user", user_id=1) is False
    assert db.query(CustomCostItem).filter_by(id="apu-user-1").first() is not None


def test_owner_can_delete_own_apu(db):
    assert delete_custom_apu(db, "apu-user-1", user_id=1) is True
    assert db.query(CustomCostItem).filter_by(id="apu-user-1").first() is None
    assert db.query(CustomCostItem).filter_by(id="apu-user-2").first() is not None
