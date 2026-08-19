import sys
from app.db.base import SessionLocal
from app.db.models.cost360 import CostAPUMaterial, CostItem

def find_affected_apus():
    db = SessionLocal()
    
    # Estos son los códigos DESTINO de las 21 fusiones incorrectas
    bad_destinations = [
        "MT2080", "PLOA56", "ACE003", "MT272", "MT591", "HER059",
        "MT190", "MT2089", "MT734", "MT176", "MT202", "ACE145",
        "MT3142", "MT3399", "MT3529", "TUB056", "MT3029"
    ]
    
    print("--- PARTIDAS (APUS) QUE CONTIENEN LOS MATERIALES AFECTADOS ---")
    print("Debes revisar estas partidas para ver si requieren el diámetro/material original.\n")
    
    for dest_code in bad_destinations:
        apus = db.query(CostAPUMaterial).filter(CostAPUMaterial.CodIns == dest_code).all()
        if not apus:
            continue
            
        print(f"\n[ Insumo sospechoso actual: {dest_code} ]")
        for apu_mat in apus:
            apu = db.query(CostItem).filter(CostItem.CodPar == apu_mat.CodPar).first()
            if apu:
                print(f"  -> Partida: {apu.CodPar} - {apu.Descri[:80]}...")
            else:
                print(f"  -> Partida: {apu_mat.CodPar} (Sin descripción)")
                
    db.close()

if __name__ == '__main__':
    find_affected_apus()
