"""
Helper utilities and database checks for budget endpoints.
"""
import math
from typing import Any, Optional, Tuple
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.db.models.backup_logs import BackupLog
from app.db.models.budget import Budget

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

        mat_cost = 0.0
        for m in (item.materials or []):
            q = float(m.cantidad or 0.0)
            w = float(m.desperdicio or 0.0)
            p = float(m.precio_unitario or 0.0) * ex_rate
            base_cost = (q * (1.0 + w / 100.0)) * p
            mat_cost += base_cost * (1.0 + (mat_inf / 100.0))

        eq_total_day = 0.0
        for eq in (item.equipments or []):
            q = float(eq.cantidad or 0.0)
            d = float(eq.depreciacion if eq.depreciacion is not None else 1.0)
            p = float(eq.precio_unitario or 0.0) * ex_rate
            base_cost = q * d * p
            eq_total_day += base_cost * (1.0 + (eq_inf / 100.0))
        eq_cost = eq_total_day / perf

        tot_jornal = 0.0
        for lab in (item.labors or []):
            q = float(lab.cantidad or 0.0)
            j = float(lab.jornal or 0.0) * ex_rate
            base_cost = q * j
            tot_jornal += base_cost * (1.0 + (lab_inf / 100.0))

        tot_bono = 0.0
        if not bono_in_fcas:
            for lab in (item.labors or []):
                q = float(lab.cantidad or 0.0)
                raw_b = float(lab.bono or 0.0)
                b_bonus = raw_b if raw_b > 0 else default_labor_bonus
                b = b_bonus * ex_rate
                base_cost = q * b
                tot_bono += base_cost * (1.0 + (lab_inf / 100.0))

        fcas_monto = tot_jornal * (fcas_percent / 100.0)
        lab_cost = (tot_jornal + tot_bono + fcas_monto) / perf

        subtotal_a = mat_cost + eq_cost + lab_cost
        admin_cost = subtotal_a * (admin_percent / 100.0)
        subtotal_b = subtotal_a + admin_cost
        profit_cost = subtotal_b * (profit_percent / 100.0)
        subtotal_c = subtotal_b + profit_cost

        pu = _round_half_up_2(subtotal_c)
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
