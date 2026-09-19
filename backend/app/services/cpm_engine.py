from typing import Dict, List, Optional, Set, Tuple, Any
from enum import Enum
from dataclasses import dataclass, field
from datetime import date, timedelta
import math
import logging

logger = logging.getLogger(__name__)


class DependencyType(str, Enum):
    FS = "FS"  # Finish to Start: Sucesor inicia después de que predecesor termina
    SS = "SS"  # Start to Start: Sucesor inicia después de que predecesor inicia
    FF = "FF"  # Finish to Finish: Sucesor termina después de que predecesor termina
    SF = "SF"  # Start to Finish: Sucesor termina después de que predecesor inicia


class CPMCycleError(ValueError):
    """Excepción lanzada cuando se detecta una dependencia circular o ciclo en la red de actividades."""
    def __init__(self, message: str, cycle_path: Optional[List[str]] = None) -> None:
        super().__init__(message)
        self.cycle_path: List[str] = cycle_path or []


@dataclass
class ActivityInput:
    id: str
    name: str
    duration: float
    quantity: Optional[float] = None
    rendimiento: Optional[float] = None
    cuadrillas: float = 1.0


@dataclass
class DependencyInput:
    predecessor_id: str
    successor_id: str
    type: DependencyType = DependencyType.FS
    lag: float = 0.0


@dataclass
class ActivityResult:
    id: str
    name: str
    duration: float
    early_start: float
    early_finish: float
    late_start: float
    late_finish: float
    total_float: float
    free_float: float
    is_critical: bool
    calendar_start: Optional[date] = None
    calendar_end: Optional[date] = None


@dataclass
class CPMResult:
    activities: Dict[str, ActivityResult]
    total_duration: float
    critical_path: List[str]
    start_date: Optional[date] = None
    end_date: Optional[date] = None


def calculate_duration_from_apu(
    quantity: float,
    rendimiento: float,
    cuadrillas: float = 1.0,
    round_up: bool = True
) -> float:
    """
    Calcula la duración en días a partir de la cantidad y el rendimiento del APU.
    Fórmula: Duración = Cantidad / (Rendimiento * Cuadrillas)
    Redondea al entero superior si round_up es True (mínimo 1 día).
    """
    if quantity is None or quantity <= 0:
        raise ValueError("La cantidad debe ser un número positivo mayor que cero.")
    if rendimiento is None or rendimiento <= 0:
        raise ValueError("El rendimiento debe ser un número positivo mayor que cero.")
    if cuadrillas is None or cuadrillas <= 0:
        cuadrillas = 1.0

    raw_duration = quantity / (rendimiento * cuadrillas)
    if round_up:
        return float(max(1, math.ceil(raw_duration)))
    return float(max(0.1, round(raw_duration, 2)))


def add_working_days(
    start_date: date,
    days: int,
    work_days_per_week: int = 5
) -> date:
    """
    Añade un número de días hábiles a una fecha dada.
    - work_days_per_week = 5: Lunes a Viernes (días 0 a 4)
    - work_days_per_week = 6: Lunes a Sábado (días 0 a 5)
    """
    if days < 0:
        raise ValueError("El número de días a añadir no puede ser negativo.")
    if work_days_per_week not in (5, 6):
        raise ValueError("work_days_per_week debe ser 5 (L-V) o 6 (L-S).")

    allowed_weekdays = set(range(work_days_per_week))
    current = start_date

    # Ajustar fecha inicial si cae en día no laborable
    while current.weekday() not in allowed_weekdays:
        current += timedelta(days=1)

    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() in allowed_weekdays:
            added += 1

    return current


def detect_cycle_in_graph(
    adjacency: Dict[str, List[str]],
    all_nodes: Set[str]
) -> Optional[List[str]]:
    """
    Detecta si existe un ciclo en el grafo dirigido usando DFS con colores:
    0 = No visitado (Blanco), 1 = En proceso (Gris), 2 = Finalizado (Negro).
    Si encuentra un ciclo, devuelve la secuencia de nodos que lo forman.
    """
    color: Dict[str, int] = {node: 0 for node in all_nodes}
    parent: Dict[str, Optional[str]] = {node: None for node in all_nodes}
    cycle: List[str] = []

    def dfs(u: str) -> bool:
        color[u] = 1
        for v in adjacency.get(u, []):
            if color[v] == 1:
                curr = u
                cycle.append(v)
                while curr != v and curr is not None:
                    cycle.append(curr)
                    curr = parent.get(curr)
                cycle.append(v)
                cycle.reverse()
                return True
            if color[v] == 0:
                parent[v] = u
                if dfs(v):
                    return True
        color[u] = 2
        return False

    for node in all_nodes:
        if color[node] == 0:
            if dfs(node):
                return cycle
    return None


def run_cpm(
    activities: List[ActivityInput],
    dependencies: List[DependencyInput],
    project_start_date: Optional[date] = None,
    work_days_per_week: int = 5
) -> CPMResult:
    """
    Ejecuta el método de la ruta crítica (Critical Path Method - CPM / PDM).
    Soporta relaciones FS, SS, FF, SF con lag (positivo o negativo).
    Calcula:
      - Early Start (ES), Early Finish (EF)
      - Late Start (LS), Late Finish (LF)
      - Total Float (TF), Free Float (FF)
      - Ruta Crítica y Duración Total del Proyecto
      - Mapeo a Fechas Calendario
    """
    if not activities:
        return CPMResult(
            activities={},
            total_duration=0.0,
            critical_path=[],
            start_date=project_start_date,
            end_date=project_start_date
        )

    act_dict: Dict[str, ActivityInput] = {}
    for act in activities:
        if not act.id:
            raise ValueError("Toda actividad debe tener un 'id' no vacío.")
        if act.id in act_dict:
            raise ValueError(f"ID de actividad duplicado: '{act.id}'")
        if act.duration < 0:
            raise ValueError(f"La duración de la actividad '{act.id}' no puede ser negativa.")
        act_dict[act.id] = act

    node_ids = set(act_dict.keys())

    graph_succ: Dict[str, List[Tuple[str, DependencyType, float]]] = {n: [] for n in node_ids}
    graph_pred: Dict[str, List[Tuple[str, DependencyType, float]]] = {n: [] for n in node_ids}
    simple_adj: Dict[str, List[str]] = {n: [] for n in node_ids}

    for dep in dependencies:
        p, s = dep.predecessor_id, dep.successor_id
        if p not in act_dict:
            raise ValueError(f"La actividad predecesora '{p}' no existe en la lista de actividades.")
        if s not in act_dict:
            raise ValueError(f"La actividad sucesora '{s}' no existe en la lista de actividades.")
        if p == s:
            raise CPMCycleError(f"Actividad '{p}' depende de sí misma (autorreferencia).", [p, s])

        dep_type = dep.type if isinstance(dep.type, DependencyType) else DependencyType(str(dep.type).upper())
        lag = float(dep.lag or 0.0)

        graph_succ[p].append((s, dep_type, lag))
        graph_pred[s].append((p, dep_type, lag))
        simple_adj[p].append(s)

    cycle = detect_cycle_in_graph(simple_adj, node_ids)
    if cycle:
        cycle_str = " -> ".join(cycle)
        raise CPMCycleError(
            f"Dependencia circular (ciclo) detectada en el cronograma: {cycle_str}",
            cycle_path=cycle
        )

    in_degree = {n: len(graph_pred[n]) for n in node_ids}
    queue = [n for n in node_ids if in_degree[n] == 0]
    topological_order: List[str] = []

    while queue:
        u = queue.pop(0)
        topological_order.append(u)
        for v, _, _ in graph_succ[u]:
            in_degree[v] -= 1
            if in_degree[v] == 0:
                queue.append(v)

    if len(topological_order) != len(node_ids):
        raise CPMCycleError("No fue posible ordenar topológicamente las actividades. Verifique posibles ciclos.")

    es: Dict[str, float] = {}
    ef: Dict[str, float] = {}

    for u in topological_order:
        dur = act_dict[u].duration
        preds = graph_pred[u]

        if not preds:
            es[u] = 0.0
        else:
            required_es_list: List[float] = [0.0]
            for p, rel, lag in preds:
                p_es = es[p]
                p_ef = ef[p]

                if rel == DependencyType.FS:
                    req_es = p_ef + lag
                elif rel == DependencyType.SS:
                    req_es = p_es + lag
                elif rel == DependencyType.FF:
                    req_ef = p_ef + lag
                    req_es = req_ef - dur
                elif rel == DependencyType.SF:
                    req_ef = p_es + lag
                    req_es = req_ef - dur
                else:
                    req_es = p_ef + lag

                required_es_list.append(req_es)

            es[u] = max(required_es_list)

        ef[u] = es[u] + dur

    total_project_duration = max(ef.values()) if ef else 0.0

    lf: Dict[str, float] = {}
    ls: Dict[str, float] = {}

    for u in reversed(topological_order):
        dur = act_dict[u].duration
        succs = graph_succ[u]

        if not succs:
            lf[u] = total_project_duration
        else:
            required_lf_list: List[float] = []
            for s, rel, lag in succs:
                s_ls = ls[s]
                s_lf = lf[s]

                if rel == DependencyType.FS:
                    req_lf = s_ls - lag
                elif rel == DependencyType.SS:
                    req_ls = s_ls - lag
                    req_lf = req_ls + dur
                elif rel == DependencyType.FF:
                    req_lf = s_lf - lag
                elif rel == DependencyType.SF:
                    req_ls = s_lf - lag
                    req_lf = req_ls + dur
                else:
                    req_lf = s_ls - lag

                required_lf_list.append(req_lf)

            lf[u] = min(required_lf_list)

        ls[u] = lf[u] - dur

    total_float: Dict[str, float] = {}
    free_float: Dict[str, float] = {}
    is_critical: Dict[str, bool] = {}

    for u in node_ids:
        tf = round(lf[u] - ef[u], 4)
        total_float[u] = max(0.0, tf)
        is_critical[u] = abs(tf) <= 0.0001

        succs = graph_succ[u]
        if not succs:
            ff_val = total_project_duration - ef[u]
        else:
            slack_list: List[float] = []
            for s, rel, lag in succs:
                if rel == DependencyType.FS:
                    slack = es[s] - (ef[u] + lag)
                elif rel == DependencyType.SS:
                    slack = es[s] - (es[u] + lag)
                elif rel == DependencyType.FF:
                    slack = ef[s] - (ef[u] + lag)
                elif rel == DependencyType.SF:
                    slack = ef[s] - (es[u] + lag)
                else:
                    slack = es[s] - (ef[u] + lag)
                slack_list.append(slack)
            ff_val = min(slack_list)

        free_float[u] = max(0.0, round(ff_val, 4))

    critical_activities = [
        u for u in topological_order if is_critical[u]
    ]

    results: Dict[str, ActivityResult] = {}
    proj_end_date: Optional[date] = None

    for u in node_ids:
        act = act_dict[u]
        cal_start: Optional[date] = None
        cal_end: Optional[date] = None

        if project_start_date:
            es_days = int(round(es[u]))
            dur_days = int(round(act.duration))
            cal_start = add_working_days(project_start_date, es_days, work_days_per_week)
            if dur_days > 0:
                cal_end = add_working_days(cal_start, max(0, dur_days - 1), work_days_per_week)
            else:
                cal_end = cal_start

        results[u] = ActivityResult(
            id=u,
            name=act.name,
            duration=act.duration,
            early_start=round(es[u], 2),
            early_finish=round(ef[u], 2),
            late_start=round(ls[u], 2),
            late_finish=round(lf[u], 2),
            total_float=round(total_float[u], 2),
            free_float=round(free_float[u], 2),
            is_critical=is_critical[u],
            calendar_start=cal_start,
            calendar_end=cal_end
        )

    if project_start_date and total_project_duration > 0:
        total_int_days = int(round(total_project_duration))
        proj_end_date = add_working_days(
            project_start_date,
            max(0, total_int_days - 1),
            work_days_per_week
        )
    elif project_start_date:
        proj_end_date = project_start_date

    return CPMResult(
        activities=results,
        total_duration=round(total_project_duration, 2),
        critical_path=critical_activities,
        start_date=project_start_date,
        end_date=proj_end_date
    )
