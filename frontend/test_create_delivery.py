import urllib.request
import urllib.parse
import json
from datetime import date

def test_create_delivery():
    login_url = "http://localhost:8000/api/auth/login"
    create_url = "http://localhost:8000/api/deliveries/"
    
    # Login
    data = urllib.parse.urlencode({"username": "admin@milkyroots.in", "password": "admin123"}).encode()
    req = urllib.request.Request(login_url, data=data)
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode())
            token = res_data["access_token"]
    except Exception as e:
        print(f"Login failed: {e}")
        return
    
    # Create Delivery
    payload = {
        "customer_id": 6, # Neetu was ID 2? Or the test customer I created. Let's find a valid customer ID.
        "date": str(date.today()),
        "slot": "morning",
        "items": [
            {"product_id": 1, "quantity": 1.0}
        ],
        "delivered_by": "Admin",
        "send_whatsapp": False
    }
    
    req = urllib.request.Request(create_url, data=json.dumps(payload).encode(), method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    
    try:
        with urllib.request.urlopen(req) as response:
            if response.status == 201:
                print("Delivery created successfully!")
            else:
                print(f"Failed with status: {response.status}")
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} {e.reason}")
        print(e.read().decode())
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_create_delivery()
