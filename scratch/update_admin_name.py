from app.db.arko_base import ArkoSessionLocal
from app.db.models.arko import ArkoAdmin, ArkoUser

db = ArkoSessionLocal()
admin = db.query(ArkoAdmin).filter(ArkoAdmin.email == 'admin@arko360.net').first()
if admin:
    admin.full_name = 'CostBase'
    print("ArkoAdmin updated!")

user = db.query(ArkoUser).filter(ArkoUser.email == 'admin@arko360.net').first()
if user:
    user.full_name = 'CostBase'
    print("ArkoUser updated!")

db.commit()
db.close()
