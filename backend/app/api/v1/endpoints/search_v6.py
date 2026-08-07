from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.services.ai_search import ai_engine
from app.db.models.cost360 import CostItem
from typing import Optional
import re

router = APIRouter()

@router.get("/buscar")
def hybrid_search(
    query: str, 
    sector: Optional[str] = None, 
    limit: int = Query(50, ge=1, le=100), 
    db: Session = Depends(get_db)
):
    if not ai_engine.is_loaded:
        return {"error": "El motor de búsqueda IA aún se está inicializando o no cargó correctamente."}
        
    # 1. Extraer features técnicos usando regex (Capa Técnica)
    fc_match = re.search(r'(\d+)\s*(?:kg/cm2|kg/cm|psi|mpa)', query, re.I)
    diam_match = re.search(r'(\d+(?:/\d+)?)\s*(?:"|pulgadas|pulg)', query, re.I)
    
    extracted_fc = float(fc_match.group(1)) if fc_match else None
    extracted_diam = diam_match.group(1) if diam_match else None
    
    # 2. Embedding Semántico
    try:
        query_emb = ai_engine.model.encode([query])[0]
        semantic_scores = ai_engine.calculate_cosine_similarity(query_emb)
    except Exception as e:
        return {"error": f"Error calculando similitud semántica: {str(e)}"}
    
    if len(semantic_scores) == 0:
        return {"error": "Matriz de embeddings vacía o no disponible."}

    # 3. Combinar scores y buscar en DB
    # Tomamos el doble del límite inicialmente por si los scores técnicos reordenan
    top_indices = semantic_scores.argsort()[-limit*3:][::-1] 
    
    candidate_ids = [ai_engine.ids_mapping[i] for i in top_indices if i < len(ai_engine.ids_mapping)]
    
    if not candidate_ids:
        return {"results": []}

    # Traer de BD
    items = db.query(CostItem).filter(CostItem.CodPar.in_(candidate_ids)).all()
    item_map = {i.CodPar: i for i in items}
    
    results = []
    # Tokenizar query para palabras clave (Keywords)
    query_words = set(re.findall(r'\w+', query.lower()))
    # Remover palabras comunes si es necesario
    stop_words = {"de", "la", "el", "en", "y", "a", "los", "las", "un", "una", "con", "para"}
    query_words = query_words - stop_words
    
    for idx in top_indices:
        if idx >= len(ai_engine.ids_mapping):
            continue
            
        item_id = ai_engine.ids_mapping[idx]
        item = item_map.get(item_id)
        if not item:
            continue
            
        sem_score = float(semantic_scores[idx])
        tech_score = 0.0
        
        # Boost por regex / metadata
        if extracted_fc and item.resistencia_fc:
            if abs(extracted_fc - item.resistencia_fc) < 10.0:
                tech_score += 0.5
        
        if extracted_diam and item.diametro_pulg:
            if extracted_diam in item.diametro_pulg:
                tech_score += 0.5
                
        # Boost por palabras clave (Keywords)
        desc_words = set(re.findall(r'\w+', (item.Descri or "").lower())) - stop_words
        overlap = query_words.intersection(desc_words)
        if len(query_words) > 0:
            tech_score += (len(overlap) / len(query_words)) * 0.5 # Max 0.5 adicional por keywords
            
        final_score = (0.7 * min(tech_score, 1.0)) + (0.3 * sem_score)
        
        results.append({
            "CodPar": item.CodPar,
            "Descri": item.Descri,
            "UniPar": item.UniPar,
            "PreUni": item.PreUni,
            "score": final_score,
            "semantic_score": sem_score,
            "tech_score": tech_score,
            "disciplina": item.disciplina,
            "resistencia_fc": item.resistencia_fc,
            "diametro_pulg": item.diametro_pulg
        })
        
    results.sort(key=lambda x: x["score"], reverse=True)
    
    return {
        "query": query,
        "extracted_features": {
            "fc": extracted_fc,
            "diametro": extracted_diam
        },
        "results": results[:limit]
    }
