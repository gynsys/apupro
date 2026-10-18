import json
from app.db.base import get_db_session
from app.db.models.costbase import CostItem
from app.services.ai_search import AISearchEngine
from app.services.ai_apu_service.rag_context.candidates import get_dynamic_candidates

query = "Construcción de sobrepiso de nivelacion con Concreto f'c=150 kg/cm² e=5.0 cm En interiores Solo mano de obra unidad m2"

with get_db_session() as db:
    print(f"=== SEARCH FOR: '{query}' ===")
    search_engine = AISearchEngine()
    raw_results = search_engine.hybrid_search(db=db, query=query, limit=20)
    print("\n--- RAW HYBRID SEARCH RESULTS (TOP 20) ---")
    ids = [r["id"] for r in raw_results]
    items = db.query(CostItem).filter(CostItem.CodPar.in_(ids)).all()
    item_map = {i.CodPar: i for i in items}
    for i, r in enumerate(raw_results):
        it = item_map.get(r["id"])
        desc = it.Descri if it else "UNKNOWN"
        u = it.UniPar if it else "?"
        score = r.get("score")
        print(f"{i+1}. [{r['id']}] ({u}) score={score:.4f} -> {desc}")

    candidates, best_score = get_dynamic_candidates(
        db=db,
        description=query,
        covenin_prefix="",
        limit=15
    )
    print("\n--- RESCORED CANDIDATES (TOP 10) ---")
    for i, c in enumerate(candidates[:10]):
        it = c["item"]
        score = c["score"]
        breakdown = c["scoring_breakdown"]
        print(f"{i+1}. [{it.CodPar}] ({it.UniPar}) FINAL={score} -> {it.Descri}")
        print(f"   Breakdown: {breakdown.get('detalles_ajustes')}")
