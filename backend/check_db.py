import os
import sys

from app.db.arko_base import get_db_session
from app.db.models.landing_site import LandingSite

def check_db():
    with get_db_session() as db:
        site = db.query(LandingSite).order_by(LandingSite.created_at.desc()).first()
        if site:
            print(f"Slug: {site.slug}")
            logo_url = site.site_config.get("global", {}).get("logo", "No logo")
            print(f"Logo URL: {logo_url}")
        else:
            print("No sites found")

if __name__ == "__main__":
    check_db()
