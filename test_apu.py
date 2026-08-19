from app.db.base import SessionLocal
from app.db.models.cost360 import CostAPUMaterial

def test_apu():
    db = SessionLocal()
    apus = db.query(CostAPUMaterial).filter(CostAPUMaterial.CodIns == 'MT2080').all()
    print("APUs with MT2080:")
    for a in apus:
        print(f"[{a.CodPar}] (length: {len(a.CodPar)})")
    db.close()

if __name__ == '__main__':
    test_apu()
