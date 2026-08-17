import requests

url = "http://localhost:8000/api/v1/cost360/items/M111110000/apu?database_id=temp_m"
resp = requests.get(url)
data = resp.json()

print(f"Total Directo: {data.get('total_directo')}")
print("Materiales:")
for m in data.get('materiales', []):
    print(f"  {m['codigo']}: {m['cantidad']} x {m['precio_unitario']} = {m['subtotal']}")
    
print("Equipos:")
for e in data.get('equipos', []):
    print(f"  {e['codigo']}: {e['cantidad']} x {e['precio_unitario']} = {e['subtotal']}")
    
print("Mano de Obra:")
for mo in data.get('mano_obra', []):
    print(f"  {mo['codigo']}: {mo['cantidad']} x {mo['precio_unitario']} = {mo['subtotal']}")
