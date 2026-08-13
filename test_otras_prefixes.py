import pandas as pd
from sqlalchemy import create_engine, text

def main():
    engine = create_engine('postgresql://apupro_user:apupro_password@costbase.arko360.net:5440/apupro_db')
    
    with engine.connect() as conn:
        # Group "OTRAS" valid items by the letters before the first dot/number
        query = text(r'''
            SELECT substring("CovPar" from '^[A-Za-z]{1,2}'), COUNT(*) as cant
            FROM cost360_items 
            WHERE "CovPar" ~ '^[A-Za-z]{1,2}[\.\-]?[0-9\.]+$'
            AND "CovPar" NOT LIKE 'E%'
            AND "CovPar" NOT LIKE 'C.%'
            AND "CovPar" NOT LIKE 'U%'
            AND "CovPar" NOT LIKE 'I%'
            AND "CovPar" NOT LIKE 'M%'
            AND "CovPar" NOT LIKE 'P%'
            AND "CovPar" NOT LIKE 'R%'
            AND "CovPar" NOT LIKE 'B%'
            AND "CovPar" NOT LIKE 'PE.%'
            AND "CovPar" NOT LIKE 'PT.%'
            AND "CovPar" NOT LIKE 'H%'
            GROUP BY substring("CovPar" from '^[A-Za-z]{1,2}')
            ORDER BY cant DESC
        ''')
        
        results = conn.execute(query).fetchall()
        print("Prefijos de las 588 partidas válidas no clasificadas:")
        for prefix, count in results:
            print(f"Prefijo '{prefix}': {count} partidas")

if __name__ == '__main__':
    main()
