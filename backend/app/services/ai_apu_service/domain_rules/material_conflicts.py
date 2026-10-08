import re
from typing import Any, Dict, List, Set
from app.core.logging import logger


def _enforce_primary_materials_mutual_exclusion(result: Dict[str, Any], user_description: str) -> None:
    """
    Salvaguarda determinista de backend para garantizar la Regla Universal de
    Insumo Preponderante Único (Mutual Exclusion of Primary Functional Inputs).

    Si en el APU resultante coexisten insumos de la misma familia de acabado o material
    técnicamente incompatibles (ejemplo: un insumo nuevo con origen 'ia' de Pintura Epóxica
    y un insumo histórico con origen 'historico' de Pintura de Esmalte o Caucho), purga
    automáticamente el insumo histórico incompatible y sus insumos satélites (solventes ajenos).
    """
    if not isinstance(result, dict) or not user_description:
        return

    materials = result.get("materials")
    if not isinstance(materials, list) or len(materials) < 2:
        return

    # Familias de exclusión mutua estricta en materiales
    mutual_exclusion_groups: Dict[str, Dict[str, List[str]]] = {
        "pinturas": {
            "EPOXICA": [r"\bEPOXI\w*\b"],
            "ESMALTE": [r"\bESMALTE\b", r"\bALQUIDIC\w*\b", r"\bACEITE\b"],
            "CAUCHO": [r"\bCAUCHO\b", r"\bLATEX\b", r"\bEMULSION\b"],
            "POLIURETANO": [r"\bPOLIURETANO\b"],
        },
        "fondos_anticorrosivos": {
            "CROMATO_ZINC": [r"\bCROMATO\b", r"\bCROMATO\s+DE\s+ZINC\b"],
            "FONDO_HERRERIA": [
                r"\bFONDO\s+(DE\s+)?HERRERIA\b",
                r"\bFONDO\s+ANTICORROSIV\w*\b(?!\s*(\/|-)?\s*CROMATO)",
                r"\bANTICORROSIV\w*\b(?!\s*(\/|-)?\s*CROMATO)",
                r"\bMINIO\b"
            ],
            "FONDO_EPOXICO": [r"\bFONDO\s+EPOXI\w*\b", r"\bPRIMER\s+EPOXI\w*\b"],
            "FONDO_ANTIALCALINO": [r"\bFONDO\s+ANTIALCALIN\w*\b", r"\bANTIALCALIN\w*\b"],
            "SELLADOR": [r"\bSELLADOR\b"],
        },
        "pisos": {
            "PORCELANATO": [r"\bPORCELANATO\b", r"\bPORCELANICO\b"],
            "CERAMICA": [r"\bCERAMIC\w*\b", r"\bAZULEJO\b"],
            "CAICO": [r"\bCAICO\b", r"\bTERRACOTA\b"],
            "GRANITO": [r"\bGRANITO\b", r"\bMARMOL\b"],
        },
        "tabiqueria": {
            "DRYWALL": [r"\bDRYWALL\b", r"\bYESO\b", r"\bTABLAYESO\b"],
            "MAMPOSTERIA": [r"\bBLOQUE(S)?\b", r"\bARCILLA\b", r"\bLADRILLO(S)?\b"],
        },
        "impermeabilizacion": {
            "MANTO": [r"\bMANTO\b", r"\bTERMOSOLDABLE\b"],
            "MEMBRANA": [r"\bMEMBRANA\s+LIQUIDA\b", r"\bPOLIURETANO\s+LIQUIDO\b"],
        },
        "bombas": {
            "BOMBA_SUMERGIBLE": [
                r"\bSUMERGIBLE\b",
                r"\bPOZO\s+PROFUNDO\b",
                r"\bLAPICERO\b",
                r"\bMULTIE?TAPA\b"
            ],
            "BOMBA_CENTRIFUGA": [
                r"\bCENTRIFUGA\b",
                r"\bSUPERFICIE\b",
                r"\bPRESION\s+CONSTANTE\b",
                r"\bEJE\s+HORIZONTAL\b",
                r"\bCARCASA\s+ESPIRAL\b"
            ],
            "BOMBA_ACHIQUE": [
                r"\bACHIQUE\b",
                r"\bAGUAS?\s+NEGRAS?\b",
                r"\bAGUAS?\s+SERVIDAS?\b",
                r"\bFLIH?GT\b",
                r"\bTRITURADOR\w*\b"
            ]
        }
    }

    user_desc_upper = user_description.upper()
    purged_items: List[str] = []

    for group_name, subtypes in mutual_exclusion_groups.items():
        active_subtypes: Set[str] = set()
        for st_name, patterns in subtypes.items():
            if any(re.search(pat, user_desc_upper) for pat in patterns):
                active_subtypes.add(st_name)

        # Si el usuario no lo nombró explícitamente en su texto, verificar si un insumo 'ia' o 'referencial' lo introdujo
        if not active_subtypes:
            for m in materials:
                if isinstance(m, dict) and str(m.get("origen", "")).lower() in ("ia", "referencial"):
                    m_desc = str(m.get("descripcion", "")).upper()
                    for st_name, patterns in subtypes.items():
                        if any(re.search(pat, m_desc) for pat in patterns):
                            active_subtypes.add(st_name)

        if group_name == "fondos_anticorrosivos":
            has_cromato = "CROMATO_ZINC" in active_subtypes or any(
                isinstance(m, dict) and any(re.search(pat, str(m.get("descripcion", "")).upper()) for pat in subtypes["CROMATO_ZINC"])
                for m in materials
            )
            if has_cromato:
                active_subtypes.add("CROMATO_ZINC")
                active_subtypes.discard("FONDO_HERRERIA")

        if active_subtypes:
            retained_materials: List[Dict[str, Any]] = []
            for m in materials:
                if not isinstance(m, dict):
                    continue
                m_desc = str(m.get("descripcion", "")).upper()
                m_origen = str(m.get("origen", "")).lower()

                is_conflicting = False
                for st_name, patterns in subtypes.items():
                    if st_name not in active_subtypes:
                        if any(re.search(pat, m_desc) for pat in patterns):
                            if m_origen == "historico":
                                is_conflicting = True
                                break

                # Purgar solventes incompatibles heredados (ej: thinner común o aguarrás si es epóxica)
                if "EPOXICA" in active_subtypes and m_origen == "historico":
                    if re.search(r"\b(THINNER\s+COMUN|AGUARRAS|SOLVENTE\s+MINERAL)\b", m_desc):
                        is_conflicting = True

                # Purgar cualquier bomba de superficie o centrífuga si la requerida es sumergible
                if "BOMBA_SUMERGIBLE" in active_subtypes and m_origen == "historico":
                    if re.search(r"\bBOMBA\b", m_desc) and not re.search(r"\b(SUMERGIBLE|LAPICERO)\b", m_desc):
                        is_conflicting = True

                if is_conflicting:
                    purged_items.append(m.get("descripcion") or m.get("codigo") or "Insumo incompatible")
                else:
                    retained_materials.append(m)

            materials = retained_materials

            # Purgar también bombas incompatibles si están en equipos
            if group_name == "bombas" and result.get("equipments"):
                retained_equipments: List[Dict[str, Any]] = []
                for eq in result["equipments"]:
                    if not isinstance(eq, dict):
                        continue
                    eq_desc = str(eq.get("descripcion", "")).upper()
                    eq_origen = str(eq.get("origen", "")).lower()
                    is_conflicting_eq = False
                    for st_name, patterns in subtypes.items():
                        if st_name not in active_subtypes:
                            if any(re.search(pat, eq_desc) for pat in patterns):
                                if eq_origen == "historico":
                                    is_conflicting_eq = True
                                    break
                    if "BOMBA_SUMERGIBLE" in active_subtypes and eq_origen == "historico":
                        if re.search(r"\bBOMBA\b", eq_desc) and not re.search(r"\b(SUMERGIBLE|LAPICERO)\b", eq_desc):
                            is_conflicting_eq = True
                    if is_conflicting_eq:
                        purged_items.append(eq.get("descripcion") or eq.get("codigo") or "Equipo incompatible")
                    else:
                        retained_equipments.append(eq)
                result["equipments"] = retained_equipments

    if purged_items:
        result["materials"] = materials
        logger.info(
            "[MutualExclusionEnforcement] Eliminados insumos incompatibles heredados de la base: %s",
            purged_items
        )
        result.setdefault("notas_adaptacion", []).append(
            f"COMPATIBILIDAD TÉCNICA: Se eliminaron automáticamente insumos incompatibles heredados ({', '.join(purged_items)}) en cumplimiento de la Regla de Insumo Preponderante Único."
        )
