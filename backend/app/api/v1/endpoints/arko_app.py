from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional, Any, Generator, Dict
from pydantic import BaseModel, EmailStr
from datetime import datetime
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from passlib.context import CryptContext
import jwt
import uuid
import logging

from app.core.logging import logger
from app.db.arko_base import ArkoSessionLocal
from contextlib import contextmanager
from app.db.models.arko import ArkoUser, ArkoProject3D
from app.db.models.calculadora import MamposteriaCalculationRun
from app.schemas.calculadora import MamposteriaCalculationRunCreate, MamposteriaCalculationRunResponse
from app.core.security import create_access_token
from app.core.config import settings

@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    db = ArkoSessionLocal()
    try:
        yield db
    finally:
        db.close()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

router = APIRouter()

# --- Pydantic Schemas ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    is_active: bool

    class Config:
        from_attributes = True

class Project3DBase(BaseModel):
    name: str
    topology: Dict[str, Any]
    results: Optional[Dict[str, Any]] = None

class Project3DCreate(Project3DBase):
    pass

class Project3DUpdate(Project3DBase):
    pass

class Project3DResponse(Project3DBase):
    id: str
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Auth ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/arko_app/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        if email is None or token_type != "arko_user":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
    
    with get_db_session() as db:
        user = db.query(ArkoUser).filter(ArkoUser.email == email).first()
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user

@router.post("/auth/register", response_model=UserResponse)
def register(user_in: UserCreate):
    try:
        with get_db_session() as db:
            existing = db.query(ArkoUser).filter(ArkoUser.email == user_in.email).first()
            if existing:
                raise HTTPException(status_code=400, detail="Este correo ya está registrado")
            
            user = ArkoUser(
                email=user_in.email,
                hashed_password=get_password_hash(user_in.password),
                full_name=user_in.full_name
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering user: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        with get_db_session() as db:
            user = db.query(ArkoUser).filter(ArkoUser.email == form_data.username).first()
            if not user or not verify_password(form_data.password, user.hashed_password):
                raise HTTPException(status_code=400, detail="Correo o contraseña incorrectos")
            if not user.is_active:
                raise HTTPException(status_code=400, detail="Usuario inactivo")
            
            access_token = create_access_token(
                data={"sub": user.email, "type": "arko_user"}
            )
            return {"access_token": access_token, "token_type": "bearer", "user": {"id": user.id, "email": user.email, "name": user.full_name}}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in user login: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

# --- Projects CRUD ---

@router.get("/projects", response_model=List[Project3DResponse])
def get_projects(current_user: ArkoUser = Depends(get_current_user)):
    try:
        with get_db_session() as db:
            projects = db.query(ArkoProject3D).filter(ArkoProject3D.user_id == current_user.id).order_by(ArkoProject3D.updated_at.desc()).all()
            return projects
    except Exception as e:
        logger.error("Error fetching projects", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/projects", response_model=Project3DResponse)
def create_project(project_in: Project3DCreate, current_user: ArkoUser = Depends(get_current_user)):
    try:
        with get_db_session() as db:
            new_project = ArkoProject3D(
                id=str(uuid.uuid4()),
                user_id=current_user.id,
                name=project_in.name,
                topology=project_in.topology,
                results=project_in.results
            )
            db.add(new_project)
            db.commit()
            db.refresh(new_project)
            return new_project
    except Exception as e:
        logger.error("Error creating project", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/projects/{project_id}", response_model=Project3DResponse)
def update_project(project_id: str, project_in: Project3DUpdate, current_user: ArkoUser = Depends(get_current_user)):
    try:
        with get_db_session() as db:
            project = db.query(ArkoProject3D).filter(ArkoProject3D.id == project_id, ArkoProject3D.user_id == current_user.id).first()
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
            
            project.name = project_in.name
            project.topology = project_in.topology
            project.results = project_in.results
            db.commit()
            db.refresh(project)
            return project
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating project", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/projects/{project_id}")
def delete_project(project_id: str, current_user: ArkoUser = Depends(get_current_user)):
    try:
        with get_db_session() as db:
            project = db.query(ArkoProject3D).filter(ArkoProject3D.id == project_id, ArkoProject3D.user_id == current_user.id).first()
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
            
            db.delete(project)
            db.commit()
            return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting project", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

# --- Mamposteria Calculadora ---

@router.get("/calculadoras/mamposteria", response_model=List[MamposteriaCalculationRunResponse])
def get_mamposteria_runs(current_user: ArkoUser = Depends(get_current_user)):
    try:
        with get_db_session() as db:
            runs = db.query(MamposteriaCalculationRun).filter(MamposteriaCalculationRun.user_id == current_user.id).order_by(MamposteriaCalculationRun.created_at.desc()).all()
            return runs
    except Exception as e:
        logger.error("Error fetching mamposteria runs", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/calculadoras/mamposteria", response_model=MamposteriaCalculationRunResponse)
def create_mamposteria_run(run_in: MamposteriaCalculationRunCreate, current_user: ArkoUser = Depends(get_current_user)):
    try:
        with get_db_session() as db:
            new_run = MamposteriaCalculationRun(
                user_id=current_user.id,
                nombre_proyecto=run_in.nombre_proyecto,
                inputs=run_in.inputs,
                resultados=run_in.resultados
            )
            db.add(new_run)
            db.commit()
            db.refresh(new_run)
            return new_run
    except Exception as e:
        logger.error("Error creating mamposteria run", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/calculadoras/mamposteria/{run_id}", response_model=MamposteriaCalculationRunResponse)
def get_mamposteria_run(run_id: int, current_user: ArkoUser = Depends(get_current_user)):
    try:
        with get_db_session() as db:
            run = db.query(MamposteriaCalculationRun).filter(MamposteriaCalculationRun.id == run_id, MamposteriaCalculationRun.user_id == current_user.id).first()
            if not run:
                raise HTTPException(status_code=404, detail="Run not found")
            return run
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error fetching mamposteria run", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/calculadoras/mamposteria/{run_id}")
def delete_mamposteria_run(run_id: int, current_user: ArkoUser = Depends(get_current_user)):
    try:
        with get_db_session() as db:
            run = db.query(MamposteriaCalculationRun).filter(MamposteriaCalculationRun.id == run_id, MamposteriaCalculationRun.user_id == current_user.id).first()
            if not run:
                raise HTTPException(status_code=404, detail="Run not found")
            db.delete(run)
            db.commit()
            return {"status": "success", "message": "Cálculo eliminado"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting mamposteria run", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
