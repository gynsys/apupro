import os
import psycopg2

def check_db():
    try:
        conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/postgres")
        cur = conn.cursor()
        cur.execute("SELECT \"CodPar\", \"CovPar\", left(\"Descri\", 50) FROM cost_items WHERE \"CodPar\" LIKE 'E44%' LIMIT 10")
        rows = cur.fetchall()
        print(f"Encontradas {len(rows)} partidas E44%:")
        for row in rows:
            print(row)
        
        cur.execute("SELECT \"CodPar\", \"CovPar\", left(\"Descri\", 50) FROM cost_items WHERE \"Descri\" ILIKE '%puerta%' AND \"Descri\" ILIKE '%entamborada%'")
        rows = cur.fetchall()
        print(f"\nPartidas con puerta entamborada:")
        for row in rows:
            print(row)
            
        cur.close()
        conn.close()
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    check_db()
