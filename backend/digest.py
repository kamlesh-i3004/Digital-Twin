"""
Weekly email digest scheduler.

Runs a background thread that sends each user a weekly summary every Sunday at 9 AM local time.
Requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in .env.

To enable for a user: PUT /api/digest/settings  {"enabled": true}
To test immediately: POST /api/digest/send
"""

import os
import time
import smtplib
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")


# ─── Email Sending ────────────────────────────────────────────────────────────────

def _send_email(to_email: str, subject: str, body_html: str, body_text: str) -> bool:
    """Send an email via SMTP TLS. Returns True on success."""
    if not SMTP_USER or not SMTP_PASSWORD:
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"Alkapro Assistant <{SMTP_USER}>"
        msg["To"] = to_email
        msg.attach(MIMEText(body_text, "plain"))
        msg.attach(MIMEText(body_html, "html"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_email, msg.as_string())
        return True
    except Exception:
        return False


# ─── Digest Content ───────────────────────────────────────────────────────────────

def _build_digest_content(user_name: str, stats: dict) -> tuple:
    """Return (html, plain_text) for the digest email."""
    week_date = datetime.now().strftime("%B %d, %Y")

    # HTML version
    overdue_rows = ""
    for t in stats["overdue_tasks"][:5]:
        overdue_rows += f"<li>{t['title']} <em style='color:#888'>(due {t['due_date'] or 'no date'})</em></li>"

    upcoming_rows = ""
    for t in stats["due_this_week"][:5]:
        upcoming_rows += f"<li>{t['title']} <em style='color:#888'>(due {t['due_date'] or 'no date'})</em></li>"

    overdue_section = f"<h3 style='color:#dc2626'>⚠️ Overdue ({stats['overdue']})</h3><ul>{overdue_rows}</ul>" if stats["overdue_tasks"] else ""
    upcoming_section = f"<h3 style='color:#2563eb'>📅 Due This Week ({len(stats['due_this_week'])})</h3><ul>{upcoming_rows}</ul>" if stats["due_this_week"] else ""

    html = f"""
    <html><body style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #222;">
      <h2>Hi {user_name}! 👋</h2>
      <p style="color:#555">Here's your weekly summary from <strong>Alkapro Assistant</strong> — week of {week_date}.</p>

      <h3>📊 This Week</h3>
      <table style="border-collapse:collapse; width:100%">
        <tr><td style="padding:6px 0">Tasks created</td><td><strong>{stats['created_this_week']}</strong></td></tr>
        <tr><td style="padding:6px 0">Tasks completed</td><td><strong>{stats['completed_this_week']}</strong></td></tr>
        <tr><td style="padding:6px 0">Completion rate</td><td><strong>{stats['completion_rate']}%</strong></td></tr>
        <tr><td style="padding:6px 0">Total pending</td><td><strong>{stats['total_pending']}</strong></td></tr>
        <tr><td style="padding:6px 0">Current streak</td><td><strong>{stats['streak']} day{'s' if stats['streak'] != 1 else ''}</strong> 🔥</td></tr>
      </table>

      {overdue_section}
      {upcoming_section}

      <hr style="margin:24px 0; border:none; border-top:1px solid #eee">
      <p style="color:#aaa; font-size:12px">
        You're receiving this because weekly digest is enabled in your Alkapro settings.<br>
        To unsubscribe, go to <strong>Settings → Digest</strong> and disable it.
      </p>
    </body></html>
    """

    # Plain text version
    lines = [
        f"Hi {user_name}!",
        f"",
        f"Your weekly summary from Alkapro Assistant — {week_date}",
        f"",
        f"📊 This Week",
        f"  Tasks created:   {stats['created_this_week']}",
        f"  Tasks completed: {stats['completed_this_week']}",
        f"  Completion rate: {stats['completion_rate']}%",
        f"  Total pending:   {stats['total_pending']}",
        f"  Current streak:  {stats['streak']} day(s) 🔥",
        f"",
    ]
    if stats["overdue_tasks"]:
        lines.append(f"⚠️ Overdue ({stats['overdue']})")
        for t in stats["overdue_tasks"][:5]:
            lines.append(f"  - {t['title']} (due {t['due_date'] or 'no date'})")
        lines.append("")
    if stats["due_this_week"]:
        lines.append(f"📅 Due This Week ({len(stats['due_this_week'])})")
        for t in stats["due_this_week"][:5]:
            lines.append(f"  - {t['title']} (due {t['due_date'] or 'no date'})")
        lines.append("")

    return html, "\n".join(lines)


# ─── Stats Collection ─────────────────────────────────────────────────────────────

def _collect_stats(user_id: int) -> dict:
    """Collect weekly stats for a user. Must be called within an active Flask app context."""
    from extensions import db
    from models import Task

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    week_ago = now - timedelta(days=7)
    today_start = datetime(now.year, now.month, now.day)
    week_end = today_start + timedelta(days=7)

    created_this_week = Task.query.filter(
        Task.user_id == user_id,
        Task.created_at >= week_ago,
    ).count()

    completed_this_week = Task.query.filter(
        Task.user_id == user_id,
        Task.completed == True,
        Task.completed_at >= week_ago,
    ).count()

    total_pending = Task.query.filter_by(user_id=user_id, completed=False).count()

    overdue_tasks = Task.query.filter(
        Task.user_id == user_id,
        Task.completed == False,
        Task.due_date != None,
        Task.due_date < now,
    ).limit(10).all()

    due_this_week = Task.query.filter(
        Task.user_id == user_id,
        Task.completed == False,
        Task.due_date >= today_start,
        Task.due_date <= week_end,
    ).order_by(Task.due_date).limit(10).all()

    # Streak (use shared function from helpers)
    from helpers import calculate_streak
    streak = calculate_streak(user_id, now)

    completion_rate = round((completed_this_week / created_this_week * 100), 1) if created_this_week > 0 else 0.0

    return {
        "created_this_week": created_this_week,
        "completed_this_week": completed_this_week,
        "completion_rate": completion_rate,
        "total_pending": total_pending,
        "overdue": len(overdue_tasks),
        "streak": streak,
        "overdue_tasks": [{"title": t.title, "due_date": t.due_date.strftime("%Y-%m-%d") if t.due_date else None} for t in overdue_tasks],
        "due_this_week": [{"title": t.title, "due_date": t.due_date.strftime("%Y-%m-%d") if t.due_date else None} for t in due_this_week],
    }


# ─── Public Send Functions ────────────────────────────────────────────────────────

def send_digest_in_context(user_id: int, to_email: str) -> bool:
    """
    Send digest for a user. Assumes an active Flask app context.
    Used from route handlers (which are already in-context).
    """
    from extensions import db
    from models import User, DigestSettings

    user = db.session.get(User, user_id)
    if not user:
        return False

    stats = _collect_stats(user_id)
    html, text = _build_digest_content(user.name, stats)
    subject = f"Your Weekly Digest — {datetime.now().strftime('%B %d, %Y')}"

    success = _send_email(to_email, subject, html, text)
    if success:
        settings = DigestSettings.query.filter_by(user_id=user_id).first()
        if settings:
            settings.last_sent = datetime.now(timezone.utc).replace(tzinfo=None)
            db.session.commit()
    return success


def send_digest_for_user(app, user_id: int, to_email: str) -> bool:
    """
    Send digest for a user from a background thread.
    Pushes its own app context so it can be called from threads.
    """
    with app.app_context():
        return send_digest_in_context(user_id, to_email)


# ─── Background Scheduler ─────────────────────────────────────────────────────────

def _digest_loop(app):
    """Check every hour; on Sunday 9 AM send digest to all opted-in users."""
    while True:
        try:
            now = datetime.now()
            if now.weekday() == 6 and now.hour == 9:  # Sunday at 9 AM local
                with app.app_context():
                    from extensions import db
                    from models import User, DigestSettings

                    week_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=6)
                    settings_list = DigestSettings.query.filter_by(enabled=True).all()

                    for settings in settings_list:
                        # Skip if already sent within the last 6 days
                        if settings.last_sent and settings.last_sent > week_ago:
                            continue

                        user = db.session.get(User, settings.user_id)
                        if not user:
                            continue

                        to_email = settings.digest_email or user.email
                        send_digest_in_context(settings.user_id, to_email)

        except Exception:
            pass  # Never crash the background thread

        time.sleep(3600)  # Check every hour


def start_digest_scheduler(app):
    """Start the weekly digest background thread. Call once at app startup."""
    if not SMTP_USER or not SMTP_PASSWORD:
        app.logger.info("SMTP not configured (SMTP_USER/SMTP_PASSWORD missing) — weekly digest disabled")
        return

    thread = threading.Thread(target=_digest_loop, args=(app,), daemon=True)
    thread.start()
    app.logger.info("Weekly digest scheduler started (runs Sundays at 9 AM)")
