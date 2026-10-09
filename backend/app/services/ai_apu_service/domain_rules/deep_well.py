import re
from typing import Any, Dict, List, Optional
from app.core.logging import logger


def _enforce_deep_well_dimensions(
    result: Dict[str, Any],
    user_description: str,
    depth_meters: Optional[float] = None
) -> None:
    """
    Salvaguarda técnica determinista para suministro e instalación de bombas sumergibles en pozo profundo:
    1. Si se detectó una profundidad (ej. 50 metros), sincroniza matemáticamente las cantidades de:
       - Tubería de impulsión / columna de tubería (cantidad = profundidad).
       - Cable sumergible plano o bajo goma (cantidad = profundidad * 1.05 holgura).
       - Guaya de seguridad / suspensión de acero (cantidad = profundidad * 1.05 holgura).
    2. Garantiza estrictamente que exista UNA SOLA BOMBA SUMERGIBLE y purga cualquier bomba centrífuga,
       de superficie o duplicada heredada de la base histórica.
    3. Asegura que la descripción técnica oficial de la partida refleje los metros de profundidad.
    """
    if not result or not isinstance(result, dict):
        return

    desc_lower = (user_description or "").lower()
    is_sewage = bool(re.search(r"\b(aguas?\s+negras?|aguas?\s+servidas?|residuales?|achique|fosa|cloaca|triturador\w*)\b", desc_lower))
    is_deep_well = (
        bool(re.search(r"\b(pozo\s+profundo|pozo\s+de\s+agua|pozo\s+tubular|bomba\s+(tipo\s+)?lapicero)\b", desc_lower))
        or (bool(re.search(r"\bbomba\s+sumergible\b", desc_lower)) and not is_sewage)
    )

    is_removal = bool(re.search(r"\b(desmontaje|demolici[oó]n|retiro|desinstalaci[oó]n|extracci[oó]n|desmantelamiento)\b", desc_lower))

    if not is_deep_well:
        return

    # Si la partida es estrictamente de DESMONTAJE o EXTRACCIÓN,
    # purgar cualquier suministro de bomba, tubería o cable nuevo y retornar.
    if is_removal:
        logger.info("[DeepWellEnforcement] Partida de DESMONTAJE/EXTRACCIÓN de pozo profundo detectada. Purgando suministros nuevos.")
        materials = result.get("materials", [])
        clean_materials = [
            m for m in materials
            if isinstance(m, dict) and not bool(re.search(r"\b(BOMBA|CABLE\s+SUMERGIBLE|TUBO|TUBERIA|COLUMNA\s+DE\s+IMPULSION)\b", str(m.get("descripcion", "")).upper()))
        ]
        result["materials"] = clean_materials

        # Limpiar advertencias asociadas a suministro de bomba, cable o tubería
        if "advertencias" in result and isinstance(result["advertencias"], list):
            result["advertencias"] = [
                a for a in result["advertencias"]
                if not any(k in a.upper() for k in ["BOMBA SUMERGIBLE", "CABLE SUMERGIBLE", "TUBERÍA DE IMPULSIÓN", "TUBERIA DE IMPULSION"])
            ]
        return

    # 1. Extraer profundidad si no fue suministrada explícitamente
    effective_depth = depth_meters
    if not effective_depth:
        dm = re.search(
            r'(?:profundidad|columna|descenso|hondo|nivel\s+din[aá]mico)?\s*(?:de|a)?\s*(\d{1,3}(?:[.,]\d+)?)\s*(?:m|mts|metros?|pie|pies|ft)\b',
            desc_lower
        )
        if not dm:
            dm = re.search(r'\b(\d{1,3})\s*(?:m|mts|metros)\b', desc_lower)
        if dm:
            try:
                effective_depth = float(dm.group(1).replace(",", "."))
            except ValueError:
                effective_depth = None

    materials = result.get("materials", [])
    equipments = result.get("equipments", [])

    # 2. Purgar bombas incompatibles o duplicadas (Centrífugas, de superficie, presión constante)
    clean_materials: List[Dict[str, Any]] = []
    seen_submersible_pump = False

    for m in materials:
        if not isinstance(m, dict):
            continue
        m_desc = str(m.get("descripcion", "")).upper()
        is_pump = bool(re.search(r"\bBOMBA\b", m_desc))
        is_submersible = bool(re.search(r"\b(SUMERGIBLE|LAPICERO|MULTIE?TAPA)\b", m_desc))

        if is_pump:
            if not is_submersible:
                # Bomba centrífuga, de superficie o de presión constante heredada: PURGAR
                logger.info("[DeepWellEnforcement] Purgada bomba no sumergible de materiales: %s", m_desc)
                continue
            if seen_submersible_pump and not any(k in desc_lower for k in ("duplex", "dos bombas", "alterno", "triplex", "2 bombas")):
                # Duplicado de bomba sumergible: conservar solo una
                logger.info("[DeepWellEnforcement] Purgada bomba sumergible duplicada de materiales: %s", m_desc)
                continue
            seen_submersible_pump = True

        # Sincronizar dimensiones con la profundidad si se conoce
        if effective_depth and effective_depth > 0:
            # Cable sumergible
            if re.search(r"\b(CABLE\s+SUMERGIBLE|CABLE\s+PLANO|CABLE\s+VULCANIZADO|CABLE\s+SUBMARINO)\b", m_desc):
                m["cantidad"] = round(effective_depth * 1.05, 2)
                m["unidad"] = "m"
                m["nota_calculo"] = f"Longitud de cable sumergible para pozo de {int(effective_depth)} m (+5% holgura)."
            # Tubería de impulsión / columna
            elif re.search(r"\b(TUBO|TUBERIA|COLUMNA)\b", m_desc) and re.search(r"\b(IMPULSION|DESCARGA|POZO|ADDUCCION)\b", m_desc):
                m["cantidad"] = round(effective_depth, 2)
                m["unidad"] = "m"
                m["nota_calculo"] = f"Columna de impulsión calculada para profundidad de {int(effective_depth)} m."
            # Guaya de soporte / suspensión
            elif re.search(r"\b(GUAYA|CABLE\s+DE\s+ACERO|MANILA|CUERDA\s+DE\s+SEGURIDAD)\b", m_desc):
                m["cantidad"] = round(effective_depth * 1.05, 2)
                m["unidad"] = "m"
                m["nota_calculo"] = f"Guaya de seguridad/soporte para profundidad de {int(effective_depth)} m."

        clean_materials.append(m)

    # 3. Garantizar que exista al menos una bomba sumergible en la partida
    has_sub_pump = any(
        bool(re.search(r"\bBOMBA\b", str(m.get("descripcion", "")).upper()))
        and bool(re.search(r"\b(SUMERGIBLE|LAPICERO|MULTIE?TAPA)\b", str(m.get("descripcion", "")).upper()))
        for m in clean_materials if isinstance(m, dict)
    )
    if not has_sub_pump:
        hp_match = re.search(r'\b(\d+(?:[.,]\d+)?)\s*(?:hp|caballos?|cv)\b', desc_lower)
        hp_str = f" DE {hp_match.group(1)} HP" if hp_match else " DE 5 HP"
        clean_materials.insert(0, {
            "id": "m-deepwell-pump",
            "codigo": "S/C",
            "descripcion": f"BOMBA SUMERGIBLE PARA POZO PROFUNDO{hp_str.upper()}, INCLUYE MOTOR Y CUERPO DE IMPULSIÓN",
            "unidad": "und",
            "cantidad": 1.0,
            "desperdicio": 0.0,
            "precio_unitario": 1850.00,
            "origen": "referencial",
            "nota_calculo": "Bomba sumergible para pozo profundo requerida por la partida."
        })
        result.setdefault("advertencias", []).append(
            f"[PRECIO_REFERENCIAL] Insumo incorporado (precio referencial de mercado): 'BOMBA SUMERGIBLE PARA POZO PROFUNDO{hp_str.upper()}, INCLUYE MOTOR Y CUERPO DE IMPULSIÓN' ($1,850.00 USD). Verifique precio local con proveedores."
        )

    # 4. Garantizar presencia de cable sumergible y tubería de impulsión si la profundidad es conocida
    if effective_depth and effective_depth > 0:
        has_cable = any(
            bool(re.search(r"\b(CABLE\s+SUMERGIBLE|CABLE\s+PLANO|CABLE\s+VULCANIZADO|CABLE\s+SUBMARINO)\b", str(m.get("descripcion", "")).upper()))
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
            bool(re.search(r"\b(TUBO|TUBERIA|COLUMNA)\b", str(m.get("descripcion", "")).upper()))
            and bool(re.search(r"\b(IMPULSION|DESCARGA|POZO|ADDUCCION)\b", str(m.get("descripcion", "")).upper()))
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

    # Purgar también bombas centrífugas si se colaron en equipos
    if equipments:
        clean_equipments: List[Dict[str, Any]] = []
        for eq in equipments:
            if not isinstance(eq, dict):
                continue
            eq_desc = str(eq.get("descripcion", "")).upper()
            if re.search(r"\bBOMBA\b", eq_desc) and not re.search(r"\b(SUMERGIBLE|LAPICERO)\b", eq_desc):
                logger.info("[DeepWellEnforcement] Purgada bomba no sumergible de equipos: %s", eq_desc)
                continue
            clean_equipments.append(eq)
        result["equipments"] = clean_equipments

    # 5. Reflejar la profundidad en la descripción técnica de la partida COVENIN
    if effective_depth and effective_depth > 0 and result.get("partida"):
        partida = result["partida"]
        cur_desc = str(partida.get("description", "")).strip()
        depth_tag = f"PROFUNDIDAD {int(effective_depth)} M"
        if depth_tag not in cur_desc.upper() and f"{int(effective_depth)} METROS" not in cur_desc.upper() and f"{int(effective_depth)} M" not in cur_desc.upper():
            partida["description"] = f"{cur_desc}, A {int(effective_depth)} M DE PROFUNDIDAD".strip(", ")
