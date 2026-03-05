from models import create_user, create_task, get_tasks_by_user

# Step 1: Create a user named "Alka"
print("🔹 Creating user 'Alka'...")
user_id = create_user("Alka", "alka@example.com")
print(f"✅ User created with ID: {user_id}")

# Step 2: Add a task for Alka
print("\n🔹 Adding task 'Submit Project'...")
task_id = create_task(
    user_id=user_id,
    title="Submit Project",
    due_date="2024-10-01",
    due_time="23:59:00",
    priority="High",
    source="Manual"
)
print(f"✅ Task created with ID: {task_id}")

# Step 3: Fetch and display all tasks for Alka
print("\n🔹 Fetching tasks for user ID:", user_id)
tasks = get_tasks_by_user(user_id)
for task in tasks:
    print(f"📌 {task['title']} | Due: {task['due_date']} {task['due_time']} | Priority: {task['priority']}")