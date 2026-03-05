import requests

try:
    resp = requests.post(
        "http://127.0.0.1:5000/api/register",
        json={"email": "alka@example.com", "password": "testpass"},
        timeout=10
    )
except Exception as e:
    print("Request error:", repr(e))
else:
    print("STATUS:", resp.status_code)
    print("HEADERS:", dict(resp.headers))
    print("TEXT (first 1000 chars):")
    print(resp.text[:1000])
    # Try JSON decode
    try:
        print("JSON:", resp.json())
    except Exception as e:
        print("JSON decode failed:", repr(e))
