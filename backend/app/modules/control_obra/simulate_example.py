"""Simulación de control de obra con el presupuesto real de ejemplo.

Ejecutar desde la raíz del repositorio:

    python backend/app/modules/control_obra/simulate_example.py
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from domain import ControlObra, ControlObraError, dec, money, pct, q2


HERE = Path(__file__).resolve().parent
FIXTURE = HERE / "fixtures" / "example_budget.json"
OUTPUT = HERE / "simulation_result.json"


def item_by_code(obra: ControlObra, code: str):
    for item in obra.items.values():
        if item.code == code:
            return item
    raise KeyError(code)


def main():
    budget = json.loads(FIXTURE.read_text(encoding="utf-8"))
    obra = ControlObra(budget)
    lines = []

    def print_row(label, value):
        lines.append(f"{label:<44} {value}")
        print(lines[-1])

    print_row("Presupuesto", obra.name)
    print_row("Partidas", len(obra.items))
    print_row("Monto original", f"{obra.currency} {money(obra.original_amount)}")

    # 1. Avance inicial
    eop = item_by_code(obra, "EOP072")
    emt030 = item_by_code(obra, "EMT030")
    carga = item_by_code(obra, "8512C418")

    obra.register_progress(eop.id, q2(eop.original_quantity * dec("0.40")), "2026-11-02", "Frente 1")
    obra.register_progress(emt030.id, q2(emt030.original_quantity * dec("0.25")), "2026-11-03", "Frente 2")
    obra.register_progress(carga.id, dec("20"), "2026-11-04", "Carga inicial")

    print("\n--- AVANCE INICIAL ---")
    print_row("Ejecutado", f"{obra.currency} {money(obra.executed_amount)}")
    print_row("Avance físico", pct(obra.physical_percent))
    print_row("Avance financiero", pct(obra.financial_percent))

    # 2. Disminución y aumento dentro del monto original
    disminucion = obra.add_modification(
        "decrease",
        [{"item_id": carga.id, "quantity_delta": dec("70")}],
        code="DIS-001",
        description="Disminución de carga por ajuste de proyecto",
    )
    obra.approve_modification(disminucion.id)

    aumento = obra.add_modification(
        "increase",
        [{"item_id": eop.id, "quantity_delta": dec("0.10")}],
        code="AUM-001",
        description="Aumento de deforestación por área adicional",
    )
    obra.approve_modification(aumento.id)

    print("\n--- MODIFICACIÓN APROBADA ---")
    print_row("Disminución", f"{obra.currency} {money(disminucion.amount)}")
    print_row("Aumento", f"{obra.currency} {money(aumento.amount)}")
    print_row("Presupuesto modificado", f"{obra.currency} {money(obra.modified_amount)}")
    print_row("Disponible", f"{obra.currency} {money(obra.available_amount)}")
    assert obra.modified_amount <= obra.original_amount

    # 3. Obra extra que excede el disponible antes del adendum
    extra = obra.add_modification(
        "extra_work",
        [{
            "item_id": "EXTRA-001",
            "code": "EXTRA-001",
            "description": "Obra extra: alcantarilla adicional",
            "unit": "und",
            "quantity_delta": 1,
            "unit_price": 500,
            "is_new_item": True,
        }],
        code="OE-001",
        description="Obra extra fuera del contrato original",
    )

    print("\n--- OBRA EXTRA SIN ADENDUM ---")
    try:
        obra.approve_modification(extra.id)
        print_row("Resultado", "Aprobada (no debería ocurrir)")
    except ControlObraError as exc:
        print_row("Resultado", f"Rechazada: {exc}")

    # 4. Adendum y aprobación de la obra extra
    adendum = obra.add_addendum(
        dec("500"),
        code="AD-001",
        description="Recursos adicionales para alcantarilla",
    )
    obra.approve_addendum(adendum.id)
    obra.approve_modification(extra.id)

    print("\n--- ADENDUM APROBADO ---")
    print_row("Adendum", f"{obra.currency} {money(adendum.amount)}")
    print_row("Monto contractual", f"{obra.currency} {money(obra.contract_amount)}")
    print_row("Presupuesto modificado", f"{obra.currency} {money(obra.modified_amount)}")
    print_row("Avance físico", pct(obra.physical_percent))
    print_row("Avance financiero", pct(obra.financial_percent))

    result = {
        "budget_id": obra.budget_id,
        "budget_name": obra.name,
        "currency": obra.currency,
        "original_amount": str(obra.original_amount),
        "modifications": [
            {
                "code": modification.code,
                "type": modification.kind,
                "status": modification.status,
                "amount": str(modification.amount),
            }
            for modification in obra.modifications
        ],
        "addenda": [
            {
                "code": addendum.code,
                "status": addendum.status,
                "amount": str(addendum.amount),
            }
            for addendum in obra.addenda
        ],
        "summary": {
            "original_amount": str(obra.original_amount),
            "addendum_amount": str(obra.approved_addendum_amount),
            "contract_amount": str(obra.contract_amount),
            "modified_amount": str(obra.modified_amount),
            "available_amount": str(obra.available_amount),
            "executed_amount": str(obra.executed_amount),
            "physical_percent": str(obra.physical_percent),
            "financial_percent": str(obra.financial_percent),
        },
        "items": [
            {
                **row,
                "original_quantity": str(row["original_quantity"]),
                "current_quantity": str(row["current_quantity"]),
                "executed_quantity": str(row["executed_quantity"]),
                "pending_quantity": str(row["pending_quantity"]),
                "physical_percent": str(row["physical_percent"]),
                "unit_price": str(row["unit_price"]),
                "executed_amount": str(row["executed_amount"]),
                "current_amount": str(row["current_amount"]),
            }
            for row in obra.item_progress()
        ],
        "generated_at": date.today().isoformat(),
    }
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nResultado guardado en {OUTPUT}")


if __name__ == "__main__":
    main()
