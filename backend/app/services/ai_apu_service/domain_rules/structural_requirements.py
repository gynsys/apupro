import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging import logger
from app.services.ai_apu_service.domain_rules.discordant_pruning import (
    is_explicit_mortar_without_coarse_concrete,
)
from app.services.ai_apu_service.reconciliation.specs_matcher import _normalize_unit
from app.services.element_geometry import (
    extract_discrete_volume_m3,
    extract_linear_length_m,
    is_linear_element,
)

# ---------------------------------------------------------------------------
# Elementos que trabajan a flexión/compresión y SIEMPRE llevan refuerzo de acero y encofrado,
# independientemente de que la mezcla sea mortero (arena-cemento) o concreto.
# (patrón, kgf acero por ml, kgf alambre por ml, m2 encofrado por ml, kgf clavos por ml)
# ---------------------------------------------------------------------------
_REINFORCED_ELEMENT_RULES: List[Tuple[re.Pattern, str, float, float, float, float]] = [
    (re.compile(r"\bDINTEL(?:ES)?\b"), "DINTEL", 2.80, 0.06, 0.55, 0.06),
    (re.compile(r"\b(?:MACHON(?:ES)?|COLUMNETA(?:S)?)\b"), "MACHON", 2.80, 0.06, 0.60, 0.06),
    (re.compile(r"\bVIGA(?:S)?\s+DE\s+(?:CORONA|RIOSTRA|AMARRE)\b"), "VIGA_CORONA", 2.80, 0.06, 0.55, 0.06),
]

_USER_EXCLUDES_STEEL = re.compile(
    r"\b(?:SIN|NO\s+INCLUYE|EXCLUYE|NO\s+LLEVA|SIN\s+INCLUIR)\b[^.;]*\b(?:ACERO|REFUERZO|CABILLA|CABILLAS|ARMADURA)\b"
)
_USER_EXCLUDES_FORMWORK = re.compile(
    r"\b(?:SIN|NO\s+INCLUYE|EXCLUYE|NO\s+LLEVA|SIN\s+INCLUIR)\b[^.;]*\b(?:ENCOFRADO|FORMALETA)\b"
)
_STEEL_PRESENT = re.compile(r"\b(?:CABILLA(?:S)?|ACERO\s+DE\s+REFUERZO|ACERO\s+ESTRIADO|MALLA\s+ELECTROSOLDADA)\b")
_WIRE_PRESENT = re.compile(r"\bALAMBRE\b")
_FORMWORK_PRESENT = re.compile(r"\b(?:ENCOFRADO|FORMALETA)\b")
_NAILS_PRESENT = re.compile(r"\bCLAVO(?:S)?\b")
_DESC_EXCLUDES_REBAR = re.compile(
    r"[,.;]?\s*(?:NO\s+INCLUYE|EXCLUYE|SIN)\s+(?:EL\s+)?REFUERZO(?:\s+METALICO)?\.?", re.IGNORECASE
)

# Rango plausible de arena por saco de cemento (m3/saco) y agua máxima (m3/saco) en mezclas arena-cemento
_SAND_PER_SACK_RANGE_M3: Tuple[float, float] = (0.06, 0.16)
_WATER_PER_SACK_MAX_M3: float = 0.05


def _strip_accents_upper_local(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text or "")
    return "".join(c for c in decomposed if not unicodedata.combining(c)).upper()


def _match_reinforced_element(user_description: str) -> Optional[Tuple[str, float, float, float, float]]:
    up = _strip_accents_upper_local(user_description)
    for pattern, name, steel, wire, formwork, nails in _REINFORCED_ELEMENT_RULES:
        if pattern.search(up):
            return name, steel, wire, formwork, nails
    return None


def _resolve_length_factor_m(result: Dict[str, Any], user_description: str) -> Optional[float]:
    """
    Metros lineales de elemento por unidad de partida: 1.0 para m/ml; longitud típica para und/pza.
    Retorna None si la unidad es discreta y no hay longitud declarada.
    """
    partida = result.get("partida") if isinstance(result.get("partida"), dict) else {}
    unit = _normalize_unit(str(partida.get("unit") or partida.get("unidad") or ""))
    if unit == "m":
        return 1.0
    if unit == "und":
        length = extract_linear_length_m(user_description) or extract_linear_length_m(
            str(partida.get("description") or partida.get("descripcion") or "")
        )
        return length
    return None


def _build_reinforcement_materials(
    steel_kg: float, wire_kg: float, formwork_m2: float, nails_kg: float, present: Dict[str, bool]
) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    if not present["steel"]:
        items.append({
            "id": "m-ia-refuerzo-cabilla",
            "codigo": "",
            "descripcion": 'CABILLA DE ACERO CORRUGADO 3/8" (9.5 mm) GRADO 60',
            "unidad": "kgf",
            "cantidad": round(steel_kg, 3),
            "desperdicio": 5,
            "precio_unitario": 1.2,
            "origen": "ia",
            "nota_calculo": "Refuerzo longitudinal y estribos incluido por defecto: elemento que trabaja a flexión.",
        })
    if not present["wire"]:
        items.append({
            "id": "m-ia-refuerzo-alambre",
            "codigo": "",
            "descripcion": "ALAMBRE NEGRO N° 18 PARA AMARRE",
            "unidad": "kgf",
            "cantidad": round(wire_kg, 3),
            "desperdicio": 5,
            "precio_unitario": 2.6,
            "origen": "ia",
            "nota_calculo": "Alambre de amarre del acero de refuerzo.",
        })
    if not present["formwork"]:
        items.append({
            "id": "m-ia-refuerzo-encofrado",
            "codigo": "",
            "descripcion": "MADERA ASERRADA PARA ENCOFRADO (TABLAS Y CUARTONES)",
            "unidad": "m2",
            "cantidad": round(formwork_m2, 3),
            "desperdicio": 10,
            "precio_unitario": 18.7,
            "origen": "ia",
            "nota_calculo": "Encofrado (laterales y fondo) incluido por defecto para el vaciado del elemento.",
        })
    if not present["nails"] and not present["formwork"]:
        items.append({
            "id": "m-ia-refuerzo-clavos",
            "codigo": "",
            "descripcion": 'CLAVOS PARA ENCOFRADO DE 2 1/2"',
            "unidad": "kgf",
            "cantidad": round(nails_kg, 3),
            "desperdicio": 5,
            "precio_unitario": 3.5,
            "origen": "ia",
            "nota_calculo": "Clavos para armado del encofrado.",
        })
    return items


def enforce_reinforcement_for_structural_elements(result: Dict[str, Any], user_description: str) -> None:
    """
    Garantiza que los elementos estructurales que trabajan a flexión/compresión (dintel, machón,
    viga de corona/riostra/amarre) incluyan por defecto acero de refuerzo, alambre de amarre y encofrado,
    sin importar si la mezcla es mortero o concreto. La decisión final de retirarlos o ajustarlos
    es del analista: el supuesto queda registrado en `notas_adaptacion` y `supuestos_tecnicos`.
    Si el usuario excluyó explícitamente el acero o el encofrado, se respeta.
    """
    if not isinstance(result, dict) or not isinstance(user_description, str) or not user_description.strip():
        return
    matched = _match_reinforced_element(user_description)
    if matched is None:
        return
    element_name, steel_per_m, wire_per_m, formwork_per_m, nails_per_m = matched

    up_user = _strip_accents_upper_local(user_description)
    excludes_steel = bool(_USER_EXCLUDES_STEEL.search(up_user))
    excludes_formwork = bool(_USER_EXCLUDES_FORMWORK.search(up_user))
    if excludes_steel and excludes_formwork:
        return

    length_factor = _resolve_length_factor_m(result, user_description)
    if length_factor is None:
        logger.info("[StructuralRequirements] %s sin longitud/unidad lineal resoluble: no se auto-incluye refuerzo", element_name)
        return

    materials = result.get("materials")
    if not isinstance(materials, list):
        materials = []
        result["materials"] = materials

    joined = " | ".join(
        _strip_accents_upper_local(str(m.get("descripcion") or "")) for m in materials if isinstance(m, dict)
    )
    present = {
        "steel": excludes_steel or bool(_STEEL_PRESENT.search(joined)),
        "wire": excludes_steel or bool(_WIRE_PRESENT.search(joined)),
        "formwork": excludes_formwork or bool(_FORMWORK_PRESENT.search(joined)),
        "nails": excludes_formwork or bool(_NAILS_PRESENT.search(joined)),
    }

    new_items = _build_reinforcement_materials(
        steel_per_m * length_factor,
        wire_per_m * length_factor,
        formwork_per_m * length_factor,
        nails_per_m * length_factor,
        present,
    )
    if not new_items:
        return
    materials.extend(new_items)

    added_names = ", ".join(i["descripcion"] for i in new_items)
    assumption = (
        f"[SUPUESTO] {element_name.replace('_', ' ')} incluye por defecto refuerzo/encofrado ({added_names}) "
        f"para {length_factor:.2f} m de elemento por unidad. El analista puede retirarlos o ajustarlos."
    )
    notes = result.setdefault("notas_adaptacion", [])
    if isinstance(notes, list):
        notes.append(assumption)
    supuestos = result.setdefault("supuestos_tecnicos", [])
    if isinstance(supuestos, list):
        supuestos.append(assumption)

    partida = result.get("partida")
    if isinstance(partida, dict) and not present["steel"]:
        desc = str(partida.get("description") or "")
        cleaned = _DESC_EXCLUDES_REBAR.sub("", desc).rstrip(" .,;")
        if not re.search(r"ACERO\s+DE\s+REFUERZO", _strip_accents_upper_local(cleaned)):
            cleaned = f"{cleaned}. INCLUYE ACERO DE REFUERZO."
        partida["description"] = cleaned


def align_description_with_requested_mix(result: Dict[str, Any], user_description: str) -> None:
    """
    Si el usuario pidió mezcla fina de arena-cemento (sin concreto), la descripción generada no debe
    llamarla 'concreto' ni heredar exclusiones de la base que contradigan la solicitud.
    """
    if not isinstance(result, dict) or not isinstance(user_description, str):
        return
    partida = result.get("partida")
    if not isinstance(partida, dict) or not is_explicit_mortar_without_coarse_concrete(user_description):
        return
    desc = str(partida.get("description") or "")
    if re.search(r"\bCONCRETO\b", desc, flags=re.IGNORECASE):
        partida["description"] = re.sub(r"\bCONCRETO\b", "MORTERO", desc, flags=re.IGNORECASE)


def enforce_fine_mix_plausibility(result: Dict[str, Any], user_description: str) -> None:
    """
    Valida la dosificación física de mezclas arena-cemento:
    1. Si la unidad es discreta (und/pza), calibra los sacos de cemento según el volumen físico real
       (V = L x b x h) o la longitud del elemento para evitar sobreestimaciones de órdenes de magnitud.
    2. Arena por saco de cemento dentro de un rango físico plausible (0.06 - 0.16 m3/saco).
    3. Agua acotada al máximo admisible (0.05 m3/saco).
    """
    if not isinstance(result, dict) or not is_explicit_mortar_without_coarse_concrete(user_description or ""):
        return
    materials = result.get("materials")
    if not isinstance(materials, list):
        return

    cement = sand = water = None
    for m in materials:
        if not isinstance(m, dict):
            continue
        d = _strip_accents_upper_local(str(m.get("descripcion") or ""))
        u = _normalize_unit(str(m.get("unidad") or ""))
        if cement is None and "CEMENTO" in d and "TRANSPORTE" not in d and u in ("saco", "sco"):
            cement = m
        elif sand is None and re.search(r"\bARENA\b", d) and u == "m3":
            sand = m
        elif water is None and re.search(r"\bAGUA\b", d) and u == "m3":
            water = m
    if cement is None:
        return
    sacks = float(cement.get("cantidad") or 0.0)
    if sacks <= 0.0:
        return

    partida = result.get("partida") if isinstance(result.get("partida"), dict) else {}
    unit = _normalize_unit(str(partida.get("unit") or partida.get("unidad") or ""))
    notes = result.setdefault("notas_adaptacion", [])

    # Calibración volumétrica para elementos en und/pza
    if unit in ("und", "pza", "pieza"):
        vol = extract_discrete_volume_m3(user_description) or extract_discrete_volume_m3(
            str(partida.get("description") or partida.get("descripcion") or "")
        )
        if vol is None and is_linear_element(user_description):
            length = extract_linear_length_m(user_description) or extract_linear_length_m(
                str(partida.get("description") or partida.get("descripcion") or "")
            )
            if length:
                # Dintel o viga menor: sección típica ~0.12m x 0.07m = 0.0084 m3/ml
                vol = round(length * 0.0084, 5)

        if vol and vol > 0.0:
            expected_sacks = round(vol * 10.6, 4)
            # Si el LLM devolvió un valor discordante por orden de magnitud (ej. 0.50 sacos vs 0.07 sacos)
            if sacks > expected_sacks * 1.8 or sacks < expected_sacks * 0.4:
                cement["cantidad"] = expected_sacks
                if isinstance(notes, list):
                    notes.append(
                        f"Dosificación volumétrica unitaria: cemento calibrado de {sacks:.4f} a {expected_sacks:.4f} sacos "
                        f"para elemento de {vol:.5f} m3 en unidad '{unit}'."
                    )
                sacks = expected_sacks

    low, high = _SAND_PER_SACK_RANGE_M3
    if sand is not None:
        qty = float(sand.get("cantidad") or 0.0)
        bounded = min(max(qty, sacks * low), sacks * high)
        if abs(bounded - qty) > 1e-9:
            sand["cantidad"] = round(bounded, 4)
            if isinstance(notes, list):
                notes.append(
                    f"Dosificación verificada: arena ajustada de {qty:.4f} a {bounded:.4f} m3 "
                    f"({bounded / sacks:.3f} m3/saco, rango físico {low}-{high})."
                )
    if water is not None:
        qty = float(water.get("cantidad") or 0.0)
        cap = sacks * _WATER_PER_SACK_MAX_M3
        if qty > cap:
            water["cantidad"] = round(cap, 4)
            if isinstance(notes, list):
                notes.append(f"Dosificación verificada: agua acotada de {qty:.4f} a {cap:.4f} m3.")
