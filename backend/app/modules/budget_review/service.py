"""Servicio orquestador de Revisión y Auditoría de Presupuestos (Maprex vs CostBase)."""
from __future__ import annotations

import base64
from collections import Counter, defaultdict
from datetime import datetime
import io
import logging
import os
import re
from typing import Any, Dict, List, Optional, Set, Tuple
import uuid

from PIL import Image as PILImage
from openpyxl import Workbook
from openpyxl.drawing.image import Image as OpenpyxlImage
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
    generate_default_executive_conclusion,
    is_exact_or_1to1_description,
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
            ("review_budget_snapshots", "report_code", "ALTER TABLE review_budget_snapshots ADD COLUMN IF NOT EXISTS report_code VARCHAR"),
            ("review_budget_snapshots", "reviewer_name", "ALTER TABLE review_budget_snapshots ADD COLUMN IF NOT EXISTS reviewer_name VARCHAR"),
            ("review_budget_snapshots", "reviewer_civ", "ALTER TABLE review_budget_snapshots ADD COLUMN IF NOT EXISTS reviewer_civ VARCHAR"),
            ("review_budget_snapshots", "document_reference", "ALTER TABLE review_budget_snapshots ADD COLUMN IF NOT EXISTS document_reference VARCHAR"),
            ("review_budget_snapshots", "institution_name", "ALTER TABLE review_budget_snapshots ADD COLUMN IF NOT EXISTS institution_name VARCHAR"),
            ("review_budget_snapshots", "institution_logo", "ALTER TABLE review_budget_snapshots ADD COLUMN IF NOT EXISTS institution_logo TEXT"),
            ("review_budget_snapshots", "conclusion_text", "ALTER TABLE review_budget_snapshots ADD COLUMN IF NOT EXISTS conclusion_text TEXT"),
            ("review_budget_snapshots", "approver_name", "ALTER TABLE review_budget_snapshots ADD COLUMN IF NOT EXISTS approver_name VARCHAR"),
            ("review_budget_snapshots", "approver_civ", "ALTER TABLE review_budget_snapshots ADD COLUMN IF NOT EXISTS approver_civ VARCHAR"),
            ("review_budget_snapshots", "approver_department", "ALTER TABLE review_budget_snapshots ADD COLUMN IF NOT EXISTS approver_department VARCHAR"),
            ("review_budget_snapshots", "include_monetary_impact", "ALTER TABLE review_budget_snapshots ADD COLUMN IF NOT EXISTS include_monetary_impact BOOLEAN NOT NULL DEFAULT TRUE"),
            ("review_findings", "finding_status", "ALTER TABLE review_findings ADD COLUMN IF NOT EXISTS finding_status VARCHAR NOT NULL DEFAULT 'PENDIENTE'"),
            ("review_findings", "auditor_comment", "ALTER TABLE review_findings ADD COLUMN IF NOT EXISTS auditor_comment TEXT"),
            ("review_budget_items", "ai_audit_status", "ALTER TABLE review_budget_items ADD COLUMN IF NOT EXISTS ai_audit_status VARCHAR"),
            ("review_budget_items", "ai_audit_summary", "ALTER TABLE review_budget_items ADD COLUMN IF NOT EXISTS ai_audit_summary TEXT"),
        ]
        with engine.begin() as conn:
            existing_rows = conn.execute(
                text(
                    "SELECT table_name, column_name FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND table_name IN ('review_budget_snapshots', 'review_findings', 'review_budget_items')"
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
    """Resuelve de forma segura el esquema de PostgreSQL correspondiente a database_id y ajusta search_path."""
    clean_id = (database_id or "master").strip()
    if not clean_id or clean_id == "master":
        db.execute(text("SET search_path TO public"))
        return "public"
    if not _SAFE_SCHEMA_RE.match(clean_id):
        raise ValueError("Identificador de base de datos inválido.")
    row = db.execute(
        text(
            "SELECT schema_name FROM information_schema.schemata WHERE schema_name = :sname"
        ),
        {"sname": clean_id},
    ).fetchone()
    resolved = clean_id if row else "public"
    db.execute(text(f'SET search_path TO "{resolved}", public'))
    return resolved


def _load_master_reference_maps(
    db: Session,
    schema: str,
) -> Tuple[Dict[str, Dict[str, str]], Dict[str, Set[str]], Dict[str, Dict[str, float]]]:
    """Carga los mapeos ref_code -> código nativo Maprex, conjunto de códigos del catálogo y precios oficiales."""
    ref_maps: Dict[str, Dict[str, str]] = {"material": {}, "equipment": {}, "labor": {}}
    catalog_codes: Dict[str, Set[str]] = {"material": set(), "equipment": set(), "labor": set()}
    catalog_prices: Dict[str, Dict[str, float]] = {"material": {}, "equipment": {}, "labor": {}}

    queries = [
        ("material", f'SELECT "CodMat", ref_code, "CosMat" FROM "{schema}".cost360_materials'),
        ("equipment", f'SELECT "CodEqu", ref_code, "CosDia" FROM "{schema}".cost360_equipment'),
        ("labor", f'SELECT "CodMan", ref_code, "Jornal" FROM "{schema}".cost360_labor'),
    ]
    for kind, sql in queries:
        try:
            rows = db.execute(text(sql)).fetchall()
            for native_val, ref_val, price_val in rows:
                p = float(price_val or 0.0)
                if native_val:
                    n_code = str(native_val).strip().upper()
                    catalog_codes[kind].add(n_code)
                    catalog_prices[kind][n_code] = p
                if ref_val:
                    r_code = str(ref_val).strip().upper()
                    catalog_codes[kind].add(r_code)
                    catalog_prices[kind][r_code] = p
                    if native_val:
                        ref_maps[kind][r_code] = str(native_val).strip().upper()
        except Exception as exc:
            logger.error("Error cargando catálogo para %s en esquema %s: %s", kind, schema, exc, exc_info=True)
            db.rollback()
    return ref_maps, catalog_codes, catalog_prices


def _fetch_master_item_and_recipe(
    db: Session,
    schema: str,
    code: str,
    cov_code: Optional[str],
    desc: Optional[str] = None,
    performance: Optional[float] = None,
    materials: Optional[List[Dict[str, Any]]] = None,
    equipments: Optional[List[Dict[str, Any]]] = None,
    labors: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, List[Dict[str, Any]]]]]:
    """
    Busca una partida en CostBase priorizando el Código COVENIN (CovPar),
    y desambigua de forma resiliente contra inconsistencias nativas de Maprex:
    1. Si hay múltiples variantes con el mismo CovPar (ej. E321390000 tiene ECS140 y EPO044):
       - Cruza primero contra el código interno/referencia (CodPar) si viene en el presupuesto.
       - Filtra por coincidencia 1 a 1 de descripción.
       - Si varias variantes comparten la misma descripción: desempata por rendimiento idéntico,
         afinidad de insumos en receta o rendimiento más cercano para no emitir falsos positivos.
    2. Si no se encuentra por CovPar, busca secundariamente por el código interno Maprex (CodPar).
    """
    clean_code = (code or "").strip()
    clean_cov = (cov_code or "").strip()
    if not clean_code and not clean_cov:
        return None, None

    # Candidatos a evaluar en CovPar (Código COVENIN):
    # En presupuestos venezolanos, el código de la partida suele ser el Código COVENIN (ej. "E311110120", "E12 S/C")
    cov_candidates_to_try: List[str] = []
    if clean_cov:
        cov_candidates_to_try.append(clean_cov)
    if clean_code and clean_code.upper() not in [c.upper() for c in cov_candidates_to_try]:
        cov_candidates_to_try.append(clean_code)

    matched_row = None

    # 1. BÚSQUEDA PRIORITARIA POR CÓDIGO COVENIN (CovPar)
    for c_try in cov_candidates_to_try:
        norm_c = re.sub(r"[\s.\-_/]", "", c_try).upper()
        # Buscamos coincidencias exactas o normalizadas (sin puntos ni guiones) en CovPar
        rows = db.execute(
            text(
                f'SELECT "CodPar", "CovPar", "Descri", "UniPar", "RenPar", "PreUni" '
                f'FROM "{schema}".cost360_items '
                f'WHERE UPPER("CovPar") = UPPER(:cov) '
                f'   OR REPLACE(REPLACE(REPLACE(REPLACE(UPPER("CovPar"), \'.\', \'\'), \'-\', \'\'), \'_\', \'\'), \' \', \'\') = :norm_cov'
            ),
            {"cov": c_try, "norm_cov": norm_c},
        ).fetchall()

        if not rows:
            continue

        if len(rows) == 1:
            matched_row = rows[0]
            break
        else:
            # Hay múltiples variantes en Maprex para este código COVENIN
            # Paso A: Si clean_code coincide con el CodPar de alguna variante, match exacto
            if clean_code:
                clean_code_upper = clean_code.upper()
                exact_by_code = [r for r in rows if str(r[0] or "").strip().upper() == clean_code_upper]
                if exact_by_code:
                    matched_row = exact_by_code[0]
                    break

            # Paso B: Filtrar candidatos que coincidan 1 a 1 en descripción
            desc_candidates: List[Any] = []
            if desc:
                for r in rows:
                    cand_desc = str(r[2] or "").strip()
                    if is_exact_or_1to1_description(desc, cand_desc):
                        desc_candidates.append(r)
            else:
                desc_candidates = list(rows)

            if len(desc_candidates) == 1:
                matched_row = desc_candidates[0]
                break
            elif len(desc_candidates) > 1:
                # Variantes Maprex con descripción 100% idéntica (ej. E321390000 con ECS140 y EPO044)
                # B.1: Coincidencia exacta de rendimiento
                if performance is not None and performance > 0:
                    perf_exact = [
                        r for r in desc_candidates
                        if abs(float(r[4] or 0.0) - performance) < 0.001
                    ]
                    if len(perf_exact) == 1:
                        matched_row = perf_exact[0]
                        break

                # B.2: Coincidencia de insumos (equipos / materiales) en la receta
                if equipments or materials:
                    imp_eq_codes = {
                        str(e.get("codigo") or e.get("CodEqu") or "").strip().upper()
                        for e in (equipments or [])
                        if (e.get("codigo") or e.get("CodEqu"))
                    }
                    imp_mat_codes = {
                        str(m.get("codigo") or m.get("CodMat") or "").strip().upper()
                        for m in (materials or [])
                        if (m.get("codigo") or m.get("CodMat"))
                    }

                    best_cand = None
                    max_overlap = -1
                    for r in desc_candidates:
                        c_par = str(r[0]).strip()
                        c_eqs = db.execute(
                            text(f'SELECT "CodIns" FROM "{schema}".cost360_apu_equipment WHERE "CodPar" = :cp'),
                            {"cp": c_par}
                        ).scalars().all()
                        c_mats = db.execute(
                            text(f'SELECT "CodIns" FROM "{schema}".cost360_apu_materials WHERE "CodPar" = :cp'),
                            {"cp": c_par}
                        ).scalars().all()
                        overlap = len(imp_eq_codes.intersection({str(x).strip().upper() for x in c_eqs})) + \
                                  len(imp_mat_codes.intersection({str(x).strip().upper() for x in c_mats}))
                        if overlap > max_overlap:
                            max_overlap = overlap
                            best_cand = r

                    if best_cand and max_overlap > 0:
                        matched_row = best_cand
                        break

                # B.3: Fallback a la variante con rendimiento más cercano
                if performance is not None and performance > 0:
                    desc_candidates.sort(key=lambda r: abs(float(r[4] or 0.0) - performance))
                    matched_row = desc_candidates[0]
                    break
                else:
                    matched_row = desc_candidates[0]
                    break

    # 2. BÚSQUEDA SECUNDARIA POR CÓDIGO INTERNO MAPREX (CodPar)
    if not matched_row and clean_code:
        rows_by_cod = db.execute(
            text(
                f'SELECT "CodPar", "CovPar", "Descri", "UniPar", "RenPar", "PreUni" '
                f'FROM "{schema}".cost360_items WHERE UPPER("CodPar") = UPPER(:c)'
            ),
            {"c": clean_code},
        ).fetchall()
        if len(rows_by_cod) == 1:
            matched_row = rows_by_cod[0]
        elif len(rows_by_cod) > 1:
            if desc:
                desc_match = [r for r in rows_by_cod if is_exact_or_1to1_description(desc, str(r[2] or "").strip())]
                if desc_match:
                    matched_row = desc_match[0]
            if not matched_row:
                matched_row = rows_by_cod[0]

    if not matched_row:
        return None, None

    matched_cod_par = str(matched_row[0]).strip()
    master_item = {
        "cod_par": matched_cod_par,
        "cov_par": str(matched_row[1] or "").strip(),
        "description": str(matched_row[2] or "").strip(),
        "unit": str(matched_row[3] or "").strip(),
        "performance": float(matched_row[4] or 1.0),
        "unit_price": float(matched_row[5] or 0.0),
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
            f'SELECT ae."CodIns", e."Descri", ae."CanIns", e."precio", ae."Deprec", e."deprec_factor", e."CosDia" '
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
                "unit_price": float(r[3] or 0.0) if float(r[3] or 0.0) > 0 else float(r[6] or 0.0),
                "waste_or_deprec": (
                    float(r[4] if r[4] is not None else (r[5] if r[5] is not None else 1.0))
                    if float(r[3] or 0.0) > 0
                    else 1.0
                ),
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
    ref_maps, catalog_codes, catalog_prices = _load_master_reference_maps(db, schema)

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

    raw_rep_code = header_info.get("report_code") or (parent_snap.report_code if parent_snap else None)
    rep_code = (
        raw_rep_code.strip()
        if raw_rep_code and raw_rep_code.strip()
        else f"RT-{datetime.utcnow().year}-{new_snap_id[:4].upper()}"
    )

    doc_ref = header_info.get("document_reference") or (parent_snap.document_reference if parent_snap else None)
    if not doc_ref or not doc_ref.strip():
        src_name = header_info.get("source_filename") or base_name
        doc_ref = f"{src_name} — Versión {version_num:02d} ({datetime.utcnow().strftime('%d/%m/%Y')})"

    rev_name = header_info.get("reviewer_name") or (parent_snap.reviewer_name if parent_snap else None)
    rev_civ = header_info.get("reviewer_civ") or (parent_snap.reviewer_civ if parent_snap else None)
    inst_name = header_info.get("institution_name") or (parent_snap.institution_name if parent_snap else None)
    inst_logo = header_info.get("institution_logo") or (parent_snap.institution_logo if parent_snap else None)
    user_conclusion = header_info.get("conclusion_text") or (parent_snap.conclusion_text if parent_snap else None)
    appr_name = header_info.get("approver_name") or (parent_snap.approver_name if parent_snap else None)
    appr_civ = header_info.get("approver_civ") or (parent_snap.approver_civ if parent_snap else None)
    appr_dept = header_info.get("approver_department") or (parent_snap.approver_department if parent_snap else None)

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
        report_code=rep_code,
        reviewer_name=rev_name.strip() if rev_name and rev_name.strip() else None,
        reviewer_civ=rev_civ.strip() if rev_civ and rev_civ.strip() else None,
        document_reference=doc_ref.strip() if doc_ref and doc_ref.strip() else None,
        institution_name=inst_name.strip() if inst_name and inst_name.strip() else None,
        institution_logo=inst_logo.strip() if inst_logo and inst_logo.strip() else None,
        approver_name=appr_name.strip() if appr_name and appr_name.strip() else None,
        approver_civ=appr_civ.strip() if appr_civ and appr_civ.strip() else None,
        approver_department=appr_dept.strip() if appr_dept and appr_dept.strip() else None,
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

    # Detectar códigos de partida duplicados en todo el presupuesto y registrar sus ubicaciones
    code_occurrences: Counter[str] = Counter()
    code_locations: Dict[str, List[int]] = defaultdict(list)
    for idx_scan, it_scan in enumerate(raw_items, start=1):
        if not it_scan.get("is_chapter") and str(it_scan.get("code") or "").strip():
            c_key = str(it_scan.get("code")).strip().upper()
            code_occurrences[c_key] += 1
            code_locations[c_key].append(int(it_scan.get("row") or idx_scan))

    reported_duplicate_codes: Set[str] = set()

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
            else _fetch_master_item_and_recipe(
                db=db,
                schema=schema,
                code=orig_code,
                cov_code=cov_code,
                desc=desc,
                performance=float(raw.get("performance") or 1.0) if raw.get("performance") is not None else None,
                materials=raw.get("materials") or [],
                equipments=raw.get("equipments") or [],
                labors=raw.get("labors") or [],
            )
        )

        suggested_code: Optional[str] = None
        suggested_desc: Optional[str] = None
        suggested_score: Optional[float] = None

        # REGLA DE ORO: Debe haber coincidencia 1 a 1 de Código y Descripción para comparar APUs
        # Si el código existe en la base pero la descripción es alterada/diferente, no emparejar para contrastar insumos (no comparar peras con manzanas)
        if master_item and not is_exact_or_1to1_description(desc, master_item["description"]):
            master_item = None
            master_recipe = None
            uncoded_flag = True
            origin_src = "DESCRIPCION_ALTERADA_IA"

        if not master_item:
            uncoded_count += 1
            uncoded_flag = True
            if origin_src != "DESCRIPCION_ALTERADA_IA":
                origin_src = "SIN_CODIGO_COVENIN"
            # No forzar búsqueda ni sugerencias de homologaciones arbitrarias
            suggested_code = None
            suggested_desc = None
            suggested_score = None
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
            is_in_cat = (c_raw in catalog_codes["material"]) or (resolved in catalog_codes["material"])
            is_in_db = bool(m_mst) or is_in_cat
            cat_price = catalog_prices["material"].get(resolved) or catalog_prices["material"].get(c_raw)
            mst_unit_p = float(m_mst["unit_price"]) if m_mst else (cat_price if cat_price is not None else None)

            norm_mats.append({
                "component_type": "material",
                "code": c_raw,
                "resolved_master_code": resolved,
                "description": str(m.get("descripcion") or m.get("description") or ""),
                "unit": str(m.get("unidad") or m.get("unit") or "und"),
                "quantity": float(m.get("cantidad") if m.get("cantidad") is not None else (m.get("quantity") or 0.0)),
                "master_quantity": float(m_mst["quantity"]) if m_mst else None,
                "unit_price": float(m.get("precio_unitario") if m.get("precio_unitario") is not None else (m.get("unit_price") or 0.0)),
                "master_unit_price": mst_unit_p,
                "waste_or_deprec": float(m.get("desperdicio") if m.get("desperdicio") is not None else 0.0),
                "master_waste_or_deprec": float(m_mst["waste_or_deprec"]) if m_mst else None,
                "bonus": 0.0,
                "is_in_database": is_in_db,
            })

        norm_eqs: List[Dict[str, Any]] = []
        for e in (raw.get("equipments") or []):
            c_raw = str(e.get("codigo") or e.get("code") or "").strip().upper()
            resolved = ref_maps["equipment"].get(c_raw, c_raw)
            e_mst = mst_eq_map.get(resolved)
            is_in_cat = (c_raw in catalog_codes["equipment"]) or (resolved in catalog_codes["equipment"])
            is_in_db = bool(e_mst) or is_in_cat
            cat_price = catalog_prices["equipment"].get(resolved) or catalog_prices["equipment"].get(c_raw)
            mst_unit_p = float(e_mst["unit_price"]) if e_mst else (cat_price if cat_price is not None else None)

            norm_eqs.append({
                "component_type": "equipment",
                "code": c_raw,
                "resolved_master_code": resolved,
                "description": str(e.get("descripcion") or e.get("description") or ""),
                "unit": str(e.get("unidad") or e.get("unit") or "día"),
                "quantity": float(e.get("cantidad") if e.get("cantidad") is not None else (e.get("quantity") or 0.0)),
                "master_quantity": float(e_mst["quantity"]) if e_mst else None,
                "unit_price": float(e.get("precio_unitario") if e.get("precio_unitario") is not None else (e.get("unit_price") or 0.0)),
                "master_unit_price": mst_unit_p,
                "waste_or_deprec": float(e.get("depreciacion") if e.get("depreciacion") is not None else 1.0),
                "master_waste_or_deprec": float(e_mst["waste_or_deprec"]) if e_mst else None,
                "bonus": 0.0,
                "is_in_database": is_in_db,
            })

        norm_labs: List[Dict[str, Any]] = []
        for l_row in (raw.get("labors") or []):
            c_raw = str(l_row.get("codigo") or l_row.get("code") or "").strip().upper()
            resolved = ref_maps["labor"].get(c_raw, c_raw)
            l_mst = mst_lab_map.get(resolved)
            is_in_cat = (c_raw in catalog_codes["labor"]) or (resolved in catalog_codes["labor"])
            is_in_db = bool(l_mst) or is_in_cat
            cat_price = catalog_prices["labor"].get(resolved) or catalog_prices["labor"].get(c_raw)
            mst_unit_p = float(l_mst["unit_price"]) if l_mst else (cat_price if cat_price is not None else None)

            norm_labs.append({
                "component_type": "labor",
                "code": c_raw,
                "resolved_master_code": resolved,
                "description": str(l_row.get("descripcion") or l_row.get("description") or ""),
                "unit": "día",
                "quantity": float(l_row.get("cantidad") if l_row.get("cantidad") is not None else (l_row.get("quantity") or 0.0)),
                "master_quantity": float(l_mst["quantity"]) if l_mst else None,
                "unit_price": float(l_row.get("jornal") if l_row.get("jornal") is not None else (l_row.get("unit_price") or 0.0)),
                "master_unit_price": mst_unit_p,
                "waste_or_deprec": 0.0,
                "master_waste_or_deprec": 0.0,
                "bonus": float(l_row.get("bono") if l_row.get("bono") is not None else (l_row.get("bonus") or 0.0)),
                "is_in_database": is_in_db,
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
            covenin_code=(
                (master_item.get("cov_par") or cov_code or orig_code)
                if master_item
                else (cov_code or orig_code)
            ),
            matched_master_code=(
                (master_item.get("cov_par") or master_item["cod_par"])
                if master_item
                else None
            ),
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

        display_cov = cov_code or (master_item.get("cov_par") if master_item else None)
        effective_display_code = (
            display_cov
            if (display_cov and display_cov.upper() not in {"S/C", "E S/C", "ES/C"})
            else orig_code
        )

        item_eval_payload = {
            "original_code": orig_code,
            "covenin_code": display_cov,
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

        if item_eval_payload.get("ai_audit_status"):
            rev_item.ai_audit_status = item_eval_payload["ai_audit_status"]
            rev_item.ai_audit_summary = item_eval_payload.get("ai_audit_summary")

        orig_key = orig_code.upper() if orig_code else ""
        if (
            orig_key
            and code_occurrences.get(orig_key, 0) > 1
            and orig_key not in reported_duplicate_codes
        ):
            reported_duplicate_codes.add(orig_key)
            locs = code_locations.get(orig_key, [])
            locs_str = f" (filas {', '.join(f'#{r}' for r in locs)})" if locs else ""
            count = code_occurrences[orig_key]
            item_findings.append({
                "rule_id": "EST-007",
                "category": "ESTRUCTURA",
                "severity": "MEDIA",
                "item_code": effective_display_code,
                "field_name": "duplicate_partida",
                "imported_value": f"{count} partidas con código {orig_code}",
                "master_value": "Código único por partida",
                "diff_percent": None,
                "message": f"El código de partida aparece {count} veces en el presupuesto{locs_str}",
                "suggestion": "Verificar si la partida fue duplicada accidentalmente en varios capítulos o consolidar metrados.",
            })

        for f_dict in item_findings:
            db.add(
                ReviewFinding(
                    snapshot_id=snapshot.id,
                    review_item_id=rev_item.id,
                    rule_id=f_dict["rule_id"],
                    category=f_dict["category"],
                    severity=f_dict["severity"],
                    item_code=f_dict.get("item_code") or effective_display_code,
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
    snapshot.conclusion_text = (
        user_conclusion.strip()
        if user_conclusion and user_conclusion.strip()
        else generate_default_executive_conclusion(
            health_score=snapshot.health_score,
            critical_count=snapshot.critical_findings_count,
            high_count=snapshot.high_findings_count,
            medium_count=snapshot.medium_findings_count,
            uncoded_count=snapshot.uncoded_items_count,
            total_items=snapshot.total_items,
            findings=all_findings_dicts,
        )
    )

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
    report_code: Optional[str] = None,
    reviewer_name: Optional[str] = None,
    reviewer_civ: Optional[str] = None,
    document_reference: Optional[str] = None,
    institution_name: Optional[str] = None,
    conclusion_text: Optional[str] = None,
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
        "report_code": report_code,
        "reviewer_name": reviewer_name,
        "reviewer_civ": reviewer_civ,
        "document_reference": document_reference,
        "institution_name": institution_name,
        "conclusion_text": conclusion_text,
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
    report_code: Optional[str] = None,
    reviewer_name: Optional[str] = None,
    reviewer_civ: Optional[str] = None,
    document_reference: Optional[str] = None,
    institution_name: Optional[str] = None,
    conclusion_text: Optional[str] = None,
    import_mode: str = "budget",
) -> ReviewSnapshot:
    """Importa un archivo externo (Excel APU, Excel presupuesto, CSV o PDF) a la base de revisión y lo audita."""
    if not file_bytes:
        raise ValueError("El archivo subido está vacío.")
    if not filename:
        raise ValueError("El nombre del archivo es requerido.")

    clean_mode = (import_mode or "budget").strip().lower()
    if clean_mode not in {"apu_workbook", "budget", "compute_notes"}:
        clean_mode = "budget"
    _resolve_schema_name(db, database_id)
    preview = build_preview(file_bytes, filename, db, mode=clean_mode)
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
        "report_code": report_code,
        "reviewer_name": reviewer_name,
        "reviewer_civ": reviewer_civ,
        "document_reference": document_reference,
        "institution_name": institution_name,
        "conclusion_text": conclusion_text,
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

    chapters_count = sum(1 for it in snap.items if it.is_chapter)

    total_original_amount = 0.0
    total_adjusted_amount = 0.0
    items_with_monetary_diff = 0

    for it in snap.items:
        if it.is_chapter:
            continue
        qty = float(it.quantity) if it.quantity and it.quantity > 0 else 1.0
        eval_pu = (
            float(it.imported_unit_price)
            if it.imported_unit_price and it.imported_unit_price > 0
            else float(it.calculated_unit_price or 0.0)
        )
        if eval_pu <= 0.0 and it.calculated_unit_price and it.calculated_unit_price > 0:
            eval_pu = float(it.calculated_unit_price)

        if it.master_unit_price is not None and it.master_unit_price > 0:
            base_pu = float(it.master_unit_price)
        else:
            base_pu = eval_pu

        orig_line = qty * eval_pu
        adj_line = qty * base_pu
        total_original_amount += orig_line
        total_adjusted_amount += adj_line
        if abs(orig_line - adj_line) > 0.001:
            items_with_monetary_diff += 1

    net_incidence = total_original_amount - total_adjusted_amount
    incidence_percent = (
        (net_incidence / total_adjusted_amount * 100.0)
        if total_adjusted_amount > 0
        else 0.0
    )

    monetary_summary = {
        "original_amount": round(total_original_amount, 2),
        "adjusted_amount": round(total_adjusted_amount, 2),
        "net_incidence": round(net_incidence, 2),
        "incidence_percent": round(incidence_percent, 2),
        "items_with_diff": items_with_monetary_diff,
        "is_overcost": net_incidence > 0.001,
        "is_undervalued": net_incidence < -0.001,
    }

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
        "report_code": snap.report_code or f"RT-{snap.created_at.year}-{snap.id[:4].upper()}",
        "reviewer_name": snap.reviewer_name,
        "reviewer_civ": snap.reviewer_civ,
        "document_reference": snap.document_reference,
        "institution_name": snap.institution_name,
        "institution_logo": snap.institution_logo,
        "approver_name": snap.approver_name,
        "approver_civ": snap.approver_civ,
        "approver_department": snap.approver_department,
        "include_monetary_impact": getattr(snap, "include_monetary_impact", True) if getattr(snap, "include_monetary_impact", None) is not None else True,
        "conclusion_text": snap.conclusion_text,
        "chapters_count": chapters_count,
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
        "monetary_summary": monetary_summary,
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
    report_code: Optional[str] = None,
    reviewer_name: Optional[str] = None,
    reviewer_civ: Optional[str] = None,
    document_reference: Optional[str] = None,
    institution_name: Optional[str] = None,
    institution_logo: Optional[str] = None,
    conclusion_text: Optional[str] = None,
    approver_name: Optional[str] = None,
    approver_civ: Optional[str] = None,
    approver_department: Optional[str] = None,
    include_monetary_impact: Optional[bool] = None,
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
    if report_code is not None:
        snap.report_code = report_code.strip() or None
    if reviewer_name is not None:
        snap.reviewer_name = reviewer_name.strip() or None
    if reviewer_civ is not None:
        snap.reviewer_civ = reviewer_civ.strip() or None
    if document_reference is not None:
        snap.document_reference = document_reference.strip() or None
    if institution_name is not None:
        snap.institution_name = institution_name.strip() or None
    if institution_logo is not None:
        snap.institution_logo = institution_logo.strip() or None
    if conclusion_text is not None:
        snap.conclusion_text = conclusion_text.strip() or None
    if approver_name is not None:
        snap.approver_name = approver_name.strip() or None
    if approver_civ is not None:
        snap.approver_civ = approver_civ.strip() or None
    if approver_department is not None:
        snap.approver_department = approver_department.strip() or None
    if include_monetary_impact is not None:
        snap.include_monetary_impact = bool(include_monetary_impact)

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
    report_code: Optional[str] = None,
    reviewer_name: Optional[str] = None,
    reviewer_civ: Optional[str] = None,
    document_reference: Optional[str] = None,
    institution_name: Optional[str] = None,
    institution_logo: Optional[str] = None,
    conclusion_text: Optional[str] = None,
    approver_name: Optional[str] = None,
    approver_civ: Optional[str] = None,
    approver_department: Optional[str] = None,
    include_monetary_impact: Optional[bool] = None,
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
        report_code=report_code.strip() if report_code and report_code.strip() else source.report_code,
        reviewer_name=reviewer_name.strip() if reviewer_name and reviewer_name.strip() else source.reviewer_name,
        reviewer_civ=reviewer_civ.strip() if reviewer_civ and reviewer_civ.strip() else source.reviewer_civ,
        document_reference=document_reference.strip() if document_reference and document_reference.strip() else source.document_reference,
        institution_name=institution_name.strip() if institution_name and institution_name.strip() else source.institution_name,
        institution_logo=institution_logo.strip() if institution_logo and institution_logo.strip() else source.institution_logo,
        conclusion_text=conclusion_text.strip() if conclusion_text and conclusion_text.strip() else source.conclusion_text,
        approver_name=approver_name.strip() if approver_name and approver_name.strip() else source.approver_name,
        approver_civ=approver_civ.strip() if approver_civ and approver_civ.strip() else source.approver_civ,
        approver_department=approver_department.strip() if approver_department and approver_department.strip() else source.approver_department,
        include_monetary_impact=bool(include_monetary_impact) if include_monetary_impact is not None else getattr(source, "include_monetary_impact", True),
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
            ai_audit_status=it.ai_audit_status,
            ai_audit_summary=it.ai_audit_summary,
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


RULE_HEADLINES: Dict[str, str] = {
    "MAT-001": "Omisión crítica de material",
    "MAT-002": "Sobreconsumo de material",
    "MAT-003": "Insumo de material no perteneciente a la base",
    "MAT-004": "Desperdicio de material manipulado",
    "MAT-005": "Material no registrado (requiere cotización)",
    "LAB-001": "Cuadrilla alterada",
    "LAB-002": "Omisión crítica de mano de obra",
    "LAB-003": "Mano de obra especializada / no tabulada",
    "EQU-001": "Omisión crítica de equipo",
    "EQU-002": "Equipo no perteneciente a la base",
    "EQU-003": "Cantidad de equipo alterada",
    "EQU-004": "Discrepancia en depreciación",
    "EQU-005": "Equipo no registrado (requiere cotización)",
    "PERF-001": "Rendimiento modificado",
    "EST-001": "Discrepancia en unidad de medida",
    "EST-002": "Código COVENIN no registrado en base",
    "EST-003": "Rendimiento nulo o inválido",
    "EST-004": "Insumo duplicado en APU",
    "EST-005": "Omisión total de materiales",
    "EST-006": "Omisión total de mano de obra",
    "EST-007": "Duplicidad de partida",
    "DUP-001": "Duplicidad explícita",
    "COL-001": "Colisión de código de partida",
    "ARI-001": "Error aritmético en capítulo",
    "COH-001": "Descuadre aritmético en APU",
    "UNC-001": "APU no codificado observado",
    "AI-UNC-001": "Estructura técnica de APU observada",
}


def _get_excel_finding_headline(f: Any) -> str:
    rule_id = getattr(f, "rule_id", None)
    if rule_id and rule_id in RULE_HEADLINES:
        return RULE_HEADLINES[rule_id]
    category = getattr(f, "category", "")
    if category == "MANO_OBRA":
        return "Cuadrilla alterada"
    if category == "MATERIALES":
        return "Desviación en consumo de material"
    if category == "EQUIPOS":
        return "Discrepancia en equipo / depreciación"
    if category == "RENDIMIENTO":
        return "Rendimiento atípico"
    if category == "COHERENCIA":
        return "Error aritmético"
    if category == "SIN_CODIGO":
        return "APU no codificado"
    if category == "ESTRUCTURA":
        return "Duplicidad / estructura de partida"
    return "Desviación técnica"


def _clean_excel_msg(msg: str) -> str:
    return (msg or "").strip().rstrip(".")


def _load_excel_logo_image(logo_val: Optional[str]) -> Optional[OpenpyxlImage]:
    """Carga y redimensiona el logo institucional para incrustarlo en la cabecera de la hoja de auditoría de Excel."""
    if not logo_val or not isinstance(logo_val, str):
        return None
    try:
        raw_data: Optional[bytes] = None
        trimmed = logo_val.strip()
        if trimmed.startswith("data:"):
            parts = trimmed.split(",", 1)
            if len(parts) == 2:
                raw_data = base64.b64decode(parts[1])
        elif os.path.exists(trimmed):
            with open(trimmed, "rb") as f:
                raw_data = f.read()
        else:
            try:
                raw_data = base64.b64decode(trimmed)
            except Exception:
                raw_data = None

        if not raw_data:
            return None

        pil_img = PILImage.open(io.BytesIO(raw_data))
        if pil_img.mode not in ("RGB", "RGBA"):
            pil_img = pil_img.convert("RGBA")

        # Mantener proporción con altura máxima ~48px y ancho máximo ~200px
        max_w, max_h = 200, 48
        w, h = pil_img.size
        if w > 0 and h > 0:
            ratio = min(max_w / w, max_h / h, 1.0)
            new_size = (max(1, int(w * ratio)), max(1, int(h * ratio)))
            resized = pil_img.resize(new_size, PILImage.Resampling.LANCZOS)
            out_buf = io.BytesIO()
            resized.save(out_buf, format="PNG")
            out_buf.seek(0)
            return OpenpyxlImage(out_buf)
    except Exception as exc:
        logger.error("Error al procesar logo institucional para Excel: %s", exc, exc_info=True)
    return None


def export_audit_report_excel(db: Session, snapshot_id: str, user_id: str) -> Tuple[bytes, str]:
    """Genera un archivo Excel (.xlsx) profesional con el Informe de Auditoría y la hoja Hallazgos de Auditoría.

    La hoja 'Informe de Auditoria' es una copia fiel del informe oficial de impresión, incluyendo
    logo institucional, encabezado oficial, ficha del expediente, resumen técnico, resultado,
    conclusión, incidencia monetaria, detalle de partidas con observaciones y firmas de conformidad técnica.
    """
    if not snapshot_id or not user_id:
        raise ValueError("snapshot_id y user_id son obligatorios para exportar el informe a Excel")

    detail = get_review_snapshot_detail(db, snapshot_id, user_id)
    wb = Workbook()

    header_fill = PatternFill("solid", fgColor="0A4275")
    header_font = Font(color="FFFFFF", bold=True, size=10)
    section_fill = PatternFill("solid", fgColor="F1F5F9")
    card_fill = PatternFill("solid", fgColor="F8FAFC")
    item_header_fill = PatternFill("solid", fgColor="E2E8F0")

    def style_header_row(ws: Any, row_idx: int = 1) -> None:
        for cell in ws[row_idx]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    # =========================================================================
    # 1. Hoja "Informe de Auditoria": Copia fiel del informe oficial de impresión
    # =========================================================================
    ws_rep = wb.active
    ws_rep.title = "Informe de Auditoria"

    # Logo Institucional Centrado (si existe en los datos del revisor / informe)
    logo_img = _load_excel_logo_image(detail.get("institution_logo"))
    if logo_img:
        ws_rep.row_dimensions[1].height = 45
        ws_rep.add_image(logo_img, "D1")
        ws_rep.append([])  # Fila vacía separadora
        ws_rep.row_dimensions[2].height = 6

    # Encabezado Oficial
    title_row = ws_rep.max_row + 1
    report_code = detail.get("report_code") or f"RT-{detail['created_at'].year if isinstance(detail['created_at'], datetime) else '2026'}-001"
    version_num = detail.get("version_number", 1)
    rev_date_str = (
        detail["created_at"].strftime("%d/%m/%Y")
        if isinstance(detail["created_at"], datetime)
        else str(detail["created_at"])[:10]
    )

    ws_rep.append([
        "INFORME DE REVISIÓN TÉCNICA DE PRESUPUESTO",
        "", "", "", "",
        f"{report_code}\nVersión {version_num} · {rev_date_str}",
        ""
    ])
    ws_rep.merge_cells(f"A{title_row}:E{title_row}")
    ws_rep.merge_cells(f"F{title_row}:G{title_row}")

    cell_title = ws_rep.cell(title_row, 1)
    cell_title.font = Font(bold=True, size=13, color="FFFFFF")
    cell_title.fill = header_fill
    cell_title.alignment = Alignment(horizontal="center", vertical="center")

    cell_code = ws_rep.cell(title_row, 6)
    cell_code.font = Font(bold=True, size=9, color="FFFFFF")
    cell_code.fill = PatternFill("solid", fgColor="0F172A")
    cell_code.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws_rep.row_dimensions[title_row].height = 32

    ws_rep.append([])
    ws_rep.row_dimensions[ws_rep.max_row].height = 8

    # Ficha de identificación del expediente (2 columnas con viñetas)
    rev_civ_str = f", CIV {detail['reviewer_civ']}" if detail.get("reviewer_civ") else ""
    rev_full_str = f"{detail.get('reviewer_name') or 'Ing. Revisor'}{rev_civ_str}"
    doc_ref = detail.get("document_reference") or detail.get("source_filename") or f"Presupuesto de Obra — v{version_num}"
    client_str = detail.get("client_name") or "Sin especificar"
    db_raw = str(detail.get("database_id") or "master").strip()
    if db_raw == "base_agosto":
        db_label = "Base Agosto"
    elif db_raw == "master":
        db_label = "Base Maestra"
    elif db_raw.lower().startswith("base_"):
        db_label = "Base " + db_raw[5:].capitalize()
    else:
        db_label = db_raw.capitalize() if db_raw else "Base Maestra"
    status_label = detail.get("review_status") or "EN_REVISION"

    card_start = ws_rep.max_row + 1
    ws_rep.append(["• Obra:", detail.get("project_name") or "Sin especificar", "", "• Documento:", doc_ref, "", ""])
    ws_rep.merge_cells(f"E{card_start}:G{card_start}")

    ws_rep.append(["• Empresa:", client_str, "", "• Revisión:", f"{rev_date_str} | {rev_full_str}", "", ""])
    ws_rep.merge_cells(f"E{card_start + 1}:G{card_start + 1}")

    ws_rep.append(["• Estado del Dictamen:", status_label, "", "• Base de Contraste:", db_label, "", ""])
    ws_rep.merge_cells(f"E{card_start + 2}:G{card_start + 2}")

    if detail.get("institution_name"):
        inst_card_row = ws_rep.max_row + 1
        ws_rep.append(["• Institución:", detail["institution_name"], "", "", "", "", ""])
        ws_rep.merge_cells(f"B{inst_card_row}:G{inst_card_row}")

    for r in range(card_start, ws_rep.max_row + 1):
        ws_rep.cell(r, 1).font = Font(bold=True, size=9, color="0F172A")
        ws_rep.cell(r, 2).font = Font(size=9, color="1E293B")
        ws_rep.cell(r, 4).font = Font(bold=True, size=9, color="0F172A")
        ws_rep.cell(r, 5).font = Font(size=9, color="1E293B")
        for col in range(1, 8):
            ws_rep.cell(r, col).fill = card_fill
        ws_rep.row_dimensions[r].height = 19

    ws_rep.append([])
    ws_rep.row_dimensions[ws_rep.max_row].height = 8

    # Alcance y Resumen Técnico
    total_items = detail.get("total_items", 0)
    chapters_count = detail.get("chapters_count", 0)
    coded_count = detail.get("coded_items_count", 0)
    uncoded_count = detail.get("uncoded_items_count", 0)
    total_findings = len(detail.get("findings") or [])

    scope_text = (
        f"Se revisó el 100% del presupuesto, evaluando un total de {chapters_count} capítulos, "
        f"{total_items} partidas ({coded_count} codificadas bajo norma COVENIN y {uncoded_count} sin codificación) "
        f"y {total_items} análisis de precios unitarios (APU). "
        + (f"Se detectaron {total_findings} errores o desviaciones técnicas que requieren corrección." if total_findings > 0 else "No se detectaron desviaciones técnicas con respecto a la base de contraste seleccionada.")
    )
    ws_rep.append([scope_text])
    ws_rep.merge_cells(f"A{ws_rep.max_row}:G{ws_rep.max_row}")
    cell_scope = ws_rep[f"A{ws_rep.max_row}"]
    cell_scope.font = Font(size=9, color="0F172A")
    cell_scope.fill = section_fill
    cell_scope.alignment = Alignment(wrap_text=True, vertical="center")
    ws_rep.row_dimensions[ws_rep.max_row].height = 36

    ws_rep.append([])
    ws_rep.row_dimensions[ws_rep.max_row].height = 8

    # Resultado de la revisión (Semáforo de Partidas)
    items = detail.get("items") or []
    items_with_findings = [it for it in items if not it.is_chapter and getattr(it, "findings", None)]
    approved_items_count = max(0, total_items - len(items_with_findings))
    has_obs = len(items_with_findings) > 0
    score_fill = PatternFill("solid", fgColor="FEF3C7" if has_obs else "D1FAE5")

    res_row = ws_rep.max_row + 1
    ws_rep.append([
        f"RESULTADO DE LA REVISIÓN:   {approved_items_count} de {total_items} partidas aprobadas · {len(items_with_findings)} con observaciones",
        "", "", "", "",
        "CON OBSERVACIONES" if has_obs else "APROBADO",
        ""
    ])
    ws_rep.merge_cells(f"A{res_row}:E{res_row}")
    ws_rep.merge_cells(f"F{res_row}:G{res_row}")

    cell_score_txt = ws_rep.cell(res_row, 1)
    cell_score_txt.font = Font(bold=True, size=10, color="0F172A")
    cell_score_txt.alignment = Alignment(vertical="center", indent=1)

    cell_score_tag = ws_rep.cell(res_row, 6)
    cell_score_tag.font = Font(bold=True, size=10, color="92400E" if has_obs else "065F46")
    cell_score_tag.alignment = Alignment(horizontal="center", vertical="center")
    for col in range(1, 8):
        ws_rep.cell(res_row, col).fill = score_fill
    ws_rep.row_dimensions[res_row].height = 24

    ws_rep.append([])
    ws_rep.row_dimensions[ws_rep.max_row].height = 8

    # Conclusión Preliminar / Dictamen Técnico
    is_conforme = detail.get("review_status") == "APROBADO" or len(items_with_findings) == 0
    conclusion_title = "CONCLUSIÓN DEL INFORME TÉCNICO:" if is_conforme else "CONCLUSIÓN PRELIMINAR:"
    conclusion_body = detail.get("conclusion_text") or (
        "El presupuesto cumple satisfactoriamente con la evaluación técnica normativa."
        if is_conforme else
        "El presupuesto no es apto para aprobación inmediata en su estado actual. Presenta desviaciones estructurales que deben ser subsanadas previo a su tramitación contractual o financiera."
    )
    ws_rep.append([conclusion_title])
    ws_rep.cell(ws_rep.max_row, 1).font = Font(bold=True, size=10, color="0F172A")

    ws_rep.append([conclusion_body])
    ws_rep.merge_cells(f"A{ws_rep.max_row}:G{ws_rep.max_row}")
    cell_conc = ws_rep[f"A{ws_rep.max_row}"]
    cell_conc.font = Font(size=9, color="1E293B")
    cell_conc.fill = section_fill
    cell_conc.alignment = Alignment(wrap_text=True, vertical="center")
    ws_rep.row_dimensions[ws_rep.max_row].height = 42

    ws_rep.append([])
    ws_rep.row_dimensions[ws_rep.max_row].height = 8

    # Observaciones del auditor (si existen)
    if detail.get("auditor_notes") and detail["auditor_notes"].strip():
        ws_rep.append(["OBSERVACIONES DEL AUDITOR:"])
        ws_rep.cell(ws_rep.max_row, 1).font = Font(bold=True, size=10, color="0F172A")
        ws_rep.append([detail["auditor_notes"].strip()])
        ws_rep.merge_cells(f"A{ws_rep.max_row}:G{ws_rep.max_row}")
        cell_notes = ws_rep[f"A{ws_rep.max_row}"]
        cell_notes.font = Font(size=9, color="1E293B")
        cell_notes.alignment = Alignment(wrap_text=True, vertical="center")
        ws_rep.row_dimensions[ws_rep.max_row].height = 30
        ws_rep.append([])
        ws_rep.row_dimensions[ws_rep.max_row].height = 8

    # Incidencia Monetaria y Variación Económica (si include_monetary_impact es True)
    if detail.get("include_monetary_impact", True) is not False:
        m_sum = detail.get("monetary_summary") or {}
        orig_amt = float(m_sum.get("original_amount") or 0.0)
        adj_amt = float(m_sum.get("adjusted_amount") or 0.0)
        net_inc = float(m_sum.get("net_incidence") or 0.0)
        inc_pct = float(m_sum.get("incidence_percent") or 0.0)
        curr = detail.get("currency", "$")
        if curr == "USD":
            curr = "$"
        elif curr == "VES":
            curr = "Bs."

        ws_rep.append(["INCIDENCIA MONETARIA Y VARIACIÓN ECONÓMICA:"])
        ws_rep.cell(ws_rep.max_row, 1).font = Font(bold=True, size=10, color="0F172A")

        if orig_amt > 0:
            sign_str = "+" if net_inc > 0 else ""
            label_tipo = "Sobrecosto" if net_inc > 0 else ("Subvaluación" if net_inc < 0 else "Variación Neta")
            color_inc = "B91C1C" if net_inc > 0 else ("047857" if net_inc < 0 else "0F172A")

            orig_str = f"{curr} {orig_amt:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            adj_str = f"{curr} {adj_amt:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            inc_str = f"{sign_str}{curr} {net_inc:,.2f} ({sign_str}{inc_pct:.2f}%)".replace(",", "X").replace(".", ",").replace("X", ".")

            ws_rep.append(["• Monto Presupuesto Evaluado:", orig_str])
            ws_rep.cell(ws_rep.max_row, 1).font = Font(bold=True, size=9)
            ws_rep.cell(ws_rep.max_row, 2).font = Font(bold=True, size=9, color="0F172A")

            ws_rep.append([f"• Incidencia Técnica ({label_tipo}):", inc_str])
            ws_rep.cell(ws_rep.max_row, 1).font = Font(bold=True, size=9)
            ws_rep.cell(ws_rep.max_row, 2).font = Font(bold=True, size=9, color=color_inc)

            ws_rep.append(["• Monto Presupuesto Ajustado:", adj_str])
            ws_rep.cell(ws_rep.max_row, 1).font = Font(bold=True, size=9)
            ws_rep.cell(ws_rep.max_row, 2).font = Font(bold=True, size=9, color="1E3A8A")

            dictamen_econ = (
                f"Las desviaciones técnicas y rendimientos modificados detectados representan una variación económica de "
                f"{inc_str} frente a los costos técnicos de la base de referencia oficial. "
                f"Se recomienda subsanar los APUs observados y fijar el presupuesto oficial ajustado de contratación en {adj_str}."
                if net_inc != 0 else
                "No se evidencia variación monetaria neta entre los análisis del presupuesto y los costos de la base técnica oficial."
            )
        else:
            dictamen_econ = (
                "Las modificaciones técnicas, alteraciones en rendimientos y variaciones en consumo de insumos detectadas "
                "en las partidas observadas representan una incidencia económica directa en la estructura de costos y precios unitarios del presupuesto. "
                "Se requiere la revisión financiera y conciliación de costos unitarios de los análisis observados previo a cualquier aprobación definitiva."
            )

        ws_rep.append([dictamen_econ])
        ws_rep.merge_cells(f"A{ws_rep.max_row}:G{ws_rep.max_row}")
        cell_mon = ws_rep[f"A{ws_rep.max_row}"]
        cell_mon.font = Font(size=9, color="1E293B")
        cell_mon.fill = section_fill
        cell_mon.alignment = Alignment(wrap_text=True, vertical="center")
        ws_rep.row_dimensions[ws_rep.max_row].height = 42
        ws_rep.append([])
        ws_rep.row_dimensions[ws_rep.max_row].height = 8

    # Verificación vs Versión Anterior (si existe)
    if detail.get("version_comparison"):
        vc = detail["version_comparison"]
        ws_rep.append([f"VERIFICACIÓN DE CORRECCIONES VS. VERSIÓN ANTERIOR (v{vc.get('previous_version_number', 1)}):"])
        ws_rep.cell(ws_rep.max_row, 1).font = Font(bold=True, size=10, color="0F172A")
        ws_rep.append([f"{vc.get('resolved_findings_count', 0)} corregidos · {vc.get('persistent_findings_count', 0)} sin corregir · {vc.get('new_findings_count', 0)} nuevos."])
        ws_rep.merge_cells(f"A{ws_rep.max_row}:G{ws_rep.max_row}")
        cell_vc = ws_rep[f"A{ws_rep.max_row}"]
        cell_vc.font = Font(size=9, bold=True, color="065F46")
        cell_vc.alignment = Alignment(vertical="center")

        resolved_list = vc.get("resolved_findings") or []
        for rf in resolved_list:
            headline = _get_excel_finding_headline(rf)
            item_code_val = getattr(rf, "item_code", "")
            clean_msg = _clean_excel_msg(getattr(rf, "message", ""))
            ws_rep.append([f"  ✓ Subsanado — {headline} (Partida {item_code_val}): {clean_msg}."])
            ws_rep.merge_cells(f"A{ws_rep.max_row}:G{ws_rep.max_row}")
            ws_rep.cell(ws_rep.max_row, 1).font = Font(size=8, color="065F46")
            ws_rep.cell(ws_rep.max_row, 1).alignment = Alignment(wrap_text=True, vertical="center")

        ws_rep.append([])
        ws_rep.row_dimensions[ws_rep.max_row].height = 8

    # Detalle de Correcciones por Partida (idéntico al informe impreso)
    ws_rep.append(["DETALLE DE CORRECCIONES:"])
    ws_rep.cell(ws_rep.max_row, 1).font = Font(bold=True, size=11, color="0F172A")
    ws_rep.append([])
    ws_rep.row_dimensions[ws_rep.max_row].height = 6

    # Agrupar hallazgos por partida
    item_lookup = {it.id: it for it in items}
    item_code_lookup = {it.original_code: it for it in items}

    grouped_findings: Dict[str, List[Any]] = defaultdict(list)
    for f in detail.get("findings") or []:
        key = getattr(f, "review_item_id", None) or getattr(f, "item_code", None) or "GENERAL"
        grouped_findings[str(key)].append(f)

    if not grouped_findings:
        ws_rep.append(["No se detectaron discrepancias técnicas con respecto a la base de contraste seleccionada."])
        ws_rep.cell(ws_rep.max_row, 1).font = Font(italic=True, size=9, color="64748B")
    else:
        for group_key, f_list in grouped_findings.items():
            first_f = f_list[0]
            it = item_lookup.get(getattr(first_f, "review_item_id", None)) or item_code_lookup.get(getattr(first_f, "item_code", None))
            item_code_str = getattr(first_f, "item_code", "") or (it.original_code if it else "")
            desc_str = (it.description if it else getattr(first_f, "component_description", "")) or ""
            unit_str = f" ({it.unit})" if it and it.unit else ""

            # Fila de cabecera de la partida
            p_row = ws_rep.max_row + 1
            ws_rep.append([f"Partida {item_code_str}  {desc_str[:120]}{unit_str}", "", "", "", "", "", "CON OBSERVACIONES"])
            ws_rep.merge_cells(f"A{p_row}:F{p_row}")
            cell_partida = ws_rep.cell(p_row, 1)
            cell_partida.font = Font(bold=True, size=9, color="1E3A8A")
            cell_partida.fill = item_header_fill
            cell_partida.alignment = Alignment(vertical="center")

            cell_obs = ws_rep.cell(p_row, 7)
            cell_obs.font = Font(bold=True, size=8, color="92400E")
            cell_obs.fill = item_header_fill
            cell_obs.alignment = Alignment(horizontal="center", vertical="center")
            ws_rep.row_dimensions[p_row].height = 20

            for idx, f in enumerate(f_list, start=1):
                headline = _get_excel_finding_headline(f)
                status_raw = getattr(f, "finding_status", None) or "PENDIENTE"
                rule_id_val = getattr(f, "rule_id", "")
                if status_raw == "PENDIENTE":
                    if rule_id_val in ("MAT-005", "EQU-005"):
                        status_tag = "[DEBE CONSIGNAR 1 COTIZACIÓN]"
                    elif rule_id_val == "LAB-003":
                        status_tag = "[CONSIGNAR SOPORTE / ESTUDIAR]"
                    else:
                        status_tag = "[PENDIENTE]"
                else:
                    status_tag = f"[{status_raw}]"

                clean_diagnosis = _clean_excel_msg(getattr(f, "message", ""))
                if rule_id_val in ("MAT-005", "EQU-005") and "cotizaci" not in clean_diagnosis.lower():
                    clean_diagnosis += "; la empresa contratista debe consignar 1 cotización comercial de proveedor"
                elif rule_id_val == "LAB-003" and "soporte" not in clean_diagnosis.lower():
                    clean_diagnosis += "; requiere estudio del revisor y consignar soporte curricular"

                sugg_str = getattr(f, "suggestion", None) or ""

                ws_rep.append([
                    f"  {idx}. {headline}: {clean_diagnosis}. {status_tag}"
                ])
                ws_rep.merge_cells(f"A{ws_rep.max_row}:G{ws_rep.max_row}")
                ws_rep.cell(ws_rep.max_row, 1).font = Font(size=9, color="1E293B")
                ws_rep.cell(ws_rep.max_row, 1).alignment = Alignment(wrap_text=True, vertical="center")
                ws_rep.row_dimensions[ws_rep.max_row].height = 22

                if sugg_str and sugg_str != "-":
                    ws_rep.append([
                        f"      Sugerencia técnica: {sugg_str}"
                    ])
                    ws_rep.merge_cells(f"A{ws_rep.max_row}:G{ws_rep.max_row}")
                    ws_rep.cell(ws_rep.max_row, 1).font = Font(size=8, italic=True, color="475569")
                    ws_rep.cell(ws_rep.max_row, 1).alignment = Alignment(wrap_text=True, vertical="center")
                    ws_rep.row_dimensions[ws_rep.max_row].height = 18

            ws_rep.append([])
            ws_rep.row_dimensions[ws_rep.max_row].height = 6

    # =========================================================================
    # Firmas y Conformidad Técnica (Tal como en la impresión oficial)
    # =========================================================================
    ws_rep.append([])
    ws_rep.row_dimensions[ws_rep.max_row].height = 14
    ws_rep.append(["FIRMAS Y CONFORMIDAD TÉCNICA:"])
    ws_rep.cell(ws_rep.max_row, 1).font = Font(bold=True, size=10, color="0F172A")

    ws_rep.append([])  # Espacio para firma física manuscrita / sello
    ws_rep.row_dimensions[ws_rep.max_row].height = 36

    # Líneas de firma
    sig_line_row = ws_rep.max_row + 1
    ws_rep.append(["", "____________________________________", "", "", "____________________________________", "", ""])
    ws_rep.merge_cells(f"B{sig_line_row}:C{sig_line_row}")
    ws_rep.merge_cells(f"E{sig_line_row}:G{sig_line_row}")
    ws_rep.cell(sig_line_row, 2).alignment = Alignment(horizontal="center")
    ws_rep.cell(sig_line_row, 5).alignment = Alignment(horizontal="center")
    ws_rep.cell(sig_line_row, 2).font = Font(bold=True, size=9, color="334155")
    ws_rep.cell(sig_line_row, 5).font = Font(bold=True, size=9, color="334155")
    ws_rep.row_dimensions[sig_line_row].height = 16

    # Nombres de los profesionales
    names_row = ws_rep.max_row + 1
    rev_name = detail.get("reviewer_name") or "Ingeniero Revisor"
    app_name = detail.get("approver_name") or "Ing. Director de Obras"
    ws_rep.append(["", rev_name, "", "", app_name, "", ""])
    ws_rep.merge_cells(f"B{names_row}:C{names_row}")
    ws_rep.merge_cells(f"E{names_row}:G{names_row}")
    ws_rep.cell(names_row, 2).font = Font(bold=True, size=10, color="0F172A")
    ws_rep.cell(names_row, 2).alignment = Alignment(horizontal="center")
    ws_rep.cell(names_row, 5).font = Font(bold=True, size=10, color="0F172A")
    ws_rep.cell(names_row, 5).alignment = Alignment(horizontal="center")
    ws_rep.row_dimensions[names_row].height = 18

    # CIVs
    civ_row = ws_rep.max_row + 1
    rev_civ = f"CIV: {detail['reviewer_civ']}" if detail.get("reviewer_civ") else "CIV: —"
    app_civ = f"CIV: {detail['approver_civ']}" if detail.get("approver_civ") else "CIV: —"
    ws_rep.append(["", rev_civ, "", "", app_civ, "", ""])
    ws_rep.merge_cells(f"B{civ_row}:C{civ_row}")
    ws_rep.merge_cells(f"E{civ_row}:G{civ_row}")
    ws_rep.cell(civ_row, 2).font = Font(size=9, color="475569")
    ws_rep.cell(civ_row, 2).alignment = Alignment(horizontal="center")
    ws_rep.cell(civ_row, 5).font = Font(size=9, color="475569")
    ws_rep.cell(civ_row, 5).alignment = Alignment(horizontal="center")
    ws_rep.row_dimensions[civ_row].height = 16

    # Cargo / Rol / Dirección
    role_row = ws_rep.max_row + 1
    app_dept = detail.get("approver_department") or "Dirección de Control de Obras y Proyectos"
    ws_rep.append(["", "Ingeniero Revisor", "", "", app_dept, "", ""])
    ws_rep.merge_cells(f"B{role_row}:C{role_row}")
    ws_rep.merge_cells(f"E{role_row}:G{role_row}")
    ws_rep.cell(role_row, 2).font = Font(bold=True, size=9, color="475569")
    ws_rep.cell(role_row, 2).alignment = Alignment(horizontal="center")
    ws_rep.cell(role_row, 5).font = Font(bold=True, size=9, color="475569")
    ws_rep.cell(role_row, 5).alignment = Alignment(horizontal="center")
    ws_rep.row_dimensions[role_row].height = 16

    # Institución (debajo del aprobador)
    if detail.get("institution_name"):
        inst_row = ws_rep.max_row + 1
        ws_rep.append(["", "", "", "", detail["institution_name"], "", ""])
        ws_rep.merge_cells(f"E{inst_row}:G{inst_row}")
        ws_rep.cell(inst_row, 5).font = Font(bold=True, size=8, color="64748B")
        ws_rep.cell(inst_row, 5).alignment = Alignment(horizontal="center")
        ws_rep.row_dimensions[inst_row].height = 15

    # Configuración de ancho de columnas y vista de impresión de la hoja
    ws_rep.column_dimensions["A"].width = 24
    ws_rep.column_dimensions["B"].width = 30
    ws_rep.column_dimensions["C"].width = 4
    ws_rep.column_dimensions["D"].width = 24
    ws_rep.column_dimensions["E"].width = 35
    ws_rep.column_dimensions["F"].width = 16
    ws_rep.column_dimensions["G"].width = 20

    ws_rep.page_setup.orientation = ws_rep.ORIENTATION_PORTRAIT
    ws_rep.page_setup.paperSize = ws_rep.PAPERSIZE_LETTER
    ws_rep.sheet_properties.pageSetUpPr.fitToPage = True
    ws_rep.page_setup.fitToWidth = 1
    ws_rep.page_setup.fitToHeight = 0
    ws_rep.oddFooter.left.text = f"{report_code} · v{version_num}"
    ws_rep.oddFooter.center.text = "Página &P de &N"
    ws_rep.oddFooter.right.text = f"Emitido el {rev_date_str}"

    # =========================================================================
    # 2. Hoja "Hallazgos de Auditoria" con ÚNICAMENTE las 11 columnas del archivo
    # =========================================================================
    ws_find = wb.create_sheet("Hallazgos de Auditoria")
    ws_find.append([
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
    ])
    style_header_row(ws_find, 1)

    crit_fill = PatternFill("solid", fgColor="FEE2E2")
    high_fill = PatternFill("solid", fgColor="FFEDD5")
    info_fill = PatternFill("solid", fgColor="E0F2FE")

    for f in detail.get("findings") or []:
        ws_find.append([
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
        ])
        row_cells = ws_find[ws_find.max_row]
        if getattr(f, "severity", "") == "CRITICA":
            for c in row_cells[:3]:
                c.fill = crit_fill
        elif getattr(f, "severity", "") == "ALTA":
            for c in row_cells[:3]:
                c.fill = high_fill
        elif getattr(f, "severity", "") == "INFO_MAPREX":
            for c in row_cells[:3]:
                c.fill = info_fill

    for idx, width in enumerate([12, 16, 16, 16, 38, 16, 20, 22, 14, 65, 55], start=1):
        ws_find.column_dimensions[get_column_letter(idx)].width = width
    ws_find.freeze_panes = "A2"

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    safe_name = re.sub(r"[^a-zA-Z0-9_-]+", "_", str(detail.get("name", "Presupuesto")))[:45] or "Presupuesto"
    return buf.getvalue(), f"Auditoria_{safe_name}_v{version_num}.xlsx"
