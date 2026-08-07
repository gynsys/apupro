from app.db.base import Base, engine
from app.db.models.budget import Budget, BudgetItem, BudgetAPUMaterial, BudgetAPUEquipment, BudgetAPULabor

print("Creando tablas de Presupuestos...")
Base.metadata.create_all(bind=engine)
print("Tablas creadas exitosamente.")
