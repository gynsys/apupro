"""Pruebas unitarias para el motor de reglas del Revisor y Auditor de Presupuestos (Maprex vs CostBase)."""
from typing import Any, Dict, List

from app.modules.budget_review.domain.audit_rules import (
    calculate_apu_unit_price,
    compute_description_similarity,
    compute_snapshot_health_score,
    evaluate_item_audit_rules,
    is_uncoded_code,
)
from app.modules.budget_review.domain.maprex_baseline import (
    classify_costbase_item_origin,
    is_native_maprex_deprec_difference,
    normalize_unit,
)


def test_maprex_baseline_unit_and_origin() -> None:
    """Verifica normalización de unidades y clasificación de origen Maprex vs otras fuentes."""
    assert normalize_unit("XDIA") == "DIA"
    assert normalize_unit("DÍA") == "DIA"
    assert normalize_unit("PZA") == "UND"
    assert classify_costbase_item_origin("E311110120", "E311110120") == "MAPREX_BASE_OR_EDIFICACIONES"
    assert classify_costbase_item_origin("M111110000", "M111110000") == "COVENIN_MANTENIMIENTO_M"
    assert classify_costbase_item_origin("U471000000", "U471000000") == "COVENIN_URBANISMO_U"
    assert classify_costbase_item_origin("E0075665", "R416410300") == "LULOWIN_IP3_REPARACIONES_R"
    assert classify_costbase_item_origin("101868D0", "A603000022") == "LULOWIN_IP3_VIALIDAD_AMBIENTAL_A"
    assert classify_costbase_item_origin("3085A7F0", "2100RA") == "CADAFE_REDES_ELECTRICAS_RA"


def test_native_maprex_deprec_detection() -> None:
    """Verifica que las diferencias nativas de depreciación Maprex (1.0 vs 0.01/0.006272) se reconozcan."""
    assert is_native_maprex_deprec_difference("ESP012", 1.0, 0.006272) is True
    assert is_native_maprex_deprec_difference("ALB010", 1.0, 0.01) is True
    assert is_native_maprex_deprec_difference("ALB010", 0.45, 0.01) is False


def test_evaluate_audit_rules_detects_manipulations_and_native_maprex() -> None:
    """Verifica detección de rendimiento alterado, material manipulado, cuadrilla alterada y depreciación nativa."""
    master_item: Dict[str, Any] = {
        "cod_par": "EOP072",
        "cov_par": "E311110120",
        "description": "CONCRETO DE RCC 210 KG/CM2 EN COLUMNAS RECTANGULARES",
        "unit": "m3",
        "performance": 8.0,
        "unit_price": 210.0,
    }
    master_recipe: Dict[str, List[Dict[str, Any]]] = {
        "materials": [
            {"code": "CEM001", "description": "CEMENTO PORTLAND GRIS", "unit": "saco", "quantity": 8.5, "unit_price": 9.0, "waste_or_deprec": 5.0},
        ],
        "equipments": [
            {"code": "ESP012", "description": "HERRAMIENTAS MENORES", "unit": "día", "quantity": 1.0, "unit_price": 12.0, "waste_or_deprec": 0.006272},
        ],
        "labors": [
            {"code": "1-1-1", "description": "OBRERO DE 1RA", "unit": "día", "quantity": 2.0, "unit_price": 15.0, "bonus": 5.0, "waste_or_deprec": 0.0},
        ],
    }

    item_data: Dict[str, Any] = {
        "original_code": "EOP072",
        "description": "CONCRETO DE RCC 210 KG/CM2 EN COLUMNAS RECTANGULARES",
        "unit": "m3",
        "quantity": 25.0,
        "performance": 4.0,  # Reducido -50%
        "imported_unit_price": 0.0,
        "calculated_unit_price": 280.0,
        "materials": [
            {"code": "CEM001", "resolved_master_code": "CEM001", "description": "CEMENTO PORTLAND GRIS", "unit": "saco", "quantity": 12.0, "unit_price": 9.0, "waste_or_deprec": 5.0},
        ],
        "equipments": [
            {"code": "ESP012", "resolved_master_code": "ESP012", "description": "HERRAMIENTAS MENORES", "unit": "día", "quantity": 1.0, "unit_price": 12.0, "waste_or_deprec": 1.0},
        ],
        "labors": [
            {"code": "1-1-1", "resolved_master_code": "1-1-1", "description": "OBRERO DE 1RA", "unit": "día", "quantity": 4.0, "unit_price": 15.0, "bonus": 5.0},
        ],
    }

    findings = evaluate_item_audit_rules(
        item_data=item_data,
        master_item=master_item,
        master_recipe=master_recipe,
    )
    rule_ids = {f["rule_id"]: f for f in findings}
    assert "REN-001" in rule_ids
    assert rule_ids["REN-001"]["severity"] == "CRITICA"
    assert "MAT-002" in rule_ids
    assert "LAB-001" in rule_ids
    assert "EQU-004" in rule_ids
    # ESP012 con Deprec=1.0 vs 0.006272 debe clasificarse como INFO_MAPREX, no como manipulación crítica
    assert rule_ids["EQU-004"]["severity"] == "INFO_MAPREX"


def test_code_collision_detection() -> None:
    """Verifica que una colisión conocida entre Maprex y CostBase (CCS228) se detecte como COL-001."""
    master_item = {
        "cod_par": "CCS228",
        "cov_par": "C-S/C",
        "description": "SUMINISTRO, TRANSPORTE Y COLOCACION DE GEOTEXTIL TIPO GOETEX 200",
        "unit": "M2",
        "performance": 300.0,
    }
    item_data = {
        "original_code": "CCS228",
        "description": "REVESTIMIENTO DE CUNETAS DE CONCRETO DE RCC-180 KG/CM2 A LOS 28 DIAS",
        "unit": "M3",
        "quantity": 15.0,
        "performance": 8.5,
        "imported_unit_price": 150.0,
        "calculated_unit_price": 150.0,
        "materials": [],
        "equipments": [],
        "labors": [],
    }
    findings = evaluate_item_audit_rules(item_data, master_item, None)
    assert any(f["rule_id"] == "COL-001" for f in findings)
    assert is_uncoded_code("CUST-001", "S/C") is True
    assert compute_description_similarity("LAMINA DE YESO 4 X 8", "LAMINA DE YESO 4 X 8 X 1/2") > 0.6
    assert compute_snapshot_health_score(findings, 10) < 100.0
    calc = calculate_apu_unit_price(10.0, [], [], [])
    assert calc["unit_price"] == 0.0
