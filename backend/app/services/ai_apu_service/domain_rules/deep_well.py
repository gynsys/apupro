import re
from typing import Any, Dict, List, Optional, Tuple
from app.core.logging import logger
from app.services.text_norm import norm_text
from app.services.ai_apu_service.domain_rules.well_classifier import is_sewage_or_drainage

DEPTH_MIN_M: float = 10.0
DEPTH_MAX_M: float = 400.0


def extract_depth(text: str) -> Optional[float]:
    """
    Extrae la profundidad del pozo en metros validando cotas técnicas de ingeniería (VER-14).
    Rango permitido: 10m a 400m. Si está fuera de rango, descarta y retorna None.
    """
    t = norm_text(text)
    for pattern in (
        r"(?:PROFUNDIDAD|COLUMNA|DESCENSO|HONDO|NIVEL\s+DINAMICO)\s*(?:DE|A|:)?\s*(\d{1,3}(?:[.,]\d+)?)\s*(?:M|MTS|METROS?|PIE|PIES|FT)\b",
        r"\b(?:A|HASTA)\s+(\d{1,3}(?:[.,]\d+)?)\s*(?:M|MTS|METROS?)\b",
        r"\b(\d{1,3}(?:[.,]\d+)?)\s*(?:M|MTS|METROS?)\b",
    ):
        m = re.search(pattern, t)
        if m:
            val_str = m.group(1).replace(",", ".")
            try:
                val = float(val_str)
            except ValueError:
                continue
            if "PIE" in t or "FT" in t:
                val *= 0.3048
            if DEPTH_MIN_M <= val <= DEPTH_MAX_M:
                return round(val, 2)
            logger.warning("[DeepWell] Profundidad fuera de rango técnico descartada: %s m", val)
            return None
    return None


def extract_hp(text: str) -> Tuple[Optional[float], bool]:
    """
    Extrae la potencia en HP soportando enteros, decimales y fracciones (ej. 1/2 HP) (VER-16).
    Retorna (hp_valor, was_assumed).
    """
    t = norm_text(text)
    m_frac = re.search(r"\b(\d+)\s*/\s*(\d+)\s*(?:HP|CABALLOS?|CV)\b", t)
    if m_frac:
        try:
            num = float(m_frac.group(1))
            den = float(m_frac.group(2))
            if den > 0:
                return (round(num / den, 2), False)
        except (ValueError, ZeroDivisionError):
            pass
    m = re.search(r"\b(\d+(?:[.,]\d+)?)\s*(?:HP|CABALLOS?|CV)\b", t)
    if m:
        try:
            return (float(m.group(1).replace(",", ".")), False)
        except ValueError:
            pass
    return (5.0, True)


def _enforce_deep_well_dimensions(
    result: Dict[str, Any],
    user_description: str = "",
    depth_meters: Optional[float] = None
) -> Dict[str, Any]:
    """
    Salvaguarda técnica determinista para suministro e instalación de bombas sumergibles en pozo profundo:
    1. Si se detectó una profundidad (ej. 50 metros), sincroniza matemáticamente las cantidades de:
       - Tubería de impulsión / columna de tubería (cantidad = profundidad).
       - Cable sumergible plano o bajo goma (cantidad = profundidad * 1.05 holgura).
       - Guaya de seguridad / suspensión de acero (cantidad = profundidad * 1.05 holgura).
    2. Garantiza estrictamente que exista UNA SOLA BOMBA SUMERGIBLE y purga cualquier bomba centrífuga,
       de superficie o duplicada heredada de la base histórica.
    3. Asegura que la descripción técnica oficial de la partida refleje los metros de profundidad.
    4. Retorna el resultado modificado para cumplimiento de contrato (VER-18).
    """
    if not result or not isinstance(result, dict):
        return result

    effective_user_desc = user_description or (result.get("partida") or {}).get("description") or ""
    desc_normalized = norm_text(effective_user_desc)
    is_sewage = is_sewage_or_drainage(effective_user_desc)
    is_deep_well = (
        bool(re.search(r"\b(POZO\s+PROFUNDO|POZO\s+PEFUNDO|POZO\s+DE\s+AGUA|POZO\s+TUBULAR|BOMBA\s+(?:TIPO\s+)?LAPICERO)\b", desc_normalized))
        or (bool(re.search(r"\bPOZO\b", desc_normalized)) and bool(re.search(r"\bBOMBA\b", desc_normalized)) and not is_sewage)
        or (bool(re.search(r"\bBOMBA\s+SUMERGIBLE\b", desc_normalized)) and not is_sewage)
    )

    is_removal = bool(re.search(r"\b(DESMONTAJE|DEMOLICION|RETIRO|DESINSTALACION|EXTRACCION|DESMANTELAMIENTO)\b", desc_normalized))

    if not is_deep_well:
        return result

    # Si la partida es estrictamente de DESMONTAJE o EXTRACCIÓN,
    # purgar cualquier suministro de bomba, tubería o cable nuevo y retornar.
    if is_removal:
        logger.info("[DeepWellEnforcement] Partida de DESMONTAJE/EXTRACCIÓN de pozo profundo detectada. Purgando suministros nuevos.")
        materials = result.get("materials", [])
        clean_materials = [
            m for m in materials
            if isinstance(m, dict) and not bool(re.search(r"\b(BOMBA|CABLE\s+SUMERGIBLE|TUBO|TUBERIA|COLUMNA\s+DE\s+IMPULSION)\b", norm_text(str(m.get("descripcion", "")))))
        ]
        result["materials"] = clean_materials

        # Limpiar advertencias asociadas a suministro de bomba, cable o tubería
        if "advertencias" in result and isinstance(result["advertencias"], list):
            result["advertencias"] = [
                a for a in result["advertencias"]
                if not any(k in norm_text(a) for k in ["BOMBA SUMERGIBLE", "CABLE SUMERGIBLE", "TUBERIA DE IMPULSION"])
            ]
        return result

    # 1. Extraer profundidad si no fue suministrada explícitamente (VER-14)
    effective_depth = depth_meters
    if not effective_depth:
        effective_depth = extract_depth(effective_user_desc)

    materials = result.get("materials", [])
    equipments = result.get("equipments", [])

    # 2. Purgar bombas incompatibles o duplicadas (Centrífugas, de superficie, presión constante)
    clean_materials: List[Dict[str, Any]] = []
    seen_submersible_pump = False

    for m in materials:
        if not isinstance(m, dict):
            continue
        m_desc = norm_text(str(m.get("descripcion", "")))
        is_pump = bool(re.search(r"\bBOMBA\b", m_desc))
        is_submersible = bool(re.search(r"\b(SUMERGIBLE|LAPICERO|MULTIE?TAPA)\b", m_desc))

        if is_pump:
            if not is_submersible:
                # Bomba centrífuga, de superficie o de presión constante heredada: PURGAR
                logger.info("[DeepWellEnforcement] Purgada bomba no sumergible de materiales: %s", m_desc)
                continue
            if seen_submersible_pump and not any(k in desc_normalized for k in ("DUPLEX", "DOS BOMBAS", "ALTERNO", "TRIPLEX", "2 BOMBAS")):
                # Duplicado de bomba sumergible: conservar solo una
                logger.info("[DeepWellEnforcement] Purgada bomba sumergible duplicada de materiales: %s", m_desc)
                continue
            seen_submersible_pump = True

        # Sincronizar dimensiones con la profundidad si se conoce (VER-5 / VER-9: robusto a tildes)
        if effective_depth and effective_depth > 0:
            # Cable sumergible
            if re.search(r"\b(CABLE\s+SUMERGIBLE|CABLE\s+PLANO|CABLE\s+VULCANIZADO|CABLE\s+SUBMARINO)\b", m_desc):
                m["cantidad"] = round(effective_depth * 1.05, 2)
                m["unidad"] = "m"
                m["nota_calculo"] = f"Longitud de cable sumergible para pozo de {int(effective_depth)} m (+5% holgura)."
            # Tubería de impulsión / columna
            elif re.search(r"\b(TUBO|TUBERIA|COLUMNA)\b", m_desc) and not re.search(r"\b(CONDUIT|ELECTRODUCTO)\b", m_desc):
                m["cantidad"] = round(effective_depth, 2)
                m["unidad"] = "m"
                m["nota_calculo"] = f"Columna de impulsión calculada para profundidad de {int(effective_depth)} m."
            # Guaya de soporte / suspensión
            elif re.search(r"\b(GUAYA|CABLE\s+DE\s+ACERO|MANILA|CUERDA\s+DE\s+SEGURIDAD)\b", m_desc):
                m["cantidad"] = round(effective_depth * 1.05, 2)
                m["unidad"] = "m"
                m["nota_calculo"] = f"Guaya de seguridad/soporte para profundidad de {int(effective_depth)} m."

        clean_materials.append(m)

    # 3. Garantizar que exista al menos una bomba sumergible en la partida (VER-16: fracción de HP)
    has_sub_pump = any(
        bool(re.search(r"\bBOMBA\b", norm_text(str(m.get("descripcion", "")))))
        and bool(re.search(r"\b(SUMERGIBLE|LAPICERO|MULTIE?TAPA)\b", norm_text(str(m.get("descripcion", "")))))
        for m in clean_materials if isinstance(m, dict)
    )
    if not has_sub_pump:
        hp_val, hp_assumed = extract_hp(user_description or "")
        hp_display = f"{int(hp_val)}" if hp_val == int(hp_val) else f"{hp_val}"
        hp_str = f" DE {hp_display} HP"
        clean_materials.insert(0, {
            "id": "m-deepwell-pump",
            "codigo": "S/C",
            "descripcion": f"BOMBA SUMERGIBLE PARA POZO PROFUNDO{hp_str}, INCLUYE MOTOR Y CUERPO DE IMPULSIÓN",
            "unidad": "und",
            "cantidad": 1.0,
            "desperdicio": 0.0,
            "precio_unitario": 1850.00,
            "origen": "referencial",
            "nota_calculo": "Bomba sumergible para pozo profundo requerida por la partida."
        })
        result.setdefault("advertencias", []).append(
            f"[PRECIO_REFERENCIAL] Insumo incorporado (precio referencial de mercado): 'BOMBA SUMERGIBLE PARA POZO PROFUNDO{hp_str}, INCLUYE MOTOR Y CUERPO DE IMPULSIÓN' ($1,850.00 USD). Verifique precio local con proveedores."
        )
        if hp_assumed:
            result.setdefault("advertencias", []).append(
                "[ESPECIFICACION] No se indicó la potencia de la bomba en la descripción. Se asumió 5 HP "
                "como valor referencial. Verifique la potencia requerida antes de licitar."
            )

    # 4. Garantizar presencia de cable sumergible y tubería de impulsión si la profundidad es conocida
    if effective_depth and effective_depth > 0:
        has_cable = any(
            bool(re.search(r"\b(CABLE\s+SUMERGIBLE|CABLE\s+PLANO|CABLE\s+VULCANIZADO|CABLE\s+SUBMARINO)\b", norm_text(str(m.get("descripcion", "")))))
            for m in clean_materials if isinstance(m, dict)
        )
        if not has_cable:
            clean_materials.append({
                "id": "m-deepwell-cable",
                "codigo": "S/C",
                "descripcion": f"CABLE SUMERGIBLE PLANO DE 3x10 AWG PARA POZO PROFUNDO ({int(effective_depth)} M)",
                "unidad": "m",
                "cantidad": round(effective_depth * 1.05, 2),
                "desperdicio": 0.0,
                "precio_unitario": 12.50,
                "origen": "referencial",
                "nota_calculo": f"Cable sumergible para pozo de {int(effective_depth)} m (+5% holgura)."
            })
            result.setdefault("advertencias", []).append(
                f"[PRECIO_REFERENCIAL] Insumo incorporado (precio referencial de mercado): 'CABLE SUMERGIBLE PLANO DE 3x10 AWG PARA POZO PROFUNDO ({int(effective_depth)} M)' ($12.50 USD). Verifique precio local con proveedores."
            )

        has_pipe = any(
            bool(re.search(r"\b(TUBO|TUBERIA|COLUMNA)\b", norm_text(str(m.get("descripcion", "")))))
            and not bool(re.search(r"\b(CONDUIT|ELECTRODUCTO)\b", norm_text(str(m.get("descripcion", "")))))
            for m in clean_materials if isinstance(m, dict)
        )
        if not has_pipe:
            clean_materials.append({
                "id": "m-deepwell-pipe",
                "codigo": "S/C",
                "descripcion": f"TUBERÍA DE IMPULSIÓN PARA POZO PROFUNDO DE 2\" ({int(effective_depth)} M)",
                "unidad": "m",
                "cantidad": round(effective_depth, 2),
                "desperdicio": 0.0,
                "precio_unitario": 28.00,
                "origen": "referencial",
                "nota_calculo": f"Columna de impulsión calculada para profundidad de {int(effective_depth)} m."
            })
            result.setdefault("advertencias", []).append(
                f"[PRECIO_REFERENCIAL] Insumo incorporado (precio referencial de mercado): 'TUBERÍA DE IMPULSIÓN PARA POZO PROFUNDO DE 2\" ({int(effective_depth)} M)' ($28.00 USD). Verifique precio local con proveedores."
            )

    result["materials"] = clean_materials

    # 5. Purgar equipos discordantes (bombas centrífugas, carretillas) y asegurar transporte vehicular
    clean_equipments: List[Dict[str, Any]] = []
    has_transport_vehicle = False

    for eq in equipments:
        if not isinstance(eq, dict):
            continue
        eq_desc = norm_text(str(eq.get("descripcion", "")))
        # Purgar bombas no sumergibles coladas en equipos
        if re.search(r"\bBOMBA\b", eq_desc) and not re.search(r"\b(SUMERGIBLE|LAPICERO)\b", eq_desc):
            logger.info("[DeepWellEnforcement] Purgada bomba no sumergible de equipos: %s", eq_desc)
            continue
        # Purgar carretillas y herramientas manuales de movimiento de tierras inoperativas en pozo profundo
        if re.search(r"\b(CARRETILL\w*|CARRUCH\w*|BUGG\w*|PALA\w*|PICO\w*|CHICUR\w*)\b", eq_desc):
            logger.info("[DeepWellEnforcement] Purgada carretilla/herramienta manual inadecuada en pozo profundo: %s", eq_desc)
            continue
        if re.search(r"\b(CAMIONETA|PICK[- ]?UP|CAMION\s+350|VEHICULO|F-150|F-350)\b", eq_desc):
            has_transport_vehicle = True
        clean_equipments.append(eq)

    # Limpiar advertencias asociadas a carretilla si las hubiera
    if "advertencias" in result and isinstance(result["advertencias"], list):
        result["advertencias"] = [
            a for a in result["advertencias"]
            if not any(k in norm_text(a) for k in ["CARRETILLA", "CARRUCHA", "BUGGY"])
        ]

    # Garantizar presencia de vehículo de transporte liviano para cuadrilla, tecle y tubería de 6 m (VER-15)
    if not has_transport_vehicle and not is_removal:
        clean_equipments.append({
            "id": "eq-deepwell-pickup",
            "codigo": "EQU-TRA-002",
            "descripcion": "CAMIONETA PICK-UP TIPO FORD F-150 / 350 (TRANSPORTE DE CUADRILLA, TUBERÍA Y EQUIPOS)",
            "unidad": "día",
            "cantidad": 0.5,
            "depreciacion": 0.0044,
            "precio_unitario": 92128.60,
            "origen": "referencial",
            "nota_calculo": "Vehículo de apoyo logístico para traslado de cuadrilla, tecle, bomba y tubería de 6 m al sitio del pozo (0.5 día)."
        })
        result.setdefault("advertencias", []).append(
            "[PRECIO_REFERENCIAL] Equipo logístico incorporado: 'CAMIONETA PICK-UP TIPO FORD F-150 / 350' (tarifa estimada referencial). Verifique alquiler local."
        )
        logger.info("[DeepWellEnforcement] Inyectada camioneta pick-up de transporte para pozo profundo.")

    result["equipments"] = clean_equipments

    # 6. Reflejar la profundidad en la descripción técnica de la partida COVENIN y registrar en partida (VER-6)
    if effective_depth and effective_depth > 0 and result.get("partida"):
        partida = result["partida"]
        partida["profundidad_m"] = effective_depth
        cur_desc = str(partida.get("description", "")).strip()
        depth_tag = f"PROFUNDIDAD {int(effective_depth)} M"
        norm_cur = norm_text(cur_desc)
        if depth_tag not in norm_cur and f"{int(effective_depth)} METROS" not in norm_cur and f"{int(effective_depth)} M" not in norm_cur:
            partida["description"] = f"{cur_desc}, A {int(effective_depth)} M DE PROFUNDIDAD".strip(", ")

    return result


def is_deep_well_item(description: str) -> bool:
    """Verifica si una descripción corresponde a pozo profundo (excluyendo aguas residuales y drenaje)."""
    desc_normalized = norm_text(description or "")
    if is_sewage_or_drainage(description or ""):
        return False
    return bool(
        re.search(r"\b(POZO\s+PROFUNDO|POZO\s+PEFUNDO|POZO\s+DE\s+AGUA|POZO\s+TUBULAR|BOMBA\s+(?:TIPO\s+)?LAPICERO)\b", desc_normalized)
        or (re.search(r"\bPOZO\b", desc_normalized) and re.search(r"\bBOMBA\b", desc_normalized))
    )


enrich_deep_well_apu = _enforce_deep_well_dimensions

