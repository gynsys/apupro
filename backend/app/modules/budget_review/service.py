"""Servicio orquestador de Revisión y Auditoría de Presupuestos (Maprex vs CostBase)."""
from __future__ import annotations

from collections import Counter
from datetime import datetime
import io
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
import uuid

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from sqlalchemy import text
from sqlalchemy.orm import Session, selectinload

from app.db.base import Base, engine
from app.db.models.budget import Budget, BudgetItem
from app.modules.budget_review.domain.audit_rules import (
    calculate_apu_unit_price,
    compute_description_similarity,
    compute_snapshot_health_score,
    evaluate_item_audit_rules,
    is_uncoded_code,
)
from app.modules.budget_review.domain.maprex_baseline import (
    classify_costbase_item_origin,
    normalize_unit,
)
from app.modules.budget_review.models import (
    ReviewAPUComponent,
    ReviewFinding,
    ReviewItem,
    ReviewSnapshot,
)
from app.services.budget_import import build_preview
from app.services.budget_import.matching import find_candidates

logger = logging.getLogger(__name__)

_SAFE_SCHEMA_RE = re.compile(r"^[a-zA-Z0-9_]+$")
_TABLES_INITIALIZED = False


def ensure_review_tables() -> None:
    """Crea y auto-migra las tablas aisladas de revisión si aún no existen en la base de datos."""
    global _TABLES_INITIALIZED
    if _TABLES_INITIALIZED:
        return
    try:
        Base.metadata.create_all(
            bind=engine,
            tables=[
                ReviewSnapshot.__table__,
                ReviewItem.__table__,
                ReviewAPUComponent.__table__,
                ReviewFinding.__table__,
            ],
        )
        required_columns = [
            ("review_budget_snapshots", "audit_group_id", "ALTER TABLE review_budget_snapshots ADD COLUMN IF NOT EXISTS audit_group_id VARCHAR"),
            ("review_budget_snapshots", "parent_snapshot_id", "ALTER TABLE review_budget_snapshots ADD COLUMN IF NOT EXISTS parent_snapshot_id VARCHAR"),
            ("review_budget_snapshots", "version_number", "ALTER TABLE review_budget_snapshots ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1"),
            ("review_budget_snapshots", "review_status", "ALTER TABLE review_budget_snapshots ADD COLUMN IF NOT EXISTS review_status VARCHAR NOT NULL DEFAULT 'EN_REVISION'"),
            ("review_budget_snapshots", "auditor_notes", "ALTER TABLE review_budget_snapshots ADD COLUMN IF NOT EXISTS auditor_notes TEXT"),
            ("review_budget_snapshots", "updated_at", "ALTER TABLE review_budget_snapshots ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
            ("review_findings", "finding_status", "ALTER TABLE review_findings ADD COLUMN IF NOT EXISTS finding_status VARCHAR NOT NULL DEFAULT 'PENDIENTE'"),
            ("review_findings", "auditor_comment", "ALTER TABLE review_findings ADD COLUMN IF NOT EXISTS auditor_comment TEXT"),
        ]
        with engine.begin() as conn:
            existing_rows = conn.execute(
                text(
                    "SELECT table_name, column_name FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND table_name IN ('review_budget_snapshots', 'review_findings')"
                )
            ).fetchall()
            existing_pairs = {(r[0], r[1]) for r in existing_rows}
            for tbl, col, stmt in required_columns:
                if (tbl, col) not in existing_pairs:
                    conn.execute(text(stmt))
        _TABLES_INITIALIZED = True
    except Exception as exc:
        logger.error("Error inicializando tablas de revisión de presupuestos: %s", exc, exc_info=True)
        raise


def _resolve_schema_name(db: Session, database_id: str) -> str:
    """Resuelve de forma segura el esquema de PostgreSQL correspondiente a database_id."""
    clean_id = (database_id or "master").strip()
    if not clean_id or clean_id == "master":
        return "public"
    if not _SAFE_SCHEMA_RE.match(clean_id):
        raise ValueError("Identificador de base de datos inválido.")
    row = db.execute(
        text(
            "SELECT schema_name FROM information_schema.schemata WHERE schema_name = :sname"
        ),
        {"sname": clean_id},
    ).fetchone()
    return clean_id if row else "public"


def _load_master_reference_maps(db: Session, schema: str) -> Dict[str, Dict[str, str]]:
    """Carga los mapeos ref_code -> código nativo Maprex para Materiales, Equipos y Mano de Obra."""
    ref_maps: Dict[str, Dict[str, str]] = {"material": {}, "equipment": {}, "labor": {}}
    queries = [
        ("material", f'SELECT ref_code, "CodMat" FROM "{schema}".cost360_materials WHERE ref_code IS NOT NULL'),
        ("equipment", f'SELECT ref_code, "CodEqu" FROM "{schema}".cost360_equipment WHERE ref_code IS NOT NULL'),
        ("labor", f'SELECT ref_code, "CodMan" FROM "{schema}".cost360_labor WHERE ref_code IS NOT NULL'),
    ]
    for kind, sql in queries:
        try:
            rows = db.execute(text(sql)).fetchall()
            for ref_val, native_val in rows:
                if ref_val and native_val:
                    ref_maps[kind][str(ref_val).strip().upper()] = str(native_val).strip().upper()
        except Exception as exc:
            logger.error("Error cargando ref_code para %s: %s", kind, exc, exc_info=True)
            db.rollback()
    return ref_maps


def _fetch_master_item_and_recipe(
    db: Session,
    schema: str,
    code: str,
    cov_code: Optional[str],
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, List[Dict[str, Any]]]]]:
    """Busca una partida en CostBase por CodPar o por CovPar y retorna sus metadatos y receta APU."""
    clean_code = (code or "").strip()
    clean_cov = (cov_code or "").strip()
    if not clean_code and not clean_cov:
        return None, None

    row = None
    if clean_code:
        row = db.execute(
            text(
                f'SELECT "CodPar", "CovPar", "Descri", "UniPar", "RenPar", "PreUni" '
                f'FROM "{schema}".cost360_items WHERE UPPER("CodPar") = UPPER(:c) LIMIT 1'
            ),
            {"c": clean_code},
        ).fetchone()

    if not row and clean_cov and clean_cov.upper() not in {"S/C", "E S/C", "ES/C"}:
        row = db.execute(
            text(
                f'SELECT "CodPar", "CovPar", "Descri", "UniPar", "RenPar", "PreUni" '
                f'FROM "{schema}".cost360_items WHERE UPPER("CovPar") = UPPER(:cov) LIMIT 1'
            ),
            {"cov": clean_cov},
        ).fetchone()

    if not row and clean_code and clean_code.upper() not in {"S/C", "E S/C", "ES/C"}:
        # En Maprex ciertas partidas de Urbanismo usan código corto pero coinciden con CovPar en CostBase
        row = db.execute(
            text(
                f'SELECT "CodPar", "CovPar", "Descri", "UniPar", "RenPar", "PreUni" '
                f'FROM "{schema}".cost360_items WHERE UPPER("CovPar") = UPPER(:c) LIMIT 1'
            ),
            {"c": clean_code},
        ).fetchone()

    if not row:
        return None, None

    matched_cod_par = str(row[0]).strip()
    master_item = {
        "cod_par": matched_cod_par,
        "cov_par": str(row[1] or "").strip(),
        "description": str(row[2] or "").strip(),
        "unit": str(row[3] or "").strip(),
        "performance": float(row[4] or 1.0),
        "unit_price": float(row[5] or 0.0),
    }

    mat_rows = db.execute(
        text(
            f'SELECT am."CodIns", m."Descri", m."UniMat", am."CanIns", m."CosMat", am."Desper" '
            f'FROM "{schema}".cost360_apu_materials am '
            f'LEFT JOIN "{schema}".cost360_materials m ON m."CodMat" = am."CodIns" '
            f'WHERE am."CodPar" = :cp'
        ),
        {"cp": matched_cod_par},
    ).fetchall()

    eq_rows = db.execute(
        text(
            f'SELECT ae."CodIns", e."Descri", ae."CanIns", e."CosDia", ae."Deprec", e."deprec_factor" '
            f'FROM "{schema}".cost360_apu_equipment ae '
            f'LEFT JOIN "{schema}".cost360_equipment e ON e."CodEqu" = ae."CodIns" '
            f'WHERE ae."CodPar" = :cp'
        ),
        {"cp": matched_cod_par},
    ).fetchall()

    lab_rows = db.execute(
        text(
            f'SELECT al."CodIns", l."Descri", al."CanIns", l."Jornal", l."Bono" '
            f'FROM "{schema}".cost360_apu_labor al '
            f'LEFT JOIN "{schema}".cost360_labor l ON l."CodMan" = al."CodIns" '
            f'WHERE al."CodPar" = :cp'
        ),
        {"cp": matched_cod_par},
    ).fetchall()

    master_recipe: Dict[str, List[Dict[str, Any]]] = {
        "materials": [
            {
                "code": str(r[0] or "").strip().upper(),
                "description": str(r[1] or "").strip(),
                "unit": str(r[2] or "und").strip(),
                "quantity": float(r[3] or 0.0),
                "unit_price": float(r[4] or 0.0),
                "waste_or_deprec": float(r[5] or 0.0),
            }
            for r in mat_rows
        ],
        "equipments": [
            {
                "code": str(r[0] or "").strip().upper(),
                "description": str(r[1] or "").strip(),
                "unit": "día",
                "quantity": float(r[2] or 0.0),
                "unit_price": float(r[3] or 0.0),
                "waste_or_deprec": float(r[4] if r[4] is not None else (r[5] if r[5] is not None else 1.0)),
            }
            for r in eq_rows
        ],
        "labors": [
            {
                "code": str(r[0] or "").strip().upper(),
                "description": str(r[1] or "").strip(),
                "unit": "día",
                "quantity": float(r[2] or 0.0),
                "unit_price": float(r[3] or 0.0),
                "bonus": float(r[4] or 0.0),
                "waste_or_deprec": 0.0,
            }
            for r in lab_rows
        ],
    }

    return master_item, master_recipe


def _execute_snapshot_audit(
    db: Session,
    user_id: str,
    header_info: Dict[str, Any],
    raw_items: List[Dict[str, Any]],
    database_id: str = "master",
) -> ReviewSnapshot:
    """Crea el snapshot de revisión, ejecuta todas las reglas de auditoría y persiste los hallazgos."""
    if not user_id:
        raise ValueError("El user_id es obligatorio para registrar la auditoría.")

    ensure_review_tables()
    parent_id = header_info.get("parent_snapshot_id")
    parent_snap: Optional[ReviewSnapshot] = None
    if parent_id:
        parent_snap = (
            db.query(ReviewSnapshot)
            .filter(ReviewSnapshot.id == str(parent_id).strip())
            .first()
        )

    effective_db_id = (
        database_id
        or (parent_snap.database_id if parent_snap else "master")
        or "master"
    )
    schema = _resolve_schema_name(db, effective_db_id)
    ref_maps = _load_master_reference_maps(db, schema)

    fcas_pct = float(header_info.get("fcas_percent") if header_info.get("fcas_percent") is not None else 417.0)
    admin_pct = float(header_info.get("admin_percent") if header_info.get("admin_percent") is not None else 15.0)
    profit_pct = float(header_info.get("profit_percent") if header_info.get("profit_percent") is not None else 10.0)
    iva_pct = float(header_info.get("iva_percent") if header_info.get("iva_percent") is not None else 16.0)

    new_snap_id = str(uuid.uuid4())
    group_id = new_snap_id
    version_num = 1
    if parent_snap:
        group_id = parent_snap.audit_group_id or parent_snap.id
        if not parent_snap.audit_group_id:
            parent_snap.audit_group_id = group_id
        existing_versions = (
            db.query(ReviewSnapshot.version_number)
            .filter(
                (ReviewSnapshot.audit_group_id == group_id)
                | (ReviewSnapshot.id == group_id)
            )
            .all()
        )
        max_ver = max([int(r[0] or 1) for r in existing_versions] + [int(parent_snap.version_number or 1)])
        version_num = max_ver + 1

    base_name = str(
        header_info.get("name")
        or (parent_snap.name if parent_snap else None)
        or "Presupuesto Auditado"
    )
    if parent_snap and not header_info.get("custom_name_provided"):
        clean_base = re.sub(r"\s*\(v\d+\)\s*$", "", base_name, flags=re.IGNORECASE).strip()
        base_name = f"{clean_base} (v{version_num})"

    snapshot = ReviewSnapshot(
        id=new_snap_id,
        user_id=str(user_id),
        source_type=str(header_info.get("source_type") or "file"),
        source_budget_id=header_info.get("source_budget_id"),
        source_filename=header_info.get("source_filename"),
        database_id=effective_db_id,
        name=base_name,
        project_name=header_info.get("project_name") or (parent_snap.project_name if parent_snap else None),
        client_name=header_info.get("client_name") or (parent_snap.client_name if parent_snap else None),
        currency=str(header_info.get("currency") or "USD"),
        audit_group_id=group_id,
        parent_snapshot_id=parent_snap.id if parent_snap else None,
        version_number=version_num,
        review_status=str(header_info.get("review_status") or "EN_REVISION"),
        auditor_notes=header_info.get("auditor_notes"),
        fcas_percent=fcas_pct,
        admin_percent=admin_pct,
        profit_percent=profit_pct,
        iva_percent=iva_pct,
    )
    db.add(snapshot)
    db.flush()

    all_findings_dicts: List[Dict[str, Any]] = []
    coded_count = 0
    uncoded_count = 0
    non_chapter_count = 0

    # Detectar códigos de partida duplicados en todo el presupuesto
    code_occurrences = Counter(
        str(it.get("code") or "").strip().upper()
        for it in raw_items
        if not it.get("is_chapter") and str(it.get("code") or "").strip()
    )

    for idx, raw in enumerate(raw_items, start=1):
        is_chap = bool(raw.get("is_chapter"))
        orig_code = str(raw.get("code") or "").strip()
        cov_code = str(raw.get("cov_par") or "").strip()
        desc = str(raw.get("description") or "").strip()
        unit = str(raw.get("unit") or "").strip()
        qty = float(raw.get("quantity") or 0.0)
        perf = float(raw.get("performance") if raw.get("performance") is not None else 1.0)
        imp_unit_price = float(raw.get("imported_unit_price") or 0.0)

        if is_chap:
            chap_item = ReviewItem(
                snapshot_id=snapshot.id,
                row_number=int(raw.get("row") or idx),
                sheet_name=raw.get("sheet_name"),
                original_code=orig_code,
                normalized_code=orig_code.upper(),
                description=desc,
                unit="",
                quantity=0.0,
                performance=1.0,
                is_chapter=True,
                is_uncoded=False,
                origin_source="CHAPTER",
            )
            db.add(chap_item)
            continue

        non_chapter_count += 1
        uncoded_flag = is_uncoded_code(orig_code, cov_code)
        master_item, master_recipe = (
            (None, None)
            if uncoded_flag
            else _fetch_master_item_and_recipe(db, schema, orig_code, cov_code)
        )

        suggested_code: Optional[str] = None
        suggested_desc: Optional[str] = None
        suggested_score: Optional[float] = None

        if not master_item:
            uncoded_count += 1
            uncoded_flag = True
            origin_src = "SIN_CODIGO_COVENIN"
            candidates = raw.get("candidates") or []
            if not candidates and desc:
                try:
                    candidates = find_candidates(db, orig_code, desc, unit, limit=3)
                except Exception as exc:
                    logger.error("Error buscando candidatos equivalentes: %s", exc, exc_info=True)
                    candidates = []
            if candidates:
                best = candidates[0]
                suggested_code = str(best.get("cod_par") or "")
                suggested_desc = str(best.get("description") or "")
                suggested_score = float(best.get("score") or 0.0)
        else:
            coded_count += 1
            uncoded_flag = False
            origin_src = classify_costbase_item_origin(
                master_item["cod_par"], master_item.get("cov_par")
            )

        # Normalizar componentes del APU y cruzar con ref_code / receta maestra
        mst_mat_map = {
            m["code"]: m for m in (master_recipe.get("materials") if master_recipe else [])
        }
        mst_eq_map = {
            e["code"]: e for e in (master_recipe.get("equipments") if master_recipe else [])
        }
        mst_lab_map = {
            l_row["code"]: l_row for l_row in (master_recipe.get("labors") if master_recipe else [])
        }

        norm_mats: List[Dict[str, Any]] = []
        for m in (raw.get("materials") or []):
            c_raw = str(m.get("codigo") or m.get("code") or "").strip().upper()
            resolved = ref_maps["material"].get(c_raw, c_raw)
            m_mst = mst_mat_map.get(resolved)
            norm_mats.append({
                "component_type": "material",
                "code": c_raw,
                "resolved_master_code": resolved,
                "description": str(m.get("descripcion") or m.get("description") or ""),
                "unit": str(m.get("unidad") or m.get("unit") or "und"),
                "quantity": float(m.get("cantidad") if m.get("cantidad") is not None else (m.get("quantity") or 0.0)),
                "master_quantity": float(m_mst["quantity"]) if m_mst else None,
                "unit_price": float(m.get("precio_unitario") if m.get("precio_unitario") is not None else (m.get("unit_price") or 0.0)),
                "master_unit_price": float(m_mst["unit_price"]) if m_mst else None,
                "waste_or_deprec": float(m.get("desperdicio") if m.get("desperdicio") is not None else 0.0),
                "master_waste_or_deprec": float(m_mst["waste_or_deprec"]) if m_mst else None,
                "bonus": 0.0,
            })

        norm_eqs: List[Dict[str, Any]] = []
        for e in (raw.get("equipments") or []):
            c_raw = str(e.get("codigo") or e.get("code") or "").strip().upper()
            resolved = ref_maps["equipment"].get(c_raw, c_raw)
            e_mst = mst_eq_map.get(resolved)
            norm_eqs.append({
                "component_type": "equipment",
                "code": c_raw,
                "resolved_master_code": resolved,
                "description": str(e.get("descripcion") or e.get("description") or ""),
                "unit": str(e.get("unidad") or e.get("unit") or "día"),
                "quantity": float(e.get("cantidad") if e.get("cantidad") is not None else (e.get("quantity") or 0.0)),
                "master_quantity": float(e_mst["quantity"]) if e_mst else None,
                "unit_price": float(e.get("precio_unitario") if e.get("precio_unitario") is not None else (e.get("unit_price") or 0.0)),
                "master_unit_price": float(e_mst["unit_price"]) if e_mst else None,
                "waste_or_deprec": float(e.get("depreciacion") if e.get("depreciacion") is not None else 1.0),
                "master_waste_or_deprec": float(e_mst["waste_or_deprec"]) if e_mst else None,
                "bonus": 0.0,
            })

        norm_labs: List[Dict[str, Any]] = []
        for l_row in (raw.get("labors") or []):
            c_raw = str(l_row.get("codigo") or l_row.get("code") or "").strip().upper()
            resolved = ref_maps["labor"].get(c_raw, c_raw)
            l_mst = mst_lab_map.get(resolved)
            norm_labs.append({
                "component_type": "labor",
                "code": c_raw,
                "resolved_master_code": resolved,
                "description": str(l_row.get("descripcion") or l_row.get("description") or ""),
                "unit": "día",
                "quantity": float(l_row.get("cantidad") if l_row.get("cantidad") is not None else (l_row.get("quantity") or 0.0)),
                "master_quantity": float(l_mst["quantity"]) if l_mst else None,
                "unit_price": float(l_row.get("jornal") if l_row.get("jornal") is not None else (l_row.get("unit_price") or 0.0)),
                "master_unit_price": float(l_mst["unit_price"]) if l_mst else None,
                "waste_or_deprec": 0.0,
                "master_waste_or_deprec": 0.0,
                "bonus": float(l_row.get("bono") if l_row.get("bono") is not None else (l_row.get("bonus") or 0.0)),
            })

        calc_breakdown = calculate_apu_unit_price(
            performance=perf,
            materials=norm_mats,
            equipments=norm_eqs,
            labors=norm_labs,
            fcas_percent=fcas_pct,
            admin_percent=admin_pct,
            profit_percent=profit_pct,
        )
        calc_unit_price = calc_breakdown["unit_price"]
        if imp_unit_price <= 0 and calc_unit_price > 0:
            imp_unit_price = calc_unit_price

        master_calc_price: Optional[float] = None
        if master_item and master_recipe:
            mst_breakdown = calculate_apu_unit_price(
                performance=float(master_item["performance"] or 1.0),
                materials=master_recipe["materials"],
                equipments=master_recipe["equipments"],
                labors=master_recipe["labors"],
                fcas_percent=fcas_pct,
                admin_percent=admin_pct,
                profit_percent=profit_pct,
            )
            master_calc_price = mst_breakdown["unit_price"] or float(master_item.get("unit_price") or 0.0)
            master_item["unit_price"] = master_calc_price

        desc_sim = (
            compute_description_similarity(desc, master_item["description"])
            if master_item
            else (suggested_score or 0.0)
        )

        rev_item = ReviewItem(
            snapshot_id=snapshot.id,
            row_number=int(raw.get("row") or idx),
            sheet_name=raw.get("sheet_name"),
            original_code=orig_code,
            normalized_code=orig_code.upper(),
            covenin_code=cov_code or (master_item.get("cov_par") if master_item else None),
            matched_master_code=master_item["cod_par"] if master_item else None,
            origin_source=origin_src,
            description=desc,
            master_description=master_item["description"] if master_item else None,
            description_similarity=desc_sim,
            unit=unit,
            master_unit=master_item["unit"] if master_item else None,
            quantity=qty,
            performance=perf,
            master_performance=master_item["performance"] if master_item else None,
            imported_unit_price=imp_unit_price,
            calculated_unit_price=calc_unit_price,
            master_unit_price=master_calc_price,
            is_chapter=False,
            is_uncoded=uncoded_flag,
            suggested_equivalent_code=suggested_code,
            suggested_equivalent_desc=suggested_desc,
            suggested_equivalent_score=suggested_score,
        )
        db.add(rev_item)
        db.flush()

        seen_mat_codes = {c["resolved_master_code"] for c in norm_mats if c["resolved_master_code"]}
        seen_eq_codes = {c["resolved_master_code"] for c in norm_eqs if c["resolved_master_code"]}
        seen_lab_codes = {c["resolved_master_code"] for c in norm_labs if c["resolved_master_code"]}

        omitted_master_comps: List[Dict[str, Any]] = []
        if (norm_mats or norm_eqs or norm_labs) and master_recipe:
            for m_code, m_mst in mst_mat_map.items():
                if m_code not in seen_mat_codes:
                    omitted_master_comps.append({
                        "component_type": "material",
                        "code": "OMITIDO",
                        "resolved_master_code": m_code,
                        "description": str(m_mst.get("description") or ""),
                        "unit": str(m_mst.get("unit") or "und"),
                        "quantity": 0.0,
                        "master_quantity": float(m_mst.get("quantity") or 0.0),
                        "unit_price": 0.0,
                        "master_unit_price": float(m_mst.get("unit_price") or 0.0),
                        "waste_or_deprec": 0.0,
                        "master_waste_or_deprec": float(m_mst.get("waste_or_deprec") or 0.0),
                        "bonus": 0.0,
                    })
            for e_code, e_mst in mst_eq_map.items():
                if e_code not in seen_eq_codes:
                    omitted_master_comps.append({
                        "component_type": "equipment",
                        "code": "OMITIDO",
                        "resolved_master_code": e_code,
                        "description": str(e_mst.get("description") or ""),
                        "unit": str(e_mst.get("unit") or "día"),
                        "quantity": 0.0,
                        "master_quantity": float(e_mst.get("quantity") or 0.0),
                        "unit_price": 0.0,
                        "master_unit_price": float(e_mst.get("unit_price") or 0.0),
                        "waste_or_deprec": 0.0,
                        "master_waste_or_deprec": float(e_mst.get("waste_or_deprec") or 1.0),
                        "bonus": 0.0,
                    })
            for l_code, l_mst in mst_lab_map.items():
                if l_code not in seen_lab_codes:
                    omitted_master_comps.append({
                        "component_type": "labor",
                        "code": "OMITIDO",
                        "resolved_master_code": l_code,
                        "description": str(l_mst.get("description") or ""),
                        "unit": "día",
                        "quantity": 0.0,
                        "master_quantity": float(l_mst.get("quantity") or 0.0),
                        "unit_price": 0.0,
                        "master_unit_price": float(l_mst.get("unit_price") or 0.0),
                        "waste_or_deprec": 0.0,
                        "master_waste_or_deprec": 0.0,
                        "bonus": 0.0,
                    })

        for comp_dict in (norm_mats + norm_eqs + norm_labs + omitted_master_comps):
            db.add(
                ReviewAPUComponent(
                    review_item_id=rev_item.id,
                    component_type=comp_dict["component_type"],
                    code=comp_dict["code"],
                    resolved_master_code=comp_dict["resolved_master_code"],
                    description=comp_dict["description"],
                    unit=comp_dict["unit"],
                    quantity=comp_dict["quantity"],
                    master_quantity=comp_dict["master_quantity"],
                    unit_price=comp_dict["unit_price"],
                    master_unit_price=comp_dict["master_unit_price"],
                    waste_or_deprec=comp_dict["waste_or_deprec"],
                    master_waste_or_deprec=comp_dict["master_waste_or_deprec"],
                    bonus=comp_dict["bonus"],
                )
            )

        item_eval_payload = {
            "original_code": orig_code,
            "description": desc,
            "unit": unit,
            "quantity": qty,
            "performance": perf,
            "imported_unit_price": float(raw.get("imported_unit_price") or 0.0),
            "calculated_unit_price": calc_unit_price,
            "suggested_equivalent_code": suggested_code,
            "suggested_equivalent_desc": suggested_desc,
            "suggested_equivalent_score": suggested_score,
            "materials": norm_mats,
            "equipments": norm_eqs,
            "labors": norm_labs,
        }

        item_findings = evaluate_item_audit_rules(
            item_data=item_eval_payload,
            master_item=master_item,
            master_recipe=master_recipe,
            fcas_percent=fcas_pct,
            admin_percent=admin_pct,
            profit_percent=profit_pct,
        )

        if orig_code and code_occurrences.get(orig_code.upper(), 0) > 1:
            item_findings.append({
                "rule_id": "EST-007",
                "category": "ESTRUCTURA",
                "severity": "MEDIA",
                "item_code": orig_code,
                "field_name": "duplicate_partida",
                "imported_value": f"{code_occurrences[orig_code.upper()]} partidas con código {orig_code}",
                "master_value": "Código único o subcapítulo diferenciado",
                "diff_percent": None,
                "message": f"El código de partida '{orig_code}' aparece {code_occurrences[orig_code.upper()]} veces en el presupuesto.",
                "suggestion": "Verificar si la partida fue duplicada accidentalmente en varios capítulos.",
            })

        for f_dict in item_findings:
            db.add(
                ReviewFinding(
                    snapshot_id=snapshot.id,
                    review_item_id=rev_item.id,
                    rule_id=f_dict["rule_id"],
                    category=f_dict["category"],
                    severity=f_dict["severity"],
                    item_code=f_dict.get("item_code") or orig_code,
                    component_code=f_dict.get("component_code"),
                    component_description=f_dict.get("component_description"),
                    field_name=f_dict.get("field_name") or "",
                    imported_value=f_dict.get("imported_value"),
                    master_value=f_dict.get("master_value"),
                    diff_percent=f_dict.get("diff_percent"),
                    message=f_dict["message"],
                    suggestion=f_dict.get("suggestion"),
                )
            )
            all_findings_dicts.append(f_dict)

    sev_counts = Counter(f["severity"] for f in all_findings_dicts)
    snapshot.total_items = non_chapter_count
    snapshot.coded_items_count = coded_count
    snapshot.uncoded_items_count = uncoded_count
    snapshot.critical_findings_count = sev_counts.get("CRITICA", 0)
    snapshot.high_findings_count = sev_counts.get("ALTA", 0)
    snapshot.medium_findings_count = sev_counts.get("MEDIA", 0)
    snapshot.info_findings_count = sev_counts.get("INFO_MAPREX", 0)
    snapshot.health_score = compute_snapshot_health_score(all_findings_dicts, non_chapter_count)

    db.commit()
    db.refresh(snapshot)
    return snapshot


def audit_existing_budget(
    db: Session,
    user_id: str,
    budget_id: str,
    database_id: str = "master",
    parent_snapshot_id: Optional[str] = None,
    custom_name: Optional[str] = None,
    project_name: Optional[str] = None,
    client_name: Optional[str] = None,
    auditor_notes: Optional[str] = None,
) -> ReviewSnapshot:
    """Crea un snapshot inmutable de un presupuesto existente en CostBase y ejecuta la auditoría completa."""
    if not budget_id or not budget_id.strip():
        raise ValueError("El budget_id es obligatorio.")

    budget: Optional[Budget] = (
        db.query(Budget)
        .options(
            selectinload(Budget.items).selectinload(BudgetItem.materials),
            selectinload(Budget.items).selectinload(BudgetItem.equipments),
            selectinload(Budget.items).selectinload(BudgetItem.labors),
        )
        .filter(Budget.id == budget_id.strip())
        .first()
    )
    if not budget:
        raise LookupError(f"Presupuesto '{budget_id}' no encontrado.")

    header_info = {
        "source_type": "existing_budget",
        "source_budget_id": budget.id,
        "source_filename": None,
        "parent_snapshot_id": parent_snapshot_id,
        "custom_name_provided": bool(custom_name and custom_name.strip()),
        "name": (custom_name.strip() if custom_name and custom_name.strip() else budget.name),
        "project_name": (project_name.strip() if project_name and project_name.strip() else budget.project_name),
        "client_name": (client_name.strip() if client_name and client_name.strip() else budget.client_name),
        "auditor_notes": auditor_notes,
        "currency": budget.currency or "USD",
        "fcas_percent": budget.fcas_percent,
        "admin_percent": budget.admin_percent,
        "profit_percent": budget.profit_percent,
        "iva_percent": budget.iva_percent,
    }

    raw_items: List[Dict[str, Any]] = []
    for idx, item in enumerate(budget.items, start=1):
        raw_items.append({
            "row": idx,
            "code": item.cod_par or "",
            "cov_par": item.cov_par or "",
            "description": item.description or "",
            "unit": item.unit or "",
            "quantity": float(item.quantity or 0.0),
            "performance": float(item.performance or 1.0),
            "is_chapter": bool(item.is_chapter),
            "materials": [
                {
                    "codigo": m.codigo,
                    "descripcion": m.descripcion,
                    "unidad": m.unidad,
                    "precio_unitario": m.precio_unitario,
                    "cantidad": m.cantidad,
                    "desperdicio": m.desperdicio,
                }
                for m in (item.materials or [])
            ],
            "equipments": [
                {
                    "codigo": e.codigo,
                    "descripcion": e.descripcion,
                    "unidad": e.unidad,
                    "precio_unitario": e.precio_unitario,
                    "cantidad": e.cantidad,
                    "depreciacion": e.depreciacion,
                }
                for e in (item.equipments or [])
            ],
            "labors": [
                {
                    "codigo": l_row.codigo,
                    "descripcion": l_row.descripcion,
                    "cantidad": l_row.cantidad,
                    "jornal": l_row.jornal,
                    "bono": l_row.bono,
                }
                for l_row in (item.labors or [])
            ],
        })

    return _execute_snapshot_audit(
        db=db,
        user_id=user_id,
        header_info=header_info,
        raw_items=raw_items,
        database_id=database_id,
    )


def audit_uploaded_file(
    db: Session,
    user_id: str,
    file_bytes: bytes,
    filename: str,
    database_id: str = "master",
    parent_snapshot_id: Optional[str] = None,
    custom_name: Optional[str] = None,
    project_name: Optional[str] = None,
    client_name: Optional[str] = None,
    auditor_notes: Optional[str] = None,
) -> ReviewSnapshot:
    """Importa un archivo externo (Excel APU, Excel presupuesto, CSV o PDF) a la base de revisión y lo audita."""
    if not file_bytes:
        raise ValueError("El archivo subido está vacío.")
    if not filename:
        raise ValueError("El nombre del archivo es requerido.")

    preview = build_preview(file_bytes, filename, db, mode="budget")
    hdr = preview.get("header") or {}
    header_info = {
        "source_type": preview.get("source_type") or "file",
        "source_budget_id": None,
        "source_filename": filename,
        "parent_snapshot_id": parent_snapshot_id,
        "custom_name_provided": bool(custom_name and custom_name.strip()),
        "name": (custom_name.strip() if custom_name and custom_name.strip() else (hdr.get("budget_name") or filename)),
        "project_name": (project_name.strip() if project_name and project_name.strip() else hdr.get("project_name")),
        "client_name": (client_name.strip() if client_name and client_name.strip() else hdr.get("client_name")),
        "auditor_notes": auditor_notes,
        "currency": hdr.get("currency") or "USD",
        "fcas_percent": hdr.get("fcas_percent") if hdr.get("fcas_percent") is not None else 417.0,
        "admin_percent": hdr.get("admin_percent") if hdr.get("admin_percent") is not None else 15.0,
        "profit_percent": hdr.get("profit_percent") if hdr.get("profit_percent") is not None else 10.0,
        "iva_percent": hdr.get("iva_percent") if hdr.get("iva_percent") is not None else 16.0,
    }

    raw_items: List[Dict[str, Any]] = []
    for idx, it in enumerate(preview.get("items") or [], start=1):
        raw_items.append({
            "row": it.get("row") or idx,
            "sheet_name": it.get("sheet_name"),
            "code": it.get("code") or "",
            "cov_par": it.get("cov_par") or "",
            "description": it.get("description") or "",
            "unit": it.get("unit") or "",
            "quantity": float(it.get("quantity") or 0.0),
            "performance": float(it.get("performance") if it.get("performance") is not None else 1.0),
            "imported_unit_price": float(it.get("unit_price") or 0.0),
            "is_chapter": bool(it.get("is_chapter")),
            "candidates": it.get("candidates") or [],
            "materials": it.get("materials") or [],
            "equipments": it.get("equipments") or [],
            "labors": it.get("labors") or [],
        })

    return _execute_snapshot_audit(
        db=db,
        user_id=user_id,
        header_info=header_info,
        raw_items=raw_items,
        database_id=database_id,
    )


def list_review_snapshots(db: Session, user_id: str, limit: int = 100) -> List[ReviewSnapshot]:
    """Lista las auditorías del usuario ordenadas por fecha de actualización."""
    ensure_review_tables()
    return (
        db.query(ReviewSnapshot)
        .filter(ReviewSnapshot.user_id == str(user_id))
        .order_by(ReviewSnapshot.created_at.desc())
        .limit(limit)
        .all()
    )


def _finding_signature(f: ReviewFinding) -> str:
    """Genera una firma determinista para comparar un hallazgo entre versiones sucesivas."""
    return f"{f.rule_id}|{str(f.item_code or '').upper()}|{str(f.component_code or '').upper()}|{str(f.field_name or '').lower()}"


def _compute_version_comparison(
    current_snap: ReviewSnapshot, parent_snap: ReviewSnapshot
) -> Dict[str, Any]:
    """Compara los hallazgos de la versión actual frente a la versión anterior para detectar correcciones."""
    parent_map: Dict[str, ReviewFinding] = {
        _finding_signature(pf): pf for pf in (parent_snap.findings or [])
    }
    current_map: Dict[str, ReviewFinding] = {
        _finding_signature(cf): cf for cf in (current_snap.findings or [])
    }

    resolved_keys = [k for k in parent_map if k not in current_map]
    persistent_keys = [k for k in current_map if k in parent_map]
    new_keys = [k for k in current_map if k not in parent_map]

    resolved_findings = [
        {
            "rule_id": parent_map[k].rule_id,
            "category": parent_map[k].category,
            "severity": parent_map[k].severity,
            "item_code": parent_map[k].item_code,
            "component_code": parent_map[k].component_code,
            "component_description": parent_map[k].component_description,
            "field_name": parent_map[k].field_name,
            "previous_imported_value": parent_map[k].imported_value,
            "master_value": parent_map[k].master_value,
            "message": parent_map[k].message,
        }
        for k in resolved_keys
    ]

    return {
        "previous_snapshot_id": parent_snap.id,
        "previous_version_number": int(parent_snap.version_number or 1),
        "previous_name": parent_snap.name,
        "previous_health_score": float(parent_snap.health_score or 0.0),
        "health_delta": round(float(current_snap.health_score or 0.0) - float(parent_snap.health_score or 0.0), 1),
        "resolved_findings_count": len(resolved_keys),
        "persistent_findings_count": len(persistent_keys),
        "new_findings_count": len(new_keys),
        "resolved_findings": resolved_findings,
        "persistent_keys": persistent_keys,
        "new_keys": new_keys,
    }


def get_review_snapshot_detail(db: Session, snapshot_id: str, user_id: str) -> Dict[str, Any]:
    """Obtiene el detalle completo de un snapshot de auditoría con desgloses estadísticos y versiones."""
    if not snapshot_id:
        raise ValueError("El snapshot_id es obligatorio.")
    ensure_review_tables()

    snap: Optional[ReviewSnapshot] = (
        db.query(ReviewSnapshot)
        .options(
            selectinload(ReviewSnapshot.items).selectinload(ReviewItem.components),
            selectinload(ReviewSnapshot.items).selectinload(ReviewItem.findings),
            selectinload(ReviewSnapshot.findings),
        )
        .filter(ReviewSnapshot.id == snapshot_id)
        .first()
    )
    if not snap:
        raise LookupError("Auditoría no encontrada.")

    origin_counts = Counter(
        it.origin_source or "OTRO"
        for it in snap.items
        if not it.is_chapter
    )
    category_counts = Counter(f.category for f in snap.findings)

    group_id = snap.audit_group_id or snap.id
    version_history = (
        db.query(ReviewSnapshot)
        .filter(
            (ReviewSnapshot.audit_group_id == group_id)
            | (ReviewSnapshot.id == group_id)
        )
        .order_by(ReviewSnapshot.version_number.asc(), ReviewSnapshot.created_at.asc())
        .all()
    )

    version_comparison: Optional[Dict[str, Any]] = None
    if snap.parent_snapshot_id:
        parent_snap = (
            db.query(ReviewSnapshot)
            .options(selectinload(ReviewSnapshot.findings))
            .filter(ReviewSnapshot.id == snap.parent_snapshot_id)
            .first()
        )
        if parent_snap:
            version_comparison = _compute_version_comparison(snap, parent_snap)

    return {
        "id": snap.id,
        "name": snap.name,
        "project_name": snap.project_name,
        "client_name": snap.client_name,
        "source_type": snap.source_type,
        "source_filename": snap.source_filename,
        "source_budget_id": snap.source_budget_id,
        "database_id": snap.database_id,
        "currency": snap.currency,
        "audit_group_id": group_id,
        "parent_snapshot_id": snap.parent_snapshot_id,
        "version_number": int(snap.version_number or 1),
        "review_status": snap.review_status or "EN_REVISION",
        "auditor_notes": snap.auditor_notes,
        "fcas_percent": snap.fcas_percent,
        "admin_percent": snap.admin_percent,
        "profit_percent": snap.profit_percent,
        "iva_percent": snap.iva_percent,
        "total_items": snap.total_items,
        "coded_items_count": snap.coded_items_count,
        "uncoded_items_count": snap.uncoded_items_count,
        "critical_findings_count": snap.critical_findings_count,
        "high_findings_count": snap.high_findings_count,
        "medium_findings_count": snap.medium_findings_count,
        "info_findings_count": snap.info_findings_count,
        "health_score": snap.health_score,
        "created_at": snap.created_at,
        "updated_at": snap.updated_at or snap.created_at,
        "origin_breakdown": dict(origin_counts),
        "category_breakdown": dict(category_counts),
        "version_history": version_history,
        "version_comparison": version_comparison,
        "items": snap.items,
        "findings": snap.findings,
    }


def update_review_snapshot(
    db: Session,
    snapshot_id: str,
    user_id: str,
    name: Optional[str] = None,
    project_name: Optional[str] = None,
    client_name: Optional[str] = None,
    review_status: Optional[str] = None,
    auditor_notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Guarda cambios de metadatos, estado y observaciones del auditor sobre una auditoría existente."""
    if not snapshot_id:
        raise ValueError("El snapshot_id es obligatorio.")
    ensure_review_tables()
    snap = db.query(ReviewSnapshot).filter(ReviewSnapshot.id == snapshot_id).first()
    if not snap:
        raise LookupError("Auditoría no encontrada.")

    if name is not None and name.strip():
        snap.name = name.strip()
    if project_name is not None:
        snap.project_name = project_name.strip() or None
    if client_name is not None:
        snap.client_name = client_name.strip() or None
    if review_status is not None and review_status.strip():
        snap.review_status = review_status.strip().upper()
    if auditor_notes is not None:
        snap.auditor_notes = auditor_notes

    snap.updated_at = datetime.utcnow()
    db.commit()
    return get_review_snapshot_detail(db=db, snapshot_id=snap.id, user_id=user_id)


def clone_review_snapshot(
    db: Session,
    snapshot_id: str,
    user_id: str,
    new_name: str,
    project_name: Optional[str] = None,
    client_name: Optional[str] = None,
    review_status: Optional[str] = "EN_REVISION",
    auditor_notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Guardar Como: crea una copia independiente completa de la auditoría actual con otro nombre."""
    if not snapshot_id:
        raise ValueError("El snapshot_id es obligatorio.")
    if not new_name or not new_name.strip():
        raise ValueError("El nuevo nombre de la auditoría es obligatorio.")
    ensure_review_tables()

    source: Optional[ReviewSnapshot] = (
        db.query(ReviewSnapshot)
        .options(
            selectinload(ReviewSnapshot.items).selectinload(ReviewItem.components),
            selectinload(ReviewSnapshot.items).selectinload(ReviewItem.findings),
            selectinload(ReviewSnapshot.findings),
        )
        .filter(ReviewSnapshot.id == snapshot_id)
        .first()
    )
    if not source:
        raise LookupError("Auditoría origen no encontrada.")

    new_id = str(uuid.uuid4())
    cloned = ReviewSnapshot(
        id=new_id,
        user_id=str(user_id),
        source_type=source.source_type,
        source_budget_id=source.source_budget_id,
        source_filename=source.source_filename,
        database_id=source.database_id,
        name=new_name.strip(),
        project_name=project_name.strip() if project_name is not None else source.project_name,
        client_name=client_name.strip() if client_name is not None else source.client_name,
        currency=source.currency,
        audit_group_id=new_id,
        parent_snapshot_id=None,
        version_number=1,
        review_status=(review_status or "EN_REVISION").strip().upper(),
        auditor_notes=auditor_notes if auditor_notes is not None else source.auditor_notes,
        fcas_percent=source.fcas_percent,
        admin_percent=source.admin_percent,
        profit_percent=source.profit_percent,
        iva_percent=source.iva_percent,
        total_items=source.total_items,
        coded_items_count=source.coded_items_count,
        uncoded_items_count=source.uncoded_items_count,
        critical_findings_count=source.critical_findings_count,
        high_findings_count=source.high_findings_count,
        medium_findings_count=source.medium_findings_count,
        info_findings_count=source.info_findings_count,
        health_score=source.health_score,
    )
    db.add(cloned)
    db.flush()

    item_id_map: Dict[str, str] = {}
    for it in source.items:
        new_item_id = str(uuid.uuid4())
        item_id_map[it.id] = new_item_id
        cloned_item = ReviewItem(
            id=new_item_id,
            snapshot_id=cloned.id,
            row_number=it.row_number,
            sheet_name=it.sheet_name,
            original_code=it.original_code,
            normalized_code=it.normalized_code,
            covenin_code=it.covenin_code,
            matched_master_code=it.matched_master_code,
            origin_source=it.origin_source,
            description=it.description,
            master_description=it.master_description,
            description_similarity=it.description_similarity,
            unit=it.unit,
            master_unit=it.master_unit,
            quantity=it.quantity,
            performance=it.performance,
            master_performance=it.master_performance,
            imported_unit_price=it.imported_unit_price,
            calculated_unit_price=it.calculated_unit_price,
            master_unit_price=it.master_unit_price,
            is_chapter=it.is_chapter,
            is_uncoded=it.is_uncoded,
            suggested_equivalent_code=it.suggested_equivalent_code,
            suggested_equivalent_desc=it.suggested_equivalent_desc,
            suggested_equivalent_score=it.suggested_equivalent_score,
        )
        db.add(cloned_item)
        db.flush()

        for comp in it.components:
            db.add(
                ReviewAPUComponent(
                    id=str(uuid.uuid4()),
                    review_item_id=cloned_item.id,
                    component_type=comp.component_type,
                    code=comp.code,
                    resolved_master_code=comp.resolved_master_code,
                    description=comp.description,
                    unit=comp.unit,
                    quantity=comp.quantity,
                    master_quantity=comp.master_quantity,
                    unit_price=comp.unit_price,
                    master_unit_price=comp.master_unit_price,
                    waste_or_deprec=comp.waste_or_deprec,
                    master_waste_or_deprec=comp.master_waste_or_deprec,
                    bonus=comp.bonus,
                )
            )

    for f in source.findings:
        db.add(
            ReviewFinding(
                snapshot_id=cloned.id,
                review_item_id=item_id_map.get(f.review_item_id or "") if f.review_item_id else None,
                rule_id=f.rule_id,
                category=f.category,
                severity=f.severity,
                item_code=f.item_code,
                component_code=f.component_code,
                component_description=f.component_description,
                field_name=f.field_name,
                imported_value=f.imported_value,
                master_value=f.master_value,
                diff_percent=f.diff_percent,
                message=f.message,
                suggestion=f.suggestion,
                finding_status=f.finding_status or "PENDIENTE",
                auditor_comment=f.auditor_comment,
            )
        )

    db.commit()
    return get_review_snapshot_detail(db=db, snapshot_id=cloned.id, user_id=user_id)


def update_review_finding(
    db: Session,
    snapshot_id: str,
    finding_id: int,
    user_id: str,
    finding_status: str,
    auditor_comment: Optional[str] = None,
) -> ReviewFinding:
    """Actualiza el estado de un hallazgo puntual (PENDIENTE, CORREGIDO, JUSTIFICADO, RECHAZADO) y su nota."""
    ensure_review_tables()
    finding = (
        db.query(ReviewFinding)
        .filter(
            ReviewFinding.id == int(finding_id),
            ReviewFinding.snapshot_id == str(snapshot_id),
        )
        .first()
    )
    if not finding:
        raise LookupError("Hallazgo no encontrado.")
    finding.finding_status = (finding_status or "PENDIENTE").strip().upper()
    if auditor_comment is not None:
        finding.auditor_comment = auditor_comment
    db.commit()
    db.refresh(finding)
    return finding


def delete_review_snapshot(db: Session, snapshot_id: str, user_id: str) -> None:
    """Elimina un snapshot de auditoría."""
    ensure_review_tables()
    snap = db.query(ReviewSnapshot).filter(ReviewSnapshot.id == snapshot_id).first()
    if not snap:
        raise LookupError("Auditoría no encontrada.")
    db.delete(snap)
    db.commit()


def export_audit_report_excel(db: Session, snapshot_id: str, user_id: str) -> Tuple[bytes, str]:
    """Genera un archivo Excel (.xlsx) profesional con las hojas del Informe de Auditoría de Presupuesto."""
    detail = get_review_snapshot_detail(db, snapshot_id, user_id)
    wb = Workbook()

    header_fill = PatternFill("solid", fgColor="0A4275")
    header_font = Font(color="FFFFFF", bold=True, size=10)
    crit_fill = PatternFill("solid", fgColor="FEE2E2")
    high_fill = PatternFill("solid", fgColor="FFEDD5")
    info_fill = PatternFill("solid", fgColor="E0F2FE")
    resolved_fill = PatternFill("solid", fgColor="DCFCE7")

    def style_header_row(ws: Any, row_idx: int = 1) -> None:
        for cell in ws[row_idx]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    # 1. Hoja Resumen Ejecutivo
    ws_sum = wb.active
    ws_sum.title = "Resumen Ejecutivo"
    ws_sum.append(["Campo / Indicador", "Valor"])
    style_header_row(ws_sum, 1)
    summary_rows = [
        ("Nombre de la Auditoría", detail["name"]),
        ("Versión del Expediente", f"v{detail['version_number']}"),
        ("Estado de Revisión", detail["review_status"]),
        ("Obra / Proyecto", detail["project_name"] or "-"),
        ("Empresa / Contratista", detail["client_name"] or "-"),
        ("Fuente de Auditoría", detail["source_filename"] or f"Presupuesto CostBase ({detail['source_budget_id']})"),
        ("Base de Datos de Referencia", detail["database_id"]),
        ("Moneda", detail["currency"]),
        ("Puntaje de Salud (0 - 100)", detail["health_score"]),
        ("Total Partidas Auditadas", detail["total_items"]),
        ("Partidas Codificadas en Base", detail["coded_items_count"]),
        ("Partidas Sin Código COVENIN (S/C)", detail["uncoded_items_count"]),
        ("Hallazgos Severidad CRÍTICA", detail["critical_findings_count"]),
        ("Hallazgos Severidad ALTA", detail["high_findings_count"]),
        ("Hallazgos Severidad MEDIA", detail["medium_findings_count"]),
        ("Diferencias de Catálogo Histórico (INFO)", detail["info_findings_count"]),
        ("Observaciones del Auditor", detail["auditor_notes"] or "-"),
    ]
    if detail.get("version_comparison"):
        vc = detail["version_comparison"]
        summary_rows.extend([
            ("Comparado contra Versión Anterior", f"v{vc['previous_version_number']} ({vc['previous_name']})"),
            ("Evolución Índice de Salud", f"{vc['previous_health_score']}% -> {detail['health_score']}% ({vc['health_delta']:+.1f}%)"),
            ("Hallazgos Corregidos / Subsanados", vc["resolved_findings_count"]),
            ("Hallazgos Persistentes", vc["persistent_findings_count"]),
            ("Hallazgos Nuevos en esta Versión", vc["new_findings_count"]),
        ])
    for k, v in summary_rows:
        ws_sum.append([str(k), str(v) if v is not None else "-"])
    ws_sum.column_dimensions["A"].width = 42
    ws_sum.column_dimensions["B"].width = 60

    # 2. Hoja Hallazgos de Auditoría
    ws_find = wb.create_sheet("Hallazgos de Auditoria")
    ws_find.append([
        "Severidad",
        "Estado Hallazgo",
        "Regla",
        "Categoría",
        "Código Partida",
        "Código Insumo",
        "Descripción Insumo",
        "Campo Auditado",
        "Valor Presupuesto",
        "Valor Base Referencia",
        "% Diferencia",
        "Diagnóstico",
        "Sugerencia Técnica",
        "Comentario Auditor",
    ])
    style_header_row(ws_find, 1)
    for f in detail["findings"]:
        sev_label = "CAT_HISTORICO" if f.severity == "INFO_MAPREX" else f.severity
        ws_find.append([
            sev_label,
            getattr(f, "finding_status", None) or "PENDIENTE",
            f.rule_id,
            f.category,
            f.item_code,
            f.component_code or "-",
            f.component_description or "-",
            f.field_name,
            f.imported_value or "-",
            f.master_value or "-",
            f"{f.diff_percent:+.2f}%" if f.diff_percent is not None else "-",
            f.message,
            f.suggestion or "-",
            getattr(f, "auditor_comment", None) or "-",
        ])
        row_cells = ws_find[ws_find.max_row]
        if f.severity == "CRITICA":
            for c in row_cells[:4]:
                c.fill = crit_fill
        elif f.severity == "ALTA":
            for c in row_cells[:4]:
                c.fill = high_fill
        elif f.severity == "INFO_MAPREX":
            for c in row_cells[:4]:
                c.fill = info_fill

    for idx, width in enumerate([15, 15, 10, 16, 16, 16, 38, 16, 20, 22, 14, 65, 55, 40], start=1):
        ws_find.column_dimensions[get_column_letter(idx)].width = width
    ws_find.freeze_panes = "A2"

    # 3. Hoja Partidas con Discrepancias (Solo partidas con hallazgos)
    ws_items = wb.create_sheet("Partidas con Discrepancias")
    ws_items.append([
        "Fila",
        "N° Discrepancias",
        "Código Presupuesto",
        "Código Base",
        "Origen Catalográfico",
        "Unidad Imp.",
        "Unidad Base",
        "Cantidad",
        "Rend. Importado",
        "Rend. Base",
        "P.U. Calculado",
        "P.U. Base Ref.",
        "Similitud Desc. %",
        "Descripción Presupuesto",
    ])
    style_header_row(ws_items, 1)
    for it in detail["items"]:
        if it.is_chapter or not it.findings:
            continue
        ws_items.append([
            it.row_number,
            len(it.findings),
            it.original_code,
            it.matched_master_code or "S/C",
            it.origin_source or "-",
            it.unit,
            it.master_unit or "-",
            it.quantity,
            it.performance,
            it.master_performance if it.master_performance is not None else "-",
            round(it.calculated_unit_price, 2),
            round(it.master_unit_price, 2) if it.master_unit_price is not None else "-",
            round(it.description_similarity * 100.0, 1),
            it.description,
        ])
    for idx, width in enumerate([7, 15, 16, 16, 26, 12, 14, 12, 15, 15, 15, 15, 16, 70], start=1):
        ws_items.column_dimensions[get_column_letter(idx)].width = width
    ws_items.freeze_panes = "A2"

    # 4. Hoja Partidas Sin Código COVENIN (S/C)
    ws_sc = wb.create_sheet("Partidas S-C y Equivalentes")
    ws_sc.append([
        "Fila",
        "Código Declarado",
        "Unidad",
        "Descripción en Presupuesto",
        "Equivalente Sugerido",
        "% Similitud",
        "Descripción Equivalente Sugerido",
    ])
    style_header_row(ws_sc, 1)
    for it in detail["items"]:
        if it.is_chapter or not it.is_uncoded:
            continue
        ws_sc.append([
            it.row_number,
            it.original_code or "S/C",
            it.unit,
            it.description,
            it.suggested_equivalent_code or "Sin candidato cercano",
            f"{(it.suggested_equivalent_score or 0.0) * 100.0:.1f}%",
            it.suggested_equivalent_desc or "-",
        ])
    for idx, width in enumerate([7, 18, 12, 65, 24, 14, 65], start=1):
        ws_sc.column_dimensions[get_column_letter(idx)].width = width
    ws_sc.freeze_panes = "A2"

    # 5. Hoja Control de Correcciones (si esta versión proviene de una re-auditoría)
    if detail.get("version_comparison"):
        vc = detail["version_comparison"]
        ws_ver = wb.create_sheet("Correcciones Subsanadas")
        ws_ver.append([
            "Estado",
            "Regla",
            "Categoría",
            "Código Partida",
            "Código Insumo",
            "Campo",
            "Valor en Versión Anterior",
            "Valor Base Referencia",
            "Detalle Subsanado",
        ])
        style_header_row(ws_ver, 1)
        for rf in vc.get("resolved_findings") or []:
            ws_ver.append([
                "CORREGIDO EN ESTA VERSIÓN",
                rf.get("rule_id") or "-",
                rf.get("category") or "-",
                rf.get("item_code") or "-",
                rf.get("component_code") or "-",
                rf.get("field_name") or "-",
                rf.get("previous_imported_value") or "-",
                rf.get("master_value") or "-",
                rf.get("message") or "-",
            ])
            for c in ws_ver[ws_ver.max_row][:3]:
                c.fill = resolved_fill
        for idx, width in enumerate([26, 12, 16, 16, 16, 16, 24, 24, 65], start=1):
            ws_ver.column_dimensions[get_column_letter(idx)].width = width
        ws_ver.freeze_panes = "A2"

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    safe_name = re.sub(r"[^a-zA-Z0-9_-]+", "_", str(detail["name"]))[:45] or "Presupuesto"
    return buf.getvalue(), f"Auditoria_{safe_name}_v{detail['version_number']}.xlsx"
