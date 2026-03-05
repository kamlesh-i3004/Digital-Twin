from datetime import datetime, timedelta, timezone
from flask import Blueprint
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Task
from helpers import api_ok, serialize_task, get_recommendation, calculate_streak

assistant_bp = Blueprint("assistant", __name__)


@assistant_bp.route("/assistant/digest", methods=["GET"])
@jwt_required()
def assistant_digest():
    user_id = get_jwt_identity()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today_start = datetime(now.year, now.month, now.day)
    today_end = today_start + timedelta(days=1)
    yesterday_start = today_start - timedelta(days=1)
    tomorrow_end = today_end + timedelta(days=1)
    week_end = today_start + timedelta(days=7)

    overdue_count = Task.query.filter(
        Task.user_id == user_id,
        Task.completed == False,
        Task.due_date != None,
        Task.due_date < today_start,
    ).count()

    due_today_count = Task.query.filter(
        Task.user_id == user_id,
        Task.completed == False,
        Task.due_date >= today_start,
        Task.due_date < today_end,
    ).count()

    due_tomorrow_count = Task.query.filter(
        Task.user_id == user_id,
        Task.completed == False,
        Task.due_date >= today_end,
        Task.due_date < tomorrow_end,
    ).count()

    high_priority_pending = Task.query.filter_by(
        user_id=user_id, completed=False, priority="High"
    ).count()

    completed_yesterday = Task.query.filter(
        Task.user_id == user_id,
        Task.completed == True,
        Task.completed_at >= yesterday_start,
        Task.completed_at < today_start,
    ).count()

    streak = calculate_streak(user_id, now)

    utc_hour = now.hour
    if utc_hour < 12:
        greeting = "Good morning"
    elif utc_hour < 17:
        greeting = "Good afternoon"
    else:
        greeting = "Good evening"

    focus = get_recommendation(user_id, now)

    upcoming = Task.query.filter(
        Task.user_id == user_id,
        Task.completed == False,
        Task.due_date >= today_start,
        Task.due_date <= week_end,
    ).order_by(Task.due_date).limit(5).all()

    return api_ok({
        "greeting": greeting,
        "overdue_count": overdue_count,
        "due_today_count": due_today_count,
        "due_tomorrow_count": due_tomorrow_count,
        "high_priority_pending": high_priority_pending,
        "completed_yesterday": completed_yesterday,
        "streak_days": streak,
        "focus_task": focus,
        "upcoming_tasks": [serialize_task(t) for t in upcoming],
    })
