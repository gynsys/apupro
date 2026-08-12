import psycopg2

def check_schema():
    try:
        conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/postgres")
        cur = conn.cursor()
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cost_items';")
        rows = cur.fetchall()
        print("Columnas de cost_items:")
        for row in rows:
            print(row)
        
        cur.execute("SELECT \"CodPar\", \"CovPar\", \"Categoria\" FROM cost_items LIMIT 5;")
        print("\nMuestra de datos:")
        for row in cur.fetchall():
            print(row)
            
        cur.close()
        conn.close()
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    check_schema()
