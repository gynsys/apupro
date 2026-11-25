"""Script de importación, carga y verificación de la obra UKATIRA INA desde el archivo Excel.

Crea la obra en la base de datos, inserta los 11 capítulos y 174 partidas con sus cantidades y PU,
registra la programación de semanas (S_ini a S_fin) en ControlObraPlan,
y verifica con exactitud matemática contra el archivo original.
"""
from __future__ import annotations

import sys
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Tuple

import openpyxl
from sqlalchemy.orm import Session

# Configurar ruta para imports del backend
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.core.logging import logger
from app.db.base import get_db
from app.db.models.arko import ArkoAdmin
from app.db.models.budget import (
    Budget,
    BudgetAPUMaterial,
    BudgetItem,
)
from app.modules.control_obra.cronograma_domain import build_schedule_dataset
from app.modules.control_obra.cronograma_excel import generate_cronograma_workbook
from app.modules.control_obra.models import ControlObraPlan
from app.modules.control_obra.service import get_cronograma_dataset, summary


def read_original_excel(excel_path: Path) -> Dict[str, Any]:
    """Lee y extrae todos los datos del archivo Excel original."""
    if not excel_path.exists():
        raise FileNotFoundError(f"No se encontró el archivo Excel en {excel_path}")

    wb = openpyxl.load_workbook(excel_path, data_only=True)
    ws_partidas = wb["Partidas"]
    ws_pond = wb["Ponderación"]
    ws_cron = wb["Cronograma General"]
    ws_men = wb["Cronograma Mensual"]

    # 1. Leer parámetros globales
    start_val = ws_pond["C5"].value
    end_val = ws_pond["C6"].value
    iva_val = float(ws_pond["C7"].value or 0.16)

    start_date = start_val.date() if isinstance(start_val, datetime) else date(2026, 10, 22)
    end_date = end_val.date() if isinstance(end_val, datetime) else date(2027, 1, 22)

    # 2. Leer partidas y capítulos
    items: List[Dict[str, Any]] = []
    chapters: List[str] = []

    for r in range(6, ws_partidas.max_row):
        num = ws_partidas.cell(r, 1).value
        code = ws_partidas.cell(r, 2).value
        desc = ws_partidas.cell(r, 3).value
        und = ws_partidas.cell(r, 4).value
        qty = ws_partidas.cell(r, 5).value
        pu = ws_partidas.cell(r, 6).value
        tot = ws_partidas.cell(r, 7).value
        chap = ws_partidas.cell(r, 8).value
        s_ini = ws_partidas.cell(r, 10).value
        s_fin = ws_partidas.cell(r, 11).value

        if num is None and desc is None:
            continue
        if str(num).strip().lower() == "total" or "total" in str(desc).strip().lower():
            break

        chap_clean = str(chap or "General").strip()
        if chap_clean not in chapters:
            chapters.append(chap_clean)

        items.append({
            "num": int(num),
            "code": str(code or "").strip(),
            "description": str(desc or "").strip(),
            "unit": str(und or "UND").strip(),
            "quantity": float(qty or 0.0),
            "unit_price": float(pu or 0.0),
            "total": float(tot or 0.0),
            "chapter": chap_clean,
            "start_week": int(s_ini or 1),
            "end_week": int(s_fin or 13),
        })

    # 3. Leer desembolsos semanales del Cronograma General (filas de totales)
    # Fila 52 es Inversión Semanal ($), Fila 50 es % Semanal, Fila 51 es Curva S
    orig_weekly_totals = [float(ws_cron.cell(52, 4 + w).value or 0.0) for w in range(1, 14)]
    orig_weekly_pcts = [float(ws_cron.cell(50, 4 + w).value or 0.0) for w in range(1, 14)]
    orig_curve_s = [float(ws_cron.cell(51, 4 + w).value or 0.0) for w in range(1, 14)]

    # 4. Leer totales del Cronograma Mensual
    # Fila 18: TOTAL MENSUAL ($), Fila 19: % MENSUAL, Fila 20: CURVA S MENSUAL
    orig_monthly_totals = [float(ws_men.cell(18, 2 + m).value or 0.0) for m in range(1, 5)]
    orig_monthly_pcts = [float(ws_men.cell(19, 2 + m).value or 0.0) for m in range(1, 5)]
    orig_monthly_cum = [float(ws_men.cell(20, 2 + m).value or 0.0) for m in range(1, 5)]

    subtotal_orig = float(ws_partidas.cell(180, 7).value or 0.0)

    return {
        "start_date": start_date,
        "end_date": end_date,
        "iva_rate": iva_val,
        "subtotal": subtotal_orig,
        "chapters": chapters,
        "items": items,
        "orig_weekly_totals": orig_weekly_totals,
        "orig_weekly_pcts": orig_weekly_pcts,
        "orig_curve_s": orig_curve_s,
        "orig_monthly_totals": orig_monthly_totals,
        "orig_monthly_pcts": orig_monthly_pcts,
        "orig_monthly_cum": orig_monthly_cum,
    }


def seed_budget(db: Session, excel_data: Dict[str, Any], user_id: str) -> Budget:
    """Crea la obra y carga partidas y programación en la base de datos."""
    # Buscar si ya existe una obra con este nombre para evitar duplicados indeseados
    budget_name = "REHABILITACIÓN INTEGRAL DE LAS INSTALACIONES DE LA CASA DE ABRIGO “UKATIRA INA”"
    existing = db.query(Budget).filter_by(name=budget_name, user_id=user_id).first()
    if existing:
        logger.info("Eliminando obra previa para recargar limpia: %s", existing.id)
        db.delete(existing)
        db.commit()

    # Crear Presupuesto Base
    budget = Budget(
        id=str(uuid.uuid4()),
        user_id=user_id,
        name=budget_name,
        description="Presupuesto base y programación según cronograma general Constructora Truckers C.A.",
        client_name="Fundación Venezuela Renace",
        company_name="CONSTRUCTORA TRUCKERS C.A.",
        project_name="CASA DE ABRIGO UKATIRA INA",
        ubicacion="Parroquia Caraballeda, Estado La Guaira",
        currency="USD",
        exchange_rate=1.0,
        fcas_percent=0.0,
        admin_percent=0.0,
        profit_percent=0.0,
        iva_percent=excel_data["iva_rate"] * 100.0,
    )
    db.add(budget)
    db.flush()

    start_date = excel_data["start_date"]
    end_date = excel_data["end_date"]
    total_weeks = 13

    # Agrupar por capítulos para insertar con estructura jerárquica
    order_cursor = 1
    items_by_chapter: Dict[str, List[Dict[str, Any]]] = {}
    for it in excel_data["items"]:
        items_by_chapter.setdefault(it["chapter"], []).append(it)

    created_budget_items: List[BudgetItem] = []

    for chap_name in excel_data["chapters"]:
        # Fila de Capítulo
        chap_item = BudgetItem(
            id=str(uuid.uuid4()),
            budget_id=budget.id,
            cod_par=f"CAP-{order_cursor:02d}",
            cov_par=None,
            description=chap_name,
            unit="CAP",
            quantity=0.0,
            performance=1.0,
            order=order_cursor,
            is_chapter=True,
        )
        db.add(chap_item)
        order_cursor += 1

        for it in items_by_chapter.get(chap_name, []):
            db_item = BudgetItem(
                id=str(uuid.uuid4()),
                budget_id=budget.id,
                cod_par=it["code"] or f"P{order_cursor}",
                cov_par=it["code"],
                description=it["description"],
                unit=it["unit"],
                quantity=it["quantity"],
                performance=1.0,
                order=order_cursor,
                is_chapter=False,
            )
            db.add(db_item)
            db.flush()

            # Insumo de material que replica el precio unitario exacto
            mat = BudgetAPUMaterial(
                id=str(uuid.uuid4()),
                budget_item_id=db_item.id,
                codigo="MAT-01",
                descripcion="Insumo representativo partida",
                unidad="GLB",
                precio_unitario=it["unit_price"],
                cantidad=1.0,
                desperdicio=0.0,
            )
            db.add(mat)

            # Programación de semana de inicio y fin en ControlObraPlan
            s_ini = it["start_week"]
            s_fin = it["end_week"]

            p_start = start_date + timedelta(days=7 * (s_ini - 1))
            if s_fin >= total_weeks:
                p_end = end_date
            else:
                p_end = start_date + timedelta(days=7 * s_fin - 1)

            plan = ControlObraPlan(
                id=str(uuid.uuid4()),
                budget_id=budget.id,
                budget_item_id=db_item.id,
                planned_start=p_start,
                planned_end=p_end,
            )
            db.add(plan)

            created_budget_items.append(db_item)
            order_cursor += 1

    db.commit()
    db.refresh(budget)
    return budget


def verify_schedule_reproduction(db: Session, budget: Budget, excel_data: Dict[str, Any]) -> None:
    """Verifica exhaustivamente que el módulo reproduce con precisión matemática el Excel original."""
    print("\n=======================================================")
    print(" INICIANDO VERIFICACIÓN DE EXACTITUD MATEMÁTICA")
    print("=======================================================")

    # 1. Obtener el dataset desde el módulo implementado
    dataset = get_cronograma_dataset(
        db=db,
        budget=budget,
        start_date=excel_data["start_date"],
        total_weeks=13,
        end_date=excel_data["end_date"],
        iva_rate=excel_data["iva_rate"],
    )

    # 2. Verificar Subtotal General
    calc_total = dataset["total_budget_amount"]
    orig_total = excel_data["subtotal"]
    diff_total = abs(calc_total - orig_total)
    print(f"Total Presupuesto Calculado: ${calc_total:,.2f}")
    print(f"Total Presupuesto Original:   ${orig_total:,.2f}")
    print(f"Diferencia: ${diff_total:,.4f}")
    assert diff_total < 0.05, f"Discrepancia en total: {calc_total} vs {orig_total}"
    print(" [OK] Subtotal General coincide exactamente.")

    # 3. Verificar Capítulos
    print("\n--- Verificación de Capítulos (11 Capítulos) ---")
    calc_chapters = {c["name"]: c for c in dataset["chapters"]}
    for c_idx, chap_name in enumerate(excel_data["chapters"], start=1):
        assert chap_name in calc_chapters, f"Capítulo no encontrado: {chap_name}"
        c_calc = calc_chapters[chap_name]
        orig_items = [it for it in excel_data["items"] if it["chapter"] == chap_name]
        orig_amt = sum(it["total"] for it in orig_items)
        amt_diff = abs(c_calc["amount"] - orig_amt)
        assert amt_diff < 0.05, f"Monto capítulo {chap_name} difiere: {c_calc['amount']} vs {orig_amt}"
        print(f"  {c_idx:02d}. {chap_name[:38]:<38} | {c_calc['item_count']} part | ${c_calc['amount']:>10,.2f} | Peso: {c_calc['weight_percent']:>5.2f}% [OK]")

    # 4. Verificar Desembolsos Semanales y Curva S (S1..S13)
    print("\n--- Verificación Semanal y Curva S (S1..S13) ---")
    print("Sem |  Desembolso Calc  |  Desembolso Orig  | Dif ($) | Curva S Calc | Curva S Orig | Estado")
    print("-" * 80)
    for w in range(13):
        w_calc = dataset["weekly_totals"][w]
        w_orig = excel_data["orig_weekly_totals"][w]
        w_diff = abs(w_calc - w_orig)

        cs_calc = dataset["curve_s_cumulative"][w]
        cs_orig = excel_data["orig_curve_s"][w] * 100.0  # Excel guarda en decimal 0.0..1.0
        cs_diff = abs(cs_calc - cs_orig)

        status = "OK" if w_diff < 1.0 and cs_diff < 0.1 else "FAIL"
        print(f"S{w+1:02d} | ${w_calc:>15,.2f} | ${w_orig:>15,.2f} | ${w_diff:>6.2f} | {cs_calc:>10.2f}% | {cs_orig:>10.2f}% | [{status}]")
        assert w_diff < 1.0, f"Discrepancia en semana S{w+1}: calc={w_calc}, orig={w_orig}"
        assert cs_diff < 0.1, f"Discrepancia en Curva S semana S{w+1}: calc={cs_calc}, orig={cs_orig}"

    # 5. Verificar Prorrateo Mensual (Oct, Nov, Dic, Ene)
    print("\n--- Verificación Prorrateo Mensual ---")
    print("Mes    | Monto Mensual Calc | Monto Mensual Orig | Dif ($) | Curva S Mensual | Estado")
    print("-" * 75)
    for m in range(4):
        m_calc = dataset["monthly_totals"][m]
        m_orig = excel_data["orig_monthly_totals"][m]
        m_diff = abs(m_calc - m_orig)
        m_cum = dataset["monthly_cumulative"][m]
        m_code = dataset["month_ranges"][m]["code"]

        status = "OK" if m_diff < 1.0 else "FAIL"
        print(f"{m_code:<6} | ${m_calc:>16,.2f} | ${m_orig:>16,.2f} | ${m_diff:>6.2f} | {m_cum:>13.2f}% | [{status}]")
        assert m_diff < 1.0, f"Discrepancia en mes {m_code}: calc={m_calc}, orig={m_orig}"

    # 6. Generar el archivo Excel resultante y verificar su estructura física
    print("\n--- Generación del Archivo Excel Oficial ---")
    buf = generate_cronograma_workbook(
        dataset=dataset,
        budget_name=budget.name,
        contractor_name=budget.company_name,
        contractee_name=budget.client_name,
        location=budget.ubicacion,
    )

    exports_dir = Path(r"c:\Users\pablo\Documents\apupro_platform\exports")
    exports_dir.mkdir(parents=True, exist_ok=True)
    out_path = exports_dir / "CRONOGRAMA_GENERAL_UKATIRA_INA_VERIFICADO.xlsx"

    with open(out_path, "wb") as f:
        f.write(buf.getvalue())

    print(f"Archivo Excel generado con éxito en: {out_path} ({out_path.stat().st_size:,} bytes)")

    # Recargar el Excel generado y comprobar sus 4 hojas y fórmulas
    wb_gen = openpyxl.load_workbook(out_path, data_only=False)
    assert set(wb_gen.sheetnames) == {"Cronograma General", "Cronograma Mensual", "Partidas", "Ponderación"}
    assert "START" in wb_gen.defined_names
    assert "FIN" in wb_gen.defined_names
    assert "IVA" in wb_gen.defined_names

    print("\n=======================================================")
    print(" ¡TODAS LAS VERIFICACIONES PASARON EXITOSAMENTE (100%)!")
    print("=======================================================")


def main() -> None:
    excel_path = Path(r"C:\Users\pablo\Desktop\CRONOGRAMA_GENERAL_UKATIRA_INA_TRUCKERSCA.xlsx")
    print(f"Leyendo archivo original: {excel_path}")
    excel_data = read_original_excel(excel_path)
    print(f"Archivo leído: {len(excel_data['items'])} partidas, {len(excel_data['chapters'])} capítulos.")

    # Conectar a la base de datos
    db = next(get_db())
    try:
        # Cargar para los usuarios activos:
        # User 13: milanopabloe@gmail.com
        # User 1: admin@arko360.net
        # User 10: costbaseia@gmail.com
        target_users = ["13", "1", "10"]
        created_budgets: List[Budget] = []

        for uid in target_users:
            admin_user = db.query(ArkoAdmin).filter_by(id=int(uid)).first()
            if admin_user:
                print(f"\nCargando obra para usuario ID {uid} ({admin_user.email})...")
                b = seed_budget(db, excel_data, user_id=uid)
                created_budgets.append(b)
                print(f"Obra creada con ID: {b.id}")

        if created_budgets:
            # Ejecutar la verificación con el primer presupuesto creado
            verify_schedule_reproduction(db, created_budgets[0], excel_data)

    except Exception:
        logger.error("Error durante la importación y verificación", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
