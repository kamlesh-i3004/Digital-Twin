import os
from datetime import datetime, timedelta, timezone
from flask import jsonify

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")


# ─── Response Helpers ────────────────────────────────────────────────────────────

def api_ok(data, message=None, code=200):
    return jsonify({"success": True, "data": data, "message": message}), code


def api_err(message, code=400):
    return jsonify({"success": False, "data": None, "message": message}), code


# ─── Serializers ─────────────────────────────────────────────────────────────────

def serialize_user(user):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "created_at": user.created_at.isoformat(),
    }


def serialize_task(task):
    return {
        "id": str(task.id),
        "title": task.title,
        "description": task.description or "",
        "priority": task.priority,
        "category": task.category or "General",
        "due_date": task.due_date.strftime("%Y-%m-%d") if task.due_date else None,
        "status": "completed" if task.completed else "pending",
        "created_at": task.created_at.isoformat(),
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "source_email_id": task.source_email_id,
        "calendar_event_id": task.calendar_event_id,
    }


def serialize_note(note):
    return {
        "id": str(note.id),
        "title": note.title or "",
        "content": note.content,
        "created_at": note.created_at.isoformat(),
        "updated_at": note.updated_at.isoformat(),
    }


# ─── Google OAuth ─────────────────────────────────────────────────────────────────

def get_google_credentials(integration):
    """Return valid Credentials, refreshing the access token if expired and persisting the new one."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from extensions import db

    creds = Credentials(
        token=integration.access_token,
        refresh_token=integration.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        integration.access_token = creds.token
        if creds.expiry:
            integration.token_expiry = creds.expiry
        db.session.commit()
    return creds


# ─── Shared Business Logic ────────────────────────────────────────────────────────

def get_recommendation(user_id, now):
    """Return the most important pending task for the user, or None."""
    from models import Task

    # 1. Overdue
    task = Task.query.filter(
        Task.user_id == user_id,
        Task.completed == False,
        Task.due_date != None,
        Task.due_date < now,
    ).first()
    if task:
        return {"task": serialize_task(task), "reason": "You have an overdue task that needs immediate attention."}

    # 2. High priority
    task = Task.query.filter_by(user_id=user_id, completed=False, priority="High").first()
    if task:
        return {"task": serialize_task(task), "reason": "This high priority task needs your attention."}

    # 3. Due within 2 days
    soon = now + timedelta(days=2)
    task = Task.query.filter(
        Task.user_id == user_id,
        Task.completed == False,
        Task.due_date != None,
        Task.due_date >= now,
        Task.due_date <= soon,
    ).first()
    if task:
        return {"task": serialize_task(task), "reason": "This task is due soon."}

    # 4. Any pending task
    task = Task.query.filter_by(user_id=user_id, completed=False).first()
    if task:
        return {"task": serialize_task(task), "reason": "Keep the momentum going with this pending task."}

    return None


def calculate_streak(user_id, now):
    """Return the user's current consecutive-day task completion streak."""
    from sqlalchemy import cast, Date as SADate
    from extensions import db
    from models import Task

    cutoff = now - timedelta(days=365)
    rows = db.session.query(
        cast(Task.completed_at, SADate).label("day")
    ).filter(
        Task.user_id == user_id,
        Task.completed == True,
        Task.completed_at >= cutoff,
    ).distinct().all()
    completed_days = {r.day for r in rows}

    streak = 0
    check_day = (now - timedelta(days=1)).date()
    for _ in range(365):
        if check_day in completed_days:
            streak += 1
            check_day -= timedelta(days=1)
        else:
            break
    return streak
