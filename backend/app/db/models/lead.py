from sqlalchemy import Column, Integer, String, DateTime, JSON
from sqlalchemy.sql import func
from app.db.base import Base

class ArkoLead(Base):
    """
    Model representing a lead captured via the landing pages (e.g. Budget Calculator).
    """
    __tablename__ = "arko_leads"

    id = Column(Integer, primary_key=True, index=True)
    landing_site_id = Column(Integer, index=True, nullable=True) # Which clone generated the lead
    name = Column(String(255), nullable=False)
    contact_info = Column(String(255), nullable=False) # WhatsApp or Email
    source = Column(String(100), nullable=True) # E.g., 'calculadora_porcelanato'
    extra_data = Column(JSON, nullable=True) # Any additional budget data or parameters
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
