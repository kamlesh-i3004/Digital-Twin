from collections import defaultdict
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import Task
from helpers import api_ok, api_err, serialize_task, get_recommendation

ALLOWED_PRIORITIES = {"Low", "Medium", "High"}
ALLOWED_CATEGORIES = {"General", "Work", "Jobs", "Personal", "Shopping", "Health", "Finance", "Education", "Government", "Other"}

try:
    import numpy as np
    from sklearn.linear_model import LinearRegression
    _ML_AVAILABLE = True
except ImportError:
    _ML_AVAILABLE = False

tasks_bp = Blueprint("tasks", __name__)


@tasks_bp.route("/tasks", methods=["POST"])
@jwt_required()
def create_task():
    data = request.get_json() or {}
    user_id = get_jwt_identity()

    if not data.get("title"):
        return api_err("Task title is required")

    due_date = None
    if data.get("due_date"):
        try:
            due_date = datetime.strptime(data["due_date"], "%Y-%m-%d")
        except ValueError:
            return api_err("Invalid date format. Use YYYY-MM-DD")

    priority = data.get("priority", "Medium")
    if priority not in ALLOWED_PRIORITIES:
        return api_err(f"Invalid priority. Must be one of: {', '.join(sorted(ALLOWED_PRIORITIES))}")

    category = data.get("category", "General")
    if category not in ALLOWED_CATEGORIES:
        return api_err(f"Invalid category. Must be one of: {', '.join(sorted(ALLOWED_CATEGORIES))}")

    task = Task(
        title=data["title"],
        description=data.get("description", ""),
        priority=priority,
        category=category,
        due_date=due_date,
        user_id=user_id,
    )
    db.session.add(task)
    db.session.commit()
    return api_ok(serialize_task(task), "Task created", 201)


@tasks_bp.route("/tasks", methods=["GET"])
@jwt_required()
def get_tasks():
    user_id = get_jwt_identity()
    query = Task.query.filter(Task.user_id == user_id)

    priority = request.args.get("priority")
    if priority:
        query = query.filter_by(priority=priority)

    status = request.args.get("status")
    if status == "completed":
        query = query.filter_by(completed=True)
    elif status == "pending":
        query = query.filter_by(completed=False)

    sort_by = request.args.get("sort_by", "created_at")
    sort_order = request.args.get("sort_order", "desc")
    if sort_by in ("due_date", "priority", "created_at"):
        column = getattr(Task, sort_by)
        query = query.order_by(column.desc() if sort_order == "desc" else column)

    tasks = query.all()
    return api_ok([serialize_task(t) for t in tasks])


@tasks_bp.route("/tasks/bulk", methods=["POST"])
@jwt_required()
def bulk_task_action():
    """Bulk operations on tasks: complete, reopen, or delete."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    action = data.get("action")
    ids = data.get("ids", [])

    if action not in ("complete", "reopen", "delete"):
        return api_err("action must be one of: complete, reopen, delete")
    if not ids or not isinstance(ids, list):
        return api_err("ids must be a non-empty list of task IDs")
    if len(ids) > 100:
        return api_err("Cannot bulk-operate on more than 100 tasks at once")

    try:
        int_ids = [int(i) for i in ids]
    except (ValueError, TypeError):
        return api_err("All ids must be integers")

    tasks = Task.query.filter(
        Task.id.in_(int_ids),
        Task.user_id == int(user_id),
    ).all()

    if not tasks:
        return api_err("No matching tasks found", 404)

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    affected = 0
    for task in tasks:
        if action == "complete":
            if not task.completed:
                task.completed = True
                task.completed_at = now
                affected += 1
        elif action == "reopen":
            if task.completed:
                task.completed = False
                task.completed_at = None
                affected += 1
        elif action == "delete":
            db.session.delete(task)
            affected += 1

    db.session.commit()
    return api_ok({"affected": affected}, f"Bulk {action} completed")


@tasks_bp.route("/tasks/stats", methods=["GET"])
@jwt_required()
def task_stats():
    user_id = get_jwt_identity()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today_start = datetime(now.year, now.month, now.day)

    total = Task.query.filter_by(user_id=user_id).count()
    completed = Task.query.filter_by(user_id=user_id, completed=True).count()
    pending = Task.query.filter_by(user_id=user_id, completed=False).count()

    overdue = Task.query.filter(
        Task.user_id == user_id,
        Task.completed == False,
        Task.due_date != None,
        Task.due_date < now,
    ).count()

    completed_today = Task.query.filter(
        Task.user_id == user_id,
        Task.completed == True,
        Task.completed_at >= today_start,
    ).count()

    return api_ok({
        "total": total,
        "completed": completed,
        "pending": pending,
        "overdue": overdue,
        "completed_today": completed_today,
    })


@tasks_bp.route("/tasks/overdue", methods=["GET"])
@jwt_required()
def get_overdue_tasks():
    user_id = get_jwt_identity()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    tasks = Task.query.filter(
        Task.user_id == user_id,
        Task.completed == False,
        Task.due_date != None,
        Task.due_date < now,
    ).all()
    return api_ok([serialize_task(t) for t in tasks])


@tasks_bp.route("/tasks/reminders", methods=["GET"])
@jwt_required()
def task_reminders():
    user_id = get_jwt_identity()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    week_later = now + timedelta(days=7)
    tasks = Task.query.filter(
        Task.user_id == user_id,
        Task.completed == False,
        Task.due_date != None,
        Task.due_date >= now,
        Task.due_date <= week_later,
    ).all()
    return api_ok([serialize_task(t) for t in tasks])


@tasks_bp.route("/tasks/recommend", methods=["GET"])
@jwt_required()
def recommend_task():
    user_id = get_jwt_identity()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    rec = get_recommendation(user_id, now)
    if rec:
        return api_ok(rec)
    return api_ok(None, "No pending tasks. Great job!")


@tasks_bp.route("/tasks/predict", methods=["GET"])
@jwt_required()
def predict_tasks():
    user_id = get_jwt_identity()
    all_tasks = Task.query.filter_by(user_id=user_id).all()

    if not all_tasks:
        return api_ok({"estimated_tasks_next_week": 0, "confidence": "low"})

    weekly: dict = defaultdict(int)
    for task in all_tasks:
        iso = task.created_at.isocalendar()
        week_key = f"{iso[0]}-{iso[1]:02d}"
        weekly[week_key] += 1

    values = [weekly[k] for k in sorted(weekly)]

    if len(values) < 3:
        est = round(sum(values) / len(values))
        return api_ok({"estimated_tasks_next_week": est, "confidence": "low"})

    try:
        if not _ML_AVAILABLE:
            raise ImportError("ML libraries not available")
        X = np.array(range(len(values))).reshape(-1, 1)
        y = np.array(values)
        model = LinearRegression()
        model.fit(X, y)
        est = max(0, int(round(model.predict([[len(values)]])[0])))
        return api_ok({"estimated_tasks_next_week": est, "confidence": "high"})
    except Exception:
        est = round(sum(values) / len(values))
        return api_ok({"estimated_tasks_next_week": est, "confidence": "low"})


@tasks_bp.route("/tasks/<int:task_id>", methods=["GET"])
@jwt_required()
def get_task(task_id):
    user_id = get_jwt_identity()
    task = Task.query.filter_by(id=task_id, user_id=user_id).first()
    if not task:
        return api_err("Task not found", 404)
    return api_ok(serialize_task(task))


@tasks_bp.route("/tasks/<int:task_id>", methods=["PUT", "PATCH"])
@jwt_required()
def update_task(task_id):
    user_id = get_jwt_identity()
    task = Task.query.filter_by(id=task_id, user_id=user_id).first()
    if not task:
        return api_err("Task not found", 404)

    data = request.get_json() or {}

    if "title" in data:
        task.title = data["title"]
    if "description" in data:
        task.description = data["description"]
    if "priority" in data:
        if data["priority"] not in ALLOWED_PRIORITIES:
            return api_err(f"Invalid priority. Must be one of: {', '.join(sorted(ALLOWED_PRIORITIES))}")
        task.priority = data["priority"]
    if "category" in data:
        if data["category"] not in ALLOWED_CATEGORIES:
            return api_err(f"Invalid category. Must be one of: {', '.join(sorted(ALLOWED_CATEGORIES))}")
        task.category = data["category"]

    # Support both "completed" (bool) and "status" ("completed"/"pending") fields
    is_completed = None
    if "completed" in data:
        is_completed = bool(data["completed"])
    elif "status" in data:
        is_completed = data["status"] == "completed"

    if is_completed is not None:
        task.completed = is_completed
        if task.completed and not task.completed_at:
            task.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
        elif not task.completed:
            task.completed_at = None

    if "due_date" in data:
        if data["due_date"]:
            try:
                task.due_date = datetime.strptime(data["due_date"], "%Y-%m-%d")
            except ValueError:
                return api_err("Invalid date format. Use YYYY-MM-DD")
        else:
            task.due_date = None

    db.session.commit()
    return api_ok(serialize_task(task))


@tasks_bp.route("/tasks/<int:task_id>", methods=["DELETE"])
@jwt_required()
def delete_task(task_id):
    user_id = get_jwt_identity()
    task = Task.query.filter_by(id=task_id, user_id=user_id).first()
    if not task:
        return api_err("Task not found", 404)
    db.session.delete(task)
    db.session.commit()
    return api_ok(None, "Task deleted")


@tasks_bp.route("/query", methods=["POST"])
@jwt_required()
def nlp_query():
    data = request.get_json() or {}
    question = data.get("question", "").lower()
    user_id = get_jwt_identity()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    tasks = []
    intent = "unknown"

    if "overdue" in question:
        intent = "overdue"
        tasks = Task.query.filter(
            Task.user_id == user_id, Task.completed == False,
            Task.due_date != None, Task.due_date < now,
        ).all()
    elif "today" in question:
        intent = "today"
        today_start = datetime(now.year, now.month, now.day)
        today_end = datetime(now.year, now.month, now.day, 23, 59, 59)
        tasks = Task.query.filter(
            Task.user_id == user_id, Task.completed == False,
            Task.due_date >= today_start, Task.due_date <= today_end,
        ).all()
    elif any(w in question for w in ("high priority", "urgent", "important")):
        intent = "high_priority"
        tasks = Task.query.filter_by(user_id=user_id, completed=False, priority="High").all()
    elif any(w in question for w in ("next week", "this week")):
        intent = "this_week"
        tasks = Task.query.filter(
            Task.user_id == user_id, Task.completed == False,
            Task.due_date >= now, Task.due_date <= now + timedelta(days=7),
        ).all()
    elif any(w in question for w in ("completed", "done", "finished")):
        intent = "completed"
        tasks = Task.query.filter_by(user_id=user_id, completed=True).all()
    elif any(w in question for w in ("tomorrow", "due")):
        intent = "due_soon"
        tasks = Task.query.filter(
            Task.user_id == user_id, Task.completed == False,
            Task.due_date != None, Task.due_date <= now + timedelta(days=1),
        ).all()
    else:
        return api_ok({"results": [], "intent": "unknown"}, "I did not understand the question.")

    return api_ok({"results": [serialize_task(t) for t in tasks], "intent": intent})
