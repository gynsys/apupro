import json
import os
import re
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

from app.core.logging import logger
from app.db.models.costbase import CostItem
from app.db.session import get_db_session


def extract_regex_matches(pattern: str, text: str) -> List[str]:
    """Extrae todas las coincidencias normalizadas de un patrón en un texto."""
    if not text:
        return []
    matches = re.findall(pattern, text, re.IGNORECASE)
    results: List[str] = []
    for m in matches:
        if isinstance(m, tuple):
            val = next((item for item in m if item), "")
        else:
            val = m
        clean_val = val.strip()
        if clean_val:
            results.append(clean_val)
    return results


def run_mining_pipeline(limit: Optional[int] = None) -> Dict[str, Any]:
    """
    Recorre las partidas de la base de datos maestra y extrae la matriz
    empírica de parámetros técnicos de la construcción civil.
    """
    logger.info("Iniciando minería empírica de partidas de cost360_items...")

    disciplinas_counter: Counter[str] = Counter()
    unidades_counter: Counter[str] = Counter()

    # Contadores paramétricos específicos
    fc_counter: Counter[str] = Counter()
    diametros_counter: Counter[str] = Counter()
    espesores_losas_counter: Counter[str] = Counter()
    espesores_bloques_counter: Counter[str] = Counter()
    espesores_sobrepisos_counter: Counter[str] = Counter()
    dosificaciones_mortero_counter: Counter[str] = Counter()
    pinturas_counter: Counter[str] = Counter()
    impermeabilizacion_counter: Counter[str] = Counter()
    excavacion_counter: Counter[str] = Counter()
    electrico_calibres_counter: Counter[str] = Counter()
    electrico_circuitos_counter: Counter[str] = Counter()
    bombas_hp_counter: Counter[str] = Counter()

    total_scanned = 0

    with get_db_session() as db:
        query = db.query(CostItem)
        if limit:
            query = query.limit(limit)

        for item in query.yield_per(500):
            total_scanned += 1
            desc = (item.Descri or "") + " " + (item.desc_limpia or "")
            lower_desc = desc.lower()

            if item.disciplina:
                disciplinas_counter[item.disciplina.strip().upper()] += 1

            if item.UniPar:
                unidades_counter[item.UniPar.strip().lower()] += 1

            # 1. Resistencia Concreto f'c
            if item.resistencia_fc and item.resistencia_fc > 0:
                fc_counter[f"f'c={int(item.resistencia_fc)} kg/cm²"] += 1
            else:
                fc_matches = extract_regex_matches(r"f'?c\s*=\s*(\d{2,3})|concreto\s+(\d{2,3})\s*kg", lower_desc)
                for fc in fc_matches:
                    fc_counter[f"f'c={fc} kg/cm²"] += 1

            # 2. Diámetro Tubería / Válvula
            if item.diametro_pulg:
                diametros_counter[f'd={item.diametro_pulg.strip()}"'] += 1
            else:
                if re.search(r"\b(tuberia|tubo|valvula|tubo|pvc|hg|cobre)\b", lower_desc):
                    d_matches = extract_regex_matches(r"\b(1/2|3/4|1|1\s*1/4|1\s*1/2|2|2\s*1/2|3|4|6|8|10|12)\s*(?:pulg|pulgadas|\"|in)\b", lower_desc)
                    for d in d_matches:
                        diametros_counter[f'd={d.replace(" ", "")}"'] += 1

            # 3. Espesor de Losas
            if re.search(r"\blosa\b", lower_desc) and not re.search(r"\b(pintura|manto|impermeabiliz)\b", lower_desc):
                e_matches = extract_regex_matches(r"\be\s*=\s*(\d{1,2}(?:\.\d+)?)\s*(?:cm|cms|m)?\b|\bespesor\s*(\d{1,2})\s*cm\b", lower_desc)
                for e in e_matches:
                    espesores_losas_counter[f"e={e} cm"] += 1

            # 4. Espesor de Bloques / Muros
            if re.search(r"\b(bloque|pared|muro|tabique)\b", lower_desc) and re.search(r"\b(arcilla|concreto)\b", lower_desc):
                eb_matches = extract_regex_matches(r"\be\s*=\s*(\d{1,2})\s*cm\b|\b(\d{1,2})\s*cm\s*(?:de\s*espesor)?\b", lower_desc)
                for eb in eb_matches:
                    if eb in ["10", "12", "15", "20", "25"]:
                        espesores_bloques_counter[f"Bloque e={eb} cm"] += 1

            # 5. Sobrepisos y Nivelación
            if re.search(r"\bsobrepiso|nivelaci[oó]n\b", lower_desc):
                esp_matches = extract_regex_matches(r"\be\s*=\s*(\d(?:\.\d)?)\s*cm\b", lower_desc)
                for esp in esp_matches:
                    espesores_sobrepisos_counter[f"e={esp} cm"] += 1

            # 6. Dosificaciones de Mortero
            if re.search(r"\bmortero\b", lower_desc):
                dos_matches = extract_regex_matches(r"\b(1:2|1:3|1:4|1:5|1:6)\b", lower_desc)
                for dos in dos_matches:
                    dosificaciones_mortero_counter[f"Mortero {dos}"] += 1

            # 7. Tipos de Pintura
            if re.search(r"\bpintur|esmalte|fondo\b", lower_desc):
                if "caucho clase a" in lower_desc:
                    pinturas_counter["Pintura de caucho clase A"] += 1
                elif "caucho clase b" in lower_desc:
                    pinturas_counter["Pintura de caucho clase B"] += 1
                elif "caucho" in lower_desc:
                    pinturas_counter["Pintura de caucho"] += 1
                elif "esmalte" in lower_desc:
                    pinturas_counter["Esmalte sintético"] += 1
                elif "epoxi" in lower_desc:
                    pinturas_counter["Pintura epóxica"] += 1
                elif "elastom" in lower_desc:
                    pinturas_counter["Pintura impermeabilizante elastomérica"] += 1
                elif "aluminio" in lower_desc or "reflectiv" in lower_desc:
                    pinturas_counter["Pintura reflectiva de aluminio"] += 1
                elif "trafico" in lower_desc or "tráfico" in lower_desc:
                    pinturas_counter["Pintura para tráfico / vial"] += 1

            # 8. Impermeabilización
            if re.search(r"\bmanto|impermeabiliz\b", lower_desc):
                if "3 mm" in lower_desc or "3mm" in lower_desc:
                    impermeabilizacion_counter["Manto asfáltico 3 mm"] += 1
                elif "4 mm" in lower_desc or "4mm" in lower_desc:
                    impermeabilizacion_counter["Manto asfáltico 4 mm"] += 1
                elif "aluminio" in lower_desc:
                    impermeabilizacion_counter["Manto con foil de aluminio"] += 1
                elif "membrana liquida" in lower_desc or "líquida" in lower_desc:
                    impermeabilizacion_counter["Membrana líquida elastomérica"] += 1
                elif "primer" in lower_desc or "imprimador" in lower_desc:
                    impermeabilizacion_counter["Primer imprimador asfáltico"] += 1

            # 9. Excavación
            if re.search(r"\bexcavac|zanja\b", lower_desc):
                if "a mano" in lower_desc or "manual" in lower_desc:
                    excavacion_counter["Excavación a mano"] += 1
                elif "a maquina" in lower_desc or "máquina" in lower_desc or "retroexcavadora" in lower_desc:
                    excavacion_counter["Excavación a máquina"] += 1
                if "hasta 1.50" in lower_desc or "hasta 1.5" in lower_desc:
                    excavacion_counter["Profundidad hasta 1.50 m"] += 1
                elif "1.50 a 3.00" in lower_desc or "1.5 a 3.0" in lower_desc:
                    excavacion_counter["Profundidad 1.50 a 3.00 m"] += 1

            # 10. Eléctrico (Calibres y Circuitos)
            if re.search(r"\bcable|conductor\b", lower_desc):
                cal_matches = extract_regex_matches(r"\b(#\d{1,2}|calibre\s*#?\s*\d{1,2}|\d{1,2}\s*awg|2/0|4/0)\b", lower_desc)
                for cal in cal_matches:
                    clean_c = cal.upper().replace("CALIBRE", "").strip()
                    electrico_calibres_counter[clean_c] += 1

            if re.search(r"\btablero\b", lower_desc):
                ctos_matches = extract_regex_matches(r"\b(\d{1,2})\s*(?:circuitos|ctos|polos)\b", lower_desc)
                for ctos in ctos_matches:
                    electrico_circuitos_counter[f"{ctos} circuitos"] += 1

            # 11. Bombas
            if re.search(r"\bbomba|electrobomba\b", lower_desc):
                hp_matches = extract_regex_matches(r"\b(0\.5|0\.75|1|1\.5|2|3|5|7\.5|10|15|20)\s*hp\b", lower_desc)
                for hp in hp_matches:
                    bombas_hp_counter[f"Potencia {hp} HP"] += 1

    logger.info("Minería completada. Partidas escaneadas: %d", total_scanned)

    matrix: Dict[str, Any] = {
        "metadatos": {
            "total_partidas_escaneadas": total_scanned,
            "disciplinas_identificadas": len(disciplinas_counter),
        },
        "top_disciplinas": dict(disciplinas_counter.most_common(20)),
        "top_unidades": dict(unidades_counter.most_common(15)),
        "familias_parametricas": {
            "concreto_fc": dict(fc_counter.most_common(10)),
            "diametros_tuberia": dict(diametros_counter.most_common(15)),
            "espesores_losas": dict(espesores_losas_counter.most_common(10)),
            "espesores_bloques": dict(espesores_bloques_counter.most_common(8)),
            "espesores_sobrepisos": dict(espesores_sobrepisos_counter.most_common(8)),
            "dosificaciones_mortero": dict(dosificaciones_mortero_counter.most_common(8)),
            "tipos_pintura": dict(pinturas_counter.most_common(10)),
            "impermeabilizacion": dict(impermeabilizacion_counter.most_common(8)),
            "excavacion": dict(excavacion_counter.most_common(8)),
            "electricidad_calibres": dict(electrico_calibres_counter.most_common(10)),
            "electricidad_circuitos_tableros": dict(electrico_circuitos_counter.most_common(8)),
            "bombas_potencia": dict(bombas_hp_counter.most_common(10)),
        }
    }

    output_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(output_dir, "parametric_matrix.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(matrix, f, indent=2, ensure_ascii=False)

    logger.info("Matriz paramétrica guardada exitosamente en %s", output_path)
    return matrix


if __name__ == "__main__":
    result = run_mining_pipeline()
    print("=== REPORTE DE MINERÍA PARAMÉTRICA ===")
    print(f"Total Partidas: {result['metadatos']['total_partidas_escaneadas']}")
    print("\nTop 5 Disciplinas:")
    for k, v in list(result["top_disciplinas"].items())[:5]:
        print(f"  - {k}: {v}")
    print("\nFamilias Paramétricas Minadas:")
    for fam, items in result["familias_parametricas"].items():
        print(f"  * {fam}: {len(items)} parámetros encontrados")
