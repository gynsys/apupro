import sys
import os
import json
from collections import defaultdict, Counter
import statistics
from sqlalchemy import or_

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.base import SessionLocal
from app.db.models.cost360 import CostItem, CostMaterial, CostEquipment, CostLabor, CostAPUMaterial, CostAPUEquipment, CostAPULabor

class MockPayload:
    def __init__(self, description):
        self.description = description

def test_preprocessing(query_text):
    db = SessionLocal()
    try:
        payload = MockPayload(query_text)
        
        # 1. Buscar partidas similares
        stopwords = {"para", "con", "del", "por", "las", "los", "una", "uno", "como", "sobre"}
        keywords = [w.lower() for w in payload.description.split() if len(w) > 3 and w.lower() not in stopwords]
        
        similar_items = []
        if keywords:
            filters = [CostItem.Descri.ilike(f"%{k}%") for k in keywords]
            similar_items = db.query(CostItem).filter(or_(*filters)).limit(20).all()

        # Puntuación de partidas (Similarity Threshold)
        if similar_items:
            keywords_set = set(keywords)
            scored = []
            for p in similar_items:
                desc_words = set(w.lower() for w in p.Descri.split() if len(w) > 3) if p.Descri else set()
                score = 0
                for kw in keywords_set:
                    if any(kw in dw or dw in kw for dw in desc_words):
                        score += 1
                similarity = score / len(keywords_set) if len(keywords_set) > 0 else 0
                if similarity >= 0.25:
                    scored.append((similarity, p))
            
            scored.sort(key=lambda x: x[0], reverse=True)
            similar_items = [p for _, p in scored[:10]]

        modo_fallback = len(similar_items) == 0

        # 2. Calcular estadísticas de insumos
        resultados = {
            "materiales": defaultdict(lambda: defaultdict(list)),
            "mano_obra": defaultdict(lambda: defaultdict(list)),
            "equipos": defaultdict(lambda: defaultdict(list)),
        }

        if not modo_fallback:
            item_codes = [item.CodPar for item in similar_items]
            unidad_por_partida = {item.CodPar: item.UniPar for item in similar_items}

            mat_rels = db.query(CostAPUMaterial, CostMaterial).join(CostMaterial, CostAPUMaterial.CodIns == CostMaterial.CodMat).filter(CostAPUMaterial.CodPar.in_(item_codes)).all()
            for rel, mat in mat_rels:
                u_partida = unidad_por_partida.get(rel.CodPar, "ND")
                key = f"{mat.Descri.strip() if mat.Descri else ''} | {mat.UniMat.strip() if mat.UniMat else ''}"
                resultados["materiales"][u_partida][key].append({
                    "cantidad": rel.CanIns,
                    "codigo": mat.CodMat,
                })
                
            eq_rels = db.query(CostAPUEquipment, CostEquipment).join(CostEquipment, CostAPUEquipment.CodIns == CostEquipment.CodEqu).filter(CostAPUEquipment.CodPar.in_(item_codes)).all()
            for rel, eq in eq_rels:
                u_partida = unidad_por_partida.get(rel.CodPar, "ND")
                key = f"{eq.Descri.strip() if eq.Descri else ''} | día"
                resultados["equipos"][u_partida][key].append({
                    "cantidad": rel.CanIns,
                    "codigo": eq.CodEqu,
                })
                
            mo_rels = db.query(CostAPULabor, CostLabor).join(CostLabor, CostAPULabor.CodIns == CostLabor.CodMan).filter(CostAPULabor.CodPar.in_(item_codes)).all()
            for rel, mo in mo_rels:
                u_partida = unidad_por_partida.get(rel.CodPar, "ND")
                key = f"{mo.Descri.strip() if mo.Descri else ''} | día"
                resultados["mano_obra"][u_partida][key].append({
                    "cantidad": rel.CanIns,
                    "codigo": mo.CodMan,
                })

        estadisticas = {"materiales": defaultdict(dict), "mano_obra": defaultdict(dict), "equipos": defaultdict(dict)}
        for tipo, grupos_por_unidad in resultados.items():
            for u_partida, grupos_insumos in grupos_por_unidad.items():
                for key, items in grupos_insumos.items():
                    cantidades = [i["cantidad"] for i in items if i["cantidad"] and i["cantidad"] > 0]
                    if not cantidades:
                        continue
                    
                    partidas_con_esta_unidad = len([p for p in similar_items if p.UniPar == u_partida or (not p.UniPar and u_partida == "ND")])
                    
                    estadisticas[tipo][u_partida][key] = {
                        "descripcion": key.split(" | ")[0],
                        "unidad": key.split(" | ")[1],
                        "min": round(min(cantidades), 4),
                        "max": round(max(cantidades), 4),
                        "promedio": round(statistics.mean(cantidades), 4),
                        "frecuencia": len(cantidades),
                        "total_partidas_unidad": partidas_con_esta_unidad,
                        "porcentaje_presencia": round(len(cantidades) / partidas_con_esta_unidad * 100, 1) if partidas_con_esta_unidad > 0 else 0,
                        "codigos": list(set(i["codigo"] for i in items if i["codigo"])),
                    }

        # 3. Detectar advertencias
        advertencias_stats = []
        for tipo, grupos_por_unidad in estadisticas.items():
            for u_partida, grupos_insumos in grupos_por_unidad.items():
                for key, s in grupos_insumos.items():
                    if s["porcentaje_presencia"] >= 20.0 and s["promedio"] > 0:
                        rango = s["max"] - s["min"]
                        if rango > s["promedio"] * 0.5:
                            advertencias_stats.append(
                                f"{tipo.upper()} '{s['descripcion']}' (para unidad {u_partida}): alta variabilidad "
                                f"(min={s['min']}, max={s['max']}, promedio={s['promedio']}). "
                                f"Revisar según condiciones específicas."
                            )

        # 4. Filtrar catálogo
        catalogo_materiales = []
        catalogo_equipos = []
        catalogo_mano_obra = []
        
        if not modo_fallback:
            codigos_mat = set()
            codigos_eq = set()
            codigos_mo = set()
            
            for u_partida, grupos_insumos in estadisticas["materiales"].items():
                for key, s in grupos_insumos.items():
                    if s["porcentaje_presencia"] >= 20.0:
                        codigos_mat.update(s.get("codigos", []))
            for u_partida, grupos_insumos in estadisticas["equipos"].items():
                for key, s in grupos_insumos.items():
                    if s["porcentaje_presencia"] >= 20.0:
                        codigos_eq.update(s.get("codigos", []))
            for u_partida, grupos_insumos in estadisticas["mano_obra"].items():
                for key, s in grupos_insumos.items():
                    if s["porcentaje_presencia"] >= 20.0:
                        codigos_mo.update(s.get("codigos", []))
                
            if codigos_mat:
                mats = db.query(CostMaterial).filter(CostMaterial.CodMat.in_(list(codigos_mat))).all()
                catalogo_materiales = [{"codigo": m.CodMat, "descripcion": m.Descri, "unidad": m.UniMat, "precio": m.CosMat} for m in mats]
            if codigos_eq:
                eqs = db.query(CostEquipment).filter(CostEquipment.CodEqu.in_(list(codigos_eq))).all()
                catalogo_equipos = [{"codigo": e.CodEqu, "descripcion": e.Descri, "precio_diario": e.CosDia} for e in eqs]
            if codigos_mo:
                mos = db.query(CostLabor).filter(CostLabor.CodMan.in_(list(codigos_mo))).all()
                catalogo_mano_obra = [{"codigo": m.CodMan, "descripcion": m.Descri, "jornal": m.Jornal} for m in mos]
                
            if not catalogo_mano_obra:
                 cat_mos = db.query(CostLabor).filter(or_(CostLabor.Descri.ilike("%peón%"), CostLabor.Descri.ilike("%maestro%"))).limit(10).all()
                 catalogo_mano_obra = [{"codigo": m.CodMan, "descripcion": m.Descri, "jornal": m.Jornal} for m in cat_mos]
        else:
            if keywords:
                cat_mats = db.query(CostMaterial).filter(or_(*[CostMaterial.Descri.ilike(f"%{k}%") for k in keywords])).limit(20).all()
                catalogo_materiales = [{"codigo": m.CodMat, "descripcion": m.Descri, "unidad": m.UniMat, "precio": m.CosMat} for m in cat_mats]
            
            cat_eqs = db.query(CostEquipment).limit(10).all()
            catalogo_equipos = [{"codigo": e.CodEqu, "descripcion": e.Descri, "precio_diario": e.CosDia} for e in cat_eqs]
            
            cat_mos = db.query(CostLabor).filter(or_(CostLabor.Descri.ilike("%peón%"), CostLabor.Descri.ilike("%maestro%"))).limit(10).all()
            catalogo_mano_obra = [{"codigo": m.CodMan, "descripcion": m.Descri, "jornal": m.Jornal} for m in cat_mos]

        # 5. Armar payload
        rendimientos_formateados_por_unidad = {}

        for tipo, grupos_por_unidad in estadisticas.items():
            for u_partida, grupos_insumos in grupos_por_unidad.items():
                if u_partida not in rendimientos_formateados_por_unidad:
                    rendimientos_formateados_por_unidad[u_partida] = {"materiales": [], "mano_obra": [], "equipos": []}
                
                for key, s in grupos_insumos.items():
                    if s["porcentaje_presencia"] >= 20.0:
                        rendimientos_formateados_por_unidad[u_partida][tipo].append({
                            "descripcion": s["descripcion"],
                            "unidad_insumo": s["unidad"],
                            "cantidad_minima": s["min"],
                            "cantidad_maxima": s["max"],
                            "cantidad_promedio": s["promedio"],
                            "frecuencia": f"{s['frecuencia']}/{s['total_partidas_unidad']} partidas",
                            "porcentaje_presencia": f"{s['porcentaje_presencia']}%",
                            "obligatorio": s["porcentaje_presencia"] > 70,
                            "opcional": s["porcentaje_presencia"] <= 70,
                        })

        payload_llm = {
            "modo": "sin_datos_historicos" if modo_fallback else "con_datos_historicos",
            "solicitud_usuario": payload.description,
            "partidas_encontradas": len(similar_items),
            "detalle_partidas": [
                {"codigo": p.CodPar, "descripcion": p.Descri, "unidad": p.UniPar}
                for p in similar_items
            ],
            "rendimientos_historicos_por_unidad_partida": rendimientos_formateados_por_unidad,
            "catalogo_insumos": {
                "materiales": catalogo_materiales,
                "equipos": catalogo_equipos,
                "mano_obra": catalogo_mano_obra
            },
            "advertencias_preprocesamiento": advertencias_stats,
        }

        return payload_llm
    finally:
        db.close()

if __name__ == "__main__":
    queries = [
        "concreto pobre fc=100 para base de fundaciones",
        "construccion de zanja para tuberia",
        "instalacion de panel solar en estacion espacial"
    ]
    for q in queries:
        print("="*80)
        print(f"QUERY: {q}")
        print("="*80)
        payload = test_preprocessing(q)
        print(f"Modo: {payload['modo']}")
        print(f"Partidas encontradas: {payload['partidas_encontradas']}")
        print(f"Advertencias: {payload['advertencias_preprocesamiento']}")
        print(f"Rendimientos: {len(payload['rendimientos_historicos_por_unidad_partida'])} grupos por unidad de partida")
        print(f"Insumos en Catálogo: {sum(len(c) for c in payload['catalogo_insumos'].values())}")
        
        print("\nDetalle Materiales Historicos:")
        for u_partida, rendimientos in payload['rendimientos_historicos_por_unidad_partida'].items():
            print(f"  Unidad de partida: {u_partida}")
            for mat in rendimientos['materiales'][:5]: # max 5 para no saturar
                 print(f"   - {mat['descripcion'][:40]} | prom={mat['cantidad_promedio']} ({mat['porcentaje_presencia']})")
        print("\n")
