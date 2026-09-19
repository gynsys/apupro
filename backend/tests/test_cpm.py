import pytest
from datetime import date
from app.services.cpm_engine import (
    ActivityInput,
    DependencyInput,
    DependencyType,
    CPMCycleError,
    run_cpm,
    calculate_duration_from_apu,
    add_working_days
)


def test_calculate_duration_from_apu():
    # 10 m3 a 3 m3/día = 3.33 días -> Redondeo al superior = 4 días
    dur = calculate_duration_from_apu(quantity=10.0, rendimiento=3.0, cuadrillas=1.0, round_up=True)
    assert dur == 4.0

    # Con 2 cuadrillas: 10 / (3 * 2) = 1.66 -> 2 días
    dur_2 = calculate_duration_from_apu(quantity=10.0, rendimiento=3.0, cuadrillas=2.0, round_up=True)
    assert dur_2 == 2.0

    # Duración mínima de 1 día si da menor
    dur_min = calculate_duration_from_apu(quantity=0.1, rendimiento=10.0, cuadrillas=1.0, round_up=True)
    assert dur_min == 1.0

    # Validaciones fail-fast
    with pytest.raises(ValueError):
        calculate_duration_from_apu(quantity=-5.0, rendimiento=1.0)
    with pytest.raises(ValueError):
        calculate_duration_from_apu(quantity=5.0, rendimiento=0.0)


def test_cpm_series():
    """
    Caso Serie Pura:
    A (3d) -> B (4d) -> C (2d)
    Duración total = 3 + 4 + 2 = 9 días.
    Todas deben ser críticas con holgura 0.
    """
    acts = [
        ActivityInput(id="A", name="Excavación", duration=3.0),
        ActivityInput(id="B", name="Fundaciones", duration=4.0),
        ActivityInput(id="C", name="Columnas", duration=2.0),
    ]
    deps = [
        DependencyInput(predecessor_id="A", successor_id="B", type=DependencyType.FS),
        DependencyInput(predecessor_id="B", successor_id="C", type=DependencyType.FS),
    ]

    res = run_cpm(acts, deps)
    assert res.total_duration == 9.0
    assert res.critical_path == ["A", "B", "C"]

    assert res.activities["A"].early_start == 0.0
    assert res.activities["A"].early_finish == 3.0
    assert res.activities["A"].total_float == 0.0
    assert res.activities["A"].is_critical is True

    assert res.activities["B"].early_start == 3.0
    assert res.activities["B"].early_finish == 7.0
    assert res.activities["B"].total_float == 0.0

    assert res.activities["C"].early_start == 7.0
    assert res.activities["C"].early_finish == 9.0
    assert res.activities["C"].total_float == 0.0


def test_cpm_parallel_with_slack():
    r"""
    Caso Paralelo con Holgura:
        -> B (2d) ->
       /            \
    A (3d)          D (3d)
       \            /
        -> C (5d) ->
    Ruta crítica: A (3) -> C (5) -> D (3) = 11 días.
    B tiene duración 2 días, por lo que tiene holgura total:
    EF(B) = 3 + 2 = 5. LF(B) = LS(D) = 8.
    Total float de B = 8 - 5 = 3 días.
    """
    acts = [
        ActivityInput(id="A", name="Inicio", duration=3.0),
        ActivityInput(id="B", name="Vía Corta", duration=2.0),
        ActivityInput(id="C", name="Vía Larga", duration=5.0),
        ActivityInput(id="D", name="Fin", duration=3.0),
    ]
    deps = [
        DependencyInput(predecessor_id="A", successor_id="B", type=DependencyType.FS),
        DependencyInput(predecessor_id="A", successor_id="C", type=DependencyType.FS),
        DependencyInput(predecessor_id="B", successor_id="D", type=DependencyType.FS),
        DependencyInput(predecessor_id="C", successor_id="D", type=DependencyType.FS),
    ]

    res = run_cpm(acts, deps)
    assert res.total_duration == 11.0
    assert res.critical_path == ["A", "C", "D"]

    # Actividad B no es crítica y tiene 3 días de holgura
    act_b = res.activities["B"]
    assert act_b.is_critical is False
    assert act_b.early_start == 3.0
    assert act_b.early_finish == 5.0
    assert act_b.late_start == 6.0
    assert act_b.late_finish == 8.0
    assert act_b.total_float == 3.0
    assert act_b.free_float == 3.0  # ES(D)=8, EF(B)=5 -> 8 - 5 = 3


def test_cpm_start_to_start_with_lag():
    """
    Caso Start-to-Start (SS) con Lag:
    A (6d) y B (4d).
    B inicia 2 días después de que inicia A (SS + 2).
    ES(A) = 0, EF(A) = 6.
    ES(B) = ES(A) + 2 = 2, EF(B) = 2 + 4 = 6.
    Duración total = 6. Ambas terminan en el día 6 y son críticas.
    """
    acts = [
        ActivityInput(id="A", name="Estructura", duration=6.0),
        ActivityInput(id="B", name="Instalaciones", duration=4.0),
    ]
    deps = [
        DependencyInput(predecessor_id="A", successor_id="B", type=DependencyType.SS, lag=2.0),
    ]

    res = run_cpm(acts, deps)
    assert res.total_duration == 6.0
    assert res.activities["A"].early_start == 0.0
    assert res.activities["A"].early_finish == 6.0
    assert res.activities["B"].early_start == 2.0
    assert res.activities["B"].early_finish == 6.0
    assert res.activities["A"].is_critical is True
    assert res.activities["B"].is_critical is True


def test_cpm_finish_to_finish_with_lag():
    """
    Caso Finish-to-Finish (FF) con Lag:
    A (5d) y B (3d).
    B debe terminar al menos 1 día después de que termine A (FF + 1).
    EF(A) = 5.
    EF(B) >= EF(A) + 1 = 6.
    Como Dur(B)=3, ES(B) = 6 - 3 = 3.
    """
    acts = [
        ActivityInput(id="A", name="Colocación de Techo", duration=5.0),
        ActivityInput(id="B", name="Impermeabilización", duration=3.0),
    ]
    deps = [
        DependencyInput(predecessor_id="A", successor_id="B", type=DependencyType.FF, lag=1.0),
    ]

    res = run_cpm(acts, deps)
    assert res.total_duration == 6.0
    assert res.activities["A"].early_finish == 5.0
    assert res.activities["B"].early_finish == 6.0
    assert res.activities["B"].early_start == 3.0


def test_cpm_cycle_detection():
    """
    Detección estricta de ciclos y autorreferencias.
    """
    acts = [
        ActivityInput(id="A", name="Actividad A", duration=2.0),
        ActivityInput(id="B", name="Actividad B", duration=3.0),
        ActivityInput(id="C", name="Actividad C", duration=1.0),
    ]
    # Ciclo A -> B -> C -> A
    deps = [
        DependencyInput(predecessor_id="A", successor_id="B", type=DependencyType.FS),
        DependencyInput(predecessor_id="B", successor_id="C", type=DependencyType.FS),
        DependencyInput(predecessor_id="C", successor_id="A", type=DependencyType.FS),
    ]

    with pytest.raises(CPMCycleError) as exc_info:
        run_cpm(acts, deps)
    assert "Dependencia circular (ciclo) detectada" in str(exc_info.value)

    # Autorreferencia A -> A
    deps_self = [
        DependencyInput(predecessor_id="A", successor_id="A", type=DependencyType.FS),
    ]
    with pytest.raises(CPMCycleError):
        run_cpm(acts, deps_self)


def test_calendar_date_mapping():
    """
    Verificación del cálculo de fechas calendario con 5 días hábiles (L-V).
    Viernes 2026-10-02 + 1 día hábil -> Lunes 2026-10-05 (salta sábado y domingo).
    """
    friday = date(2026, 10, 2)
    next_day = add_working_days(friday, 1, work_days_per_week=5)
    assert next_day == date(2026, 10, 5)

    # Con 6 días hábiles (L-S):
    # Viernes + 1 día -> Sábado 2026-10-03
    next_sat = add_working_days(friday, 1, work_days_per_week=6)
    assert next_sat == date(2026, 10, 3)

    # Prueba con cronograma completo y fecha de inicio
    acts = [
        ActivityInput(id="A", name="Excavación", duration=2.0),  # Días 0 y 1
        ActivityInput(id="B", name="Vaciado", duration=1.0),     # Día 2
    ]
    deps = [
        DependencyInput(predecessor_id="A", successor_id="B", type=DependencyType.FS),
    ]
    # Empezando el Jueves 2026-10-01
    start_date = date(2026, 10, 1)
    res = run_cpm(acts, deps, project_start_date=start_date, work_days_per_week=5)

    # A dura 2 días: Jueves 01 y Viernes 02
    assert res.activities["A"].calendar_start == date(2026, 10, 1)
    assert res.activities["A"].calendar_end == date(2026, 10, 2)

    # B dura 1 día: Lunes 05
    assert res.activities["B"].calendar_start == date(2026, 10, 5)
    assert res.activities["B"].calendar_end == date(2026, 10, 5)
    assert res.end_date == date(2026, 10, 5)
