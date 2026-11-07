"""Servicio orquestador de Revisión y Auditoría de Presupuestos (Maprex vs CostBase)."""
from __future__ import annotations

from collections import Counter
import io
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

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
    """Crea las tablas aisladas de revisión si aún no existen en la base de datos."""
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
    schema = _resolve_schema_name(db, database_id)
    ref_maps = _load_master_reference_maps(db, schema)

    fcas_pct = float(header_info.get("fcas_percent") if header_info.get("fcas_percent") is not None else 417.0)
    admin_pct = float(header_info.get("admin_percent") if header_info.get("admin_percent") is not None else 15.0)
    profit_pct = float(header_info.get("profit_percent") if header_info.get("profit_percent") is not None else 10.0)
    iva_pct = float(header_info.get("iva_percent") if header_info.get("iva_percent") is not None else 16.0)

    snapshot = ReviewSnapshot(
        user_id=str(user_id),
        source_type=str(header_info.get("source_type") or "file"),
        source_budget_id=header_info.get("source_budget_id"),
        source_filename=header_info.get("source_filename"),
        database_id=database_id or "master",
        name=str(header_info.get("name") or "Presupuesto Auditado"),
        project_name=header_info.get("project_name"),
        client_name=header_info.get("client_name"),
        currency=str(header_info.get("currency") or "USD"),
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
        "name": budget.name,
        "project_name": budget.project_name,
        "client_name": budget.client_name,
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
) -> ReviewSnapshot:
    """Importa un archivo externo (Maprex Excel APU, Excel presupuesto, CSV o PDF) a la base de revisión y lo audita."""
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
        "name": hdr.get("budget_name") or filename,
        "project_name": hdr.get("project_name"),
        "client_name": hdr.get("client_name"),
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


def list_review_snapshots(db: Session, user_id: str, limit: int = 30) -> List[ReviewSnapshot]:
    """Lista las auditorías recientes del usuario."""
    ensure_review_tables()
    return (
        db.query(ReviewSnapshot)
        .filter(ReviewSnapshot.user_id == str(user_id))
        .order_by(ReviewSnapshot.created_at.desc())
        .limit(limit)
        .all()
    )


def get_review_snapshot_detail(db: Session, snapshot_id: str, user_id: str) -> Dict[str, Any]:
    """Obtiene el detalle completo de un snapshot de auditoría con desgloses estadísticos."""
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
        "origin_breakdown": dict(origin_counts),
        "category_breakdown": dict(category_counts),
        "items": snap.items,
        "findings": snap.findings,
    }


def delete_review_snapshot(db: Session, snapshot_id: str, user_id: str) -> None:
    """Elimina un snapshot de auditoría."""
    ensure_review_tables()
    snap = db.query(ReviewSnapshot).filter(ReviewSnapshot.id == snapshot_id).first()
    if not snap:
        raise LookupError("Auditoría no encontrada.")
    db.delete(snap)
    db.commit()


def export_audit_report_excel(db: Session, snapshot_id: str, user_id: str) -> Tuple[bytes, str]:
    """Genera un archivo Excel (.xlsx) profesional con las 4 hojas del Informe de Auditoría de Presupuesto."""
    detail = get_review_snapshot_detail(db, snapshot_id, user_id)
    wb = Workbook()

    header_fill = PatternFill("solid", fgColor="0A4275")
    header_font = Font(color="FFFFFF", bold=True, size=10)
    crit_fill = PatternFill("solid", fgColor="FEE2E2")
    high_fill = PatternFill("solid", fgColor="FFEDD5")
    info_fill = PatternFill("solid", fgColor="E0F2FE")

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
        ("Nombre del Presupuesto", detail["name"]),
        ("Obra / Proyecto", detail["project_name"] or "-"),
        ("Cliente / Contratante", detail["client_name"] or "-"),
        ("Fuente de Auditoría", detail["source_filename"] or f"Presupuesto CostBase ({detail['source_budget_id']})"),
        ("Base de Datos de Contraste", detail["database_id"]),
        ("Moneda", detail["currency"]),
        ("Puntaje de Salud (0 - 100)", detail["health_score"]),
        ("Total Partidas Auditadas", detail["total_items"]),
        ("Partidas Codificadas (CostBase / Maprex)", detail["coded_items_count"]),
        ("Partidas Sin Código COVENIN (S/C)", detail["uncoded_items_count"]),
        ("Hallazgos Severidad CRÍTICA", detail["critical_findings_count"]),
        ("Hallazgos Severidad ALTA", detail["high_findings_count"]),
        ("Hallazgos Severidad MEDIA", detail["medium_findings_count"]),
        ("Notas Nativas Maprex vs CostBase (INFO)", detail["info_findings_count"]),
    ]
    for k, v in summary_rows:
        ws_sum.append([k, v])
    ws_sum.column_dimensions["A"].width = 42
    ws_sum.column_dimensions["B"].width = 50

    # 2. Hoja Hallazgos de Auditoría
    ws_find = wb.create_sheet("Hallazgos de Auditoria")
    ws_find.append([
        "Severidad",
        "Regla",
        "Categoría",
        "Código Partida",
        "Código Insumo",
        "Descripción Insumo",
        "Campo Auditado",
        "Valor Presupuesto",
        "Valor Maestro CostBase",
        "% Diferencia",
        "Diagnóstico",
        "Sugerencia Técnica",
    ])
    style_header_row(ws_find, 1)
    for f in detail["findings"]:
        ws_find.append([
            f.severity,
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
        if f.severity == "CRITICA":
            for c in row_cells[:4]:
                c.fill = crit_fill
        elif f.severity == "ALTA":
            for c in row_cells[:4]:
                c.fill = high_fill
        elif f.severity == "INFO_MAPREX":
            for c in row_cells[:4]:
                c.fill = info_fill

    for idx, width in enumerate([14, 10, 16, 16, 16, 38, 16, 20, 22, 14, 65, 55], start=1):
        ws_find.column_dimensions[get_column_letter(idx)].width = width
    ws_find.freeze_panes = "A2"

    # 3. Hoja Partidas con Discrepancias (Solo partidas con hallazgos)
    ws_items = wb.create_sheet("Partidas con Discrepancias")
    ws_items.append([
        "Fila",
        "N° Hallazgos",
        "Código Importado",
        "Código Maestro",
        "Origen Catalográfico",
        "Unidad Imp.",
        "Unidad Maestra",
        "Cantidad",
        "Rend. Importado",
        "Rend. Maestro",
        "P.U. Calculado",
        "P.U. Maestro Ref.",
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
    for idx, width in enumerate([7, 13, 16, 16, 26, 12, 14, 12, 15, 15, 15, 15, 16, 70], start=1):
        ws_items.column_dimensions[get_column_letter(idx)].width = width
    ws_items.freeze_panes = "A2"

    # 4. Hoja Partidas Sin Código COVENIN (S/C)
    ws_sc = wb.create_sheet("Partidas S-C y Equivalentes")
    ws_sc.append([
        "Fila",
        "Código Declarado",
        "Unidad",
        "Descripción en Presupuesto",
        "Equivalente Maestro Sugerido",
        "% Similitud",
        "Descripción Maestro Sugerido",
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

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    safe_name = re.sub(r"[^a-zA-Z0-9_-]+", "_", str(detail["name"]))[:45]
    return buf.getvalue(), f"Auditoria_{safe_name}.xlsx"
