import psycopg2
import json

def check_db():
    try:
        conn = psycopg2.connect("postgresql://postgres:gyn13409534@localhost:5432/gynsys")
        cur = conn.cursor()
        
        # Check C.
        cur.execute("SELECT \"CodPar\" FROM cost_items WHERE \"CodPar\" LIKE 'C%' LIMIT 5;")
        print("Partidas C%:")
        for row in cur.fetchall():
            print(repr(row[0]))
            
        # Check E44
        cur.execute("SELECT \"CodPar\" FROM cost_items WHERE \"CodPar\" LIKE 'E44%' LIMIT 5;")
        print("\nPartidas E44%:")
        for row in cur.fetchall():
            print(repr(row[0]))
            
        cur.execute("SELECT COUNT(*) FROM cost_items WHERE \"CodPar\" LIKE 'E%';")
        print("\nTotal E%:", cur.fetchone()[0])
        
        cur.execute("SELECT COUNT(*) FROM cost_items WHERE \"CodPar\" LIKE 'C%';")
        print("Total C%:", cur.fetchone()[0])
        
        cur.close()
        conn.close()
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    check_db()
