from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.base import get_db
from app.db.models.lead import ArkoLead

router = APIRouter()

class LeadCreate(BaseModel):
    name: str
    contact_info: str
    source: str = None
    landing_site_id: int = None
    extra_data: dict = None

@router.post("/", status_code=201)
def create_lead(lead_in: LeadCreate, db: Session = Depends(get_db)):
    """
    Register a new lead captured from the landing page.
    Used for the Budget Calculator Lead Magnet.
    """
    new_lead = ArkoLead(
        name=lead_in.name,
        contact_info=lead_in.contact_info,
        source=lead_in.source,
        landing_site_id=lead_in.landing_site_id,
        extra_data=lead_in.extra_data
    )
    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)
    return {"status": "success", "lead_id": new_lead.id}
