
import sys
sys.path.append('/app')
from app.services.ai_search import ai_engine
from app.db.session import SessionLocal
from app.db.models.cost360 import CostItem

ai_engine.load_brain()
query = "excavacion a mano para banqueo sin incluir carga de material utilizando equipos livianos"
query_emb = ai_engine.model.encode([query])[0]
scores = ai_engine.calculate_cosine_similarity(query_emb)

top_indices = scores.argsort()[::-1][:15]
print("Query:", query)
db = SessionLocal()
for idx in top_indices:
    item_id = ai_engine.ids_mapping[idx]
    score = scores[idx]
    item = db.query(CostItem).filter(CostItem.CodPar == item_id).first()
    desc = item.Descri if item else "NOT_FOUND"
    print(f"[{score:.4f}] {item_id}: {desc}")
