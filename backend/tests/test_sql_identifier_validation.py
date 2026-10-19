"""Pruebas unitarias para la validacion de identificadores SQL contra inyeccion en dedup.py.

Verifica el endurecimiento sugerido y resuelto con el flujo Worker-Reviewer.
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.v1.endpoints.dedup import (
    validate_sql_identifier,
    ALLOWED_CATALOG_TABLES,
    ALLOWED_APU_TABLES,
    ALLOWED_COLUMNS,
    ALLOWED_BUDGET_TABLES,
)


def test_validate_sql_identifier_allowed() -> None:
    """Valida que los nombres legitimos de tablas y columnas pasen sin error."""
    assert validate_sql_identifier("cost360_materials", ALLOWED_CATALOG_TABLES) == "cost360_materials"
    assert validate_sql_identifier("cost360_equipment", ALLOWED_CATALOG_TABLES) == "cost360_equipment"
    assert validate_sql_identifier("cost360_labor", ALLOWED_CATALOG_TABLES) == "cost360_labor"
    assert validate_sql_identifier("CodMat", ALLOWED_COLUMNS) == "CodMat"
    assert validate_sql_identifier("Descri", ALLOWED_COLUMNS) == "Descri"
    assert validate_sql_identifier("cost360_apu_materials", ALLOWED_APU_TABLES) == "cost360_apu_materials"
    assert validate_sql_identifier("budget_apu_materials", ALLOWED_BUDGET_TABLES) == "budget_apu_materials"


def test_validate_sql_identifier_rejection_injection_payload() -> None:
    """Verifica que cualquier payload con caracteres especiales de inyeccion SQL sea rechazado."""
    malicious_payloads = [
        "cost360_materials; DROP TABLE users;--",
        "CodMat' OR '1'='1",
        "Descri\"; SELECT * FROM arko_admins;--",
        "tbl/*comment*/",
        "table$name",
        "tbl\x00inject",
    ]
    for payload in malicious_payloads:
        with pytest.raises(ValueError) as exc_info:
            validate_sql_identifier(payload, ALLOWED_CATALOG_TABLES)
        assert "Identificador SQL invalido" in str(exc_info.value) or "Solo se permiten" in str(exc_info.value)


def test_validate_sql_identifier_unknown_identifier() -> None:
    """Verifica que un nombre alfanumerico sintacticamente valido pero no autorizado sea rechazado."""
    with pytest.raises(ValueError) as exc_info:
        validate_sql_identifier("users", ALLOWED_CATALOG_TABLES)
    assert "Identificador SQL no autorizado" in str(exc_info.value)

    with pytest.raises(ValueError) as exc_info:
        validate_sql_identifier("password_hash", ALLOWED_COLUMNS)
    assert "Identificador SQL no autorizado" in str(exc_info.value)


def test_validate_sql_identifier_empty_or_non_string() -> None:
    """Verifica que cadenas vacias o tipos invalidos lancen ValueError de inmediato."""
    with pytest.raises(ValueError):
        validate_sql_identifier("", ALLOWED_CATALOG_TABLES)

    with pytest.raises(ValueError):
        validate_sql_identifier("   ", ALLOWED_CATALOG_TABLES)
