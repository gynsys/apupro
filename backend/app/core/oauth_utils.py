"""
OAuth utility functions for whitelist validation.
"""
from sqlalchemy.orm import Session
from app.db.models.oauth_whitelist import OAuthWhitelist
from app.core.config import settings


def is_email_whitelisted(email: str, db: Session) -> bool:
    """
    Check if an email is whitelisted for OAuth registration.
    
    Checks both database whitelist and .env fallback configuration.
    
    Args:
        email: Email address to check
        db: Database session
        
    Returns:
        True if email is whitelisted, False otherwise
    """
    # Check database for explicit email whitelist
    db_whitelist = db.query(OAuthWhitelist).filter(
        OAuthWhitelist.email == email,
        OAuthWhitelist.is_active == True
    ).first()
    
    if db_whitelist:
        return True
    
    # Check database for domain wildcard whitelist
    domain_whitelists = db.query(OAuthWhitelist).filter(
        OAuthWhitelist.domain.isnot(None),
        OAuthWhitelist.is_active == True
    ).all()
    
    for wl in domain_whitelists:
        if email.endswith(wl.domain):
            return True
    
    # Fallback to .env configuration
    if email in settings.oauth_allowed_emails:
        return True
    
    for domain in settings.oauth_allowed_domains:
        if email.endswith(domain):
            return True
    
    return False


def add_email_to_whitelist(
    email: str, 
    db: Session, 
    added_by_id: int = None,
    notes: str = None
) -> OAuthWhitelist:
    """
    Add an email to the OAuth whitelist.
    
    Args:
        email: Email address to whitelist
        db: Database session
        added_by_id: ID of the doctor/admin adding this entry
        notes: Optional notes about why this email was whitelisted
        
    Returns:
        The created OAuthWhitelist entry
    """
    # Check if already exists
    existing = db.query(OAuthWhitelist).filter(
        OAuthWhitelist.email == email
    ).first()
    
    if existing:
        # Reactivate if inactive
        if not existing.is_active:
            existing.is_active = True
            db.commit()
        return existing
    
    # Create new whitelist entry
    whitelist_entry = OAuthWhitelist(
        email=email,
        added_by=added_by_id,
        is_active=True,
        notes=notes or f"Auto-added when doctor approved"
    )
    
    db.add(whitelist_entry)
    db.commit()
    db.refresh(whitelist_entry)
    
    return whitelist_entry
