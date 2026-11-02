"""Módulo aislado de control de obra.

No contiene endpoints ni componentes de UI todavía: concentra el dominio,
las reglas de presupuesto original/modificado/adendum, el avance físico y
financiero, las pruebas y la simulación con el presupuesto de ejemplo.
"""
from .domain import (  # noqa: F401
    Addendum,
    BudgetItem,
    BudgetSettings,
    ControlObra,
    ControlObraError,
    Modification,
    ModificationLine,
    ProgressEntry,
    calculate_item_breakdown,
    dec,
    money,
    pct,
    q2,
)

__all__ = [
    "Addendum",
    "BudgetItem",
    "BudgetSettings",
    "ControlObra",
    "ControlObraError",
    "Modification",
    "ModificationLine",
    "ProgressEntry",
    "calculate_item_breakdown",
    "dec",
    "money",
    "pct",
    "q2",
]
