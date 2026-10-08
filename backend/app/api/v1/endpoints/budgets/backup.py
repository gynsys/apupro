"""
Budget backup and restore endpoints: Encrypted export (.cb) and secure restore.
"""
from typing import Any, Dict

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.api.v1.endpoints.arko import get_current_arko_admin
from app.core.logging import logger
from app.db.base import get_db
from app.db.models.arko import ArkoAdmin
from app.db.models.budget import (
    Budget,
    BudgetAPUEquipment as DBEquipment,
    BudgetAPULabor as DBLabor,
    BudgetAPUMaterial as DBMaterial,
    BudgetItem,
)
from app.services.encryption_service import encryption_service
from .helpers import log_backup_action

router = APIRouter()


@router.post("/{budget_id}/backup")
async def export_budget_backup(
    budget_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Exporta un backup encriptado del presupuesto para descarga directa."""
    client_ip = request.client.host if request and request.client else None
    try:
        budget = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == str(current_user.id)).first()
        if not budget:
            log_backup_action(
                db,
                str(current_user.id),
                current_user.email,
                budget_id,
                "unknown",
                "export",
                "failed",
                "Budget not found",
                client_ip,
            )
            raise HTTPException(status_code=404, detail="Budget not found")

        # Obtener items del presupuesto
        items = db.query(BudgetItem).filter(BudgetItem.budget_id == budget_id).all()

        # Serializar budget y items
        budget_dict = {
            "id": budget.id,
            "name": budget.name,
            "description": budget.description,
            "client_name": budget.client_name,
            "currency": budget.currency,
            "exchange_rate": budget.exchange_rate,
            "fcas_percent": budget.fcas_percent,
            "admin_percent": budget.admin_percent,
            "profit_percent": budget.profit_percent,
            "iva_percent": budget.iva_percent,
            "labor_bonus": budget.labor_bonus,
            "material_inflation": budget.material_inflation,
            "labor_inflation": budget.labor_inflation,
            "equipment_inflation": budget.equipment_inflation,
            "company_name": budget.company_name,
            "company_rif": budget.company_rif,
            "project_name": budget.project_name,
            "created_at": budget.created_at.isoformat() if budget.created_at else None,
            "updated_at": budget.updated_at.isoformat() if budget.updated_at else None,
        }

        items_dict = []
        for item in items:
            item_data = {
                "id": item.id,
                "cod_par": item.cod_par,
                "cov_par": item.cov_par,
                "description": item.description,
                "unit": item.unit,
                "quantity": item.quantity,
                "performance": item.performance,
                "order": item.order,
                "is_chapter": item.is_chapter,
                "materials": [
                    {
                        "codigo": mat.codigo,
                        "descripcion": mat.descripcion,
                        "unidad": mat.unidad,
                        "precio_unitario": mat.precio_unitario,
                        "cantidad": mat.cantidad,
                        "desperdicio": mat.desperdicio,
                    }
                    for mat in item.materials
                ],
                "equipments": [
                    {
                        "codigo": eq.codigo,
                        "descripcion": eq.descripcion,
                        "unidad": eq.unidad,
                        "precio_unitario": eq.precio_unitario,
                        "cantidad": eq.cantidad,
                        "depreciacion": eq.depreciacion,
                    }
                    for eq in item.equipments
                ],
                "labors": [
                    {
                        "codigo": lab.codigo,
                        "descripcion": lab.descripcion,
                        "cantidad": lab.cantidad,
                        "jornal": lab.jornal,
                        "bono": lab.bono,
                    }
                    for lab in item.labors
                ],
            }
            items_dict.append(item_data)

        # Crear paquete de backup
        backup_package = encryption_service.create_backup_package(
            budget_dict, items_dict, current_user.email, str(current_user.id)
        )

        # Encriptar backup
        encrypted_backup = encryption_service.encrypt_backup(backup_package, current_user.email)

        # Registrar éxito en auditoría
        log_backup_action(
            db,
            str(current_user.id),
            current_user.email,
            budget_id,
            budget.name,
            "export",
            "success",
            None,
            client_ip,
        )

        return {
            "status": "success",
            "message": f"Backup generado exitosamente para {budget.name}",
            "budget_name": budget.name,
            "backup_data": encrypted_backup.hex(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exportando backup: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error al exportar backup: {str(e)}")


@router.post("/import-backup")
async def import_budget_backup(
    request: Request,
    backup_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Importa un backup encriptado de presupuesto (.cb)."""
    client_ip = request.client.host if request and request.client else None
    budget_name_for_log = "unknown"
    try:
        # Validar que sea un archivo .cb
        if not backup_file.filename or not backup_file.filename.endswith(".cb"):
            raise HTTPException(status_code=400, detail="Solo se permiten archivos .cb")

        # Leer el archivo encriptado
        encrypted_data = await backup_file.read()

        # Desencriptar el backup
        try:
            backup_data = encryption_service.decrypt_backup(encrypted_data, current_user.email)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Error desencriptando backup: {str(e)}")

        # Validar que el backup pertenezca al usuario
        if not encryption_service.validate_ownership(backup_data, current_user.email):
            raise HTTPException(status_code=403, detail="Este backup no pertenece a tu cuenta")

        # Validar versión del backup
        backup_version = backup_data.get("version")
        if backup_version != "1.0":
            raise HTTPException(status_code=400, detail="Versión de backup no compatible")

        # Extraer datos del presupuesto
        budget_data = backup_data.get("budget")
        items_data = backup_data.get("items", [])
        budget_name_for_log = budget_data.get("name", "unknown") if budget_data else "unknown"

        if not budget_data:
            raise HTTPException(status_code=400, detail="Backup corrupto: no contiene datos de presupuesto")

        # Crear nuevo presupuesto (no mantener el ID original)
        new_budget = Budget(
            user_id=str(current_user.id),
            name=budget_data.get("name", "Importado desde backup"),
            description=budget_data.get("description"),
            client_name=budget_data.get("client_name"),
            currency=budget_data.get("currency", "USD"),
            exchange_rate=budget_data.get("exchange_rate", 1.0),
            fcas_percent=budget_data.get("fcas_percent", 417.0),
            admin_percent=budget_data.get("admin_percent", 15.0),
            profit_percent=budget_data.get("profit_percent", 10.0),
            iva_percent=budget_data.get("iva_percent", 16.0),
            labor_bonus=budget_data.get("labor_bonus", 0.0),
            material_inflation=budget_data.get("material_inflation", 0.0),
            labor_inflation=budget_data.get("labor_inflation", 0.0),
            equipment_inflation=budget_data.get("equipment_inflation", 0.0),
            company_name=budget_data.get("company_name"),
            company_rif=budget_data.get("company_rif"),
            project_name=budget_data.get("project_name"),
        )

        db.add(new_budget)
        db.commit()
        db.refresh(new_budget)

        # Importar items
        max_order = 0
        for item_data in items_data:
            target_order = item_data.get("order", 0)
            if target_order <= 0:
                max_order += 1
                target_order = max_order
            else:
                max_order = max(max_order, target_order)

            # Crear el item
            new_item = BudgetItem(
                budget_id=new_budget.id,
                cod_par=item_data.get("cod_par", ""),
                cov_par=item_data.get("cov_par"),
                description=item_data.get("description", ""),
                unit=item_data.get("unit", ""),
                quantity=item_data.get("quantity", 0.0),
                performance=item_data.get("performance", 1.0),
                order=target_order,
                is_chapter=item_data.get("is_chapter", False),
            )

            db.add(new_item)
            db.commit()
            db.refresh(new_item)

            # Si no es capítulo, importar materiales, equipos y mano de obra
            if not item_data.get("is_chapter", False):
                for mat_data in item_data.get("materials", []):
                    db_mat = DBMaterial(
                        budget_item_id=new_item.id,
                        codigo=mat_data.get("codigo", ""),
                        descripcion=mat_data.get("descripcion", ""),
                        unidad=mat_data.get("unidad", ""),
                        precio_unitario=mat_data.get("precio_unitario", 0.0),
                        cantidad=mat_data.get("cantidad", 0.0),
                        desperdicio=mat_data.get("desperdicio", 0.0),
                    )
                    db.add(db_mat)

                for eq_data in item_data.get("equipments", []):
                    db_eq = DBEquipment(
                        budget_item_id=new_item.id,
                        codigo=eq_data.get("codigo", ""),
                        descripcion=eq_data.get("descripcion", ""),
                        unidad=eq_data.get("unidad", ""),
                        precio_unitario=eq_data.get("precio_unitario", 0.0),
                        cantidad=eq_data.get("cantidad", 0.0),
                        depreciacion=eq_data.get("depreciacion", 1.0),
                    )
                    db.add(db_eq)

                for lab_data in item_data.get("labors", []):
                    db_lab = DBLabor(
                        budget_item_id=new_item.id,
                        codigo=lab_data.get("codigo", ""),
                        descripcion=lab_data.get("descripcion", ""),
                        cantidad=lab_data.get("cantidad", 0.0),
                        jornal=lab_data.get("jornal", 0.0),
                        bono=lab_data.get("bono", 0.0),
                    )
                    db.add(db_lab)

        db.commit()
        db.refresh(new_budget)

        # Registrar éxito en auditoría
        log_backup_action(
            db,
            str(current_user.id),
            current_user.email,
            new_budget.id,
            new_budget.name,
            "import",
            "success",
            None,
            client_ip,
        )

        return {
            "status": "success",
            "message": "Backup importado exitosamente",
            "budget_id": new_budget.id,
            "budget_name": new_budget.name,
        }

    except HTTPException as e:
        log_backup_action(
            db,
            str(current_user.id),
            current_user.email,
            "unknown",
            budget_name_for_log,
            "import",
            "failed",
            str(e.detail),
            client_ip,
        )
        raise
    except Exception as e:
        logger.error(f"Error importando backup: {str(e)}", exc_info=True)
        log_backup_action(
            db,
            str(current_user.id),
            current_user.email,
            "unknown",
            budget_name_for_log,
            "import",
            "failed",
            str(e),
            client_ip,
        )
        raise HTTPException(status_code=500, detail=f"Error al importar backup: {str(e)}")
