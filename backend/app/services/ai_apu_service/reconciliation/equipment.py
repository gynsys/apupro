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


def is_minor_or_manual_tool(description: str, code: str = "") -> bool:
    """
    Identifica si un equipo corresponde a herramientas manuales o menores
    (palas, picos, carretillas, andamios simples, herramientas de albañilería/demolición manual, etc.)
    que deben operar en modalidad de equipo propio (amortización diaria < 1.0)
    en lugar de modalidad de alquiler directo (1.0).
    """
    if not description and not code:
        return False
    desc = str(description or "").upper()
    code_clean = str(code or "").upper()

    # 1. Exclusiones taxativas: maquinaria pesada, vehículos, equipos motorizados o eléctricos de potencia
    heavy_exclusions = (
        "RETROEXCAVADORA", "EXCAVADORA", "MINICARGADOR", "BOBCAT", "CARGADOR FRONTAL",
        "CAMION", "CAMIÓN", "TRACTOR", "GRUA", "GRÚA", "VIBROCOMPACTADOR", "RODILLO",
        "MEZCLADORA", "TROMPO", "COMPRESOR", "MOTOBOMBA", "PLANTA ELECTRICA", "GENERADOR",
        "DEMOLEDOR", "MARTILLO DEMOLEDOR", "ROTOMARTILLO", "CORE DRILL", "CORTADORA DE PAVIMENTO",
        "SIERRA CIRCULAR", "SOLDADORA", "EQUIPO DE BOMBEO", "MONTACARGA"
    )
    if any(h in desc for h in heavy_exclusions):
        return False

    # 2. Códigos conocidos de herramientas menores de albañilería / manuales en la base maestra
    known_minor_codes = ("ALB084", "ALB013", "COM024", "COM026", "ALB004", "ALB052", "ALB067", "SUB023")
    if any(code_clean.startswith(c) for c in known_minor_codes):
        return True

    # 3. Patrones semánticos de herramientas manuales o menores
    minor_patterns = (
        "PALA", "PICO", "PIQUETA", "CHICURA", "CHÍCURA",
        "CARRETILL", "CARRUCHA", "CARRETON", "CARRETÓN", "BUGGI", "BUGGY",
        "ANDAMIO",
        "MANDARRIA", "MAZO", "CINCEL", "CORTAFRIO", "CORTAFRÍO", "PATA DE CABRA",
        "BARRA METALICA", "BARRA METÁLICA", "BARRA OCTOGONAL", "BARRA PARA HOYAR", "PALANQUETA", "BARRETA",
        "HERRAMIENTAS MENORES", "HERRAMIENTAS MANUALES", "JUEGO DE HERRAMIENTAS",
        "ALBAÑILERIA", "ALBAÑIL",
        "PALUSTRA", "CUCHARA DE ALBAÑIL", "LLANA", "ESPATULA", "ESPÁTULA",
        "CEPILLO CARRETERO", "CEPILLO ALBAÑILERIA", "TOBO", "BALDE",
        "CIZALLA MANUAL", "PLOMADA", "NIVEL DE MANO"
    )
    return any(p in desc for p in minor_patterns)


def get_default_minor_tool_deprec(description: str) -> float:
    """
    Determina la tasa de depreciación diaria estándar (deprec < 1.0) para una herramienta menor o andamio:
    - Andamios simples (tubulares/colgantes): 0.008 (0.8% diario, vida útil ~125 días).
    - Herramientas manuales de demolición/excavación/carga (palas, picos, carretillas, barras, mandarrias): 0.025 (2.5% diario, vida útil ~40 días).
    - Herramientas generales o juegos de albañilería: 0.02 (2% diario, vida útil ~50 días).
    """
    desc = str(description or "").upper()
    if "ANDAMIO" in desc:
        return 0.008
    if any(k in desc for k in ("PALA", "PICO", "CARRETILL", "MANDARRIA", "BARRA", "CINCEL", "CORTAFRIO", "PIQUETA", "CHICURA")):
        return 0.025
    return 0.02


def enforce_minor_tools_amortization(result: Dict[str, Any]) -> None:
    """
    Regla automática:
    Fuerza la modalidad de amortización / equipo propio (deprec < 1.0) para todas las herramientas
    manuales o menores (palas, picos, carretillas, andamios simples, kits de albañilería).
    Si el equipo proviene de una partida base antigua con el vicio de depreciación = 1.0 (alquiler),
    recalibra la depreciación a la tasa de desgaste diario real y escala el precio unitario al valor
    de reposición/compra nuevo, manteniendo la equivalencia matemática del costo diario de operación.
    """
    if not result or not isinstance(result, dict):
        return

    equipments_key = "equipments" if "equipments" in result else "equipos" if "equipos" in result else None
    if not equipments_key:
        return

    equipments = result.get(equipments_key)
    if not isinstance(equipments, list):
        return

    for eq in equipments:
        if not isinstance(eq, dict):
            continue

        desc = str(eq.get("descripcion") or "").strip()
        cod = str(eq.get("codigo") or "").strip()
        deprec = float(eq.get("depreciacion") or 1.0)
        pu = float(eq.get("precio_unitario") or 0.0)

        if is_minor_or_manual_tool(desc, cod) and deprec >= 0.9:
            f_deprec = get_default_minor_tool_deprec(desc)
            eq["depreciacion"] = f_deprec
            if pu > 0:
                # El precio representaba el costo diario: escalar a valor de adquisición nuevo
                eq["precio_unitario"] = round(pu / f_deprec, 2)

            if "nota_calculo" in eq and isinstance(eq["nota_calculo"], str) and eq["nota_calculo"]:
                orig_nota = eq["nota_calculo"]
                eq["nota_calculo"] = f"{orig_nota} (Modalidad equipo propio: amortización diaria calibrada al {f_deprec*100:.1f}%)."
            else:
                eq["nota_calculo"] = f"Herramienta propia: amortización diaria calibrada al {f_deprec*100:.1f}%."


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

            # Si es herramienta menor / manual y la base tenía deprec = 1.0, forzar amortización propia
            match_desc = desc or str(base_match.get("descripcion", ""))
            if is_minor_or_manual_tool(match_desc, cod) and eq_item["depreciacion"] >= 0.9:
                f_dep = get_default_minor_tool_deprec(match_desc)
                eq_item["depreciacion"] = f_dep
                if eq_item["precio_unitario"] > 0:
                    eq_item["precio_unitario"] = round(eq_item["precio_unitario"] / f_dep, 2)
            continue

        # 2. Si es un equipo nuevo agregado por IA (ej. carretilla, pala nueva, etc.)
        deprec = float(eq_item.get("depreciacion") or 1.0)
        pu = float(eq_item.get("precio_unitario") or 0.0)

        if is_minor_or_manual_tool(desc, cod) and deprec >= 0.9:
            f_dep = get_default_minor_tool_deprec(desc)
            eq_item["depreciacion"] = f_dep
            if pu > 0:
                eq_item["precio_unitario"] = round(pu / f_dep, 2)
        elif 0 < deprec < 0.05 and 0 < pu < 2.0:
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
    recon_trace = result.setdefault("debug_reconciliation_trace", {
        "materiales": {"total_insumos": 0, "reconciliados_historico": [], "mantenidos_referencial": []},
        "equipos": {"total_insumos": len(equipments), "reconciliados_historico": [], "mantenidos_referencial": []},
        "mano_obra": {"total_insumos": 0, "reconciliados_historico": [], "mantenidos_referencial": []}
    })
    eq_trace = recon_trace["equipos"]
    eq_trace["total_insumos"] = len(equipments)

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

                    # Si es herramienta menor o andamio, priorizar registros con deprec < 1.0 (equipo propio)
                    cand_dep = float(cand.deprec_factor or 1.0)
                    if is_minor_or_manual_tool(desc) and cand_dep < 0.9:
                        sim += 0.05

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

            # Si es herramienta menor o manual y la BD maestra traía deprec_factor = 1.0, recalibrar a equipo propio
            if is_minor_or_manual_tool(matched_desc or desc, matched_cod) and matched_deprec >= 0.9:
                f_dep = get_default_minor_tool_deprec(matched_desc or desc)
                daily_cost = matched_price if matched_price > 0 else matched_cosdia
                matched_deprec = f_dep
                if daily_cost > 0:
                    matched_price = round(daily_cost / f_dep, 2)
            else:
                if matched_price <= 0 and matched_cosdia > 0 and matched_deprec > 0:
                    matched_price = round(matched_cosdia / matched_deprec, 2)

            eq["codigo"] = matched_cod
            eq["descripcion"] = matched_desc
            eq["precio_unitario"] = matched_price
            eq["depreciacion"] = matched_deprec
            eq["origen"] = "historico"
            reconciled_terms.append(matched_desc.lower())
            reconciled_terms.append(desc.lower())
            eq_trace["reconciliados_historico"].append({
                "original_llm": desc,
                "cod_equ": matched_cod,
                "ref_code": getattr(matched_row, "ref_code", None),
                "descripcion_bd": matched_desc,
                "precio_bd": matched_price,
                "depreciacion_bd": matched_deprec,
            })
        else:
            if is_ia or no_cod or zero_price:
                eq["origen"] = "referencial"
                if not eq.get("codigo") or eq.get("codigo").startswith("e-") or eq.get("codigo").startswith("EQU-IA-"):
                    eq["codigo"] = "S/C"
                eq_trace["mantenidos_referencial"].append({
                    "descripcion": desc,
                    "precio_referencial": float(eq.get("precio_unitario") or 0.0),
                    "depreciacion": float(eq.get("depreciacion") or 1.0),
                    "motivo": "Sin coincidencia en catálogo certificado de equipos de Costbase"
                })

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
    6. Forzar la modalidad de amortización (deprec < 1.0) para herramientas menores.
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

    # Salvaguarda final: ninguna herramienta menor/manual puede salir con deprec = 1.0
    enforce_minor_tools_amortization(result)
