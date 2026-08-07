from app.db.base import SessionLocal
from app.db.models.landing_site import LandingSite
from app.core.security import hash_password

db = SessionLocal()
site = db.query(LandingSite).filter(LandingSite.slug == 'prueba').first()

if site:
    print('Email:', site.email)
    site.password_hash = hash_password('123456')
    db.commit()
    print('Password reset to: 123456')
else:
    print('Site not found')
