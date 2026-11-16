"""
Budget synchronization endpoints: Update unit prices from Cost360 master catalog or historical databases.
Supports Maprex-style granular updating, versioning, inflation adjustment, and quantity scaling.
"""
import base64
import io
import re
from typing import Any, Dict, List, Optional, Set, Tuple
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session, selectinload

from app.api.v1.endpoints.arko import get_current_arko_admin
from app.core.logging import logger
from app.db.base import get_db
from app.db.models.arko import ArkoAdmin
from app.db.models.budget import (
    Budget,
    BudgetItem,
    BudgetAPUMaterial as DBMaterial,
    BudgetAPUEquipment as DBEquipment,
    BudgetAPULabor as DBLabor,
)
from app.db.models.cost360 import CostEquipment, CostLabor, CostMaterial
from .helpers import compute_budget_summary_metrics

router = APIRouter()

_SAFE_SCHEMA_RE = re.compile(r"^[a-zA-Z0-9_]+$")


def _resolve_schema_name(db: Session, database_id: str) -> str:
    """Resuelve de forma segura el esquema de PostgreSQL correspondiente a database_id."""
    clean_id = (database_id or "master").strip().lower()
    if not clean_id or clean_id == "master":
        return "public"
    if not _SAFE_SCHEMA_RE.match(clean_id):
        raise ValueError(f"Identificador de base de datos inválido: {clean_id}")
    row = db.execute(
        text("SELECT schema_name FROM information_schema.schemata WHERE schema_name = :sname"),
        {"sname": clean_id},
    ).fetchone()
    return clean_id if row else "public"


def _collect_audit_rows(
    budget_obj: Any,
    before_mat: Dict[Any, float],
    before_eq: Dict[Any, float],
    before_lab: Dict[Any, float],
    unmatched_mat_ids: Set[Any],
    unmatched_eq_ids: Set[Any],
    unmatched_lab_ids: Set[Any],
) -> Tuple[List[Tuple[Any, ...]], List[Tuple[Any, ...]], List[Tuple[Any, ...]]]:
    """Construye filas únicas de auditoría para Materiales, Equipos y Mano de Obra."""
    mat_rows: List[Tuple[Any, ...]] = []
    eq_rows: List[Tuple[Any, ...]] = []
    lab_rows: List[Tuple[Any, ...]] = []
    seen_mat: Set[Tuple[Any, ...]] = set()
    seen_eq: Set[Tuple[Any, ...]] = set()
    seen_lab: Set[Tuple[Any, ...]] = set()

    for it in (budget_obj.items or []):
        if it.is_chapter:
            continue

        for m in (it.materials or []):
            old_p = round(float(before_mat.get(m.id, m.precio_unitario or 0.0)), 4)
            new_p = round(float(m.precio_unitario or 0.0), 4)
            if m.id in unmatched_mat_ids:
                estado = "No encontrado en base"
            elif abs(new_p - old_p) > 1e-4:
                estado = "Actualizado (con variación)"
            else:
                estado = "Sin variación"
            key = (str(m.codigo or ""), str(m.descripcion or ""), str(m.unidad or ""), old_p, new_p, estado)
            if key not in seen_mat:
                seen_mat.add(key)
                mat_rows.append(key)

        for eq in (it.equipments or []):
            old_p = round(float(before_eq.get(eq.id, eq.precio_unitario or 0.0)), 4)
            new_p = round(float(eq.precio_unitario or 0.0), 4)
            if eq.id in unmatched_eq_ids:
                estado = "No encontrado en base"
            elif abs(new_p - old_p) > 1e-4:
                estado = "Actualizado (con variación)"
            else:
                estado = "Sin variación"
            key = (str(eq.codigo or ""), str(eq.descripcion or ""), str(eq.unidad or "día"), old_p, new_p, estado)
            if key not in seen_eq:
                seen_eq.add(key)
                eq_rows.append(key)

        for lab in (it.labors or []):
            old_p = round(float(before_lab.get(lab.id, float(lab.jornal or 0.0) + float(lab.bono or 0.0))), 4)
            new_p = round(float(lab.jornal or 0.0) + float(lab.bono or 0.0), 4)
            if lab.id in unmatched_lab_ids:
                estado = "No encontrado en base"
            elif abs(new_p - old_p) > 1e-4:
                estado = "Actualizado (con variación)"
            else:
                estado = "Sin variación"
            key = (str(lab.codigo or ""), str(lab.descripcion or ""), "día", old_p, new_p, estado)
            if key not in seen_lab:
                seen_lab.add(key)
                lab_rows.append(key)

    return mat_rows, eq_rows, lab_rows


def _build_sync_audit_excel(
    budget_name: str,
    old_total: float,
    new_total: float,
    diff_percent: float,
    mat_rows: List[Tuple[Any, ...]],
    eq_rows: List[Tuple[Any, ...]],
    lab_rows: List[Tuple[Any, ...]],
) -> Tuple[str, str]:
    """Genera un libro Excel (.xlsx) en base64 con 3 hojas para auditar la actualización."""
    wb = Workbook()
    wb.remove(wb.active)

    banner_fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    header_fill = PatternFill(start_color="D97706", end_color="D97706", fill_type="solid")
    varied_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )

    sheets_spec = [
        ("Materiales", "Material", mat_rows),
        ("Equipos", "Equipo", eq_rows),
        ("Mano de Obra", "Mano de Obra", lab_rows),
    ]

    for sheet_title, item_label, rows in sheets_spec:
        ws = wb.create_sheet(title=sheet_title)
        ws.freeze_panes = "A3"

        ws.merge_cells("A1:H1")
        ws["A1"] = (
            f"Auditoría de Actualización · {sheet_title} — {budget_name} | "
            f"Neto (sin IVA): {old_total:,.2f} → {new_total:,.2f} ({diff_percent:+.2f}%)"
        )
        ws["A1"].font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        ws["A1"].fill = banner_fill
        ws["A1"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
        ws.row_dimensions[1].height = 24

        headers = [
            "Código",
            item_label,
            "Unidad",
            "Precio Original",
            "Precio Actualizado",
            "Delta",
            "% Variación",
            "Estado",
        ]
        ws.append(headers)
        ws.row_dimensions[2].height = 22
        for col_idx in range(1, 9):
            cell = ws.cell(row=2, column=col_idx)
            cell.font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
            cell.fill = header_fill
            cell.border = thin_border
            cell.alignment = Alignment(
                horizontal="right" if col_idx in (4, 5, 6, 7) else "left",
                vertical="center",
            )

        for r_idx, (codigo, nombre, unidad, old_p, new_p, estado) in enumerate(rows, start=3):
            delta = round(new_p - old_p, 4)
            pct = ((new_p - old_p) / old_p) if old_p > 0 else (1.0 if new_p > 0 else 0.0)
            varied = abs(delta) > 1e-4

            ws.append([codigo, nombre, unidad, old_p, new_p, delta, pct, estado])

            row_font = Font(name="Calibri", size=10, italic=varied, color="0F172A")
            delta_color = "15803D" if delta > 1e-4 else ("B91C1C" if delta < -1e-4 else "0F172A")
            delta_font = Font(name="Calibri", size=10, italic=varied, bold=varied, color=delta_color)

            for c_idx in range(1, 9):
                cell = ws.cell(row=r_idx, column=c_idx)
                cell.border = thin_border
                cell.font = delta_font if c_idx in (6, 7) else row_font
                if varied:
                    cell.fill = varied_fill
                if c_idx in (4, 5):
                    cell.number_format = "#,##0.00"
                    cell.alignment = Alignment(horizontal="right", vertical="center")
                elif c_idx == 6:
                    cell.number_format = "+#,##0.00;-#,##0.00;0.00"
                    cell.alignment = Alignment(horizontal="right", vertical="center")
                elif c_idx == 7:
                    cell.number_format = "+0.00%;-0.00%;0.00%"
                    cell.alignment = Alignment(horizontal="right", vertical="center")
                else:
                    cell.alignment = Alignment(horizontal="left", vertical="center")

        col_widths = [16, 48, 10, 16, 18, 14, 14, 24]
        for idx, width in enumerate(col_widths, start=1):
            ws.column_dimensions[get_column_letter(idx)].width = width

    buf = io.BytesIO()
    wb.save(buf)
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    safe_name = re.sub(r"[^a-zA-Z0-9_-]+", "_", (budget_name or "Presupuesto").strip()).strip("_")
    filename = f"Auditoria_Actualizacion_{safe_name or 'Presupuesto'}.xlsx"
    return encoded, filename


class BudgetAdvancedSyncRequest(BaseModel):
    target_database_id: str = "master"
    mode: str = "preset_prices"  # preset_prices, preset_factors, preset_full, custom, inflation_adjust, scale_quantities

    # Partidas
    update_partida_performance: bool = False
    update_partida_fcas: bool = False
    update_partida_desc: bool = False

    # Materiales
    update_material_prices: bool = True
    update_material_quantities: bool = False
    update_material_waste: bool = False

    # Equipos
    update_equipment_prices: bool = True
    update_equipment_depreciation: bool = False
    update_equipment_quantities: bool = False

    # Mano de Obra
    update_labor_jornal: bool = True
    update_labor_bonus: bool = True
    update_labor_crews: bool = False
    fixed_labor_bonus: Optional[float] = None

    # Pestaña 2: Inflación / Ajuste %
    inflation_global: Optional[float] = None
    inflation_materials: Optional[float] = None
    inflation_equipments: Optional[float] = None
    inflation_labor: Optional[float] = None

    # Pestaña 3: Multiplicador de Cantidades
    quantity_multiplier: Optional[float] = None

    # Modo Seguro: Versionamiento
    create_new_version: bool = False
    new_version_name: Optional[str] = None


@router.post("/{budget_id}/sync_prices")
def sync_budget_prices(
    budget_id: str,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """Sincroniza los precios de materiales, equipos y mano de obra con la base maestra de Cost360."""
    default_req = BudgetAdvancedSyncRequest(
        target_database_id="master",
        mode="preset_prices",
        create_new_version=False,
    )
    return sync_budget_advanced(budget_id, default_req, db, current_user)


@router.post("/{budget_id}/sync_advanced")
def sync_budget_advanced(
    budget_id: str,
    req: BudgetAdvancedSyncRequest,
    db: Session = Depends(get_db),
    current_user: ArkoAdmin = Depends(get_current_arko_admin),
) -> Dict[str, Any]:
    """
    Actualización avanzada de presupuesto estilo Maprex con control granular de rubros,
    versionamiento seguro, factores de inflación y multiplicador de cantidades.
    """
    budget = (
        db.query(Budget)
        .options(
            selectinload(Budget.items).selectinload(BudgetItem.materials),
            selectinload(Budget.items).selectinload(BudgetItem.equipments),
            selectinload(Budget.items).selectinload(BudgetItem.labors),
        )
        .filter(Budget.id == budget_id, Budget.user_id == str(current_user.id))
        .first()
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

    old_subtotal, old_total = compute_budget_summary_metrics(budget)

    # Si se solicitó crear nueva versión, duplicamos el presupuesto y aplicamos los cambios a la copia
    if req.create_new_version:
        db_label = req.target_database_id.replace("base_", "Base ").title() if req.target_database_id != "master" else "Base Maestra"
        new_name = (req.new_version_name or f"{budget.name} — Actualizado ({db_label})").strip()
        
        target_budget = Budget(
            user_id=str(current_user.id),
            name=new_name,
            project_name=new_name,
            currency=budget.currency,
            exchange_rate=budget.exchange_rate,
            material_inflation=budget.material_inflation,
            equipment_inflation=budget.equipment_inflation,
            labor_inflation=budget.labor_inflation,
            labor_bonus=budget.labor_bonus,
            admin_percent=budget.admin_percent,
            profit_percent=budget.profit_percent,
            fcas_percent=budget.fcas_percent,
            iva_percent=budget.iva_percent,
            company_name=budget.company_name,
            company_rif=budget.company_rif,
            client_name=budget.client_name,
            ubicacion=budget.ubicacion,
            bono_in_fcas=budget.bono_in_fcas,
        )
        db.add(target_budget)
        db.commit()
        db.refresh(target_budget)

        for it in budget.items:
            new_it = BudgetItem(
                budget_id=target_budget.id,
                cod_par=it.cod_par,
                cov_par=it.cov_par,
                description=it.description,
                unit=it.unit,
                quantity=it.quantity,
                performance=it.performance,
                order=it.order,
                is_chapter=it.is_chapter,
                is_pending=it.is_pending,
            )
            db.add(new_it)
            db.commit()
            db.refresh(new_it)

            for m in (it.materials or []):
                db.add(DBMaterial(
                    budget_item_id=new_it.id,
                    codigo=m.codigo,
                    descripcion=m.descripcion,
                    unidad=m.unidad,
                    precio_unitario=m.precio_unitario,
                    cantidad=m.cantidad,
                    desperdicio=m.desperdicio,
                ))
            for eq in (it.equipments or []):
                db.add(DBEquipment(
                    budget_item_id=new_it.id,
                    codigo=eq.codigo,
                    descripcion=eq.descripcion,
                    unidad=eq.unidad,
                    precio_unitario=eq.precio_unitario,
                    cantidad=eq.cantidad,
                    depreciacion=eq.depreciacion,
                ))
            for lab in (it.labors or []):
                db.add(DBLabor(
                    budget_item_id=new_it.id,
                    codigo=lab.codigo,
                    descripcion=lab.descripcion,
                    jornal=lab.jornal,
                    bono=lab.bono,
                    cantidad=lab.cantidad,
                ))
        db.commit()
        db.refresh(target_budget)
    else:
        target_budget = budget

    updated_materials = 0
    unmatched_materials = set()
    updated_equipments = 0
    unmatched_equipments = set()
    updated_labors = 0
    unmatched_labors = set()
    updated_items = 0
    updated_performances = 0
    updated_depreciations = 0
    updated_descriptions = 0

    before_mat: Dict[Any, float] = {}
    before_eq: Dict[Any, float] = {}
    before_lab: Dict[Any, float] = {}
    unmatched_mat_ids: Set[Any] = set()
    unmatched_eq_ids: Set[Any] = set()
    unmatched_lab_ids: Set[Any] = set()
    for it in (target_budget.items or []):
        if it.is_chapter:
            continue
        for m in (it.materials or []):
            before_mat[m.id] = float(m.precio_unitario or 0.0)
        for eq in (it.equipments or []):
            before_eq[eq.id] = float(eq.precio_unitario or 0.0)
        for lab in (it.labors or []):
            before_lab[lab.id] = float(lab.jornal or 0.0) + float(lab.bono or 0.0)

    # =========================================================================
    # CASO A: Multiplicador de Cantidades (Pestaña 3)
    # =========================================================================
    if req.mode == "scale_quantities":
        mult = float(req.quantity_multiplier or 1.0)
        if mult <= 0:
            raise HTTPException(status_code=400, detail="El multiplicador de cantidades debe ser mayor a 0")
        for it in target_budget.items:
            if not it.is_chapter:
                it.quantity = round(float(it.quantity or 0.0) * mult, 4)
                updated_items += 1
        db.commit()

    # =========================================================================
    # CASO B: Ajuste Porcentual / Inflación (Pestaña 2)
    # =========================================================================
    elif req.mode == "inflation_adjust":
        g_pct = float(req.inflation_global or 0.0)
        m_pct = float(req.inflation_materials if req.inflation_materials is not None else g_pct)
        e_pct = float(req.inflation_equipments if req.inflation_equipments is not None else g_pct)
        l_pct = float(req.inflation_labor if req.inflation_labor is not None else g_pct)

        m_factor = 1.0 + (m_pct / 100.0)
        e_factor = 1.0 + (e_pct / 100.0)
        l_factor = 1.0 + (l_pct / 100.0)

        for it in target_budget.items:
            if it.is_chapter:
                continue
            for m in (it.materials or []):
                m.precio_unitario = round(float(m.precio_unitario or 0.0) * m_factor, 4)
                updated_materials += 1
            for eq in (it.equipments or []):
                eq.precio_unitario = round(float(eq.precio_unitario or 0.0) * e_factor, 4)
                updated_equipments += 1
            for lab in (it.labors or []):
                lab.jornal = round(float(lab.jornal or 0.0) * l_factor, 4)
                lab.bono = round(float(lab.bono or 0.0) * l_factor, 4)
                updated_labors += 1
        db.commit()

    # =========================================================================
    # CASO C: Actualización contra Base de Datos (Pestaña 1 - Maprex)
    # =========================================================================
    else:
        # Determinar flags según modo o custom
        if req.mode == "preset_prices":
            up_mat_price = True
            up_mat_qty = False
            up_mat_waste = False
            up_eq_price = True
            up_eq_deprec = bool(req.update_equipment_depreciation)
            up_eq_qty = False
            up_lab_jornal = True
            up_lab_bonus = False
            up_lab_crews = False
            up_par_perf = bool(req.update_partida_performance)
            up_par_fcas = bool(req.update_partida_fcas)
            up_par_desc = bool(req.update_partida_desc)
        elif req.mode == "preset_factors":
            up_mat_price = True
            up_mat_qty = False
            up_mat_waste = False
            up_eq_price = True
            up_eq_deprec = True
            up_eq_qty = False
            up_lab_jornal = True
            up_lab_bonus = True
            up_lab_crews = False
            up_par_perf = bool(req.update_partida_performance)
            up_par_fcas = True
            up_par_desc = bool(req.update_partida_desc)
        elif req.mode == "preset_full":
            up_mat_price = True
            up_mat_qty = True
            up_mat_waste = True
            up_eq_price = True
            up_eq_deprec = True
            up_eq_qty = True
            up_lab_jornal = True
            up_lab_bonus = True
            up_lab_crews = True
            up_par_perf = True
            up_par_fcas = True
            up_par_desc = True
        else:  # "custom"
            up_mat_price = req.update_material_prices
            up_mat_qty = req.update_material_quantities
            up_mat_waste = req.update_material_waste
            up_eq_price = req.update_equipment_prices
            up_eq_deprec = req.update_equipment_depreciation
            up_eq_qty = req.update_equipment_quantities
            up_lab_jornal = req.update_labor_jornal
            up_lab_bonus = req.update_labor_bonus
            up_lab_crews = req.update_labor_crews
            up_par_perf = req.update_partida_performance
            up_par_fcas = req.update_partida_fcas
            up_par_desc = req.update_partida_desc

        schema = _resolve_schema_name(db, req.target_database_id)

        # 1. Cargar catálogo de materiales
        mat_map: Dict[str, Dict[str, Any]] = {}
        try:
            m_rows = db.execute(
                text(f'SELECT "CodMat", ref_code, "CosMat", "Descri", "UniMat" FROM "{schema}".cost360_materials')
            ).fetchall()
            for r in m_rows:
                entry = {"CodMat": r[0], "CosMat": float(r[2] or 0.0), "Descri": r[3], "UniMat": r[4]}
                if r[0]:
                    code_str = str(r[0]).strip().upper()
                    mat_map[code_str] = entry
                    mat_map[re.sub(r'[^A-Z0-9]', '', code_str)] = entry
                if r[1]:
                    ref_str = str(r[1]).strip().upper()
                    mat_map[ref_str] = entry
                    mat_map[re.sub(r'[^A-Z0-9]', '', ref_str)] = entry
        except Exception as exc:
            logger.error("Error cargando materiales en esquema %s: %s", schema, exc, exc_info=True)
            db.rollback()

        # 2. Cargar catálogo de equipos
        eq_map: Dict[str, Dict[str, Any]] = {}
        try:
            e_rows = db.execute(
                text(f'SELECT "CodEqu", ref_code, "CosDia", "Descri", deprec_factor, "precio" FROM "{schema}".cost360_equipment')
            ).fetchall()
            for r in e_rows:
                entry = {
                    "CodEqu": r[0],
                    "CosDia": float(r[2] or 0.0),
                    "Descri": r[3],
                    "deprec": float(r[4] if r[4] is not None else 1.0),
                    "precio": float(r[5] or 0.0),
                }
                if r[0]:
                    code_str = str(r[0]).strip().upper()
                    eq_map[code_str] = entry
                    eq_map[re.sub(r'[^A-Z0-9]', '', code_str)] = entry
                if r[1]:
                    ref_str = str(r[1]).strip().upper()
                    eq_map[ref_str] = entry
                    eq_map[re.sub(r'[^A-Z0-9]', '', ref_str)] = entry
        except Exception as exc:
            logger.error("Error cargando equipos en esquema %s: %s", schema, exc, exc_info=True)
            db.rollback()

        # 3. Cargar catálogo de mano de obra
        lab_map: Dict[str, Dict[str, Any]] = {}
        try:
            l_rows = db.execute(
                text(f'SELECT "CodMan", ref_code, "Jornal", "Bono", "Descri" FROM "{schema}".cost360_labor')
            ).fetchall()
            for r in l_rows:
                entry = {"CodMan": r[0], "Jornal": float(r[2] or 0.0), "Bono": float(r[3] or 0.0), "Descri": r[4]}
                if r[0]:
                    code_str = str(r[0]).strip().upper()
                    lab_map[code_str] = entry
                    lab_map[re.sub(r'[^A-Z0-9]', '', code_str)] = entry
                if r[1]:
                    ref_str = str(r[1]).strip().upper()
                    lab_map[ref_str] = entry
                    lab_map[re.sub(r'[^A-Z0-9]', '', ref_str)] = entry
        except Exception as exc:
            logger.error("Error cargando mano de obra en esquema %s: %s", schema, exc, exc_info=True)
            db.rollback()

        # 4. Cargar partidas maestras si se requiere actualizar rendimientos o descripciones
        item_map: Dict[str, Dict[str, Any]] = {}
        if up_par_perf or up_par_desc:
            try:
                i_rows = db.execute(
                    text(f'SELECT "CodPar", "CovPar", "Descri", "UniPar", "RenPar" FROM "{schema}".cost360_items')
                ).fetchall()
                for r in i_rows:
                    entry = {"CodPar": r[0], "CovPar": r[1], "Descri": r[2], "UniPar": r[3], "RenPar": float(r[4] or 1.0)}
                    if r[0]:
                        code_str = str(r[0]).strip().upper()
                        item_map[code_str] = entry
                        item_map[re.sub(r'[^A-Z0-9]', '', code_str)] = entry
                    if r[1]:
                        cov_str = str(r[1]).strip().upper()
                        item_map[cov_str] = entry
                        item_map[re.sub(r'[^A-Z0-9]', '', cov_str)] = entry
            except Exception as exc:
                logger.error("Error cargando partidas en esquema %s: %s", schema, exc, exc_info=True)
                db.rollback()

        # 5. Aplicar actualizaciones sobre cada item y sus APUs
        for it in target_budget.items:
            if it.is_chapter:
                continue

            # Actualizar datos de cabecera de partida (Rendimiento, Descripción, Unidad)
            if (up_par_perf or up_par_desc) and item_map:
                it_code = str(it.cod_par or "").strip().upper()
                cov_code = str(it.cov_par or "").strip().upper()
                clean_it = re.sub(r'[^A-Z0-9]', '', it_code)
                clean_cov = re.sub(r'[^A-Z0-9]', '', cov_code)
                master_it = (
                    item_map.get(cov_code)
                    or (item_map.get(clean_cov) if clean_cov else None)
                    or item_map.get(it_code)
                    or (item_map.get(clean_it) if clean_it else None)
                )
                if master_it:
                    item_changed = False
                    if up_par_perf and master_it.get("RenPar", 0) > 0:
                        it.performance = master_it["RenPar"]
                        updated_performances += 1
                        item_changed = True
                    if up_par_desc:
                        if master_it.get("Descri"):
                            it.description = master_it["Descri"]
                            updated_descriptions += 1
                            item_changed = True
                        if master_it.get("UniPar"):
                            it.unit = master_it["UniPar"]
                            item_changed = True
                    if item_changed:
                        updated_items += 1

            # Actualizar Materiales
            for m in (it.materials or []):
                m_code = str(m.codigo or "").strip().upper()
                clean_m = re.sub(r'[^A-Z0-9]', '', m_code)
                cat_m = mat_map.get(m_code) or (mat_map.get(clean_m) if clean_m else None)
                if cat_m:
                    if up_mat_price:
                        m.precio_unitario = cat_m["CosMat"]
                    updated_materials += 1
                else:
                    unmatched_materials.add(f"{m.codigo} ({m.descripcion[:30] if m.descripcion else 'Material'})")
                    unmatched_mat_ids.add(m.id)

            # Actualizar Equipos
            for eq in (it.equipments or []):
                eq_code = str(eq.codigo or "").strip().upper()
                clean_eq = re.sub(r'[^A-Z0-9]', '', eq_code)
                cat_eq = eq_map.get(eq_code) or (eq_map.get(clean_eq) if clean_eq else None)
                if cat_eq:
                    if up_eq_price:
                        # En el catálogo, CosDia ya está afectado por el factor
                        # de depreciación; el APU del presupuesto guarda el
                        # precio diario bruto y aplica la depreciación al calcular.
                        deprec = cat_eq.get("deprec") or 1.0
                        if cat_eq.get("precio", 0.0) > 0:
                            eq.precio_unitario = cat_eq["precio"]
                        elif deprec > 0:
                            eq.precio_unitario = cat_eq["CosDia"] / deprec
                        else:
                            eq.precio_unitario = cat_eq["CosDia"]
                    if up_eq_deprec and cat_eq.get("deprec") is not None:
                        eq.depreciacion = cat_eq["deprec"]
                        updated_depreciations += 1
                    updated_equipments += 1
                else:
                    unmatched_equipments.add(f"{eq.codigo} ({eq.descripcion[:30] if eq.descripcion else 'Equipo'})")
                    unmatched_eq_ids.add(eq.id)

            # Actualizar Mano de Obra
            for lab in (it.labors or []):
                lab_code = str(lab.codigo or "").strip().upper()
                clean_lab = re.sub(r'[^A-Z0-9]', '', lab_code)
                cat_lab = lab_map.get(lab_code) or (lab_map.get(clean_lab) if clean_lab else None)
                if cat_lab:
                    if up_lab_jornal:
                        lab.jornal = cat_lab["Jornal"]
                    if req.fixed_labor_bonus is not None and req.fixed_labor_bonus >= 0:
                        lab.bono = float(req.fixed_labor_bonus)
                    elif up_lab_bonus and cat_lab["Bono"] > 0:
                        # Si el presupuesto original no tenía bono (bono == 0), no incorporarlo
                        current_b = float(lab.bono or 0.0)
                        if current_b > 0:
                            lab.bono = cat_lab["Bono"]
                    updated_labors += 1
                else:
                    if req.fixed_labor_bonus is not None and req.fixed_labor_bonus >= 0:
                        lab.bono = float(req.fixed_labor_bonus)
                        updated_labors += 1
                    else:
                        unmatched_labors.add(f"{lab.codigo} ({lab.descripcion[:30] if lab.descripcion else 'Mano de Obra'})")
                        unmatched_lab_ids.add(lab.id)

        db.commit()

    # Recalcular nuevo total
    new_subtotal, new_total = compute_budget_summary_metrics(target_budget)
    diff_amount = round(new_total - old_total, 2)
    diff_percent = round((diff_amount / old_total * 100.0) if old_total > 0 else 0.0, 2)
    net_diff_amount = round(new_subtotal - old_subtotal, 2)
    net_diff_percent = round((net_diff_amount / old_subtotal * 100.0) if old_subtotal > 0 else 0.0, 2)

    audit_excel_base64: Optional[str] = None
    audit_excel_filename: Optional[str] = None
    try:
        mat_rows, eq_rows, lab_rows = _collect_audit_rows(
            target_budget,
            before_mat,
            before_eq,
            before_lab,
            unmatched_mat_ids,
            unmatched_eq_ids,
            unmatched_lab_ids,
        )
        audit_excel_base64, audit_excel_filename = _build_sync_audit_excel(
            target_budget.name,
            old_subtotal,
            new_subtotal,
            net_diff_percent,
            mat_rows,
            eq_rows,
            lab_rows,
        )
    except Exception as exc:
        logger.error("Error generando Excel de auditoría de actualización: %s", exc, exc_info=True)

    actions_done = []
    if updated_materials > 0 or updated_equipments > 0 or updated_labors > 0:
        actions_done.append("precios actualizados")
    if updated_performances > 0:
        actions_done.append(f"{updated_performances} rendimientos corregidos")
    if updated_depreciations > 0:
        actions_done.append(f"{updated_depreciations} depreciaciones corregidas")
    if updated_descriptions > 0:
        actions_done.append(f"{updated_descriptions} descripciones homologadas")

    summary_str = f" ({', '.join(actions_done)})" if actions_done else ""

    return {
        "status": "ok",
        "budget_id": target_budget.id,
        "budget_name": target_budget.name,
        "is_new_version": req.create_new_version,
        "updated_materials_count": updated_materials,
        "unmatched_materials_count": len(unmatched_materials),
        "unmatched_materials": sorted(list(unmatched_materials))[:15],
        "updated_equipments_count": updated_equipments,
        "unmatched_equipments_count": len(unmatched_equipments),
        "unmatched_equipments": sorted(list(unmatched_equipments))[:15],
        "updated_labors_count": updated_labors,
        "unmatched_labors_count": len(unmatched_labors),
        "unmatched_labors": sorted(list(unmatched_labors))[:15],
        "updated_items_count": updated_items,
        "updated_performances_count": updated_performances,
        "updated_depreciations_count": updated_depreciations,
        "updated_descriptions_count": updated_descriptions,
        "old_total": old_total,
        "new_total": new_total,
        "diff_amount": diff_amount,
        "diff_percent": diff_percent,
        "audit_excel_base64": audit_excel_base64,
        "audit_excel_filename": audit_excel_filename,
        "message": (
            f"Nueva versión '{target_budget.name}' creada exitosamente{summary_str}. Variación: {diff_amount:+,.2f} ({diff_percent:+.2f}%)."
            if req.create_new_version
            else f"Presupuesto actualizado exitosamente{summary_str}. Variación: {diff_amount:+,.2f} ({diff_percent:+.2f}%)."
        ),
    }
