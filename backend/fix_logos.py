import sys
from app.db.session import get_db_session
from app.db.models.landing_site import LandingSite

def fix_logos():
    with get_db_session() as db:
        sites = db.query(LandingSite).all()
        for site in sites:
            if site.site_config and "global" in site.site_config and "logo" in site.site_config["global"]:
                logo_url = site.site_config["global"]["logo"]
                if "http://backend:8001" in logo_url:
                    new_logo_url = logo_url.replace("http://backend:8001", "https://api.arko360.net")
                    
                    # Update config
                    new_config = dict(site.site_config)
                    new_config["global"]["logo"] = new_logo_url
                    new_config["logoUrl"] = new_logo_url
                    
                    site.site_config = new_config
                    db.add(site)
                    print(f"Fixed logo for {site.slug}")
        db.commit()

if __name__ == "__main__":
    fix_logos()
