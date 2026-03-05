from src.database import get_connection

try:
    conn = get_connection()
    print("✅ Connection successful!")
    conn.close()
except Exception as e:
    print("❌ Connection failed:", e)
