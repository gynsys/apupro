"""Motor de control de obra: presupuesto, avance, modificaciones y adendum.

Todas las operaciones monetarias y de cantidades se redondean a dos decimales
con ROUND_HALF_UP. El módulo es independiente de FastAPI y de la base de datos
para poder probarse y simularse de forma determinista.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, Iterable, List, Optional
import uuid


TWO_PLACES = Decimal("0.01")


class ControlObraError(ValueError):
    """Error de negocio del control de obra."""


def dec(value: Any) -> Decimal:
    if value is None or value == "":
        return Decimal("0")
    return Decimal(str(value))


def q2(value: Any) -> Decimal:
    return dec(value).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def money(value: Any) -> str:
    return f"{q2(value):,.2f}"


def pct(value: Any) -> str:
    return f"{q2(value):,.2f}%"


@dataclass
class BudgetItem:
    id: str
    code: str
    description: str
    unit: str
    original_quantity: Decimal
    unit_price: Decimal
    is_chapter: bool = False
    performance: Decimal = Decimal("1")
    materials: List[Dict[str, Any]] = field(default_factory=list)
    equipments: List[Dict[str, Any]] = field(default_factory=list)
    labors: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def original_amount(self) -> Decimal:
        return q2(self.original_quantity * self.unit_price)


@dataclass
class ModificationLine:
    item_id: str
    quantity_delta: Decimal = Decimal("0")
    unit_price: Optional[Decimal] = None
    description: str = ""
    unit: str = ""
    code: str = ""
    is_new_item: bool = False


@dataclass
class Modification:
    id: str
    kind: str  # increase | decrease | extra_work
    code: str
    description: str
    lines: List[ModificationLine]
    status: str = "draft"  # draft | review | approved | rejected
    requested_at: str = ""
    approved_at: str = ""

    @property
    def is_approved(self) -> bool:
        return self.status == "approved"

    @property
    def amount(self) -> Decimal:
        total = Decimal("0")
        for line in self.lines:
            price = line.unit_price or Decimal("0")
            total += line.quantity_delta * price
        return q2(abs(total) if self.kind == "decrease" else total)


@dataclass
class Addendum:
    id: str
    code: str
    description: str
    amount: Decimal
    status: str = "draft"  # draft | review | approved | rejected
    approved_at: str = ""

    @property
    def is_approved(self) -> bool:
        return self.status == "approved"


@dataclass
class ProgressEntry:
    id: str
    item_id: str
    quantity: Decimal
    entry_date: str
    notes: str = ""
    entry_type: str = "execution"  # execution | adjustment | reversal


@dataclass
class BudgetSettings:
    fcas_percent: Decimal = Decimal("417")
    admin_percent: Decimal = Decimal("15")
    profit_percent: Decimal = Decimal("10")
    iva_percent: Decimal = Decimal("16")
    labor_bonus: Decimal = Decimal("0")
    bono_in_fcas: bool = False
    material_inflation: Decimal = Decimal("0")
    labor_inflation: Decimal = Decimal("0")
    equipment_inflation: Decimal = Decimal("0")


def _component_quantity(row: Dict[str, Any]) -> Decimal:
    return dec(row.get("cantidad", row.get("quantity", 0)))


def _component_price(row: Dict[str, Any]) -> Decimal:
    return dec(row.get("precio_unitario", row.get("price", 0)))


def calculate_item_breakdown(item: Dict[str, Any], settings: BudgetSettings) -> Dict[str, Decimal]:
    """Calcula el desglose de un APU, equivalente a apuCalculations.js.

    Se usa para reconstruir el precio unitario desde el presupuesto exportado.
    """
    if item.get("is_chapter"):
        return {
            "matCost": Decimal("0"),
            "eqCost": Decimal("0"),
            "labCost": Decimal("0"),
            "subtotalA": Decimal("0"),
            "adminCost": Decimal("0"),
            "profitCost": Decimal("0"),
            "unitPrice": Decimal("0"),
        }

    perf = dec(item.get("performance") or 1) or Decimal("1")

    mat = Decimal("0")
    for row in item.get("materials") or []:
        q = _component_quantity(row)
        waste = dec(row.get("desperdicio", row.get("waste", 0)))
        price = _component_price(row)
        base = q * (Decimal("1") + waste / Decimal("100")) * price
        mat += base * (Decimal("1") + settings.material_inflation / Decimal("100"))
    mat = q2(mat)

    eq_day = Decimal("0")
    for row in item.get("equipments") or []:
        q = _component_quantity(row)
        dep = dec(row.get("depreciacion", row.get("depreciation", 1)))
        price = _component_price(row)
        eq_day += q * dep * price * (Decimal("1") + settings.equipment_inflation / Decimal("100"))
    eq = q2(eq_day / perf)

    jornal = Decimal("0")
    bono = Decimal("0")
    for row in item.get("labors") or []:
        q = _component_quantity(row)
        j = dec(row.get("jornal", 0))
        b = dec(row.get("bono", settings.labor_bonus))
        jornal += q * j * (Decimal("1") + settings.labor_inflation / Decimal("100"))
        bono += q * b * (Decimal("1") + settings.labor_inflation / Decimal("100"))

    fcas = q2(jornal * settings.fcas_percent / Decimal("100"))
    if settings.bono_in_fcas:
        bono = Decimal("0")
    lab = q2((jornal + bono + fcas) / perf)

    direct = q2(mat + eq + lab)
    admin = q2(direct * settings.admin_percent / Decimal("100"))
    subtotal_b = q2(direct + admin)
    profit = q2(subtotal_b * settings.profit_percent / Decimal("100"))
    unit_price = q2(subtotal_b + profit)

    return {
        "matCost": mat,
        "eqCost": eq,
        "labCost": lab,
        "subtotalA": direct,
        "adminCost": admin,
        "profitCost": profit,
        "unitPrice": unit_price,
    }


class ControlObra:
    """Estado de control de una obra.

    El presupuesto original es inmutable. Las modificaciones aprobadas cambian
    las cantidades vigentes. El adendum amplía el monto contractual disponible.
    """

    def __init__(self, budget_json: Dict[str, Any]):
        self.budget_id = str(budget_json.get("id") or "")
        self.name = str(budget_json.get("name") or "")
        self.currency = str(budget_json.get("currency") or "USD")
        self.settings = BudgetSettings(
            fcas_percent=dec(budget_json.get("fcas_percent", 417)),
            admin_percent=dec(budget_json.get("admin_percent", 15)),
            profit_percent=dec(budget_json.get("profit_percent", 10)),
            iva_percent=dec(budget_json.get("iva_percent", 16)),
            labor_bonus=dec(budget_json.get("labor_bonus", 0)),
            bono_in_fcas=bool(budget_json.get("bono_in_fcas", False)),
            material_inflation=dec(budget_json.get("material_inflation", 0)),
            labor_inflation=dec(budget_json.get("labor_inflation", 0)),
            equipment_inflation=dec(budget_json.get("equipment_inflation", 0)),
        )
        self.items: Dict[str, BudgetItem] = {}
        for raw in budget_json.get("items") or []:
            if raw.get("is_chapter"):
                continue
            breakdown = calculate_item_breakdown(raw, self.settings)
            item_id = str(raw.get("id"))
            self.items[item_id] = BudgetItem(
                id=item_id,
                code=str(raw.get("cod_par") or raw.get("cov_par") or ""),
                description=str(raw.get("description") or ""),
                unit=str(raw.get("unit") or ""),
                original_quantity=dec(raw.get("quantity", 0)),
                unit_price=breakdown["unitPrice"],
                performance=dec(raw.get("performance") or 1),
                materials=list(raw.get("materials") or []),
                equipments=list(raw.get("equipments") or []),
                labors=list(raw.get("labors") or []),
            )
        self.modifications: List[Modification] = []
        self.addenda: List[Addendum] = []
        self.progress: List[ProgressEntry] = []

    # ------------------------------------------------------------------
    # Presupuesto
    # ------------------------------------------------------------------
    @property
    def original_amount(self) -> Decimal:
        return q2(sum((item.original_amount for item in self.items.values()), Decimal("0")))

    @property
    def approved_addendum_amount(self) -> Decimal:
        return q2(sum((a.amount for a in self.addenda if a.is_approved), Decimal("0")))

    @property
    def contract_amount(self) -> Decimal:
        return q2(self.original_amount + self.approved_addendum_amount)

    @property
    def approved_modifications(self) -> List[Modification]:
        return [m for m in self.modifications if m.is_approved]

    def _line_price(self, line: ModificationLine) -> Decimal:
        if line.unit_price is not None:
            return line.unit_price
        item = self.items.get(line.item_id)
        if item is None:
            raise ControlObraError(f"No existe la partida {line.item_id}")
        return item.unit_price

    def current_quantities(self) -> Dict[str, Decimal]:
        quantities = {item_id: item.original_quantity for item_id, item in self.items.items()}
        for modification in self.approved_modifications:
            for line in modification.lines:
                if line.is_new_item:
                    continue
                if line.item_id not in quantities:
                    raise ControlObraError(f"No existe la partida {line.item_id}")
                delta = line.quantity_delta
                if modification.kind == "decrease":
                    delta = -abs(delta)
                quantities[line.item_id] = q2(quantities[line.item_id] + delta)
        return quantities

    @property
    def modified_amount(self) -> Decimal:
        quantities = self.current_quantities()
        total = Decimal("0")
        for item_id, quantity in quantities.items():
            item = self.items[item_id]
            total += q2(quantity * item.unit_price)
        for modification in self.approved_modifications:
            for line in modification.lines:
                if line.is_new_item:
                    total += q2(line.quantity_delta * self._line_price(line))
        return q2(total)

    @property
    def available_amount(self) -> Decimal:
        return q2(self.contract_amount - self.modified_amount)

    # ------------------------------------------------------------------
    # Modificaciones
    # ------------------------------------------------------------------
    def add_modification(
        self,
        kind: str,
        lines: Iterable[Dict[str, Any]],
        code: str = "",
        description: str = "",
        requested_at: str = "",
    ) -> Modification:
        if kind not in {"increase", "decrease", "extra_work"}:
            raise ControlObraError("Tipo de modificación inválido")
        parsed: List[ModificationLine] = []
        for raw in lines:
            item_id = str(raw.get("item_id") or "")
            raw_price = raw.get("unit_price")
            if raw_price is None and item_id in self.items:
                raw_price = self.items[item_id].unit_price
            parsed.append(ModificationLine(
                item_id=item_id,
                quantity_delta=dec(raw.get("quantity_delta", raw.get("quantity", 0))),
                unit_price=dec(raw_price) if raw_price is not None else None,
                description=str(raw.get("description") or ""),
                unit=str(raw.get("unit") or ""),
                code=str(raw.get("code") or ""),
                is_new_item=bool(raw.get("is_new_item", kind == "extra_work")),
            ))
        modification = Modification(
            id=str(uuid.uuid4()),
            kind=kind,
            code=code or f"MOD-{len(self.modifications) + 1:03d}",
            description=description,
            lines=parsed,
            requested_at=requested_at,
        )
        self.modifications.append(modification)
        return modification

    def approve_modification(self, modification_id: str) -> Modification:
        modification = next((m for m in self.modifications if m.id == modification_id), None)
        if not modification:
            raise ControlObraError("Modificación no encontrada")
        if modification.status == "approved":
            return modification

        previous_status = modification.status
        modification.status = "approved"
        try:
            # El presupuesto modificado no puede superar el monto contractual
            # disponible (original + adendum aprobado).
            if self.modified_amount > self.contract_amount:
                raise ControlObraError(
                    "El presupuesto modificado supera el monto original. "
                    "Debe tramitarse un adendum antes de aprobar esta modificación."
                )
        except Exception:
            modification.status = previous_status
            raise
        return modification

    def reject_modification(self, modification_id: str) -> Modification:
        modification = next((m for m in self.modifications if m.id == modification_id), None)
        if not modification:
            raise ControlObraError("Modificación no encontrada")
        modification.status = "rejected"
        return modification

    # ------------------------------------------------------------------
    # Adendum
    # ------------------------------------------------------------------
    def add_addendum(self, amount: Any, code: str = "", description: str = "") -> Addendum:
        addendum = Addendum(
            id=str(uuid.uuid4()),
            code=code or f"AD-{len(self.addenda) + 1:02d}",
            description=description,
            amount=q2(amount),
        )
        self.addenda.append(addendum)
        return addendum

    def approve_addendum(self, addendum_id: str) -> Addendum:
        addendum = next((a for a in self.addenda if a.id == addendum_id), None)
        if not addendum:
            raise ControlObraError("Adendum no encontrado")
        addendum.status = "approved"
        return addendum

    # ------------------------------------------------------------------
    # Avance
    # ------------------------------------------------------------------
    def register_progress(
        self,
        item_id: str,
        quantity: Any,
        entry_date: str,
        notes: str = "",
        entry_type: str = "execution",
    ) -> ProgressEntry:
        if item_id not in self.items:
            raise ControlObraError(f"No existe la partida {item_id}")
        q = dec(quantity)
        if q < 0:
            raise ControlObraError("La cantidad ejecutada no puede ser negativa")
        entry = ProgressEntry(
            id=str(uuid.uuid4()),
            item_id=item_id,
            quantity=q,
            entry_date=entry_date,
            notes=notes,
            entry_type=entry_type,
        )
        self.progress.append(entry)
        return entry

    def executed_quantities(self) -> Dict[str, Decimal]:
        executed = {item_id: Decimal("0") for item_id in self.items}
        for entry in self.progress:
            if entry.item_id not in executed:
                continue
            sign = Decimal("-1") if entry.entry_type == "reversal" else Decimal("1")
            executed[entry.item_id] = q2(executed[entry.item_id] + entry.quantity * sign)
        return executed

    @property
    def executed_amount(self) -> Decimal:
        executed = self.executed_quantities()
        total = Decimal("0")
        for item_id, quantity in executed.items():
            total += quantity * self.items[item_id].unit_price
        return q2(total)

    @property
    def physical_percent(self) -> Decimal:
        """Avance físico ponderado por el monto vigente de cada partida.

        Se calcula explícitamente como Σ(peso_i × avance_i), no como una
        simple división de montos. El avance de cada partida se limita a 100%
        para el avance contractual; los excesos se reflejan en item_progress.
        """
        if self.modified_amount <= 0:
            return Decimal("0")
        quantities = self.current_quantities()
        executed = self.executed_quantities()
        weighted = Decimal("0")
        total_weight = Decimal("0")

        for item_id, item in self.items.items():
            current = quantities[item_id]
            if current <= 0:
                continue
            current_amount = q2(current * item.unit_price)
            weight = current_amount / self.modified_amount
            item_ratio = min(Decimal("1"), executed[item_id] / current)
            weighted += weight * item_ratio
            total_weight += weight

        # Las obras extras sin partida de ejecución forman parte del alcance,
        # pero todavía no tienen avance registrado; su peso queda en el
        # denominador mediante modified_amount.
        if total_weight <= 0:
            return Decimal("0")
        return q2(weighted * Decimal("100"))

    @property
    def financial_percent(self) -> Decimal:
        if self.contract_amount <= 0:
            return Decimal("0")
        return q2(self.executed_amount / self.contract_amount * Decimal("100"))

    def item_progress(self) -> List[Dict[str, Any]]:
        quantities = self.current_quantities()
        executed = self.executed_quantities()
        rows = []
        for item_id, item in self.items.items():
            current = quantities[item_id]
            done = executed[item_id]
            pct_item = q2(done / current * Decimal("100")) if current > 0 else Decimal("0")
            rows.append({
                "item_id": item_id,
                "code": item.code,
                "description": item.description,
                "unit": item.unit,
                "original_quantity": item.original_quantity,
                "current_quantity": current,
                "executed_quantity": done,
                "pending_quantity": q2(current - done),
                "physical_percent": pct_item,
                "unit_price": item.unit_price,
                "executed_amount": q2(done * item.unit_price),
                "current_amount": q2(current * item.unit_price),
            })
        return rows

    def summary(self) -> Dict[str, Any]:
        return {
            "budget_id": self.budget_id,
            "name": self.name,
            "currency": self.currency,
            "original_amount": self.original_amount,
            "addendum_amount": self.approved_addendum_amount,
            "contract_amount": self.contract_amount,
            "modified_amount": self.modified_amount,
            "available_amount": self.available_amount,
            "executed_amount": self.executed_amount,
            "physical_percent": self.physical_percent,
            "financial_percent": self.financial_percent,
            "items": self.item_progress(),
        }
