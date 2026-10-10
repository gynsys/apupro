import re
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.logging import logger
from app.db.base import get_db_session
from app.services.web_price_researcher import research_material_web_price
from app.services.ai_apu_service.reconciliation.specs_matcher import (
    _extract_technical_specs,
    _has_technical_spec_conflict,
    _has_primary_noun_conflict,
    _convert_material_quantity,
    _RECONCILE_STOPWORDS,
)


def _execute_material_reconciliation(result: Dict[str, Any], db: Session) -> None:
    """
    Reconcilia los materiales del APU con el catálogo certificado de Costbase (cost360_materials).
    Solo si existe coincidencia de alta fidelidad (semántica, tokens y sin conflicto técnico):
    1. Asigna el código oficial de la BD (CodMat o ref_code).
    2. Asigna la descripción certificada de la BD correspondiente al código.
    3. Asigna el precio unitario oficial de la BD.
    4. Cambia 'origen' a 'historico'.
    Si NO hay coincidencia certera:
    - El insumo se conserva estrictamente como 'ia' con su precio referencial de mercado y advertencia.
    - Se consulta a research_material_web_price para obtener precio estimado en USD.
    """
    if not isinstance(result, dict):
        return

    materials = result.get("materials")
    if not isinstance(materials, list) or not materials:
        return

    reconciled_terms: List[str] = []
    recon_trace = result.setdefault("debug_reconciliation_trace", {
        "materiales": {"total_insumos": len(materials), "reconciliados_historico": [], "mantenidos_referencial": []},
        "equipos": {"total_insumos": 0, "reconciliados_historico": [], "mantenidos_referencial": []},
        "mano_obra": {"total_insumos": 0, "reconciliados_historico": [], "mantenidos_referencial": []}
    })
    mat_trace = recon_trace["materiales"]
    mat_trace["total_insumos"] = len(materials)

    for mat in materials:
        if not isinstance(mat, dict):
            continue

        is_ia = (str(mat.get("origen", "")).lower() in ("ia", "referencial"))
        cod = str(mat.get("codigo") or "").strip()
        no_cod = (not cod or cod.startswith("m-ia-") or cod.startswith("MAT-IA-") or cod.startswith("MAT-"))
        zero_price = (float(mat.get("precio_unitario") or 0.0) <= 0.0)

        matched_row = None

        # 1. Búsqueda directa por código exacto en la tabla de materiales si ya es un código de catálogo
        if cod and not cod.startswith("m-ia-") and not cod.startswith("MAT-IA-"):
            sql_cod = text("""
                SELECT "CodMat", ref_code, "Descri", "UniMat", "CosMat"
                FROM cost360_materials
                WHERE UPPER(TRIM("CodMat")) = UPPER(TRIM(:c))
                   OR (ref_code IS NOT NULL AND UPPER(TRIM(ref_code)) = UPPER(TRIM(:c)))
                LIMIT 1;
            """)
            matched_row = db.execute(sql_cod, {"c": cod}).fetchone()

        # 2. Si no coincide por código y es 'ia' o precio cero o código provisional,
        # buscar por coincidencia estricta multi-token en la descripción
        desc = str(mat.get("descripcion", "")).strip()
        if not matched_row and (is_ia or no_cod or zero_price):
            clean = re.sub(r'[^A-Z0-9\s]', ' ', desc.upper())
            tokens = [w for w in clean.split() if len(w) >= 3 and w not in _RECONCILE_STOPWORDS]

            # REGLA ESTRICTA: Mínimo 2 tokens significativos. Se elimina la búsqueda por 1 solo token.
            if len(tokens) >= 2:
                candidates_rows = []
                if len(tokens) >= 3:
                    sql3 = text("""
                        SELECT "CodMat", ref_code, "Descri", "UniMat", "CosMat"
                        FROM cost360_materials
                        WHERE "Descri" ILIKE :kw1 AND "Descri" ILIKE :kw2 AND "Descri" ILIKE :kw3
                        LIMIT 15;
                    """)
                    candidates_rows = db.execute(sql3, {
                        "kw1": f"%{tokens[0]}%",
                        "kw2": f"%{tokens[1]}%",
                        "kw3": f"%{tokens[2]}%"
                    }).fetchall()

                if not candidates_rows and len(tokens) >= 2:
                    sql2 = text("""
                        SELECT "CodMat", ref_code, "Descri", "UniMat", "CosMat"
                        FROM cost360_materials
                        WHERE "Descri" ILIKE :kw1 AND "Descri" ILIKE :kw2
                        LIMIT 15;
                    """)
                    candidates_rows = db.execute(sql2, {
                        "kw1": f"%{tokens[0]}%",
                        "kw2": f"%{tokens[1]}%"
                    }).fetchall()

                best_cand = None
                best_sim = 0.0
                desc_specs = _extract_technical_specs(desc)

                for cand in candidates_rows:
                    cand_desc = str(cand.Descri or "").strip()
                    cand_specs = _extract_technical_specs(cand_desc)

                    # 1. Filtro: Conflicto de especificaciones técnicas (ej: 1" vs 2", 1 HP vs 2 HP)
                    if _has_technical_spec_conflict(desc_specs, cand_specs):
                        continue

                    # 2. Filtro: Conflicto de sustantivo primario / accesorio
                    if _has_primary_noun_conflict(desc, cand_desc):
                        continue

                    # 3. Filtro: Compatibilidad dimensional de unidad de medida
                    current_mat_unit = str(mat.get("unidad") or "").strip()
                    cand_unit = str(cand.UniMat or "").strip()
                    _, is_compatible = _convert_material_quantity(
                        qty=float(mat.get("cantidad") or 1.0),
                        from_unit_raw=current_mat_unit,
                        to_unit_raw=cand_unit,
                        mat_desc=desc
                    )
                    if not is_compatible:
                        continue

                    norm_desc = re.sub(r'[^A-Z0-9]', ' ', desc.upper()).strip()
                    norm_cand = re.sub(r'[^A-Z0-9]', ' ', cand_desc.upper()).strip()
                    sim = SequenceMatcher(None, norm_desc, norm_cand).ratio()

                    cand_words = set(norm_cand.split())
                    desc_words = set(tokens)
                    common = desc_words & cand_words
                    jaccard = len(common) / len(desc_words | cand_words) if (desc_words | cand_words) else 0.0

                    # Umbral estricto: Ratio >= 0.65 o (jaccard >= 0.45 y al menos 2 palabras clave coincidentes)
                    if (sim >= 0.65 or (jaccard >= 0.45 and len(common) >= 2)) and sim > best_sim:
                        best_sim = sim
                        best_cand = cand

                if best_cand:
                    matched_row = best_cand

        if matched_row:
            matched_cod = matched_row.CodMat or matched_row.ref_code
            matched_desc = matched_row.Descri
            matched_price = float(matched_row.CosMat or 0.0)
            matched_unit = matched_row.UniMat

            # Recalcular cantidad si hubo conversión dimensional de unidad (ej. kg -> saco)
            current_mat_unit = str(mat.get("unidad") or "").strip()
            new_qty, is_comp = _convert_material_quantity(
                qty=float(mat.get("cantidad") or 1.0),
                from_unit_raw=current_mat_unit,
                to_unit_raw=str(matched_unit or ""),
                mat_desc=desc
            )
            if is_comp and new_qty is not None:
                mat["cantidad"] = new_qty

            mat["codigo"] = matched_cod
            mat["descripcion"] = matched_desc  # REGLA DE INTEGRIDAD: Código de catálogo siempre lleva su descripción oficial
            if matched_price > 0:
                mat["precio_unitario"] = matched_price
            if matched_unit:
                mat["unidad"] = matched_unit
            mat["origen"] = "historico"
            reconciled_terms.append(matched_desc.lower())
            reconciled_terms.append(desc.lower())
            mat_trace["reconciliados_historico"].append({
                "original_llm": desc,
                "cod_mat": matched_cod,
                "ref_code": getattr(matched_row, "ref_code", None),
                "descripcion_bd": matched_desc,
                "unidad_bd": matched_unit,
                "precio_unitario_bd": matched_price,
            })
        else:
            # Si no hubo coincidencia estricta en el catálogo, es un material referencial
            if is_ia or no_cod or zero_price:
                mat["origen"] = "referencial"
                if not mat.get("codigo") or mat.get("codigo").startswith("m-") or mat.get("codigo").startswith("MAT-IA-"):
                    mat["codigo"] = "S/C"

                # Investigar precio promedio en internet para el insumo faltante
                mat_desc = mat.get("descripcion", "")
                mat_unit = mat.get("unidad", "")
                try:
                    web_info = research_material_web_price(mat_desc, mat_unit)
                    if web_info and web_info.get("precio_promedio"):
                        mat["precio_unitario"] = float(web_info["precio_promedio"])
                        mat["precio_web_info"] = web_info
                    else:
                        pu = float(mat.get("precio_unitario") or 0.0)
                        if pu <= 0:
                            mat["precio_unitario"] = 10.0  # fallback mínimo referencial
                except Exception as w_err:
                    logger.warning("Error al buscar precio web para material '%s': %s", mat_desc, w_err)
                    pu = float(mat.get("precio_unitario") or 0.0)
                    if pu <= 0:
                        mat["precio_unitario"] = 10.0

                mat_trace["mantenidos_referencial"].append({
                    "descripcion": mat_desc or desc,
                    "unidad": mat_unit or str(mat.get("unidad") or ""),
                    "precio_referencial": float(mat.get("precio_unitario") or 0.0),
                    "fuente_precio": "investigacion_web" if mat.get("precio_web_info") else "estimacion_llm",
                    "motivo": "Sin coincidencia en catálogo certificado de Costbase"
                })

    # Sanitizar advertencias de precios referenciales si el material fue reconciliado con catálogo
    if "advertencias" in result and isinstance(result["advertencias"], list) and reconciled_terms:
        clean_adv: List[str] = []
        for adv in result["advertencias"]:
            adv_str = str(adv)
            if "[precio_referencial]" in adv_str.lower():
                if any(term in adv_str.lower() for term in reconciled_terms):
                    continue
            clean_adv.append(adv)
        result["advertencias"] = clean_adv

    # Asegurar advertencia de precio referencial para insumos no presentes en catálogo
    referential_mats = [
        mat for mat in materials
        if isinstance(mat, dict) and str(mat.get("origen", "")).lower() in ("ia", "referencial")
    ]
    for mat in referential_mats:
        mat_desc = str(mat.get("descripcion", "")).strip()
        mat_pu = float(mat.get("precio_unitario") or 0.0)
        web_info = mat.get("precio_web_info")

        if "advertencias" in result and isinstance(result["advertencias"], list):
            result["advertencias"] = [
                a for a in result["advertencias"]
                if not (
                    "[precio_referencial]" in str(a).lower() and
                    (mat_desc.lower() in str(a).lower() or f"'{mat_desc.lower()}'" in str(a).lower())
                )
            ]

        if web_info:
            adv_text = (
                f"[PRECIO_REFERENCIAL] Insumo incorporado (precio web investigado): '{mat_desc}' "
                f"(${mat_pu:,.2f} USD). Promedio investigado en internet. Verifique precio local."
            )
        else:
            adv_text = (
                f"[PRECIO_REFERENCIAL] Insumo incorporado (precio referencial de mercado): '{mat_desc}' "
                f"(${mat_pu:,.2f} USD). Verifique precio local con proveedores."
            )
        result.setdefault("advertencias", []).append(adv_text)


def reconcile_materials_with_database(result: Dict[str, Any], db: Optional[Session] = None) -> None:
    """
    Reconcilia los materiales del APU con el catálogo certificado de Costbase (cost360_materials).
    Si un material tiene origen 'ia' o precio referencial estimado, busca en la BD el material real para:
    1. Asignar el código oficial de la BD (CodMat o ref_code).
    2. Asignar el precio unitario oficial de la BD.
    3. Cambiar 'origen' a 'historico'.
    4. Purgar las advertencias de [PRECIO_REFERENCIAL] asociadas a dicho material.
    """
    if not result or not isinstance(result, dict) or "materials" not in result:
        return

    if db is not None:
        _execute_material_reconciliation(result, db)
    else:
        try:
            with get_db_session() as session:
                _execute_material_reconciliation(result, session)
        except Exception as exc:
            logger.error("Error al reconciliar materiales con base de datos: %s", exc, exc_info=True)


def _enforce_base_apu_material_heritage(
    result: Dict[str, Any],
    base_apu: Dict[str, Any],
    complementary_apus: Optional[List[Dict[str, Any]]] = None
) -> None:
    """
    Garantiza que todo insumo de material presente en el resultado que provenga
    de la partida base histórica (o complementarias) mantenga 'origen': 'historico',
    su código oficial de la base y su precio unitario de catálogo.
    """
    if not result or not isinstance(result, dict) or "materials" not in result:
        return

    materials = result.get("materials")
    if not isinstance(materials, list) or not materials:
        return

    base_mats = base_apu.get("materiales", []) if isinstance(base_apu, dict) else []
    comp_mats: List[Dict[str, Any]] = []
    if complementary_apus:
        for c in complementary_apus:
            if isinstance(c, dict) and "materiales" in c:
                comp_mats.extend(c.get("materiales", []))

    all_reference_mats = base_mats + comp_mats
    if not all_reference_mats:
        return

    def _norm(s: Any) -> str:
        clean = re.sub(r'[^A-Z0-9]', '', str(s or '').upper())
        return clean

    ref_by_code: Dict[str, Dict[str, Any]] = {}
    ref_by_desc: Dict[str, Dict[str, Any]] = {}
    for rm in all_reference_mats:
        if not isinstance(rm, dict):
            continue
        c = str(rm.get("codigo") or "").strip().upper()
        if c:
            ref_by_code[c] = rm
        d = _norm(rm.get("descripcion", ""))
        if d:
            ref_by_desc[d] = rm

    for mat in materials:
        if not isinstance(mat, dict):
            continue
        mat_cod = str(mat.get("codigo") or "").strip().upper()
        mat_desc_norm = _norm(mat.get("descripcion", ""))

        matched_ref = None
        if mat_cod and mat_cod in ref_by_code:
            matched_ref = ref_by_code[mat_cod]
        elif mat_desc_norm and mat_desc_norm in ref_by_desc:
            matched_ref = ref_by_desc[mat_desc_norm]
        else:
            mat_raw_desc = str(mat.get("descripcion") or "")
            mat_specs = _extract_technical_specs(mat_raw_desc)
            clean_mat = re.sub(r'[^A-Z0-9\s]', ' ', mat_raw_desc.upper())
            tokens_mat = set(w for w in clean_mat.split() if len(w) >= 3 and w not in _RECONCILE_STOPWORDS)

            best_sim = 0.0
            for r_norm, rm in ref_by_desc.items():
                rm_raw_desc = str(rm.get("descripcion") or "")
                rm_specs = _extract_technical_specs(rm_raw_desc)

                # 1. Filtro: Conflicto de especificaciones técnicas (ej: 1" vs 2", 1 HP vs 2 HP)
                if _has_technical_spec_conflict(mat_specs, rm_specs):
                    continue

                # 2. Filtro: Conflicto de accesorio vs sustantivo principal
                if _has_primary_noun_conflict(mat_raw_desc, rm_raw_desc):
                    continue

                # 3. Similitud estricta por tokens y secuencia
                clean_rm = re.sub(r'[^A-Z0-9\s]', ' ', rm_raw_desc.upper())
                tokens_rm = set(w for w in clean_rm.split() if len(w) >= 3 and w not in _RECONCILE_STOPWORDS)
                common = tokens_mat & tokens_rm
                jaccard = len(common) / len(tokens_mat | tokens_rm) if (tokens_mat | tokens_rm) else 0.0
                ratio = SequenceMatcher(None, mat_desc_norm, r_norm).ratio()

                if (ratio >= 0.70 or (jaccard >= 0.50 and len(common) >= 2)) and ratio > best_sim:
                    best_sim = ratio
                    matched_ref = rm

        if matched_ref:
            mat["origen"] = "historico"
            if matched_ref.get("codigo"):
                mat["codigo"] = matched_ref["codigo"]
            mat["descripcion"] = matched_ref.get("descripcion", mat.get("descripcion"))
            ref_price = float(matched_ref.get("precio_unitario") or 0.0)
            if ref_price > 0:
                mat["precio_unitario"] = ref_price
            ref_unit = matched_ref.get("unidad")
            if ref_unit:
                new_qty, is_comp = _convert_material_quantity(
                    qty=float(mat.get("cantidad") or 1.0),
                    from_unit_raw=str(mat.get("unidad") or ""),
                    to_unit_raw=str(ref_unit),
                    mat_desc=str(mat.get("descripcion") or "")
                )
                if is_comp and new_qty is not None:
                    mat["cantidad"] = new_qty
                    mat["unidad"] = ref_unit
