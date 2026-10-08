"""
Helper utilities and database checks for budget endpoints.
"""
from typing import Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.db.models.backup_logs import BackupLog


def ensure_budget_share_columns(db: Session) -> None:
    """Asegura que existan las columnas necesarias en la tabla budgets."""
    try:
        db.execute(text("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS share_token VARCHAR(255);"))
        db.execute(text("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS is_public_share BOOLEAN DEFAULT FALSE;"))
        db.execute(text("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS notes TEXT;"))
        db.execute(text("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS bono_in_fcas BOOLEAN DEFAULT FALSE;"))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error asegurando columnas en budgets: {e}", exc_info=True)


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
