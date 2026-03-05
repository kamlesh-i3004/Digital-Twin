import requests

BASE_URL = "http://127.0.0.1:5000"

# -----------------------
# LOGIN
# -----------------------
login_response = requests.post(
    f"{BASE_URL}/api/login",
    json={
        "username": "alka",
        "password": "123"
    }
)

print("LOGIN RESPONSE:")
print(login_response.json())

if "access_token" not in login_response.json():
    print("❌ Login failed, no token received")
    exit()

token = login_response.json()["access_token"]
print("\nACCESS TOKEN:")
print(token)
