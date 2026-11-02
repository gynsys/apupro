"""Servicio de integración entre la base de datos y el dominio de control de obra."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session, selectinload

from app.db.models.budget import Budget, BudgetItem
from app.modules.control_obra.domain import (
    Addendum,
    ControlObra,
    ControlObraError,
    Modification,
    ModificationLine,
    q2,
)
from app.modules.control_obra.models import (
    ControlObraAddendum,
    ControlObraAudit,
    ControlObraModification,
    ControlObraModificationItem,
    ControlObraPeriod,
    ControlObraPlan,
    ControlObraProgressEntry,
)


def _budget_to_json(budget: Budget) -> Dict[str, Any]:
    items = []
    for item in budget.items:
        items.append({
            "id": item.id,
            "cod_par": item.cod_par,
            "cov_par": item.cov_par,
            "description": item.description,
            "unit": item.unit,
            "quantity": item.quantity,
            "performance": item.performance,
            "is_chapter": item.is_chapter,
            "materials": [
                {
                    "cantidad": m.cantidad,
                    "precio_unitario": m.precio_unitario,
                    "desperdicio": m.desperdicio,
                }
                for m in item.materials
            ],
            "equipments": [
                {
                    "cantidad": e.cantidad,
                    "precio_unitario": e.precio_unitario,
                    "depreciacion": e.depreciacion,
                }
                for e in item.equipments
            ],
            "labors": [
                {
                    "cantidad": l.cantidad,
                    "jornal": l.jornal,
                    "bono": l.bono,
                }
                for l in item.labors
            ],
        })
    return {
        "id": budget.id,
        "name": budget.name,
        "currency": budget.currency,
        "exchange_rate": budget.exchange_rate,
        "fcas_percent": budget.fcas_percent,
        "admin_percent": budget.admin_percent,
        "profit_percent": budget.profit_percent,
        "iva_percent": budget.iva_percent,
        "labor_bonus": budget.labor_bonus,
        "bono_in_fcas": budget.bono_in_fcas,
        "material_inflation": budget.material_inflation,
        "labor_inflation": budget.labor_inflation,
        "equipment_inflation": budget.equipment_inflation,
        "items": items,
    }


def load_budget(db: Session, budget_id: str, user_id: str) -> Budget:
    return (
        db.query(Budget)
        .options(
            selectinload(Budget.items).selectinload(BudgetItem.materials),
            selectinload(Budget.items).selectinload(BudgetItem.equipments),
            selectinload(Budget.items).selectinload(BudgetItem.labors),
        )
        .filter(Budget.id == budget_id, Budget.user_id == str(user_id))
        .first()
    )


def load_domain(db: Session, budget: Budget) -> ControlObra:
    domain = ControlObra(_budget_to_json(budget))

    modifications = (
        db.query(ControlObraModification)
        .options(selectinload(ControlObraModification.lines))
        .filter(ControlObraModification.budget_id == budget.id)
        .order_by(ControlObraModification.created_at.asc())
        .all()
    )
    for row in modifications:
        domain.modifications.append(Modification(
            id=row.id,
            kind=row.kind,
            code=row.code,
            description=row.description or "",
            status=row.status,
            requested_at=row.requested_at.isoformat() if row.requested_at else "",
            approved_at=row.approved_at.isoformat() if row.approved_at else "",
            lines=[
                ModificationLine(
                    item_id=line.budget_item_id or "",
                    quantity_delta=Decimal(str(line.quantity_delta or 0)),
                    unit_price=Decimal(str(line.unit_price or 0)),
                    description=line.description or "",
                    unit=line.unit or "",
                    code=line.code or "",
                    is_new_item=bool(line.is_new_item),
                )
                for line in row.lines
            ],
        ))

    addenda = (
        db.query(ControlObraAddendum)
        .filter(ControlObraAddendum.budget_id == budget.id)
        .order_by(ControlObraAddendum.created_at.asc())
        .all()
    )
    for row in addenda:
        domain.addenda.append(Addendum(
            id=row.id,
            code=row.code,
            description=row.description or "",
            amount=Decimal(str(row.amount or 0)),
            status=row.status,
            approved_at=row.approved_at.isoformat() if row.approved_at else "",
        ))

    entries = (
        db.query(ControlObraProgressEntry)
        .filter(ControlObraProgressEntry.budget_id == budget.id)
        .order_by(ControlObraProgressEntry.entry_date.asc())
        .all()
    )
    for row in entries:
        domain.register_progress(
            item_id=row.budget_item_id,
            quantity=Decimal(str(row.quantity or 0)),
            entry_date=row.entry_date.isoformat(),
            notes=row.notes or "",
            entry_type=row.entry_type,
        )

    return domain


def _number(value: Decimal) -> float:
    return float(round(value, 2))


def summary(db: Session, budget: Budget) -> Dict[str, Any]:
    domain = load_domain(db, budget)
    data = domain.summary()
    items = []
    for row in data["items"]:
        items.append({
            **row,
            "original_quantity": _number(row["original_quantity"]),
            "current_quantity": _number(row["current_quantity"]),
            "executed_quantity": _number(row["executed_quantity"]),
            "pending_quantity": _number(row["pending_quantity"]),
            "physical_percent": _number(row["physical_percent"]),
            "unit_price": _number(row["unit_price"]),
            "executed_amount": _number(row["executed_amount"]),
            "current_amount": _number(row["current_amount"]),
            "hours_per_unit": _number(row["hours_per_unit"]),
            "budget_hours": _number(row["budget_hours"]),
            "executed_hours": _number(row["executed_hours"]),
            "hours_weight": _number(row["hours_weight"]),
            "physical_percent_hh": _number(row["physical_percent_hh"]),
        })
    entries = (
        db.query(ControlObraProgressEntry)
        .filter(ControlObraProgressEntry.budget_id == budget.id)
        .order_by(ControlObraProgressEntry.entry_date.desc(), ControlObraProgressEntry.created_at.desc())
        .all()
    )
    item_by_id = {row["item_id"]: row for row in items}
    entry_rows = []
    for entry in entries:
        item = item_by_id.get(entry.budget_item_id, {})
        entry_rows.append({
            "id": entry.id,
            "item_id": entry.budget_item_id,
            "code": item.get("code", ""),
            "description": item.get("description", ""),
            "entry_date": entry.entry_date.isoformat(),
            "quantity": _number(entry.quantity),
            "notes": entry.notes or "",
            "entry_type": entry.entry_type,
        })
    return {
        "budget_id": budget.id,
        "budget_name": budget.name,
        "currency": budget.currency,
        "original_amount": _number(data["original_amount"]),
        "addendum_amount": _number(data["addendum_amount"]),
        "contract_amount": _number(data["contract_amount"]),
        "modified_amount": _number(data["modified_amount"]),
        "available_amount": _number(data["available_amount"]),
        "executed_amount": _number(data["executed_amount"]),
        "physical_percent": _number(data["physical_percent"]),
        "physical_percent_hh": _number(data["physical_percent_hh"]),
        "budget_hours": _number(data["budget_hours"]),
        "executed_hours": _number(data["executed_hours"]),
        "financial_percent": _number(data["financial_percent"]),
        "items": items,
        "entries": entry_rows,
        "modifications": [
            {
                "id": mod.id,
                "code": mod.code,
                "kind": mod.kind,
                "description": mod.description,
                "status": mod.status,
                "amount": _number(mod.amount),
            }
            for mod in domain.modifications
        ],
        "addenda": [
            {
                "id": add.id,
                "code": add.code,
                "description": add.description,
                "amount": _number(add.amount),
                "status": add.status,
            }
            for add in domain.addenda
        ],
    }


def create_modification(
    db: Session,
    budget: Budget,
    kind: str,
    lines: List[Dict[str, Any]],
    code: str = "",
    description: str = "",
    created_by: str = "",
) -> ControlObraModification:
    if kind not in {"increase", "decrease", "extra_work"}:
        raise ControlObraError("Tipo de modificación inválido")
    domain = load_domain(db, budget)
    row = ControlObraModification(
        budget_id=budget.id,
        kind=kind,
        code=code or f"MOD-{db.query(ControlObraModification).filter_by(budget_id=budget.id).count() + 1:03d}",
        description=description,
        status="draft",
        created_by=created_by,
    )
    db.add(row)
    db.flush()
    for raw in lines:
        item_id = raw.get("item_id") or raw.get("budget_item_id")
        unit_price = raw.get("unit_price")
        if unit_price in (None, "") and item_id in domain.items:
            unit_price = domain.items[item_id].unit_price
        db.add(ControlObraModificationItem(
            modification_id=row.id,
            budget_item_id=item_id,
            code=raw.get("code") or "",
            description=raw.get("description") or "",
            unit=raw.get("unit") or "",
            quantity_delta=float(raw.get("quantity_delta", raw.get("quantity", 0)) or 0),
            unit_price=float(unit_price or 0),
            is_new_item=bool(raw.get("is_new_item", kind == "extra_work")),
        ))
    db.commit()
    db.refresh(row)
    return row


def approve_modification(db: Session, budget: Budget, modification_id: str) -> ControlObraModification:
    row = (
        db.query(ControlObraModification)
        .filter_by(id=modification_id, budget_id=budget.id)
        .first()
    )
    if not row:
        raise ControlObraError("Modificación no encontrada")
    domain = load_domain(db, budget)
    domain.approve_modification(modification_id)
    row.status = "approved"
    row.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row


def create_addendum(
    db: Session,
    budget: Budget,
    amount: float,
    code: str = "",
    description: str = "",
    created_by: str = "",
) -> ControlObraAddendum:
    if amount < 0:
        raise ControlObraError("El monto del adendum no puede ser negativo")
    row = ControlObraAddendum(
        budget_id=budget.id,
        code=code or f"AD-{db.query(ControlObraAddendum).filter_by(budget_id=budget.id).count() + 1:02d}",
        description=description,
        amount=float(amount),
        status="draft",
        created_by=created_by,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def approve_addendum(db: Session, budget: Budget, addendum_id: str) -> ControlObraAddendum:
    row = (
        db.query(ControlObraAddendum)
        .filter_by(id=addendum_id, budget_id=budget.id)
        .first()
    )
    if not row:
        raise ControlObraError("Adendum no encontrado")
    row.status = "approved"
    row.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row


def _audit(db: Session, budget: Budget, entity_type: str, action: str, entity_id: str = "", reason: str = "", user_id: str = ""):
    db.add(ControlObraAudit(
        budget_id=budget.id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        reason=reason,
        user_id=user_id,
    ))


def list_periods(db: Session, budget: Budget) -> List[ControlObraPeriod]:
    return (
        db.query(ControlObraPeriod)
        .filter(ControlObraPeriod.budget_id == budget.id)
        .order_by(ControlObraPeriod.start_date.asc())
        .all()
    )


def create_period(db: Session, budget: Budget, name: str, start_date: date, end_date: date, user_id: str = "") -> ControlObraPeriod:
    if end_date < start_date:
        raise ControlObraError("La fecha final no puede ser anterior a la inicial")
    overlap = (
        db.query(ControlObraPeriod)
        .filter(
            ControlObraPeriod.budget_id == budget.id,
            ControlObraPeriod.start_date <= end_date,
            ControlObraPeriod.end_date >= start_date,
        )
        .first()
    )
    if overlap:
        raise ControlObraError("El período se solapa con uno existente")
    row = ControlObraPeriod(
        budget_id=budget.id,
        name=name,
        start_date=start_date,
        end_date=end_date,
        status="open",
    )
    db.add(row)
    db.flush()
    _audit(db, budget, "period", "created", row.id, user_id=user_id)
    db.commit()
    db.refresh(row)
    return row


def close_period(db: Session, budget: Budget, period_id: str, user_id: str = "") -> ControlObraPeriod:
    row = db.query(ControlObraPeriod).filter_by(id=period_id, budget_id=budget.id).first()
    if not row:
        raise ControlObraError("Período no encontrado")
    row.status = "closed"
    row.closed_at = datetime.utcnow()
    row.closed_by = user_id
    _audit(db, budget, "period", "closed", row.id, user_id=user_id)
    db.commit()
    db.refresh(row)
    return row


def reopen_period(db: Session, budget: Budget, period_id: str, reason: str, user_id: str = "") -> ControlObraPeriod:
    row = db.query(ControlObraPeriod).filter_by(id=period_id, budget_id=budget.id).first()
    if not row:
        raise ControlObraError("Período no encontrado")
    if not reason.strip():
        raise ControlObraError("Indica el motivo de la reapertura")
    row.status = "reopened"
    row.reopened_at = datetime.utcnow()
    row.reopened_by = user_id
    row.reopen_reason = reason
    _audit(db, budget, "period", "reopened", row.id, reason, user_id)
    db.commit()
    db.refresh(row)
    return row


def _closed_period_for_date(db: Session, budget: Budget, entry_date: date) -> Optional[ControlObraPeriod]:
    return (
        db.query(ControlObraPeriod)
        .filter(
            ControlObraPeriod.budget_id == budget.id,
            ControlObraPeriod.status == "closed",
            ControlObraPeriod.start_date <= entry_date,
            ControlObraPeriod.end_date >= entry_date,
        )
        .first()
    )


def set_plan(db: Session, budget: Budget, item_id: str, planned_start: date, planned_end: date) -> ControlObraPlan:
    if planned_end < planned_start:
        raise ControlObraError("La fecha final del plan no puede ser anterior a la inicial")
    if not db.query(BudgetItem).filter_by(id=item_id, budget_id=budget.id).first():
        raise ControlObraError("Partida no encontrada")
    row = (
        db.query(ControlObraPlan)
        .filter_by(budget_id=budget.id, budget_item_id=item_id)
        .first()
    )
    if row:
        row.planned_start = planned_start
        row.planned_end = planned_end
    else:
        row = ControlObraPlan(
            budget_id=budget.id,
            budget_item_id=item_id,
            planned_start=planned_start,
            planned_end=planned_end,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _month_starts(start: date, end: date) -> List[date]:
    points = []
    current = date(start.year, start.month, 1)
    while current <= end:
        points.append(current)
        current = date(current.year + (current.month // 12), (current.month % 12) + 1, 1)
    if points and points[-1] < end:
        points.append(end)
    return points


def curve(db: Session, budget: Budget) -> List[Dict[str, Any]]:
    domain = load_domain(db, budget)
    summary_data = summary(db, budget)
    plans = {
        p.budget_item_id: p
        for p in db.query(ControlObraPlan).filter(ControlObraPlan.budget_id == budget.id).all()
    }
    entries = (
        db.query(ControlObraProgressEntry)
        .filter(ControlObraProgressEntry.budget_id == budget.id)
        .order_by(ControlObraProgressEntry.entry_date.asc())
        .all()
    )
    if not plans and not entries:
        return []

    dates = [p.planned_start for p in plans.values()] + [p.planned_end for p in plans.values()]
    dates += [e.entry_date for e in entries]
    start, end = min(dates), max(dates)
    points = _month_starts(start, end)
    items = {row["item_id"]: row for row in summary_data["items"]}
    current_total = summary_data["modified_amount"] or 1

    result = []
    for point in points:
        planned_value = 0.0
        for item_id, plan in plans.items():
            item = items.get(item_id)
            if not item:
                continue
            total_days = max((plan.planned_end - plan.planned_start).days, 1)
            elapsed = max(0, min((point - plan.planned_start).days, total_days))
            fraction = elapsed / total_days
            planned_value += item["current_amount"] * fraction
        executed_value = 0.0
        for entry in entries:
            if entry.entry_date > point:
                continue
            item = items.get(entry.budget_item_id)
            if not item:
                continue
            sign = -1 if entry.entry_type == "reversal" else 1
            executed_value += sign * entry.quantity * item["unit_price"]
        result.append({
            "date": point.isoformat(),
            "planned_percent": round(min(100.0, planned_value / current_total * 100), 2),
            "actual_percent": round(executed_value / current_total * 100, 2),
        })
    return result


def build_report(db: Session, budget: Budget):
    """Genera un libro Excel de control de obra y devuelve los bytes."""
    from io import BytesIO
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill

    data = summary(db, budget)
    wb = Workbook()
    ws = wb.active
    ws.title = "Resumen"
    ws.append(["Control de Obra", budget.name])
    ws.append(["Monto original", data["original_amount"]])
    ws.append(["Adendum", data["addendum_amount"]])
    ws.append(["Monto contractual", data["contract_amount"]])
    ws.append(["Presupuesto modificado", data["modified_amount"]])
    ws.append(["Ejecutado", data["executed_amount"]])
    ws.append(["Avance físico", data["physical_percent"]])
    ws.append(["Avance financiero", data["financial_percent"]])

    items_ws = wb.create_sheet("Partidas")
    items_ws.append(["Código", "Descripción", "Unidad", "Original", "Modificada", "Ejecutada", "% Físico", "P.U.", "Ejecutado"])
    for row in data["items"]:
        items_ws.append([
            row["code"], row["description"], row["unit"], row["original_quantity"],
            row["current_quantity"], row["executed_quantity"], row["physical_percent"],
            row["unit_price"], row["executed_amount"],
        ])

    mods = wb.create_sheet("Modificaciones")
    mods.append(["Código", "Tipo", "Descripción", "Monto", "Estado"])
    for row in data["modifications"]:
        mods.append([row["code"], row["kind"], row["description"], row["amount"], row["status"]])

    addenda = wb.create_sheet("Adendum")
    addenda.append(["Código", "Descripción", "Monto", "Estado"])
    for row in data["addenda"]:
        addenda.append([row["code"], row["description"], row["amount"], row["status"]])

    for sheet in wb.worksheets:
        for cell in sheet[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="1E3A8A")

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def create_progress(
    db: Session,
    budget: Budget,
    item_id: str,
    quantity: float,
    entry_date: date,
    notes: str = "",
    entry_type: str = "execution",
    created_by: str = "",
) -> ControlObraProgressEntry:
    item = db.query(BudgetItem).filter_by(id=item_id, budget_id=budget.id).first()
    if not item:
        raise ControlObraError("Partida no encontrada en el presupuesto")
    if quantity < 0:
        raise ControlObraError("La cantidad ejecutada no puede ser negativa")
    closed = _closed_period_for_date(db, budget, entry_date)
    if closed:
        raise ControlObraError(f"El período '{closed.name}' está cerrado. Reábrelo para registrar avance.")
    row = ControlObraProgressEntry(
        budget_id=budget.id,
        budget_item_id=item_id,
        entry_date=entry_date,
        quantity=float(quantity),
        notes=notes,
        entry_type=entry_type,
        created_by=created_by,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_progress(
    db: Session,
    budget: Budget,
    entry_id: str,
    quantity: float,
    entry_date: date,
    notes: str = "",
    user_id: str = "",
) -> ControlObraProgressEntry:
    row = (
        db.query(ControlObraProgressEntry)
        .filter_by(id=entry_id, budget_id=budget.id)
        .first()
    )
    if not row:
        raise ControlObraError("Registro de avance no encontrado")
    if quantity < 0:
        raise ControlObraError("La cantidad ejecutada no puede ser negativa")
    closed = _closed_period_for_date(db, budget, entry_date)
    if closed:
        raise ControlObraError(f"El período '{closed.name}' está cerrado. Reábrelo para corregir el avance.")
    _audit(db, budget, "progress", "corrected", row.id, f"Cantidad: {row.quantity} -> {quantity}", user_id)
    row.quantity = float(quantity)
    row.entry_date = entry_date
    row.notes = notes
    db.commit()
    db.refresh(row)
    return row


def sync_progress(
    db: Session,
    budget: Budget,
    items: List[Dict[str, Any]],
    entry_date: date,
    notes: str = "Sincronizado desde cómputos",
    user_id: str = "",
) -> Dict[str, Any]:
    """Lleva cantidades objetivo desde una planilla de cómputos.

    No reemplaza el historial: crea un ajuste por la diferencia entre la
    cantidad ejecutada actual y la cantidad objetivo. Si la diferencia es
    negativa, crea un reverso.
    """
    if not items:
        raise ControlObraError("No hay cantidades de cómputos para llevar")
    closed = _closed_period_for_date(db, budget, entry_date)
    if closed:
        raise ControlObraError(f"El período '{closed.name}' está cerrado. Reábrelo para sincronizar cómputos.")

    entries = (
        db.query(ControlObraProgressEntry)
        .filter(ControlObraProgressEntry.budget_id == budget.id)
        .all()
    )
    current: Dict[str, float] = {}
    for entry in entries:
        sign = -1.0 if entry.entry_type == "reversal" else 1.0
        current[entry.budget_item_id] = current.get(entry.budget_item_id, 0.0) + sign * float(entry.quantity)

    changed = 0
    for item in items:
        item_id = item.get("item_id")
        quantity = Decimal(str(item.get("quantity", 0)))
        if quantity < 0:
            raise ControlObraError("La cantidad de cómputo no puede ser negativa")
        if not db.query(BudgetItem).filter_by(id=item_id, budget_id=budget.id).first():
            raise ControlObraError(f"Partida no encontrada: {item_id}")
        difference = q2(quantity - Decimal(str(current.get(item_id, 0.0))))
        if difference == 0:
            continue
        row = ControlObraProgressEntry(
            budget_id=budget.id,
            budget_item_id=item_id,
            entry_date=entry_date,
            quantity=float(abs(difference)),
            notes=notes,
            entry_type="execution" if difference > 0 else "reversal",
            created_by=user_id,
        )
        db.add(row)
        _audit(
            db, budget, "progress", "synced", item_id,
            f"Cantidad objetivo: {quantity}; ajuste: {difference}", user_id,
        )
        changed += 1
    if changed == 0:
        raise ControlObraError("Las cantidades de cómputos coinciden con el avance registrado")
    db.commit()
    return {"updated": changed, "entry_date": entry_date.isoformat()}
