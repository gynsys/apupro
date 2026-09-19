from typing import List, Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.base import get_db
from app.api.v1.endpoints.arko import get_current_arko_admin
from app.db.models.arko import ArkoAdmin
from app.db.models.budget import Budget, BudgetItem
from app.db.models.schedule import ScheduleProject, ScheduleActivity, ScheduleDependency
from app.schemas.schedule import (
    ScheduleCreate, ScheduleUpdate, ScheduleOut,
    ActivityCreate, ActivityUpdate, ActivityOut,
    DependencyCreate, DependencyOut,
    ScheduleCalculateResponse, ImportItemsRequest
)
from app.services.cpm_engine import (
    ActivityInput, DependencyInput, DependencyType,
    CPMCycleError, run_cpm, calculate_duration_from_apu
)
from app.core.logging import logger

router = APIRouter()


def _recalculate_and_persist_schedule(
    db: Session,
    schedule: ScheduleProject
) -> ScheduleCalculateResponse:
    """Función auxiliar que ejecuta el motor CPM y persiste los resultados en la BD."""
    activities = schedule.activities
    dependencies = schedule.dependencies

    act_inputs: List[ActivityInput] = [
        ActivityInput(
            id=act.id,
            name=act.name,
            duration=float(act.duration),
            quantity=act.quantity,
            rendimiento=act.rendimiento,
            cuadrillas=float(act.cuadrillas or 1.0)
        )
        for act in activities
    ]

    dep_inputs: List[DependencyInput] = [
        DependencyInput(
            predecessor_id=dep.predecessor_id,
            successor_id=dep.successor_id,
            type=DependencyType(dep.type) if dep.type in DependencyType._value2member_map_ else DependencyType.FS,
            lag=float(dep.lag or 0.0)
        )
        for dep in dependencies
    ]

    cpm_result = run_cpm(
        activities=act_inputs,
        dependencies=dep_inputs,
        project_start_date=schedule.start_date,
        work_days_per_week=schedule.work_days_per_week
    )

    # Actualizar actividades con los resultados calculados
    for act in activities:
        res = cpm_result.activities.get(act.id)
        if res:
            act.early_start = res.early_start
            act.early_finish = res.early_finish
            act.late_start = res.late_start
            act.late_finish = res.late_finish
            act.total_float = res.total_float
            act.free_float = res.free_float
            act.is_critical = res.is_critical
            act.calendar_start = res.calendar_start
            act.calendar_end = res.calendar_end

    schedule.total_duration = cpm_result.total_duration
    schedule.end_date = cpm_result.end_date
    schedule.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(schedule)

    return ScheduleCalculateResponse(
        total_duration=schedule.total_duration,
        critical_path=cpm_result.critical_path,
        start_date=schedule.start_date,
        end_date=schedule.end_date,
        activities=[ActivityOut.model_validate(act) for act in schedule.activities]
    )


@router.get("/budget/{budget_id}", response_model=ScheduleOut)
def get_or_create_budget_schedule(
    budget_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> ScheduleOut:
    """Obtiene el cronograma de un presupuesto. Si no existe, lo crea e importa automáticamente las partidas."""
    if not budget_id:
        raise HTTPException(status_code=400, detail="El identificador del presupuesto es obligatorio.")

    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado.")

    # Verificar que el usuario tenga acceso al presupuesto
    if str(budget.user_id) != str(current_user.id) and not getattr(current_user, "is_superadmin", False):
        raise HTTPException(status_code=403, detail="No tiene permisos para acceder a este presupuesto.")

    schedule = db.query(ScheduleProject).filter(ScheduleProject.budget_id == budget_id).first()

    if not schedule:
        # Crear cronograma por defecto
        schedule = ScheduleProject(
            budget_id=budget.id,
            user_id=str(current_user.id),
            name=f"Cronograma - {budget.name}",
            description=budget.description,
            start_date=date.today(),
            work_days_per_week=5
        )
        db.add(schedule)
        db.flush()

        # Importación automática de partidas con cantidad > 0 (omitiendo capítulos)
        valid_items = [
            item for item in budget.items
            if not item.is_chapter and (item.quantity or 0.0) > 0
        ]

        for idx, item in enumerate(valid_items, start=1):
            perf = item.performance if item.performance and item.performance > 0 else 1.0
            dur = calculate_duration_from_apu(
                quantity=float(item.quantity),
                rendimiento=float(perf),
                cuadrillas=1.0,
                round_up=True
            )
            activity = ScheduleActivity(
                schedule_id=schedule.id,
                budget_item_id=item.id,
                code=f"ACT-{idx:02d}",
                name=item.description,
                order=idx,
                quantity=float(item.quantity),
                rendimiento=float(perf),
                cuadrillas=1.0,
                duration=dur
            )
            db.add(activity)

        db.commit()
        db.refresh(schedule)

        # Calcular CPM inicial si se importaron actividades
        if schedule.activities:
            try:
                _recalculate_and_persist_schedule(db, schedule)
            except Exception as err:
                logger.error(f"Error en cálculo CPM inicial: {err}", exc_info=True)

    return ScheduleOut.model_validate(schedule)


@router.post("/{schedule_id}/import-budget", response_model=ScheduleOut)
def import_budget_items(
    schedule_id: str,
    payload: ImportItemsRequest,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> ScheduleOut:
    """Sincroniza e importa partidas del presupuesto al cronograma."""
    schedule = db.query(ScheduleProject).filter(ScheduleProject.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Cronograma no encontrado.")
    if not schedule.budget_id:
        raise HTTPException(status_code=400, detail="Este cronograma no tiene un presupuesto asociado.")

    budget = db.query(Budget).filter(Budget.id == schedule.budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado.")

    existing_item_ids = {act.budget_item_id for act in schedule.activities if act.budget_item_id}
    current_max_order = max([act.order for act in schedule.activities] or [0])

    new_activities_count = 0
    valid_items = [
        item for item in budget.items
        if not item.is_chapter and (item.quantity or 0.0) > 0 and item.id not in existing_item_ids
    ]

    for item in valid_items:
        current_max_order += 1
        perf = item.performance if item.performance and item.performance > 0 else 1.0
        dur = calculate_duration_from_apu(
            quantity=float(item.quantity),
            rendimiento=float(perf),
            cuadrillas=payload.default_cuadrillas,
            round_up=payload.round_up
        )
        act = ScheduleActivity(
            schedule_id=schedule.id,
            budget_item_id=item.id,
            code=f"ACT-{current_max_order:02d}",
            name=item.description,
            order=current_max_order,
            quantity=float(item.quantity),
            rendimiento=float(perf),
            cuadrillas=payload.default_cuadrillas,
            duration=dur
        )
        db.add(act)
        new_activities_count += 1

    db.commit()
    db.refresh(schedule)

    # Recalcular CPM
    _recalculate_and_persist_schedule(db, schedule)
    return ScheduleOut.model_validate(schedule)


@router.put("/{schedule_id}", response_model=ScheduleOut)
def update_schedule(
    schedule_id: str,
    schedule_in: ScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> ScheduleOut:
    """Actualiza la configuración del cronograma (nombre, fecha de inicio, días por semana)."""
    schedule = db.query(ScheduleProject).filter(ScheduleProject.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Cronograma no encontrado.")

    update_data = schedule_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(schedule, field, value)

    schedule.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(schedule)

    # Recalcular fechas con el nuevo calendario o fecha inicial
    if schedule.activities:
        _recalculate_and_persist_schedule(db, schedule)

    return ScheduleOut.model_validate(schedule)


@router.post("/{schedule_id}/activities", response_model=ActivityOut, status_code=status.HTTP_201_CREATED)
def create_activity(
    schedule_id: str,
    activity_in: ActivityCreate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> ActivityOut:
    """Crea una nueva actividad en el cronograma."""
    schedule = db.query(ScheduleProject).filter(ScheduleProject.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Cronograma no encontrado.")

    data = activity_in.model_dump()
    activity = ScheduleActivity(
        schedule_id=schedule.id,
        **data
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)

    # Recalcular cronograma
    _recalculate_and_persist_schedule(db, schedule)
    db.refresh(activity)
    return ActivityOut.model_validate(activity)


@router.put("/{schedule_id}/activities/{activity_id}", response_model=ActivityOut)
def update_activity(
    schedule_id: str,
    activity_id: str,
    activity_in: ActivityUpdate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> ActivityOut:
    """Actualiza una actividad existente."""
    schedule = db.query(ScheduleProject).filter(ScheduleProject.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Cronograma no encontrado.")

    activity = db.query(ScheduleActivity).filter(
        ScheduleActivity.id == activity_id,
        ScheduleActivity.schedule_id == schedule_id
    ).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Actividad no encontrada.")

    update_data = activity_in.model_dump(exclude_unset=True)

    # Si se actualizan cantidad o rendimiento y no se envió duración manual explícita
    if ("quantity" in update_data or "rendimiento" in update_data or "cuadrillas" in update_data) and "duration" not in update_data:
        q = update_data.get("quantity", activity.quantity)
        r = update_data.get("rendimiento", activity.rendimiento)
        c = update_data.get("cuadrillas", activity.cuadrillas)
        if q and r and q > 0 and r > 0:
            update_data["duration"] = calculate_duration_from_apu(q, r, c or 1.0, round_up=True)

    for field, value in update_data.items():
        setattr(activity, field, value)

    db.commit()
    db.refresh(activity)

    # Recalcular cronograma
    _recalculate_and_persist_schedule(db, schedule)
    db.refresh(activity)
    return ActivityOut.model_validate(activity)


@router.delete("/{schedule_id}/activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(
    schedule_id: str,
    activity_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> None:
    """Elimina una actividad del cronograma y limpia sus dependencias en cascada."""
    activity = db.query(ScheduleActivity).filter(
        ScheduleActivity.id == activity_id,
        ScheduleActivity.schedule_id == schedule_id
    ).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Actividad no encontrada.")

    schedule = activity.schedule
    db.delete(activity)
    db.commit()

    if schedule:
        _recalculate_and_persist_schedule(db, schedule)


@router.post("/{schedule_id}/dependencies", response_model=DependencyOut, status_code=status.HTTP_201_CREATED)
def create_dependency(
    schedule_id: str,
    dep_in: DependencyCreate,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> DependencyOut:
    """Crea una dependencia entre dos actividades y valida que no introduzca ciclos."""
    if dep_in.predecessor_id == dep_in.successor_id:
        raise HTTPException(
            status_code=400,
            detail="Una actividad no puede ser predecesora de sí misma."
        )

    schedule = db.query(ScheduleProject).filter(ScheduleProject.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Cronograma no encontrado.")

    pred = db.query(ScheduleActivity).filter(
        ScheduleActivity.id == dep_in.predecessor_id,
        ScheduleActivity.schedule_id == schedule_id
    ).first()
    succ = db.query(ScheduleActivity).filter(
        ScheduleActivity.id == dep_in.successor_id,
        ScheduleActivity.schedule_id == schedule_id
    ).first()

    if not pred or not succ:
        raise HTTPException(status_code=404, detail="Una o ambas actividades no existen en este cronograma.")

    # Verificar si ya existe esta relación
    existing = db.query(ScheduleDependency).filter(
        ScheduleDependency.schedule_id == schedule_id,
        ScheduleDependency.predecessor_id == dep_in.predecessor_id,
        ScheduleDependency.successor_id == dep_in.successor_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Esta dependencia ya existe entre las dos actividades.")

    # Intentar crear la dependencia
    dependency = ScheduleDependency(
        schedule_id=schedule.id,
        predecessor_id=dep_in.predecessor_id,
        successor_id=dep_in.successor_id,
        type=dep_in.type,
        lag=dep_in.lag
    )
    db.add(dependency)
    db.flush()

    # Validar que no produzca ciclo antes de consolidar
    try:
        _recalculate_and_persist_schedule(db, schedule)
    except CPMCycleError as cycle_err:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(cycle_err)
        )
    except Exception as err:
        db.rollback()
        logger.error(f"Error al verificar dependencia: {err}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Error en la dependencia: {err}")

    db.refresh(dependency)
    return DependencyOut.model_validate(dependency)


@router.delete("/{schedule_id}/dependencies/{dependency_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dependency(
    schedule_id: str,
    dependency_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> None:
    """Elimina una relación de dependencia."""
    dep = db.query(ScheduleDependency).filter(
        ScheduleDependency.id == dependency_id,
        ScheduleDependency.schedule_id == schedule_id
    ).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Dependencia no encontrada.")

    schedule = dep.schedule
    db.delete(dep)
    db.commit()

    if schedule:
        _recalculate_and_persist_schedule(db, schedule)


@router.post("/{schedule_id}/calculate", response_model=ScheduleCalculateResponse)
def calculate_schedule_endpoint(
    schedule_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin)
) -> ScheduleCalculateResponse:
    """Calcula la ruta crítica (CPM) y todas las fechas del cronograma."""
    schedule = db.query(ScheduleProject).filter(ScheduleProject.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Cronograma no encontrado.")

    try:
        result = _recalculate_and_persist_schedule(db, schedule)
        return result
    except CPMCycleError as cycle_err:
        raise HTTPException(status_code=400, detail=str(cycle_err))
    except Exception as err:
        logger.error(f"Error calculando cronograma CPM: {err}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error en el cálculo CPM: {str(err)}")
