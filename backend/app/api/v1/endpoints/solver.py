# arko360_platform/backend/app/api/routes/solver.py
from fastapi import APIRouter, Depends, HTTPException
from app.schemas.fea3d import Topology, ProjectResults
from app.engine.solvers import StructuralSolver
from sqlalchemy.orm import Session
from app.api.v1.endpoints.arko import get_db_session
from app.db.models.arko import ArkoProject3D
import uuid
import traceback

router = APIRouter()

@router.post("/{project_id}/solve")
async def submit_solver_job(project_id: str, topology: Topology):
    try:
        solver = StructuralSolver(topology)
        results = solver.solve()
        
        # El solver ahora actúa como función pura, el guardado lo hace el usuario manualmente.
            
        return {"job_id": project_id, "status": "completed", **results}
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Solver Error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    with get_db_session() as db:
        project = db.query(ArkoProject3D).filter(ArkoProject3D.id == job_id).first()
        if not project:
            return {"status": "not_found"}
        if project.results:
            return {"status": "completed", "results": project.results}
        return {"status": "running"}