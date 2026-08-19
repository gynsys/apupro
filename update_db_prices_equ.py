import json
from app.db.base import SessionLocal
from sqlalchemy import text

def update_equ_prices():
    db = SessionLocal()
    
    with open('/app/equ_update.json', 'r') as f:
        data = json.load(f)
        
    print(f"Iniciando actualización de {len(data)} precios de equipos...")
    
    updated_count = 0
    try:
        for item in data:
            codigo = item['codigo']
            costo = item['costo']
            
            res = db.execute(text("UPDATE public.cost360_equipment SET \"CosDia\" = :costo WHERE \"CodEqu\" = :codigo"), 
                             {'costo': costo, 'codigo': codigo})
            updated_count += res.rowcount
            
        db.commit()
        print(f"¡Éxito! Se actualizaron los precios de {updated_count} equipos EQU.")
    except Exception as e:
        print(f"Error actualizando: {e}")
        db.execute(text("ROLLBACK;"))
    finally:
        db.close()

if __name__ == '__main__':
    update_equ_prices()
