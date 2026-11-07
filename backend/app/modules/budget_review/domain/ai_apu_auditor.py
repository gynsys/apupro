"""
Módulo de Auditoría de APUs No Codificados con Inteligencia Artificial (Google Gemini).
Evalúa la coherencia técnica interna, suficiencia de insumos, cuadrilla de mano de obra
y factibilidad de rendimiento en partidas especiales sin código COVENIN / maestro.
"""
import logging
from typing import Any, Dict, List, Optional
from app.services.llm_router import call_llm_json

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Eres un Ingeniero Civil Auditor Senior experto en Análisis de Precios Unitarios (APU) "
    "y Presupuestos de Construcción en Venezuela. Tu misión es evaluar con estricto criterio "
    "técnico de ingeniería partidas especiales no codificadas. "
    "Responde SIEMPRE en formato JSON válido y en español."
)


def audit_uncoded_apu_with_ai(item_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evalúa la estructura técnica de un APU no codificado mediante IA estructurada.

    Reglas técnicas de auditoría:
    1. Una partida especial no codificada NO debe ser rechazada si su APU está bien estructurado.
       Es normal y legítimo en obras civiles que existan partidas especiales atípicas.
    2. NO forzar homologaciones con códigos COVENIN ni sugerir partidas de otros catálogos.
    3. Evaluar la completitud y coherencia interna:
       - Materiales: ¿Contiene los materiales necesarios para la descripción?
       - Mano de Obra: ¿La cuadrilla es razonable para la tarea?
       - Equipos: ¿Dispone de las herramientas o maquinaria requerida?
       - Rendimiento: ¿El rendimiento diario es factible para una jornada estándar?
    """
    desc = str(item_data.get("description") or "").strip()
    unit = str(item_data.get("unit") or "UND").strip()
    perf = float(item_data.get("performance") or 1.0)
    code = str(item_data.get("original_code") or "S/C").strip()

    materials: List[Dict[str, Any]] = item_data.get("materials") or []
    equipments: List[Dict[str, Any]] = item_data.get("equipments") or []
    labors: List[Dict[str, Any]] = item_data.get("labors") or []

    mat_lines = [
        f"- {m.get('description') or m.get('code')}: cant={m.get('quantity')}, unidad={m.get('unit')}, desp={m.get('waste_or_deprec') or 0}%"
        for m in materials
    ]
    eq_lines = [
        f"- {e.get('description') or e.get('code')}: cant={e.get('quantity')}, deprec={e.get('waste_or_deprec') or 0}"
        for e in equipments
    ]
    lab_lines = [
        f"- {l.get('description') or l.get('code')}: cant={l.get('quantity')}"
        for l in labors
    ]

    mat_summary = "\n".join(mat_lines) if mat_lines else "(Sin materiales declarados en el APU)"
    eq_summary = "\n".join(eq_lines) if eq_lines else "(Sin equipos/herramientas declarados en el APU)"
    lab_summary = "\n".join(lab_lines) if lab_lines else "(Sin mano de obra declarada en el APU)"

    prompt = f"""AUDITORÍA TÉCNICA DE PARTIDA ESPECIAL NO CODIFICADA:

Descripción de la Partida: "{desc}"
Unidad de Medida: {unit}
Rendimiento Diario Declarado: {perf} {unit}/día
Código Declarado en Presupuesto: {code}

DESGLOSE DEL ANÁLISIS DE PRECIOS UNITARIOS (APU):
MATERIALES ({len(materials)} ítems):
{mat_summary}

EQUIPOS Y HERRAMIENTAS ({len(equipments)} ítems):
{eq_summary}

MANO DE OBRA ({len(labors)} ítems):
{lab_summary}

INSTRUCCIONES CLAVE DE REVISIÓN Y FÓRMULAS ESTÁNDAR:
1. Una partida especial no codificada NO DEBE SER RECHAZADA si su APU está bien estructurado.
2. NO sugieras homologar con la base maestra ni con códigos COVENIN.
3. Evalúa con base en fórmulas estándar de ingeniería de costos (COVENIN / FONDONORMA):
   a) MATERIALES (CanIns):
      - Fórmula: CanIns = Consumo Teórico Geométrico * (1 + % Desperdicio).
      - Verifica que las cantidades unitarias guarden relación física con la unidad de medida "{unit}".
      - Ejemplo: Si la unidad es M2 de impermeabilización con manto, el CanIns de manto debe rondar 1.10 - 1.15 M2 (10% traslape). Si es pintura, el galón debe rendir ~15 a 20 M2 por mano.
   b) MANO DE OBRA (H-H):
      - Relación: Horas-Hombre = (Total Trabajadores en Cuadrilla * 8 horas) / Rendimiento Diario ({perf} {unit}/día).
      - Verifica que el oficio principal (ej. albañil, electricista, soldador) esté acompañado de ayudante/obrero si la labor lo exige.
   c) EQUIPOS Y HERRAMIENTAS:
      - Para maquinaria mayor: debe incluir equipo coherente con el rendimiento diario.
      - Para labores manuales: debe contemplar herramientas menores o implementos de seguridad.
      - Depreciación: no debe ser manipulada artificialmente a 0.00 ni sobredimensionada.
   d) RENDIMIENTO ({perf} {unit}/día):
      - ¿Es físicamente factible para una jornada de 8 horas con la cuadrilla indicada?
4. DICTAMEN TÉCNICO:
   - Si el APU está bien estructurado, completo y coherente:
     status="CONFORME", is_well_structured=true, summary="APU especial técnicamente estructurado y justificado.", defects=[]
   - Si tiene omisiones graves reales (ej. omite el material principal descrito, 0 mano de obra para instalación, o rendimiento disparatado):
     status="OBSERVADO", is_well_structured=false, summary="APU incompleto con omisión de insumos indispensables.", defects=["detalle técnico concreto de la falla"]

Responde ÚNICAMENTE un objeto JSON con este esquema exacto:
{{
  "is_well_structured": true,
  "status": "CONFORME",
  "summary": "Resumen técnico en una sola línea",
  "technical_diagnosis": "Explicación breve de la suficiencia del APU",
  "defects": []
}}
"""
    try:
        res = call_llm_json(prompt=prompt, use_case="all", system_prompt=SYSTEM_PROMPT)
        if isinstance(res, dict) and "is_well_structured" in res:
            logger.info(f"[AI-APU-AUDITOR] Partida '{code}' auditada por IA: status={res.get('status')}")
            return res
    except Exception as exc:
        logger.warning(
            f"[AI-APU-AUDITOR] Falló llamada a LLM para partida '{code}': {exc}. "
            "Aplicando validación técnica determinista de respaldo."
        )

    # -------------------------------------------------------------------------
    # Respaldo determinista de ingeniería si la IA no está disponible
    # -------------------------------------------------------------------------
    has_mat = len(materials) > 0
    has_lab = len(labors) > 0
    has_perf = perf > 0

    desc_lower = desc.lower()
    requires_materials = any(
        kw in desc_lower
        for kw in ["suministro", "instalacion", "colocacion", "construccion", "fabricacion", "manto", "tuberia"]
    ) and not any(kw in desc_lower for kw in ["solo mano de obra", "solo acarreo", "demolicion manual"])

    defects: List[str] = []
    if requires_materials and not has_mat:
        defects.append("La partida describe suministro/construcción pero el APU no incluye materiales.")
    if (has_mat or len(equipments) > 0) and not has_lab:
        defects.append("El APU posee materiales/equipos pero carece de cuadrilla de mano de obra.")
    if not has_perf or perf <= 0:
        defects.append("Rendimiento diario inválido o en cero.")

    is_ok = len(defects) == 0
    return {
        "is_well_structured": is_ok,
        "status": "CONFORME" if is_ok else "OBSERVADO",
        "summary": (
            "APU especial técnicamente estructurado y justificado."
            if is_ok
            else "APU incompleto con omisión de insumos esenciales."
        ),
        "technical_diagnosis": (
            "El APU cuenta con insumos, personal y rendimiento coherentes con su alcance."
            if is_ok
            else "; ".join(defects)
        ),
        "defects": defects,
    }
