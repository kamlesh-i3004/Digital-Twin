import requests

BASE_URL = "http://127.0.0.1:5000/api"

# -------------------------
# REGISTER USER
# -------------------------
print("\n--- REGISTER ---")
register_response = requests.post(
    f"{BASE_URL}/register",
    json={
        "username": "alka",
        "password": "password123"
    }
)

print("REGISTER STATUS:", register_response.status_code)
print("REGISTER RESPONSE:", register_response.json())


# -------------------------
# LOGIN USER
# -------------------------
print("\n--- LOGIN ---")
login_response = requests.post(
    f"{BASE_URL}/login",
    json={
        "username": "alka",
        "password": "password123"
    }
)

print("LOGIN STATUS:", login_response.status_code)
print("LOGIN RESPONSE:", login_response.json())

if login_response.status_code != 200:
    print("Login failed. Stopping test.")
    exit()

token = login_response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}


# -------------------------
# CREATE TASK
# -------------------------
print("\n--- CREATE TASK ---")
task_response = requests.post(
    f"{BASE_URL}/tasks",
    headers=headers,
    json={
        "title": "Complete AI Research",
        "description": "Study task prediction models",
        "priority": "High",
        "due_date": "2026-02-20"
    }
)

print("CREATE STATUS:", task_response.status_code)
print("CREATE RESPONSE:", task_response.json())

task_id = task_response.json().get("task_id")


# -------------------------
# CREATE ADDITIONAL TASKS
# -------------------------
print("\n--- CREATE MULTIPLE TASKS FOR FILTER TEST ---")

requests.post(
    f"{BASE_URL}/tasks",
    headers=headers,
    json={
        "title": "High Priority Task",
        "priority": "High",
        "due_date": "2026-02-25"
    }
)

requests.post(
    f"{BASE_URL}/tasks",
    headers=headers,
    json={
        "title": "Low Priority Task",
        "priority": "Low",
        "due_date": "2026-03-01"
    }
)


# -------------------------
# GET ALL TASKS
# -------------------------
print("\n--- GET ALL TASKS ---")
get_response = requests.get(f"{BASE_URL}/tasks", headers=headers)
print("GET STATUS:", get_response.status_code)
print("GET RESPONSE:", get_response.json())


# -------------------------
# FILTER BY PRIORITY
# -------------------------
print("\n--- FILTER: priority=High ---")
filter_response = requests.get(
    f"{BASE_URL}/tasks?priority=High",
    headers=headers
)
print("FILTER STATUS:", filter_response.status_code)
print("FILTER RESPONSE:", filter_response.json())

# -------------------------
# FILTER BY COMPLETION
# -------------------------
print("\n--- FILTER: completed=true ---")
comp_filter = requests.get(
    f"{BASE_URL}/tasks?completed=true",
    headers=headers
)
print("COMPLETION FILTER STATUS:", comp_filter.status_code)
print("COMPLETION FILTER RESPONSE:", comp_filter.json())

# -------------------------
# SORT BY DUE DATE
# -------------------------
print("\n--- SORT BY due_date ---")
sort_response = requests.get(
    f"{BASE_URL}/tasks?sort_by=due_date",
    headers=headers
)
print("SORT STATUS:", sort_response.status_code)
print("SORT RESPONSE:", sort_response.json())

# -------------------------
# SORT DESCENDING
# -------------------------
print("\n--- SORT BY -due_date ---")
sort_desc = requests.get(
    f"{BASE_URL}/tasks?sort_by=-due_date",
    headers=headers
)
print("SORT DESC STATUS:", sort_desc.status_code)
print("SORT DESC RESPONSE:", sort_desc.json())


# -------------------------
# UPDATE TASK
# -------------------------
print("\n--- UPDATE TASK ---")
update_response = requests.put(
    f"{BASE_URL}/tasks/{task_id}",
    headers=headers,
    json={
        "title": "Updated AI Research Task",
        "priority": "Medium",
        "completed": True,
        "due_date": "2026-03-01",
        "description": "Now with more detail"
    }
)

print("UPDATE STATUS:", update_response.status_code)
print("UPDATE RESPONSE:", update_response.json())

# verify update actually persisted
if update_response.status_code == 200:
    verify = requests.get(f"{BASE_URL}/tasks", headers=headers)
    print("VERIFY AFTER UPDATE:", verify.json())

# -------------------------
# AUTHORIZATION CHECK
# -------------------------
print("\n--- AUTHZ: another user cannot delete/update ---")
# create second user and task
second_reg = requests.post(
    f"{BASE_URL}/register",
    json={"username": "other", "password": "secret"}
)
second_login = requests.post(
    f"{BASE_URL}/login",
    json={"username": "other", "password": "secret"}
)
sec_token = second_login.json().get("access_token")
sec_headers = {"Authorization": f"Bearer {sec_token}"}

sec_task = requests.post(
    f"{BASE_URL}/tasks",
    headers=sec_headers,
    json={"title": "Sec Task"}
)
sec_id = sec_task.json().get("task_id")
# attempt to delete original user's task with second token
bad_delete = requests.delete(
    f"{BASE_URL}/tasks/{task_id}",
    headers=sec_headers
)
print("BAD DELETE STATUS:", bad_delete.status_code)
print("BAD DELETE RESPONSE:", bad_delete.json())

# attempt to update second user's task with first token (should fail)
bad_update = requests.put(
    f"{BASE_URL}/tasks/{sec_id}",
    headers=headers,
    json={"title": "Hacked"}
)
print("BAD UPDATE STATUS:", bad_update.status_code)
print("BAD UPDATE RESPONSE:", bad_update.json())


# -------------------------
# DELETE TASK
# -------------------------
print("\n--- DELETE TASK ---")
delete_response = requests.delete(
    f"{BASE_URL}/tasks/{task_id}",
    headers=headers
)

print("DELETE STATUS:", delete_response.status_code)
print("DELETE RESPONSE:", delete_response.json())


# -------------------------
# CREATE OVERDUE TASK
# -------------------------
print("\n--- CREATE OVERDUE TASK ---")

requests.post(
    f"{BASE_URL}/tasks",
    headers=headers,
    json={
        "title": "Old Pending Task",
        "priority": "High",
        "due_date": "2023-01-01"  # Past date
    }
)


# -------------------------
# GET OVERDUE TASKS
# -------------------------
print("\n--- GET OVERDUE TASKS ---")
overdue_response = requests.get(
    f"{BASE_URL}/tasks/overdue",
    headers=headers
)

print("OVERDUE STATUS:", overdue_response.status_code)
print("OVERDUE RESPONSE:", overdue_response.json())


# -------------------------
# GET TASK STATISTICS
# -------------------------
print("\n--- GET TASK STATISTICS ---")
stats_response = requests.get(
    f"{BASE_URL}/tasks/stats",
    headers=headers
)

print("STATS STATUS:", stats_response.status_code)
print("STATS RESPONSE:", stats_response.json())

# -------------------------
# GET SMART RECOMMENDATION
# -------------------------
print("\n--- SMART TASK RECOMMENDATION ---")

recommend_response = requests.get(
    f"{BASE_URL}/tasks/recommend",
    headers=headers
)

print("RECOMMEND STATUS:", recommend_response.status_code)
print("RECOMMEND RESPONSE:", recommend_response.json())

# -------------------------
# NOTES CRUD
# -------------------------
print("\n--- NOTES CRUD ---")
note_resp = requests.post(
    f"{BASE_URL}/notes",
    headers=headers,
    json={"title": "Brainstorm", "content": "Ideas for project"}
)
print("NOTE CREATE", note_resp.status_code, note_resp.json())
note_id = note_resp.json().get("note_id")

list_notes = requests.get(f"{BASE_URL}/notes", headers=headers)
print("LIST NOTES", list_notes.status_code, list_notes.json())

if note_id:
    upd = requests.put(
        f"{BASE_URL}/notes/{note_id}",
        headers=headers,
        json={"content": "Updated ideas"}
    )
    print("UPDATE NOTE", upd.status_code, upd.json())
    deln = requests.delete(f"{BASE_URL}/notes/{note_id}", headers=headers)
    print("DELETE NOTE", deln.status_code, deln.json())

# -------------------------
# REMINDERS
# -------------------------
print("\n--- REMINDERS (next 7 days) ---")
rem = requests.get(f"{BASE_URL}/tasks/reminders", headers=headers)
print("REMINDERS", rem.status_code, rem.json())

# -------------------------
# PREDICTION
# -------------------------
print("\n--- PREDICT TASK COUNT ---")
pred = requests.get(f"{BASE_URL}/tasks/predict", headers=headers)
print("PRED", pred.status_code, pred.json())

# -------------------------
# NLP QUERY
# -------------------------
print("\n--- NLP QUERY ---")
qresp = requests.post(
    f"{BASE_URL}/query",
    headers=headers,
    json={"question": "What is due tomorrow?"}
)
print("QRESP", qresp.status_code, qresp.json())
