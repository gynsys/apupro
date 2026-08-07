import requests
import json
import uuid

base_url = "http://localhost:8000/api/v1/arko_app"
unique_email = f"test_{uuid.uuid4()}@example.com"

data = {
    "full_name": "Test User",
    "email": unique_email,
    "password": "password123"
}

print(f"Testing register with email {unique_email}")
try:
    response = requests.post(f"{base_url}/auth/register", json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
