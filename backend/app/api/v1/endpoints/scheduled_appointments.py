from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import crud, schemas
from app.db.base import get_db
from app.api.v1.endpoints.auth import get_current_user
from app.crud import scheduled_appointment as crud_scheduled
from app.schemas import scheduled_appointment as schema_scheduled

router = APIRouter()

@router.get("/", response_model=List[schema_scheduled.ScheduledAppointment])
def read_scheduled_appointments(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    upcoming: bool = Query(False, description="Filter only upcoming appointments"),
    current_user: Any = Depends(get_current_user),
) -> Any:
    """
    Retrieve scheduled appointments for the logged-in doctor.
    """
    # Multi-tenancy: current_user.id corresponds to doctor_id in this context
    appointments = crud_scheduled.get_scheduled_appointments_by_doctor(
        db, doctor_id=current_user.id, upcoming_only=upcoming, skip=skip, limit=limit
    )
    return appointments

@router.post("/", response_model=schema_scheduled.ScheduledAppointment)
def create_scheduled_appointment(
    *,
    db: Session = Depends(get_db),
    obj_in: schema_scheduled.ScheduledAppointmentCreate,
    current_user: Any = Depends(get_current_user),
) -> Any:
    """
    Create a new scheduled appointment.
    """
    # Ensure multi-tenancy: force doctor_id to be current_user.id
    obj_in.doctor_id = current_user.id
    return crud_scheduled.create_scheduled_appointment(db, obj_in=obj_in)

@router.put("/{id}", response_model=schema_scheduled.ScheduledAppointment)
def update_scheduled_appointment(
    *,
    db: Session = Depends(get_db),
    id: int,
    obj_in: schema_scheduled.ScheduledAppointmentUpdate,
    current_user: Any = Depends(get_current_user),
) -> Any:
    """
    Update a scheduled appointment.
    """
    db_obj = crud_scheduled.get_scheduled_appointment(db, id=id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Scheduled appointment not found")
    if db_obj.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return crud_scheduled.update_scheduled_appointment(db, db_obj=db_obj, obj_in=obj_in)

@router.delete("/{id}", response_model=schema_scheduled.ScheduledAppointment)
def delete_scheduled_appointment(
    *,
    db: Session = Depends(get_db),
    id: int,
    current_user: Any = Depends(get_current_user),
) -> Any:
    """
    Delete/Cancel a scheduled appointment.
    """
    db_obj = crud_scheduled.get_scheduled_appointment(db, id=id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Scheduled appointment not found")
    if db_obj.doctor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return crud_scheduled.delete_scheduled_appointment(db, id=id)
