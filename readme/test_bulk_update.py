import requests
import json

# Datos de prueba
updates = [
    {"codigo": "MAT1402", "precio": 145},
    {"codigo": "MAT1408", "precio": 220},
    {"codigo": "MAT1409", "precio": 195},
    {"codigo": "MAT1417", "precio": 130}
]

# Token del admin (necesito obtenerlo)
token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiaWF0IjoxNzI0NTQ0MDAwLCJleHAiOjE3MjQ2MzA0MDB9.test"  # Token de prueba

# Intentar la actualización
try:
    response = requests.post(
        "http://costbase.net/api/v1/cost360/materials/bulk-update",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        },
        json={"updates": updates}
    )
    
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
    
except Exception as e:
    print(f"Error: {e}")
