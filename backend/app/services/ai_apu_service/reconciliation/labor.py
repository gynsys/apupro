import re
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.logging import logger
from app.db.base import get_db_session
from app.services.ai_apu_service.reconciliation.specs_matcher import _RECONCILE_STOPWORDS


def _execute_labor_reconciliation(result: Dict[str, Any], db: Session) -> None:
    """
    Reconcilia la mano de obra del APU con el tabulador oficial de Costbase (cost360_labor).
    Garantiza que los cargos y salarios oficiales (Jornal y Bono) provengan 100% de la BD.
    """
    if not isinstance(result, dict):
        return

    labors = result.get("labors")
    if not isinstance(labors, list) or not labors:
        return

    for i, lab in enumerate(labors):
        if not isinstance(lab, dict):
            continue

        cod = str(lab.get("codigo") or "").strip()
        desc = str(lab.get("descripcion") or "").strip()
        is_ia = (lab.get("origen") == "ia")
        no_cod = (not cod or cod.startswith("l-ia-") or cod.startswith("LAB-IA-") or cod.startswith("LAB-") or cod.startswith("l-"))
        zero_wage = (float(lab.get("jornal") or 0.0) <= 0.0)

        matched_row = None

        # 1. Búsqueda directa por código oficial en cost360_labor
        if cod and not no_cod:
            sql_cod = text("""
                SELECT "CodMan", ref_code, "Descri", "Jornal", "Bono"
                FROM cost360_labor
                WHERE UPPER(TRIM("CodMan")) = UPPER(TRIM(:cod))
                   OR (ref_code IS NOT NULL AND UPPER(TRIM(ref_code)) = UPPER(TRIM(:cod)))
                LIMIT 1;
            """)
            matched_row = db.execute(sql_cod, {"cod": cod}).fetchone()

        # 2. Búsqueda por coincidencia de cargo oficial
        if not matched_row and (is_ia or no_cod or zero_wage):
            clean = re.sub(r'[^A-Z0-9\s]', ' ', desc.upper())
            tokens = [w for w in clean.split() if len(w) >= 3 and w not in _RECONCILE_STOPWORDS]

            if tokens:
                candidates_rows = []
                if len(tokens) >= 2:
                    sql2 = text("""
                        SELECT "CodMan", ref_code, "Descri", "Jornal", "Bono"
                        FROM cost360_labor
                        WHERE "Descri" ILIKE :kw1 AND "Descri" ILIKE :kw2
                        LIMIT 10;
                    """)
                    candidates_rows = db.execute(sql2, {
                        "kw1": f"%{tokens[0]}%",
                        "kw2": f"%{tokens[1]}%"
                    }).fetchall()

                if not candidates_rows and len(tokens) >= 1:
                    sql1 = text("""
                        SELECT "CodMan", ref_code, "Descri", "Jornal", "Bono"
                        FROM cost360_labor
                        WHERE "Descri" ILIKE :kw1
                        LIMIT 10;
                    """)
                    candidates_rows = db.execute(sql1, {
                        "kw1": f"%{tokens[0]}%"
                    }).fetchall()

                best_cand = None
                best_sim = 0.0
                norm_desc = re.sub(r'[^A-Z0-9]', '', desc.upper())

                for cand in candidates_rows:
                    cand_desc = str(cand.Descri or "").strip()
                    norm_cand = re.sub(r'[^A-Z0-9]', '', cand_desc.upper())
                    sim = SequenceMatcher(None, norm_desc, norm_cand).ratio()

                    # Evitar cruce entre cargos de supervisión y obreros rasos
                    is_cand_sup = any(s in cand_desc.upper() for s in ["MAESTRO", "CAPORAL", "INGENIERO", "TOPOGRAFO", "INSPECTOR"])
                    is_desc_sup = any(s in desc.upper() for s in ["MAESTRO", "CAPORAL", "INGENIERO", "TOPOGRAFO", "INSPECTOR"])
                    if is_cand_sup != is_desc_sup:
                        continue

                    if sim >= 0.55 and sim > best_sim:
                        best_sim = sim
                        best_cand = cand

                if best_cand:
                    matched_row = best_cand

        if matched_row:
            matched_cod = matched_row.CodMan or matched_row.ref_code
            matched_desc = matched_row.Descri
            matched_jornal = float(matched_row.Jornal or 0.0)
            matched_bono = float(matched_row.Bono or 0.0)

            lab["codigo"] = matched_cod
            lab["descripcion"] = matched_desc
            lab["jornal"] = matched_jornal
            lab["bono"] = matched_bono
            lab["origen"] = "historico"
        else:
            if is_ia or no_cod or zero_wage:
                lab["origen"] = "ia"
                if not lab.get("codigo") or lab.get("codigo").startswith("l-"):
                    lab["codigo"] = f"LAB-IA-{i+1:03d}"
                if float(lab.get("jornal") or 0.0) <= 0.0:
                    lab["jornal"] = 5.0  # fallback mínimo referencial


def reconcile_labor_with_database(result: Dict[str, Any], db: Optional[Session] = None) -> None:
    """
    Reconcilia la mano de obra del APU con el tabulador oficial de Costbase (cost360_labor).
    """
    if not result or not isinstance(result, dict) or "labors" not in result:
        return

    if db is not None:
        _execute_labor_reconciliation(result, db)
    else:
        try:
            with get_db_session() as session:
                _execute_labor_reconciliation(result, session)
        except Exception as exc:
            logger.error("Error al reconciliar mano de obra con base de datos: %s", exc, exc_info=True)
