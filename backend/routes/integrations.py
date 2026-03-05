import os
import json
import base64
import hmac as _hmac
import hashlib as _hashlib
import threading
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, redirect, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import Task, GoogleIntegration, GmailSenderWhitelist, DigestSettings, User
from helpers import api_ok, api_err, serialize_task, get_google_credentials

integrations_bp = Blueprint("integrations", __name__)

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:5000/api/integrations/google/callback")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
]

# In-memory async sync state: {user_id: {"status": str, "result": dict|None, "error": str|None, "started_at": str}}
_sync_status: dict = {}
_sync_lock = threading.Lock()


# ─── OAuth Helpers ────────────────────────────────────────────────────────────────

def _make_oauth_state(user_id: str, secret: str) -> str:
    nonce = base64.urlsafe_b64encode(os.urandom(16)).decode()
    payload = json.dumps({"user_id": user_id, "nonce": nonce})
    sig = _hmac.new(secret.encode(), payload.encode(), _hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}|{sig}".encode()).decode()


def _verify_oauth_state(state: str, secret: str) -> dict:
    try:
        decoded = base64.urlsafe_b64decode(state.encode()).decode()
        payload_str, sig = decoded.rsplit("|", 1)
        expected_sig = _hmac.new(secret.encode(), payload_str.encode(), _hashlib.sha256).hexdigest()
        if not _hmac.compare_digest(sig, expected_sig):
            raise ValueError("Invalid signature")
        return json.loads(payload_str)
    except Exception as exc:
        raise ValueError("Invalid OAuth state") from exc


def _build_flow():
    from google_auth_oauthlib.flow import Flow
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [GOOGLE_REDIRECT_URI],
        }
    }
    flow = Flow.from_client_config(client_config, scopes=GOOGLE_SCOPES)
    flow.redirect_uri = GOOGLE_REDIRECT_URI
    return flow


# ─── Google OAuth Routes ──────────────────────────────────────────────────────────

@integrations_bp.route("/integrations/google/auth-url", methods=["GET"])
@jwt_required()
def google_auth_url():
    if not GOOGLE_CLIENT_ID:
        return api_err("Google integration not configured. Add GOOGLE_CLIENT_ID to .env", 503)
    user_id = get_jwt_identity()
    secret = current_app.config["JWT_SECRET_KEY"]
    flow = _build_flow()
    state = _make_oauth_state(user_id, secret)
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )
    return api_ok({"auth_url": auth_url})


@integrations_bp.route("/integrations/google/callback", methods=["GET"])
def google_callback():
    code = request.args.get("code")
    state = request.args.get("state", "")
    error = request.args.get("error")

    if error or not code:
        return redirect(f"{FRONTEND_URL}/settings?error=google_denied")

    try:
        secret = current_app.config["JWT_SECRET_KEY"]
        state_data = _verify_oauth_state(state, secret)
        user_id = int(state_data["user_id"])
    except ValueError:
        return redirect(f"{FRONTEND_URL}/settings?error=invalid_state")

    try:
        flow = _build_flow()
        flow.fetch_token(code=code)
        creds = flow.credentials

        from googleapiclient.discovery import build as gbuild
        oauth2 = gbuild("oauth2", "v2", credentials=creds)
        info = oauth2.userinfo().get().execute()
        google_email = info.get("email", "")

        integration = GoogleIntegration.query.filter_by(user_id=user_id).first()
        if integration:
            integration.access_token = creds.token
            integration.refresh_token = creds.refresh_token or integration.refresh_token
            integration.token_expiry = creds.expiry
            integration.google_email = google_email
            integration.connected_at = datetime.now(timezone.utc).replace(tzinfo=None)
        else:
            integration = GoogleIntegration(
                user_id=user_id,
                access_token=creds.token,
                refresh_token=creds.refresh_token,
                token_expiry=creds.expiry,
                google_email=google_email,
            )
            db.session.add(integration)
        db.session.commit()
        return redirect(f"{FRONTEND_URL}/settings?connected=true")
    except Exception:
        current_app.logger.exception("Google OAuth callback failed")
        return redirect(f"{FRONTEND_URL}/settings?error=google_failed")


@integrations_bp.route("/integrations/google/status", methods=["GET"])
@jwt_required()
def google_status():
    user_id = get_jwt_identity()
    integration = GoogleIntegration.query.filter_by(user_id=int(user_id)).first()
    if not integration:
        return api_ok({"connected": False, "email": None, "connected_at": None})
    return api_ok({
        "connected": True,
        "email": integration.google_email,
        "connected_at": integration.connected_at.isoformat(),
    })


@integrations_bp.route("/integrations/google/disconnect", methods=["DELETE"])
@jwt_required()
def google_disconnect():
    user_id = get_jwt_identity()
    integration = GoogleIntegration.query.filter_by(user_id=int(user_id)).first()
    if integration:
        db.session.delete(integration)
        db.session.commit()
    return api_ok(None, "Google account disconnected")


# ─── Gmail Sender Whitelist ───────────────────────────────────────────────────────

@integrations_bp.route("/integrations/gmail/senders", methods=["GET"])
@jwt_required()
def list_senders():
    user_id = get_jwt_identity()
    senders = GmailSenderWhitelist.query.filter_by(user_id=int(user_id)).all()
    return api_ok([{"email": s.sender_email, "added_at": s.added_at.isoformat()} for s in senders])


@integrations_bp.route("/integrations/gmail/senders", methods=["POST"])
@jwt_required()
def add_sender():
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    if not email or "@" not in email:
        return api_err("Valid email is required")

    existing = GmailSenderWhitelist.query.filter_by(user_id=int(user_id), sender_email=email).first()
    if existing:
        return api_err("Sender already in whitelist", 409)

    entry = GmailSenderWhitelist(user_id=int(user_id), sender_email=email)
    db.session.add(entry)
    db.session.commit()
    return api_ok({"email": entry.sender_email, "added_at": entry.added_at.isoformat()}, "Sender added", 201)


@integrations_bp.route("/integrations/gmail/senders/<path:sender_email>", methods=["DELETE"])
@jwt_required()
def remove_sender(sender_email):
    user_id = get_jwt_identity()
    entry = GmailSenderWhitelist.query.filter_by(
        user_id=int(user_id), sender_email=sender_email.lower()
    ).first()
    if not entry:
        return api_err("Sender not found", 404)
    db.session.delete(entry)
    db.session.commit()
    return api_ok(None, "Sender removed")


# ─── Gmail Sync – helpers ─────────────────────────────────────────────────────────

def _extract_email_body(payload: dict, max_chars: int = 3000) -> str:
    """Recursively extract plain-text body from a Gmail message payload."""
    mime_type = payload.get("mimeType", "")
    if mime_type == "text/plain":
        data = payload.get("body", {}).get("data", "")
        if data:
            import base64 as _b64
            try:
                return _b64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")[:max_chars]
            except Exception:
                return ""
    for part in payload.get("parts", []):
        body = _extract_email_body(part, max_chars)
        if body:
            return body
    return ""


# General-purpose email task extraction prompt (not job-specific)
_GMAIL_SYSTEM_PROMPT = """\
You are a personal assistant that reads emails and extracts actionable tasks.

Extract tasks from any email that requires the recipient to take an action. This includes:
- Meeting invitations or schedule confirmations requiring acceptance or preparation
- Deadlines or deliverables ("submit by", "respond by", "complete by", "due", "before")
- Follow-up actions from email threads
- Bills, payments, or financial actions needed
- Appointments or bookings to confirm or arrange
- Any direct request requiring a response or action
- Reminders about upcoming events needing preparation

Priority rules:
- High: urgent response needed, deadline within 2 days, meeting in 24-48 hours, payment overdue
- Medium: deadline within a week, meeting next week, action needed but not immediately urgent
- Low: soft deadlines, optional actions, low-stakes follow-ups

Category must be one of: "Work|Personal|Shopping|Health|Finance|Education|Other"
Choose the most fitting category based on the email content.

Respond ONLY with valid JSON in this exact schema (no markdown, no explanation):
{
  "should_create_task": true/false,
  "title": "concise action title (max 100 chars)",
  "description": "what needs to be done and any key details (max 300 chars)",
  "priority": "Low|Medium|High",
  "due_date": "YYYY-MM-DD or null",
  "category": "Work|Personal|Shopping|Health|Finance|Education|Other"
}

Set should_create_task to false only for: newsletters, promotions, receipts with no required action, automated notifications, or pure FYI emails."""


def _do_gmail_sync(app, user_id: int, integration_id: int, sender_emails: list, groq_key: str):
    """Background thread: syncs Gmail and updates _sync_status when done."""
    with _sync_lock:
        _sync_status[user_id]["status"] = "running"

    try:
        with app.app_context():
            from googleapiclient.discovery import build as gbuild
            from groq import Groq

            integration = db.session.get(GoogleIntegration, integration_id)
            if not integration:
                raise RuntimeError("Integration record not found")

            creds = get_google_credentials(integration)
            service = gbuild("gmail", "v1", credentials=creds)

            sender_query = " OR ".join(f"from:{e}" for e in sender_emails)
            results = service.users().messages().list(
                userId="me", q=f"({sender_query}) newer_than:30d", maxResults=30
            ).execute()
            messages = results.get("messages", [])

            created_count = 0
            skipped_count = 0
            created_tasks = []
            groq_client = Groq(api_key=groq_key)

            for msg_ref in messages:
                msg_id = msg_ref["id"]

                if Task.query.filter_by(user_id=user_id, source_email_id=msg_id).first():
                    skipped_count += 1
                    continue

                msg = service.users().messages().get(
                    userId="me", id=msg_id, format="full"
                ).execute()

                payload = msg.get("payload", {})
                headers = {h["name"]: h["value"] for h in payload.get("headers", [])}
                subject = headers.get("Subject", "(no subject)")
                sender = headers.get("From", "")
                date_header = headers.get("Date", "")
                body_text = _extract_email_body(payload) or msg.get("snippet", "")

                try:
                    user_content = (
                        f"Subject: {subject[:300]}\n"
                        f"From: {sender[:150]}\n"
                        f"Date: {date_header[:100]}\n\n"
                        f"Email body:\n{body_text[:2500]}"
                    )
                    chat = groq_client.chat.completions.create(
                        model="llama3-8b-8192",
                        messages=[
                            {"role": "system", "content": _GMAIL_SYSTEM_PROMPT},
                            {"role": "user", "content": user_content},
                        ],
                        temperature=0.1,
                        max_tokens=300,
                    )
                    raw = chat.choices[0].message.content.strip()
                    start = raw.find("{")
                    end = raw.rfind("}") + 1
                    parsed = json.loads(raw[start:end])
                except Exception:
                    skipped_count += 1
                    continue

                if not parsed.get("should_create_task"):
                    skipped_count += 1
                    continue

                due_date = None
                if parsed.get("due_date"):
                    try:
                        due_date = datetime.strptime(parsed["due_date"], "%Y-%m-%d")
                    except ValueError:
                        pass

                task = Task(
                    title=parsed.get("title", subject)[:200],
                    description=parsed.get("description", body_text[:300])[:500],
                    priority=parsed.get("priority", "Medium"),
                    category=parsed.get("category", "Work"),
                    due_date=due_date,
                    source_email_id=msg_id,
                    user_id=user_id,
                )
                db.session.add(task)
                db.session.flush()
                created_tasks.append({"id": str(task.id), "title": task.title})
                created_count += 1

            db.session.commit()
            result = {"created": created_count, "skipped": skipped_count, "tasks": created_tasks}
            with _sync_lock:
                _sync_status[user_id] = {
                    "status": "done",
                    "result": result,
                    "error": None,
                    "started_at": _sync_status[user_id].get("started_at"),
                }

    except Exception as exc:
        with _sync_lock:
            _sync_status[user_id] = {
                "status": "error",
                "result": None,
                "error": str(exc),
                "started_at": _sync_status.get(user_id, {}).get("started_at"),
            }


# ─── Gmail Sync Routes ────────────────────────────────────────────────────────────

@integrations_bp.route("/integrations/gmail/sync", methods=["POST"])
@jwt_required()
def gmail_sync():
    user_id = int(get_jwt_identity())

    integration = GoogleIntegration.query.filter_by(user_id=user_id).first()
    if not integration:
        return api_err("Google account not connected", 403)

    senders = GmailSenderWhitelist.query.filter_by(user_id=user_id).all()
    if not senders:
        return api_err("No senders in whitelist. Add senders first.", 400)

    if not GROQ_API_KEY:
        return api_err("GROQ_API_KEY not configured in .env", 503)

    # Prevent concurrent syncs for the same user
    with _sync_lock:
        if _sync_status.get(user_id, {}).get("status") == "running":
            return api_ok({"status": "running"}, "Sync already in progress", 202)
        _sync_status[user_id] = {
            "status": "running",
            "result": None,
            "error": None,
            "started_at": datetime.now().isoformat(),
        }

    sender_emails = [s.sender_email for s in senders]
    app_ref = current_app._get_current_object()

    thread = threading.Thread(
        target=_do_gmail_sync,
        args=(app_ref, user_id, integration.id, sender_emails, GROQ_API_KEY),
        daemon=True,
    )
    thread.start()

    return api_ok({"status": "started"}, "Gmail sync started in background", 202)


@integrations_bp.route("/integrations/gmail/sync/status", methods=["GET"])
@jwt_required()
def gmail_sync_status():
    """Poll this endpoint after starting a sync to get progress/results."""
    user_id = int(get_jwt_identity())
    with _sync_lock:
        status = _sync_status.get(user_id)
    if not status:
        return api_ok({"status": "idle"})
    return api_ok(status)


# ─── Google Calendar ──────────────────────────────────────────────────────────────

@integrations_bp.route("/integrations/calendar/sync", methods=["POST"])
@jwt_required()
def calendar_sync():
    user_id = get_jwt_identity()
    integration = GoogleIntegration.query.filter_by(user_id=int(user_id)).first()
    if not integration:
        return api_err("Google account not connected", 403)

    try:
        from googleapiclient.discovery import build as gbuild
        creds = get_google_credentials(integration)
        service = gbuild("calendar", "v3", credentials=creds)

        tasks = Task.query.filter(
            Task.user_id == int(user_id),
            Task.completed == False,
            Task.due_date != None,
        ).all()

        synced = 0
        for task in tasks:
            due = task.due_date
            color_id = "11" if task.priority == "High" else "5" if task.priority == "Medium" else "2"
            event_body = {
                "summary": task.title,
                "description": task.description or "",
                "start": {"date": due.strftime("%Y-%m-%d")},
                "end": {"date": due.strftime("%Y-%m-%d")},
                "colorId": color_id,
            }

            if task.calendar_event_id:
                try:
                    service.events().update(
                        calendarId="primary",
                        eventId=task.calendar_event_id,
                        body=event_body,
                    ).execute()
                    synced += 1
                    continue
                except Exception:
                    task.calendar_event_id = None

            created = service.events().insert(calendarId="primary", body=event_body).execute()
            task.calendar_event_id = created.get("id")
            synced += 1

        db.session.commit()
        return api_ok({"synced": synced})

    except Exception:
        current_app.logger.exception("Calendar sync failed")
        return api_err("Calendar sync failed. Please try again later.", 500)


@integrations_bp.route("/tasks/<int:task_id>/calendar", methods=["POST"])
@jwt_required()
def push_task_to_calendar(task_id):
    """Push (or update) a single task as a Google Calendar all-day event."""
    user_id = get_jwt_identity()

    task = Task.query.filter_by(id=task_id, user_id=int(user_id)).first()
    if not task:
        return api_err("Task not found", 404)
    if not task.due_date:
        return api_err("Task has no due date — set a due date before adding to calendar", 400)

    integration = GoogleIntegration.query.filter_by(user_id=int(user_id)).first()
    if not integration:
        return api_err("Google account not connected", 403)

    try:
        from googleapiclient.discovery import build as gbuild
        creds = get_google_credentials(integration)
        service = gbuild("calendar", "v3", credentials=creds)

        due = task.due_date
        color_id = "11" if task.priority == "High" else "5" if task.priority == "Medium" else "2"
        event_body = {
            "summary": task.title,
            "description": task.description or "",
            "start": {"date": due.strftime("%Y-%m-%d")},
            "end": {"date": due.strftime("%Y-%m-%d")},
            "colorId": color_id,
        }

        if task.calendar_event_id:
            try:
                service.events().update(
                    calendarId="primary",
                    eventId=task.calendar_event_id,
                    body=event_body,
                ).execute()
                return api_ok({"event_id": task.calendar_event_id}, "Calendar event updated")
            except Exception:
                task.calendar_event_id = None

        created = service.events().insert(calendarId="primary", body=event_body).execute()
        task.calendar_event_id = created.get("id")
        db.session.commit()
        return api_ok({"event_id": task.calendar_event_id}, "Added to Google Calendar")

    except Exception:
        current_app.logger.exception("Single-task calendar push failed")
        return api_err("Failed to add task to calendar. Please try again.", 500)


# ─── Weekly Digest Settings ───────────────────────────────────────────────────────

@integrations_bp.route("/digest/settings", methods=["GET"])
@jwt_required()
def get_digest_settings():
    user_id = int(get_jwt_identity())
    settings = DigestSettings.query.filter_by(user_id=user_id).first()
    user = db.session.get(User, user_id)
    if not settings:
        return api_ok({
            "enabled": False,
            "digest_email": user.email if user else None,
            "last_sent": None,
        })
    return api_ok({
        "enabled": settings.enabled,
        "digest_email": settings.digest_email or (user.email if user else None),
        "last_sent": settings.last_sent.isoformat() if settings.last_sent else None,
    })


@integrations_bp.route("/digest/settings", methods=["PUT", "PATCH"])
@jwt_required()
def update_digest_settings():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    settings = DigestSettings.query.filter_by(user_id=user_id).first()
    if not settings:
        settings = DigestSettings(user_id=user_id)
        db.session.add(settings)

    if "enabled" in data:
        settings.enabled = bool(data["enabled"])
    if "digest_email" in data:
        settings.digest_email = data["digest_email"].strip() if data["digest_email"] else None

    db.session.commit()
    user = db.session.get(User, user_id)
    return api_ok({
        "enabled": settings.enabled,
        "digest_email": settings.digest_email or (user.email if user else None),
        "last_sent": settings.last_sent.isoformat() if settings.last_sent else None,
    }, "Digest settings updated")


@integrations_bp.route("/digest/send", methods=["POST"])
@jwt_required()
def send_digest_now():
    """Manually trigger a digest email (useful for testing the feature)."""
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return api_err("User not found", 404)

    from digest import SMTP_USER, send_digest_in_context
    if not SMTP_USER:
        return api_err("SMTP not configured. Add SMTP_USER and SMTP_PASSWORD to .env", 503)

    settings = DigestSettings.query.filter_by(user_id=user_id).first()
    to_email = (settings.digest_email if settings else None) or user.email

    success = send_digest_in_context(user_id, to_email)
    if success:
        return api_ok({"sent_to": to_email}, "Digest sent successfully")
    return api_err("Failed to send digest. Check SMTP configuration in .env", 500)
