from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import logging

from app.core.logging import logger
from app.db.arko_base import get_arko_db
from app.db.models.tenant import Tenant, TenantStatus
from app.api.v1.endpoints.arko import get_current_arko_admin

router = APIRouter()

# --- Schemas ---

class TenantBase(BaseModel):
    email: str
    nombre_completo: str
    telefono: Optional[str] = None
    especialidad: Optional[str] = None
    slug: str
    status: Optional[str] = "active"

class TenantCreate(TenantBase):
    password: str

class TenantUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    telefono: Optional[str] = None
    especialidad: Optional[str] = None
    slug: Optional[str] = None
    status: Optional[str] = None

class TenantResponse(TenantBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# --- Endpoints ---

@router.get("/", response_model=List[TenantResponse])
def get_all_tenants(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = None,
    current_admin = Depends(get_current_arko_admin),
    db: Session = Depends(get_arko_db)
):
    try:
        query = db.query(Tenant)
        if status_filter:
            query = query.filter(Tenant.status == status_filter)
        
        tenants = query.order_by(Tenant.created_at.desc()).offset(skip).limit(limit).all()
        return tenants
    except Exception as e:
        logger.error(f"Error fetching tenants: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
def create_tenant(
    tenant_in: TenantCreate,
    current_admin = Depends(get_current_arko_admin),
    db: Session = Depends(get_arko_db)
):
    from app.core.security import hash_password
    try:
        # Check email and slug
        if db.query(Tenant).filter(Tenant.email == tenant_in.email).first():
            raise HTTPException(status_code=400, detail="Email already registered")
        if db.query(Tenant).filter(Tenant.slug == tenant_in.slug).first():
            raise HTTPException(status_code=400, detail="Slug already taken")
            
        new_tenant = Tenant(
            email=tenant_in.email,
            password_hash=hash_password(tenant_in.password),
            nombre_completo=tenant_in.nombre_completo,
            telefono=tenant_in.telefono,
            especialidad=tenant_in.especialidad,
            slug=tenant_in.slug,
            status=tenant_in.status,
            is_verified=True
        )
        db.add(new_tenant)
        db.commit()
        db.refresh(new_tenant)
        return new_tenant
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating tenant: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/{tenant_id}", response_model=TenantResponse)
def update_tenant(
    tenant_id: int,
    tenant_in: TenantUpdate,
    current_admin = Depends(get_current_arko_admin),
    db: Session = Depends(get_arko_db)
):
    try:
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
            
        if tenant_in.slug and tenant_in.slug != tenant.slug:
            if db.query(Tenant).filter(Tenant.slug == tenant_in.slug).first():
                raise HTTPException(status_code=400, detail="Slug already taken")
                
        update_data = tenant_in.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(tenant, key, value)
            
        db.commit()
        db.refresh(tenant)
        return tenant
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating tenant: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
