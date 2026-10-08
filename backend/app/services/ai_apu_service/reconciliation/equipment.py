import re
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.logging import logger
from app.db.base import get_db_session
from app.services.ai_apu_service.reconciliation.specs_matcher import (
    _extract_technical_specs,
    _has_technical_spec_conflict,
    _has_primary_noun_conflict,
    _RECONCILE_STOPWORDS,
)


def _normalize_equipment_prices(
    result: Dict[str, Any],
    base_apu: Optional[Dict[str, Any]] = None,
    complementary_apus: Optional[List[Dict[str, Any]]] = None,
) -> None:
    """
    Normaliza y asegura que los precios unitarios y factores de depreciación de los equipos
    no sufran doble depreciación y mantengan coherencia con la fórmula del editor APU:
    Total Día = Cantidad * Depreciación * Precio_Unitario.
    """
    if not result or not isinstance(result, dict) or "equipments" not in result:
        return

    equipments = result.get("equipments")
    if not isinstance(equipments, list):
        return

    # Mapeo de equipos base históricos y complementarios por código y descripción
    base_eq_map: Dict[str, Dict[str, Any]] = {}
    sources: List[Dict[str, Any]] = []
    if base_apu and isinstance(base_apu, dict):
        sources.append(base_apu)
    if complementary_apus and isinstance(complementary_apus, list):
        for comp in complementary_apus:
            if isinstance(comp, dict):
                sources.append(comp)

    for src in sources:
        for eq in src.get("equipos", []):
            if isinstance(eq, dict):
                cod = str(eq.get("codigo", "")).strip().upper()
                if cod:
                    base_eq_map[cod] = eq
                desc = str(eq.get("descripcion", "")).strip().upper()
                if desc:
                    base_eq_map[desc] = eq

    for eq_item in equipments:
        if not isinstance(eq_item, dict):
            continue

        cod = str(eq_item.get("codigo", "")).strip().upper()
        desc = str(eq_item.get("descripcion", "")).strip().upper()

        # 1. Si coincide con un equipo histórico de la base o complementarias, anclar precio y depreciación exactos
        base_match = base_eq_map.get(cod) or base_eq_map.get(desc)
        if base_match:
            base_price = float(base_match.get("precio_unitario") or 0.0)
            base_deprec = float(base_match.get("depreciacion") or 1.0)
            if base_price > 0:
                eq_item["precio_unitario"] = round(base_price, 2)
            if base_deprec > 0:
                eq_item["depreciacion"] = base_deprec
            if base_match.get("codigo"):
                eq_item["codigo"] = base_match["codigo"]
            continue

        # 2. Si es un equipo nuevo agregado por IA (ej. carretilla, pala nueva, etc.)
        deprec = float(eq_item.get("depreciacion") or 1.0)
        pu = float(eq_item.get("precio_unitario") or 0.0)

        # Si el LLM puso depreciación menor a 0.05 (ej: 0.01) pero un precio unitario diminuto (< 1.50)
        # significa que colocó el costo diario en lugar del valor de adquisición (provocando doble depreciación)
        if 0 < deprec < 0.05 and 0 < pu < 2.0:
            eq_item["precio_unitario"] = round(pu / deprec, 2)
        elif pu > 0 and deprec <= 0:
            eq_item["depreciacion"] = 1.0


def _execute_equipment_reconciliation(result: Dict[str, Any], db: Session) -> None:
    """
    Ejecuta la búsqueda y normalización de equipos contra cost360_equipment.
    Aplica filtros estrictos semánticos y técnicos para prevenir asignaciones erróneas.
    """
    if not isinstance(result, dict):
        return

    equipments = result.get("equipments")
    if not isinstance(equipments, list) or not equipments:
        return

    reconciled_terms: List[str] = []

    for eq in equipments:
        if not isinstance(eq, dict):
            continue

        is_ia = (str(eq.get("origen", "")).lower() in ("ia", "referencial"))
        cod = str(eq.get("codigo") or "").strip()
        no_cod = (not cod or cod.startswith("e-ia-") or cod.startswith("EQU-IA-"))
        zero_price = (float(eq.get("precio_unitario") or 0.0) <= 0.0)
        suspicious_deprec = (
            float(eq.get("depreciacion") or 1.0) == 1.0
            and float(eq.get("precio_unitario") or 0.0) > 100.0
        )

        matched_row = None

        # 1. Búsqueda exacta por código en cost360_equipment si está disponible
        if cod and not cod.startswith("e-ia-") and not cod.startswith("EQU-IA-"):
            sql_cod = text("""
                SELECT "CodEqu", ref_code, "Descri", "CosDia", precio, deprec_factor
                FROM cost360_equipment
                WHERE "CodEqu" = :cod OR ref_code = :cod
                LIMIT 1;
            """)
            matched_row = db.execute(sql_cod, {"cod": cod}).fetchone()

        # 2. Si no se encontró por código, búsqueda semántica estricta multi-token
        desc = str(eq.get("descripcion", "")).strip()
        if not matched_row and (is_ia or no_cod or zero_price or suspicious_deprec):
            clean = re.sub(r'[^A-Z0-9\s]', ' ', desc.upper())
            tokens = [w for w in clean.split() if len(w) >= 3 and w not in _RECONCILE_STOPWORDS]

            # REGLA ESTRICTA: Mínimo 2 tokens. Se prohíbe la búsqueda por 1 solo token.
            if len(tokens) >= 2:
                candidates_rows = []
                if len(tokens) >= 3:
                    sql3 = text("""
                        SELECT "CodEqu", ref_code, "Descri", "CosDia", precio, deprec_factor
                        FROM cost360_equipment
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
                        SELECT "CodEqu", ref_code, "Descri", "CosDia", precio, deprec_factor
                        FROM cost360_equipment
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

                    if _has_technical_spec_conflict(desc_specs, cand_specs):
                        continue
                    if _has_primary_noun_conflict(desc, cand_desc):
                        continue

                    norm_desc = re.sub(r'[^A-Z0-9]', ' ', desc.upper()).strip()
                    norm_cand = re.sub(r'[^A-Z0-9]', ' ', cand_desc.upper()).strip()
                    sim = SequenceMatcher(None, norm_desc, norm_cand).ratio()

                    cand_words = set(norm_cand.split())
                    desc_words = set(tokens)
                    common = desc_words & cand_words
                    jaccard = len(common) / len(desc_words | cand_words) if (desc_words | cand_words) else 0.0

                    if (sim >= 0.65 or (jaccard >= 0.45 and len(common) >= 2)) and sim > best_sim:
                        best_sim = sim
                        best_cand = cand

                if best_cand:
                    matched_row = best_cand

        if matched_row:
            matched_cod = matched_row.CodEqu or matched_row.ref_code
            matched_desc = matched_row.Descri
            matched_price = float(matched_row.precio or 0.0)
            matched_deprec = float(matched_row.deprec_factor or 1.0)
            matched_cosdia = float(matched_row.CosDia or 0.0)

            if matched_price <= 0 and matched_cosdia > 0 and matched_deprec > 0:
                matched_price = round(matched_cosdia / matched_deprec, 2)

            eq["codigo"] = matched_cod
            eq["descripcion"] = matched_desc
            eq["precio_unitario"] = matched_price
            eq["depreciacion"] = matched_deprec
            eq["origen"] = "historico"
            reconciled_terms.append(matched_desc.lower())
            reconciled_terms.append(desc.lower())
        else:
            if is_ia or no_cod or zero_price:
                eq["origen"] = "referencial"
                if not eq.get("codigo") or eq.get("codigo").startswith("e-") or eq.get("codigo").startswith("EQU-IA-"):
                    eq["codigo"] = "S/C"

    # Sanitizar advertencias de equipos
    if "advertencias" in result and isinstance(result["advertencias"], list):
        clean_adv: List[str] = []
        for adv in result["advertencias"]:
            adv_str = str(adv)
            if "[precio_referencial]" in adv_str.lower():
                if any(term in adv_str.lower() for term in reconciled_terms):
                    continue
            clean_adv.append(adv)
        result["advertencias"] = clean_adv

    # Asegurar advertencia de precio referencial para equipos no presentes en catálogo
    referential_eqs = [
        eq for eq in equipments
        if isinstance(eq, dict) and str(eq.get("origen", "")).lower() in ("ia", "referencial")
    ]
    for eq in referential_eqs:
        eq_desc = str(eq.get("descripcion", "")).strip()
        eq_pu = float(eq.get("precio_unitario") or 0.0)

        if "advertencias" in result and isinstance(result["advertencias"], list):
            result["advertencias"] = [
                a for a in result["advertencias"]
                if not (
                    "[precio_referencial]" in str(a).lower() and
                    (eq_desc.lower() in str(a).lower() or f"'{eq_desc.lower()}'" in str(a).lower())
                )
            ]

        adv_text = (
            f"[PRECIO_REFERENCIAL] Equipo incorporado (precio referencial de mercado): '{eq_desc}' "
            f"(${eq_pu:,.2f} USD). Verifique costo diario con proveedores locales."
        )
        result.setdefault("advertencias", []).append(adv_text)


def reconcile_equipment_with_database(result: Dict[str, Any], db: Optional[Session] = None) -> None:
    """
    Reconcilia los equipos del APU con el catálogo certificado de Costbase (cost360_equipment).
    Si un equipo tiene origen 'ia' o precio referencial estimado, busca en la BD el equipo real para:
    1. Asignar el código oficial de la BD (CodEqu o ref_code).
    2. Asignar la descripción estándar certificada.
    3. Asignar el precio de compra y factor de depreciación oficiales de la BD.
    4. Cambiar 'origen' a 'historico'.
    5. Purgar las advertencias de [PRECIO_REFERENCIAL] asociadas a dicho equipo.
    """
    if not result or not isinstance(result, dict) or "equipments" not in result:
        return

    if db is not None:
        _execute_equipment_reconciliation(result, db)
    else:
        try:
            with get_db_session() as session:
                _execute_equipment_reconciliation(result, session)
        except Exception as exc:
            logger.error("Error al reconciliar equipos con base de datos: %s", exc, exc_info=True)
