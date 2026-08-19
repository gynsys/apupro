import csv
from app.db.base import SessionLocal
from sqlalchemy import text

def export_mat_prices():
    db = SessionLocal()
    
    mat_query = text("SELECT \"CodMat\", \"Descri\", \"UniMat\", \"CosMat\" FROM public.cost360_materials WHERE \"CodMat\" LIKE 'MAT%' AND \"CosMat\" > 1000")
    mat_materials = db.execute(mat_query).fetchall()
    
    with open('/app/mat_precios_locos.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['CodMat', 'Descri', 'UniMat', 'CosMatActual', 'NuevoPrecio'])
        for mat in mat_materials:
            writer.writerow([mat[0], mat[1], mat[2], mat[3], ''])
            
    print(f"Exportados {len(mat_materials)} materiales a mat_precios_locos.csv")
    db.close()

if __name__ == '__main__':
    export_mat_prices()
