from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.db.base import get_db
from app.schemas.costbase import CustomApuExportRequest
from app.crud.crud_costbase import (
    get_item_by_code,
    get_apu_materials,
    get_apu_equipments,
    get_apu_labors
)
from app.api.v1.endpoints.export_utils import generate_excel_workbook
from app.services.code_mapping import apply_code_maps, build_code_maps

router = APIRouter()


@router.post("/apu/{item_id}/export-excel")
async def export_apu_excel(item_id: str, db: Session = Depends(get_db)) -> FileResponse:
    """Genera un archivo Excel con fórmulas nativas usando el formato del script de referencia apu_formulas.py"""
    try:
        try:
            item = get_item_by_code(db, item_id.split('-')[0])
        except Exception:
            raise HTTPException(status_code=404, detail="Item not found")

        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        mat_rows = get_apu_materials(db, item_id)
        eq_rows = get_apu_equipments(db, item_id)
        mo_rows = get_apu_labors(db, item_id)

        item_dict = {
            "CodPar": item.CodPar,
            "CovPar": item.CovPar,
            "Descri": item.Descri,
            "UniPar": item.UniPar,
            "RenPar": item.RenPar
        }

        mats = [{"codigo": apu.CodIns or (mat.CodMat if mat else ''), "Descri": mat.Descri if mat else '', "UniMat": mat.UniMat if mat else '', "CanIns": apu.CanIns, "Desper": apu.Desper, "CosMat": mat.CosMat if mat else 0} for apu, mat in mat_rows]
        eqs = [{"codigo": apu.CodIns or (eq.CodEqu if eq else ''), "Descri": eq.Descri if eq else '', "CanIns": apu.CanIns, "Deprec": apu.Deprec, "CosDia": eq.CosDia if eq else 0} for apu, eq in eq_rows]
        mos = [{"codigo": apu.CodIns or (mo.CodMan if mo else ''), "Descri": mo.Descri if mo else '', "CanIns": apu.CanIns, "Jornal": mo.Jornal if mo else 0, "Bono": mo.Bono if mo else 0} for apu, mo in mo_rows]

        file_path, filename = generate_excel_workbook(item_dict, mats, eqs, mos)
        return FileResponse(path=str(file_path), filename=filename)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exportando APU Excel: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error al exportar APU: {str(e)}")


@router.post("/apu/export-excel-custom")
async def export_apu_excel_custom(payload: CustomApuExportRequest, db: Session = Depends(get_db)) -> FileResponse:
    """Genera un archivo Excel desde la memoria enviada por el frontend (APU dinámico o en edición)"""
    try:
        item_data = payload.item
        mats = payload.materials
        eqs = payload.equipments
        mos = payload.labors

        apply_code_maps(
            [{"materials": mats, "equipments": eqs, "labors": mos}],
            build_code_maps(db),
        )

        item_dict = {
            "CodPar": item_data.get("CodPar") or item_data.get("cod_par", "Custom"),
            "Descri": item_data.get("Descri") or item_data.get("description", "Custom APU"),
            "UniPar": item_data.get("UniPar") or item_data.get("unit", "UND"),
            "RenPar": item_data.get("RenPar") or item_data.get("performance", 1.0)
        }

        settings = payload.settings or {}
        file_path, filename = generate_excel_workbook(item_dict, mats, eqs, mos, settings)

        return FileResponse(
            path=str(file_path), 
            filename=filename, 
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exportando APU custom a Excel: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error al exportar APU: {str(e)}")
