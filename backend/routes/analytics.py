from datetime import datetime, timedelta, timezone
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Task
from helpers import api_ok, calculate_streak

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/analytics/tasks/completion", methods=["GET"])
@jwt_required()
def analytics_task_completion():
    user_id = get_jwt_identity()
    days = request.args.get("days", 30, type=int)
    days = max(7, min(days, 90))
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    result = []

    for i in range(days - 1, -1, -1):
        day = now - timedelta(days=i)
        day_start = datetime(day.year, day.month, day.day)
        day_end = day_start + timedelta(days=1)

        created = Task.query.filter(
            Task.user_id == user_id,
            Task.created_at >= day_start, Task.created_at < day_end,
        ).count()

        completed = Task.query.filter(
            Task.user_id == user_id, Task.completed == True,
            Task.completed_at >= day_start, Task.completed_at < day_end,
        ).count()

        result.append({"date": day_start.strftime("%Y-%m-%d"), "created": created, "completed": completed})

    return api_ok(result)


@analytics_bp.route("/analytics/tasks/priority", methods=["GET"])
@jwt_required()
def analytics_priority_distribution():
    user_id = get_jwt_identity()
    result = []
    for priority in ("Low", "Medium", "High"):
        count = Task.query.filter_by(user_id=user_id, priority=priority).count()
        result.append({"priority": priority, "count": count})
    return api_ok(result)


@analytics_bp.route("/analytics/productivity", methods=["GET"])
@jwt_required()
def analytics_productivity():
    user_id = get_jwt_identity()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    total = Task.query.filter_by(user_id=user_id).count()
    completed = Task.query.filter_by(user_id=user_id, completed=True).count()
    completion_rate = round((completed / total * 100), 1) if total > 0 else 0.0

    recent = Task.query.filter(
        Task.user_id == user_id,
        Task.created_at >= now - timedelta(days=30),
    ).count()
    tasks_per_day = round(recent / 30, 1)

    streak = calculate_streak(user_id, now)

    return api_ok({
        "completion_rate": completion_rate,
        "tasks_per_day": tasks_per_day,
        "streak_days": streak,
    })
