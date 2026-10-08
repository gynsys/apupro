"""
Submódulo de reconciliación de insumos con catálogos de base de datos.
"""
from app.services.ai_apu_service.reconciliation.specs_matcher import (
    _extract_technical_specs,
    _has_technical_spec_conflict,
    _has_primary_noun_conflict,
    _normalize_unit,
    _convert_material_quantity,
)
from app.services.ai_apu_service.reconciliation.equipment import (
    _normalize_equipment_prices,
    _execute_equipment_reconciliation,
    reconcile_equipment_with_database,
)
from app.services.ai_apu_service.reconciliation.materials import (
    _execute_material_reconciliation,
    reconcile_materials_with_database,
    _enforce_base_apu_material_heritage,
)
from app.services.ai_apu_service.reconciliation.labor import (
    _execute_labor_reconciliation,
    reconcile_labor_with_database,
)

__all__ = [
    "_extract_technical_specs",
    "_has_technical_spec_conflict",
    "_has_primary_noun_conflict",
    "_normalize_unit",
    "_convert_material_quantity",
    "_normalize_equipment_prices",
    "_execute_equipment_reconciliation",
    "reconcile_equipment_with_database",
    "_execute_material_reconciliation",
    "reconcile_materials_with_database",
    "_enforce_base_apu_material_heritage",
    "_execute_labor_reconciliation",
    "reconcile_labor_with_database",
]
