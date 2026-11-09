"""Pruebas unitarias para el motor de reglas del Revisor y Auditor de Presupuestos (Maprex vs CostBase)."""
from typing import Any, Dict, List

from app.modules.budget_review.domain.audit_rules import (
    calculate_apu_unit_price,
    compute_description_similarity,
    compute_snapshot_health_score,
    evaluate_item_audit_rules,
    generate_default_executive_conclusion,
    is_exact_or_1to1_description,
    is_specialized_labor_profile,
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


def test_uncoded_apu_not_rejected_when_well_structured() -> None:
    """Verifica que una partida no codificada (S/C) con APU bien estructurado NO se rechace ni sugiera homologaciones."""
    uncoded_item = {
        "original_code": "ESP-001",
        "description": "SUMINISTRO E INSTALACION DE MANTO ASFALTICO 4MM POLIESTER",
        "unit": "M2",
        "quantity": 100.0,
        "performance": 40.0,
        "imported_unit_price": 25.0,
        "calculated_unit_price": 25.0,
        "materials": [
            {"code": "MAT-01", "description": "MANTO ASFALTICO 4MM", "quantity": 1.15, "unit": "M2"},
            {"code": "MAT-02", "description": "IMPRIMADOR ASFALTICO", "quantity": 0.25, "unit": "GAL"},
        ],
        "equipments": [
            {"code": "EQU-01", "description": "SOPLETE Y REGULADOR", "quantity": 1.0, "waste_or_deprec": 1.0},
        ],
        "labors": [
            {"code": "MO-01", "description": "IMPERMEABILIZADOR", "quantity": 1.0},
            {"code": "MO-02", "description": "AYUDANTE", "quantity": 1.0},
        ],
    }
    findings = evaluate_item_audit_rules(uncoded_item, None, None)
    # No debe tener SIN-001 ni sugerir homologación
    assert not any(f["rule_id"] == "SIN-001" for f in findings)
    assert not any("Evaluar homologación" in (f.get("suggestion") or "") for f in findings)
    assert not any("Equivalente más parecido" in (f.get("message") or "") for f in findings)
    # Al estar bien estructurado, el status debe ser CONFORME
    assert uncoded_item.get("ai_audit_status") == "CONFORME"


def test_partida_code_prioritizes_covpar() -> None:
    """Verifica que el código oficial COVENIN (CovPar) tenga prioridad sobre el código interno (CodPar)."""
    master_item = {
        "cod_par": "CAR013",
        "cov_par": "C078750000",
        "description": "ACERO DE REFUERZO FY=4200 KG/CM2 CABILLAS",
        "unit": "KGF",
        "performance": 400.0,
    }
    item_data = {
        "original_code": "CAR013",
        "covenin_code": "C078750000",
        "description": "ACERO DE REFUERZO CABILLAS",
        "unit": "KGF",
        "quantity": 500.0,
        "performance": 200.0,  # Rendimiento alterado -> genera hallazgo REN-001
        "materials": [],
        "equipments": [],
        "labors": [],
    }
    findings = evaluate_item_audit_rules(item_data, master_item, None)
    assert len(findings) > 0
    for f in findings:
        # El item_code reportado debe ser el COVENIN C078750000, NUNCA CAR013
        assert f["item_code"] == "C078750000", f"Se esperaba CovPar C078750000 pero se obtuvo {f['item_code']}"


def test_partida_code_fallback_when_uncoded() -> None:
    """Verifica que si no hay CovPar o es S/C, se use el código original del presupuesto."""
    item_sc = {
        "original_code": "CUST-999",
        "covenin_code": "S/C",
        "description": "INSTALACION ESPECIAL DE TABIQUERIA ACUSTICA",
        "unit": "",  # Genera EST-001
        "quantity": 10.0,
        "performance": 15.0,
        "materials": [],
        "equipments": [],
        "labors": [],
    }
    findings = evaluate_item_audit_rules(item_sc, None, None)
    assert any(f["rule_id"] == "EST-001" for f in findings)
    est_finding = next(f for f in findings if f["rule_id"] == "EST-001")
    assert est_finding["item_code"] == "CUST-999"


def test_duplicate_partida_scan_and_single_emission() -> None:
    """Verifica que la detección de partidas duplicadas emita un solo hallazgo por código e incluya filas."""
    from collections import Counter, defaultdict

    raw_items = [
        {"row": 1, "code": "CAP1", "is_chapter": True},
        {"row": 2, "code": "ARB023", "cov_par": "U803100700", "is_chapter": False},
        {"row": 3, "code": "E311110", "cov_par": "E311110", "is_chapter": False},
        {"row": 4, "code": "ARB023", "cov_par": "U803100700", "is_chapter": False},
        {"row": 5, "code": "M110000", "cov_par": "M110000", "is_chapter": False},
        {"row": 6, "code": "ARB023", "cov_par": "U803100700", "is_chapter": False},
    ]

    code_occurrences = Counter()
    code_locations = defaultdict(list)
    for idx_scan, it_scan in enumerate(raw_items, start=1):
        if not it_scan.get("is_chapter") and str(it_scan.get("code") or "").strip():
            c_key = str(it_scan.get("code")).strip().upper()
            code_occurrences[c_key] += 1
            code_locations[c_key].append(int(it_scan.get("row") or idx_scan))

    reported_duplicate_codes = set()
    emitted_findings = []

    for raw in raw_items:
        if raw.get("is_chapter"):
            continue
        orig_code = str(raw.get("code") or "").strip()
        display_cov = str(raw.get("cov_par") or "").strip()
        effective_code = display_cov if (display_cov and display_cov.upper() != "S/C") else orig_code
        orig_key = orig_code.upper() if orig_code else ""

        if orig_key and code_occurrences.get(orig_key, 0) > 1 and orig_key not in reported_duplicate_codes:
            reported_duplicate_codes.add(orig_key)
            locs = code_locations.get(orig_key, [])
            locs_str = f" (filas {', '.join(f'#{r}' for r in locs)})" if locs else ""
            count = code_occurrences[orig_key]
            emitted_findings.append({
                "rule_id": "EST-007",
                "item_code": effective_code,
                "message": f"El código de partida aparece {count} veces en el presupuesto{locs_str}",
            })

    # Debe haber EXACTAMENTE 1 hallazgo EST-007, a pesar de que ARB023 aparece 3 veces
    assert len(emitted_findings) == 1
    f = emitted_findings[0]
    assert f["item_code"] == "U803100700"
    assert "3 veces en el presupuesto (filas #2, #4, #6)" in f["message"]
    # El mensaje no debe terminar con punto duplicado
    assert not f["message"].endswith("..")


def test_clean_message_formatting_no_double_dots() -> None:
    """Verifica que la función saneadora de mensajes evite el doble punto final."""
    import re

    def clean_message(msg: str) -> str:
        return re.sub(r"\.+$", "", (msg or "").strip())

    msg_with_dot = "Rendimiento reducido importado 300 vs maestro 400 (-25.0%)."
    msg_with_double_dot = "Factor manipulado en equipo (+900.0%).. "
    msg_without_dot = "El código de partida aparece 2 veces en el presupuesto"

    assert clean_message(msg_with_dot) == "Rendimiento reducido importado 300 vs maestro 400 (-25.0%)"
    assert clean_message(msg_with_double_dot) == "Factor manipulado en equipo (+900.0%)"
    assert clean_message(msg_without_dot) == "El código de partida aparece 2 veces en el presupuesto"
    # Concatenar un solo punto para la oración final
    assert f"{clean_message(msg_with_dot)}." == "Rendimiento reducido importado 300 vs maestro 400 (-25.0%)."


def test_structural_rules_emission() -> None:
    """Verifica que las reglas estructurales EST-001, EST-002, EST-003, EST-004, EST-005 emitan hallazgos claros."""
    item_broken = {
        "original_code": "PART-01",
        "description": "SUMINISTRO Y CONSTRUCCION DE MURO DE BLOQUE",
        "unit": "",  # EST-001
        "quantity": -5.0,  # EST-002
        "performance": 0.0,  # EST-003
        "materials": [],  # EST-005 (dice suministro pero no tiene materiales)
        "equipments": [
            {"code": "AND01", "resolved_master_code": "AND01"},
            {"code": "AND01", "resolved_master_code": "AND01"},  # EST-004 (equipo duplicado)
        ],
        "labors": [],  # EST-006 (tiene equipo pero no tiene mano de obra)
    }
    findings = evaluate_item_audit_rules(item_broken, None, None)
    rule_ids = {f["rule_id"] for f in findings}
    assert "EST-001" in rule_ids
    assert "EST-002" in rule_ids
    assert "EST-003" in rule_ids
    assert "EST-004" in rule_ids
    assert "EST-005" in rule_ids
    assert "EST-006" in rule_ids


def test_health_score_calculation_bounds() -> None:
    """El puntaje es el % de partidas aprobadas (sin hallazgos CRITICA/ALTA/MEDIA) sobre el total."""
    # Presupuesto perfecto sin hallazgos
    assert compute_snapshot_health_score([], total_items=10) == 100.0

    # Un hallazgo informativo Maprex no penaliza
    score_info = compute_snapshot_health_score(
        [{"severity": "INFO_MAPREX", "item_code": "A1"}], total_items=10
    )
    assert score_info == 100.0

    # 1 partida observada de 10 -> 90 % aprobadas
    score_crit = compute_snapshot_health_score(
        [{"severity": "CRITICA", "item_code": "A1"}], total_items=10
    )
    assert score_crit == 90.0

    # Varios hallazgos sobre la misma partida cuentan una sola partida observada
    same_item = [
        {"severity": "CRITICA", "item_code": "A1"},
        {"severity": "MEDIA", "item_code": "a1"},
    ]
    assert compute_snapshot_health_score(same_item, total_items=10) == 90.0

    # 40 de 100 partidas observadas -> 60 % aprobadas
    forty = [{"severity": "ALTA", "item_code": f"P{i}"} for i in range(40)]
    assert compute_snapshot_health_score(forty, total_items=100) == 60.0

    # Los hallazgos de capítulo (ARI-001) no cuentan como partida observada
    chapter = [{"severity": "ALTA", "rule_id": "ARI-001", "item_code": "CAP1"}]
    assert compute_snapshot_health_score(chapter, total_items=10) == 100.0

    # Nunca excede los límites 0..100
    many_findings = [{"severity": "CRITICA", "item_code": f"X{i}"} for i in range(50)]
    score_many = compute_snapshot_health_score(many_findings, total_items=5)
    assert score_many == 0.0


def test_uncoded_apu_detects_unregistered_materials_and_equipment_and_specialized_labor() -> None:
    """Verifica detección de insumos no registrados (MAT-005, EQU-005) y mano de obra especializada (LAB-003)."""
    payload: Dict[str, Any] = {
        "code": "S/C-001",
        "covenin_code": "S/C",
        "description": "REPARACIÓN ESTRUCTURAL CON FIBRA DE CARBONO Y RESINA EPÓXICA",
        "unit": "M2",
        "quantity": 10.0,
        "performance": 12.0,
        "is_uncoded": True,
        "materials": [
            {
                "code": "MAT-ESP-01",
                "description": "RESINA EPÓXICA ESTRUCTURAL BICOMPONENTE",
                "unit": "KG",
                "quantity": 1.2,
                "unit_price": 85.0,
                "is_in_database": False,
            },
            {
                "code": "CEM-01",
                "description": "CEMENTO PORTLAND GRIS TIPO I",
                "unit": "SACO",
                "quantity": 2.0,
                "unit_price": 10.0,
                "is_in_database": True,
            },
        ],
        "equipments": [
            {
                "code": "BOMBA-01",
                "description": "BOMBA DE INYECCIÓN DE RESINA EPÓXICA A ALTA PRESIÓN",
                "unit": "DIA",
                "quantity": 1.0,
                "unit_price": 150.0,
                "is_in_database": False,
            },
        ],
        "labors": [
            {
                "code": "ING-01",
                "description": "INGENIERO CALCULISTA ESTRUCTURAL CON 30 AÑOS DE EXPERIENCIA",
                "unit": "DIA",
                "quantity": 0.5,
                "unit_price": 250.0,
                "is_in_database": False,
            },
            {
                "code": "OBR-01",
                "description": "OBRERO DE PRIMERA",
                "unit": "DIA",
                "quantity": 2.0,
                "unit_price": 25.0,
                "is_in_database": True,
            },
        ],
    }

    findings = evaluate_item_audit_rules(payload, None, None)
    rule_ids = {f["rule_id"] for f in findings}

    assert "MAT-005" in rule_ids
    assert "EQU-005" in rule_ids
    assert "LAB-003" in rule_ids

    # Verificar sugerencias específicas
    mat_finding = next(f for f in findings if f["rule_id"] == "MAT-005")
    assert "1 cotización comercial" in mat_finding["suggestion"]
    assert "RESINA EPÓXICA" in mat_finding["message"]

    equ_finding = next(f for f in findings if f["rule_id"] == "EQU-005")
    assert "memoria de cálculo de costos horarios" in equ_finding["suggestion"]

    lab_finding = next(f for f in findings if f["rule_id"] == "LAB-003")
    assert "calculistas" in lab_finding["suggestion"].lower() or "soporte curricular" in lab_finding["suggestion"].lower()


def test_specialized_labor_profile_detection() -> None:
    """Verifica el reconocimiento regex de perfiles técnicos especializados."""
    assert is_specialized_labor_profile("Ingeniero Calculista Estructural") is True
    assert is_specialized_labor_profile("Analista de Laboratorio de Suelos") is True
    assert is_specialized_labor_profile("Especialista en Patología de Concreto") is True
    assert is_specialized_labor_profile("Ingeniero Geotecnista") is True
    assert is_specialized_labor_profile("Obrero de Primera") is False
    assert is_specialized_labor_profile("Albañil") is False
    assert is_specialized_labor_profile("") is False


def test_executive_conclusion_includes_quotes_and_specialized_labor() -> None:
    """Verifica que la conclusión ejecutiva incorpore los avisos de cotizaciones comerciales y mano de obra especializada."""
    findings = [
        {"rule_id": "MAT-005", "severity": "MEDIA", "item_code": "P-01"},
        {"rule_id": "EQU-005", "severity": "MEDIA", "item_code": "P-01"},
        {"rule_id": "LAB-003", "severity": "MEDIA", "item_code": "P-01"},
    ]
    conclusion = generate_default_executive_conclusion(
        health_score=80.0,
        critical_count=0,
        high_count=0,
        medium_count=3,
        uncoded_count=1,
        total_items=3,
        findings=findings,
    )
    assert "1 cotización comercial" in conclusion
    assert "equipos no catalogados" in conclusion
    assert "mano de obra técnica especializada" in conclusion


def test_one_to_one_code_and_description_match_prevents_false_positives() -> None:
    """
    Verifica que si una partida tiene un código similar/igual pero descripción alterada
    (ej. E12 S/C: LIMPIEZA Y DESMALEZAMIENTO DEL AREA DE TRABAJO vs BAN039: LIMPIEZA DEL AREA DE TRABAJO),
    el sistema NO compare peras con manzanas (no emita discrepancias de insumos internos de la receta)
    y emita el hallazgo DES-ALT-001 evaluándolo con IA.
    """
    # 1. Coincidencia 1 a 1 exacta o tipográfica
    assert is_exact_or_1to1_description("LIMPIEZA DEL ÁREA DE TRABAJO", "LIMPIEZA DEL AREA DE TRABAJO") is True
    assert is_exact_or_1to1_description("limpieza del area de trabajo", "LIMPIEZA DEL AREA DE TRABAJO") is True
    
    # Alcances diferentes deben retornar False
    assert is_exact_or_1to1_description(
        "LIMPIEZA Y DESMALEZAMIENTO DEL AREA DE TRABAJO",
        "LIMPIEZA DEL AREA DE TRABAJO",
    ) is False

    # 2. Partidas S/C reconocidas como no codificadas
    assert is_uncoded_code("E12 S/C") is True
    assert is_uncoded_code("S/C") is True
    assert is_uncoded_code("01 S-C") is True

    # 3. Al evaluar con evaluate_item_audit_rules, debe emitir DES-ALT-001 y NO comparar insumos de la receta
    budget_item: Dict[str, Any] = {
        "item_code": "E12 S/C",
        "covenin_code": "E12 S/C",
        "description": "LIMPIEZA Y DESMALEZAMIENTO DEL AREA DE TRABAJO",
        "unit": "M2",
        "quantity": 100.0,
        "performance": 350.0,
        "imported_unit_price": 1.21,
        "calculated_unit_price": 1.21,
        "materials": [{"code": "MAU015", "description": "BOLSA NEGRA", "amount": 0.5}],
        "equipments": [{"code": "ARB007", "description": "MACHETE ROZADOR", "amount": 2.0}],
        "labors": [{"code": "1-1.1", "description": "OBRERO DE 1RA", "amount": 4.0}],
    }
    master_item: Dict[str, Any] = {
        "cod_par": "BAN039",
        "cov_par": "E12 S/C",
        "description": "LIMPIEZA DEL AREA DE TRABAJO",
        "unit": "M2",
        "performance": 200.0,
        "unit_price": 0.85,
    }
    # En la base BAN039 tiene insumos de limpieza de oficina (pañito, jabón),
    # mientras que el presupuesto tiene machetes y rastrillo.
    master_recipe: Dict[str, List[Dict[str, Any]]] = {
        "materials": [{"code": "MAU010", "description": "PAÑITO YES", "amount": 0.1}],
        "equipments": [{"code": "LIM018", "description": "CEPILLO CARRETERO", "amount": 2.0}],
        "labors": [{"code": "1-1.1", "description": "OBRERO DE 1RA", "amount": 4.0}],
    }

    findings = evaluate_item_audit_rules(
        item_data=budget_item,
        master_item=master_item,
        master_recipe=master_recipe,
    )

    # Debe emitir exactamente DES-ALT-001 y NINGUNA discrepancia de insumos omitidos/extras
    rule_ids = [f["rule_id"] for f in findings]
    assert "DES-ALT-001" in rule_ids
    assert "INS-OMI-001" not in rule_ids
    assert "INS-EXT-001" not in rule_ids
    assert budget_item.get("ai_audit_status") is not None


