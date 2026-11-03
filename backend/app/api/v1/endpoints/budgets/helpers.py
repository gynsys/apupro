"""
Helper utilities and database checks for budget endpoints.
"""
import json
import math
from pathlib import Path
from typing import Any, Optional, Tuple
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.db.models.backup_logs import BackupLog
from app.db.models.budget import (
    Budget,
    BudgetItem,
    BudgetAPUMaterial as DBMaterial,
    BudgetAPUEquipment as DBEquipment,
    BudgetAPULabor as DBLabor,
)

_BUDGET_INDEXES_ENSURED: bool = False


def _round_half_up_2(val: float) -> float:
    """Redondeo comercial a 2 decimales idéntico a Math.round((x + EPSILON) * 100) / 100 en JS."""
    scaled = abs(float(val or 0.0)) * 100.0
    rounded = math.floor(scaled + 0.5 + 1e-9) / 100.0
    return rounded if (val or 0.0) >= 0 else -rounded


def ensure_budget_share_columns(db: Session) -> None:
    """Asegura que existan las columnas e índices necesarios en las tablas de presupuestos."""
    try:
        db.execute(text("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS share_token VARCHAR(255);"))
        db.execute(text("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS is_public_share BOOLEAN DEFAULT FALSE;"))
        db.execute(text("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS notes TEXT;"))
        db.execute(text("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS bono_in_fcas BOOLEAN DEFAULT FALSE;"))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error asegurando columnas en budgets: {e}", exc_info=True)
    ensure_budget_performance_indexes(db)


def ensure_budget_performance_indexes(db: Session) -> None:
    """Crea índices sobre las claves foráneas de presupuestos si no existen para evitar Seq Scans."""
    global _BUDGET_INDEXES_ENSURED
    if _BUDGET_INDEXES_ENSURED:
        return
    try:
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_budget_items_budget_id ON budget_items(budget_id);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_budget_apu_materials_item_id ON budget_apu_materials(budget_item_id);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_budget_apu_equipments_item_id ON budget_apu_equipments(budget_item_id);"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_budget_apu_labors_item_id ON budget_apu_labors(budget_item_id);"))
        db.commit()
        _BUDGET_INDEXES_ENSURED = True
    except Exception as e:
        db.rollback()
        logger.error(f"Error asegurando índices de rendimiento en budgets: {e}", exc_info=True)


def compute_budget_summary_metrics(budget: Budget) -> Tuple[int, float]:
    """
    Calcula en memoria (items_count, total_amount) de un presupuesto con la misma
    fórmula exacta de calculateBudgetTotals en frontend/src/utils/apuCalculations.js.
    """
    if not budget:
        return 0, 0.0

    curr = str(budget.currency or "USD").strip()
    ex_rate = float(budget.exchange_rate or 1.0) if curr in ("BS", "Bs", "Bs.") else 1.0
    mat_inf = float(budget.material_inflation or 0.0)
    eq_inf = float(budget.equipment_inflation or 0.0)
    lab_inf = float(budget.labor_inflation or 0.0)
    default_labor_bonus = float(budget.labor_bonus or 0.0)

    fcas_percent = float(budget.fcas_percent if budget.fcas_percent is not None else 417.0)
    raw_bono_in_fcas: Any = budget.bono_in_fcas
    bono_in_fcas = (raw_bono_in_fcas is True) or (raw_bono_in_fcas is not False and fcas_percent >= 1000.0)

    admin_percent = float(budget.admin_percent if budget.admin_percent is not None else 15.0)
    profit_percent = float(budget.profit_percent if budget.profit_percent is not None else 10.0)
    iva_percent = float(budget.iva_percent if budget.iva_percent is not None else 16.0)

    items_count = 0
    subtotal_presupuesto = 0.0

    for item in (budget.items or []):
        if item.is_chapter:
            continue
        items_count += 1
        perf = float(item.performance or 1.0) or 1.0

        mat_cost = _round_half_up_2(sum(
            _round_half_up_2((float(m.cantidad or 0.0) * (1.0 + float(m.desperdicio or 0.0) / 100.0)) * (float(m.precio_unitario or 0.0) * ex_rate)) * (1.0 + (mat_inf / 100.0))
            for m in (item.materials or [])
        ))

        eq_total_day = _round_half_up_2(sum(
            _round_half_up_2(float(eq.cantidad or 0.0) * float(eq.depreciacion if eq.depreciacion is not None else 1.0) * (float(eq.precio_unitario or 0.0) * ex_rate)) * (1.0 + (eq_inf / 100.0))
            for eq in (item.equipments or [])
        ))
        eq_cost = _round_half_up_2(eq_total_day / perf)

        tot_jornal = _round_half_up_2(sum(
            _round_half_up_2(float(lab.cantidad or 0.0) * (float(lab.jornal or 0.0) * ex_rate)) * (1.0 + (lab_inf / 100.0))
            for lab in (item.labors or [])
        ))

        tot_bono = 0.0
        if not bono_in_fcas:
            tot_bono = _round_half_up_2(sum(
                _round_half_up_2(
                    float(lab.cantidad or 0.0) * (
                        (float(lab.bono) if (lab.bono is not None and not (isinstance(lab.bono, str) and str(lab.bono).strip() == "")) else default_labor_bonus) * ex_rate
                    )
                ) * (1.0 + (lab_inf / 100.0))
                for lab in (item.labors or [])
            ))

        fcas_monto = _round_half_up_2(tot_jornal * (fcas_percent / 100.0))
        lab_total_day = _round_half_up_2(tot_jornal + tot_bono + fcas_monto)
        lab_cost = _round_half_up_2(lab_total_day / perf)

        subtotal_a = _round_half_up_2(mat_cost + eq_cost + lab_cost)
        admin_cost = _round_half_up_2(subtotal_a * (admin_percent / 100.0))
        subtotal_b = _round_half_up_2(subtotal_a + admin_cost)
        profit_cost = _round_half_up_2(subtotal_b * (profit_percent / 100.0))
        subtotal_c = _round_half_up_2(subtotal_b + profit_cost)

        pu = subtotal_c
        qty = float(item.quantity or 0.0)
        item_total = _round_half_up_2(pu * qty)
        subtotal_presupuesto += item_total

    rounded_subtotal = _round_half_up_2(subtotal_presupuesto)
    iva_amount = _round_half_up_2(rounded_subtotal * (iva_percent / 100.0))
    total_general = _round_half_up_2(rounded_subtotal + iva_amount)
    return items_count, total_general


def log_backup_action(
    db: Session,
    user_id: str,
    user_email: str,
    budget_id: str,
    budget_name: str,
    action: str,
    status: str,
    error_message: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Registra acciones de backup para auditoria."""
    try:
        log_entry = BackupLog(
            user_id=user_id,
            user_email=user_email,
            budget_id=budget_id,
            budget_name=budget_name,
            action=action,
            status=status,
            error_message=error_message,
            ip_address=ip_address,
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error al registrar accion de backup en auditoria: {e}", exc_info=True)


def seed_example_budget_for_user(db: Session, target_user_id: Any) -> Optional[Budget]:
    """
    Crea o clona el 'Presupuesto de Ejemplo costbase.net' para un usuario si no posee ningún presupuesto.
    """
    target_user_id_str = str(target_user_id).strip()
    if not target_user_id_str:
        return None

    try:
        existing = db.query(Budget).filter(Budget.user_id == target_user_id_str).first()
        if existing:
            return existing

        template = db.query(Budget).filter(
            Budget.name == "Presupuesto de Ejemplo costbase.net"
        ).first()

        if template:
            new_budget = Budget(
                user_id=target_user_id_str,
                name=template.name,
                description=template.description,
                currency=template.currency,
                exchange_rate=template.exchange_rate,
                fcas_percent=template.fcas_percent,
                admin_percent=template.admin_percent,
                profit_percent=template.profit_percent,
                iva_percent=template.iva_percent,
                labor_bonus=template.labor_bonus,
                bono_in_fcas=template.bono_in_fcas,
                material_inflation=template.material_inflation,
                labor_inflation=template.labor_inflation,
                equipment_inflation=template.equipment_inflation,
                company_name=template.company_name,
                company_rif=template.company_rif,
                project_name=template.project_name,
                client_name=template.client_name,
                ubicacion=template.ubicacion,
                notes=template.notes
            )
            db.add(new_budget)
            db.flush()

            for item in template.items:
                new_item = BudgetItem(
                    budget_id=new_budget.id,
                    cod_par=item.cod_par,
                    cov_par=item.cov_par,
                    description=item.description,
                    unit=item.unit,
                    quantity=item.quantity,
                    performance=item.performance,
                    order=item.order,
                    is_chapter=item.is_chapter,
                    is_pending=item.is_pending
                )
                db.add(new_item)
                db.flush()

                for m in item.materials:
                    db.add(DBMaterial(
                        budget_item_id=new_item.id,
                        codigo=m.codigo,
                        descripcion=m.descripcion,
                        unidad=m.unidad,
                        precio_unitario=m.precio_unitario,
                        cantidad=m.cantidad,
                        desperdicio=m.desperdicio
                    ))
                for e in item.equipments:
                    db.add(DBEquipment(
                        budget_item_id=new_item.id,
                        codigo=e.codigo,
                        descripcion=e.descripcion,
                        cantidad=e.cantidad,
                        unidad=e.unidad,
                        precio_unitario=e.precio_unitario,
                        depreciacion=e.depreciacion
                    ))
                for l in item.labors:
                    db.add(DBLabor(
                        budget_item_id=new_item.id,
                        codigo=l.codigo,
                        descripcion=l.descripcion,
                        cantidad=l.cantidad,
                        jornal=l.jornal,
                        bono=l.bono
                    ))

            db.commit()
            db.refresh(new_budget)
            logger.info("Presupuesto de ejemplo clonado exitosamente para el usuario %s", target_user_id_str)
            return new_budget

        # Fallback: cargar desde fixture JSON
        fixture_path = Path(__file__).resolve().parent.parent.parent.parent / "modules" / "control_obra" / "fixtures" / "example_budget.json"
        if fixture_path.exists():
            with open(fixture_path, encoding="utf-8") as f:
                data = json.load(f)

            new_budget = Budget(
                user_id=target_user_id_str,
                name=data.get("name", "Presupuesto de Ejemplo costbase.net"),
                description=data.get("description"),
                currency=data.get("currency", "USD"),
                exchange_rate=data.get("exchange_rate", 1.0),
                fcas_percent=data.get("fcas_percent", 417.0),
                admin_percent=data.get("admin_percent", 15.0),
                profit_percent=data.get("profit_percent", 10.0),
                iva_percent=data.get("iva_percent", 16.0),
                labor_bonus=data.get("labor_bonus", 0.0),
                bono_in_fcas=data.get("bono_in_fcas", False),
                material_inflation=data.get("material_inflation", 0.0),
                labor_inflation=data.get("labor_inflation", 0.0),
                equipment_inflation=data.get("equipment_inflation", 0.0),
                company_name=data.get("company_name", ""),
                company_rif=data.get("company_rif", ""),
                project_name=data.get("project_name", ""),
                client_name=data.get("client_name", ""),
                ubicacion=data.get("ubicacion", ""),
                notes=data.get("notes")
            )
            db.add(new_budget)
            db.flush()

            for item_data in data.get("items", []):
                new_item = BudgetItem(
                    budget_id=new_budget.id,
                    cod_par=item_data.get("cod_par", ""),
                    cov_par=item_data.get("cov_par", ""),
                    description=item_data.get("description", ""),
                    unit=item_data.get("unit", ""),
                    quantity=item_data.get("quantity", 0.0),
                    performance=item_data.get("performance", 1.0),
                    order=item_data.get("order", 1),
                    is_chapter=item_data.get("is_chapter", False),
                    is_pending=item_data.get("is_pending", False)
                )
                db.add(new_item)
                db.flush()

                for m in item_data.get("materials", []):
                    db.add(DBMaterial(
                        budget_item_id=new_item.id,
                        codigo=m.get("codigo", ""),
                        descripcion=m.get("descripcion", ""),
                        unidad=m.get("unidad", ""),
                        precio_unitario=m.get("precio_unitario", 0.0),
                        cantidad=m.get("cantidad", 0.0),
                        desperdicio=m.get("desperdicio", 0.0)
                    ))
                for e in item_data.get("equipments", []):
                    db.add(DBEquipment(
                        budget_item_id=new_item.id,
                        codigo=e.get("codigo", ""),
                        descripcion=e.get("descripcion", ""),
                        cantidad=e.get("cantidad", 0.0),
                        unidad=e.get("unidad", ""),
                        precio_unitario=e.get("precio_unitario", 0.0),
                        depreciacion=e.get("depreciacion", 1.0)
                    ))
                for l in item_data.get("labors", []):
                    db.add(DBLabor(
                        budget_item_id=new_item.id,
                        codigo=l.get("codigo", ""),
                        descripcion=l.get("descripcion", ""),
                        cantidad=l.get("cantidad", 0.0),
                        jornal=l.get("jornal", 0.0),
                        bono=l.get("bono", 0.0)
                    ))

            db.commit()
            db.refresh(new_budget)
            logger.info("Presupuesto de ejemplo creado desde fixture para el usuario %s", target_user_id_str)
            return new_budget
    except Exception as e:
        db.rollback()
        logger.error(f"Error sembrando presupuesto de ejemplo para {target_user_id}: {e}", exc_info=True)
        return None

    return None
