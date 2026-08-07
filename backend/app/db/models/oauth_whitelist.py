"""
OAuth Whitelist Model - Manages allowed emails/domains for Google OAuth registration.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class OAuthWhitelist(Base):
    """
    Stores whitelisted emails and domains for OAuth registration.
    
    Either email OR domain must be provided (enforced by check constraint).
    """
    __tablename__ = "oauth_whitelist"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Either email OR domain can be provided (one must be non-null)
    email = Column(String, nullable=True, index=True)  # Exact email whitelist
    domain = Column(String, nullable=True, index=True)  # Domain wildcard (e.g., "@gynsys.com")
    
    # Audit trail
    added_by = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    added_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Active flag
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    
    # Optional notes
    notes = Column(Text, nullable=True)
    
    # Relationship
    added_by_doctor = relationship("Doctor", foreign_keys=[added_by])
    
    __table_args__ = (
        CheckConstraint('email IS NOT NULL OR domain IS NOT NULL', name='email_or_domain_required'),
    )
    
    def __repr__(self):
        identifier = self.email or f"domain:{self.domain}"
        return f"<OAuthWhitelist(id={self.id}, {identifier}, active={self.is_active})>"
