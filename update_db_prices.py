import json
from app.db.base import SessionLocal
from sqlalchemy import text

def update_prices():
    db = SessionLocal()
    
    with open('/app/insumos_update.json', 'r') as f:
        data = json.load(f)
        
    print(f"Iniciando actualización de {len(data)} precios...")
    
    updated_count = 0
    try:
        # Usamos una transacción para actualizar todos juntos
        for item in data:
            codigo = item['codigo']
            costo = item['costo']
            
            res = db.execute(text("UPDATE public.cost360_materials SET \"CosMat\" = :costo WHERE \"CodMat\" = :codigo"), 
                             {'costo': costo, 'codigo': codigo})
            updated_count += res.rowcount
            
        db.commit()
        print(f"¡Éxito! Se actualizaron los precios de {updated_count} materiales MAT.")
    except Exception as e:
        print(f"Error actualizando: {e}")
        db.execute(text("ROLLBACK;"))
    finally:
        db.close()

if __name__ == '__main__':
    update_prices()
