import os
import json
import base64
import hmac as _hmac
import hashlib as _hashlib
import threading
import string
import random
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, redirect, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db, limiter
from models import Task, GoogleIntegration, GmailSenderWhitelist, DigestSettings, User
from helpers import api_ok, api_err, serialize_task, get_google_credentials

integrations_bp = Blueprint("integrations", __name__)

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:5000/api/integrations/google/callback")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173").split(",")[0].strip()
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

def _make_oauth_state(user_id: str, secret: str, code_verifier: str = "") -> str:
    nonce = base64.urlsafe_b64encode(os.urandom(16)).decode()
    payload = json.dumps({"user_id": user_id, "nonce": nonce, "cv": code_verifier})
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


def _build_flow(code_verifier=None):
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
    kwargs = {"code_verifier": code_verifier} if code_verifier else {}
    flow = Flow.from_client_config(client_config, scopes=GOOGLE_SCOPES, **kwargs)
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
    chars = string.ascii_letters + string.digits + "-._~"
    code_verifier = "".join(random.SystemRandom().choice(chars) for _ in range(128))
    flow = _build_flow(code_verifier=code_verifier)
    state = _make_oauth_state(user_id, secret, code_verifier)
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
        code_verifier = state_data.get("cv") or None
    except ValueError:
        return redirect(f"{FRONTEND_URL}/settings?error=invalid_state")

    try:
        flow = _build_flow(code_verifier=code_verifier)
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
    import re as _re
    email = data.get("email", "").strip().lower()
    if not email or not _re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
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


def _parse_groq_json(raw_text: str) -> dict | None:
    """Try to robustly extract JSON from model output."""
    import ast
    import re

    cleaned = re.sub(r"```(?:json)?", "", raw_text).strip()
    cleaned = cleaned.replace("```", "").strip()

    # Take the outermost JSON object if present
    first = cleaned.find("{")
    last = cleaned.rfind("}")
    candidate = cleaned
    if first != -1 and last != -1 and first < last:
        candidate = cleaned[first : last + 1]

    # First try strict JSON
    try:
        return json.loads(candidate)
    except Exception:
        pass

    # Try a lenient JSON-ish parsing
    try:
        return json.loads(candidate.replace("'", '"'))
    except Exception:
        pass

    # Try Python literal eval as a last resort
    try:
        return ast.literal_eval(candidate)
    except Exception:
        current_app.logger.debug("GROQ JSON parse failed. raw=%s", raw_text)
        current_app.logger.debug("GROQ JSON candidate=%s", candidate)
        return None


# General-purpose email task extraction prompt
_GMAIL_SYSTEM_PROMPT = """\
You are a personal assistant that reads emails and extracts actionable tasks.

Extract a task from ANY email that the recipient should act on, track, or be aware of. Be INCLUSIVE — when in doubt, create a task. This covers:

JOB & CAREER:
- Job match notifications (save/apply to interesting jobs)
- Application status updates (interview invite, rejection, offer, shortlisted)
- HR replies and recruiter messages (respond, schedule interview)
- Online assessments or coding tests scheduled or due
- Offer letters or contract documents to review/sign

SUBSCRIPTIONS & SERVICES:
- Subscription renewal or expiry notices (renew, cancel, review)
- Auto-pay or auto-renewal upcoming (verify payment method, cancel if unwanted)
- Trial ending (decide to keep or cancel)
- Account suspension or deactivation warning

GOVERNMENT & OFFICIAL:
- Tax notices, ITR filing reminders, refund status
- License renewal (driving license, professional license)
- ID or document expiry (passport, Aadhaar, PAN, voter ID)
- Visa or permit expiry or application update
- Court, legal, or regulatory notices
- Utility bill due (electricity, water, gas)

FINANCE:
- Payment due, invoice, overdue notice
- Credit card statement, EMI due
- Insurance premium due or policy expiry
- Refund or claim action needed
- Bank account action required

HEALTH & APPOINTMENTS:
- Doctor, dentist, or specialist appointment confirmation or reminder
- Lab test results with follow-up needed
- Medicine refill or prescription renewal reminder

MEETINGS & SCHEDULING:
- Meeting invitations (accept, decline, prepare)
- Rescheduling or cancellation requests
- Interview call or video call scheduled

GENERAL:
- Any deadline ("submit by", "respond by", "due", "before", "expires on")
- Direct requests requiring a response or action
- Document to review or sign

Priority rules:
- High: urgent, deadline within 2 days, payment overdue, interview within 48h, expiry imminent
- Medium: deadline within a week, action needed but not immediately urgent
- Low: soft deadlines, informational with optional action, track for later

Category must be one of: "Work|Jobs|Personal|Shopping|Health|Finance|Education|Government|Other"
- Jobs: anything about job search, applications, interviews, HR
- Government: tax, IDs, licenses, legal, government services
- Finance: bills, payments, banking, insurance
- Health: medical appointments, prescriptions, health reminders

Respond ONLY with valid JSON in this exact schema (no markdown, no explanation):
{
  "should_create_task": true/false,
  "title": "concise action title (max 100 chars)",
  "description": "what needs to be done and any key details (max 300 chars)",
  "priority": "Low|Medium|High",
  "due_date": "YYYY-MM-DD or null",
  "category": "Work|Jobs|Personal|Shopping|Health|Finance|Education|Government|Other"
}

Set should_create_task to false ONLY for: pure marketing/promotional blasts, social media digests, order shipping updates with zero action needed, newsletters with no deadlines, and spam."""


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
                userId="me", q=f"({sender_query}) newer_than:30d", maxResults=50
            ).execute()
            messages = results.get("messages", [])

            created_count = 0
            duplicates_count = 0
            ai_skipped_count = 0
            error_count = 0
            created_tasks = []
            parse_failures: list[dict] = []
            last_failure_raw: str | None = None
            last_failure_exc: str | None = None
            groq_client = Groq(api_key=groq_key)

            for msg_ref in messages:
                msg_id = msg_ref["id"]

                if Task.query.filter_by(user_id=user_id, source_email_id=msg_id).first():
                    duplicates_count += 1
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

                raw = None
                try:
                    user_content = (
                        f"Subject: {subject[:300]}\n"
                        f"From: {sender[:150]}\n"
                        f"Date: {date_header[:100]}\n\n"
                        f"Email body:\n{body_text[:2500]}"
                    )
                    chat = groq_client.chat.completions.create(
                        model="llama-3.1-8b-instant",
                        messages=[
                            {"role": "system", "content": _GMAIL_SYSTEM_PROMPT},
                            {"role": "user", "content": user_content},
                        ],
                        temperature=0.1,
                        max_tokens=500,
                        timeout=30,
                    )
                    raw = chat.choices[0].message.content.strip()

                    parsed = _parse_groq_json(raw)
                    if parsed is None:
                        # Treat parse failures as "not actionable" (AI didn't return valid task JSON)
                        ai_skipped_count += 1
                        last_failure_raw = raw

                        # Store a few examples of what failed to parse for debugging
                        if len(parse_failures) < 5:
                            import re

                            cleaned = re.sub(r"```(?:json)?", "", raw).strip()
                            cleaned = cleaned.replace("```", "").strip()
                            first = cleaned.find("{")
                            last = cleaned.rfind("}")
                            candidate = cleaned
                            if first != -1 and last != -1 and first < last:
                                candidate = cleaned[first : last + 1]

                            parse_failures.append({
                                "msg_id": msg_id,
                                "subject": subject,
                                "raw": raw,
                                "candidate": candidate,
                            })
                        continue
                except Exception as exc:
                    error_count += 1
                    last_failure_exc = str(exc)
                    if raw is not None:
                        last_failure_raw = raw
                    continue

                if not parsed.get("should_create_task"):
                    ai_skipped_count += 1
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

            try:
                db.session.commit()
            except Exception:
                db.session.rollback()
                raise
            result = {
                "created": created_count,
                "duplicates": duplicates_count,
                "ai_skipped": ai_skipped_count,
                "errors": error_count,
                "skipped": duplicates_count + ai_skipped_count + error_count,
                "tasks": created_tasks,
                "parse_failures": parse_failures,
                "last_failure_raw": last_failure_raw,
                "last_failure_exc": last_failure_exc,
            }
            if parse_failures:
                current_app.logger.warning(
                    "Gmail sync parse failures (showing up to %d): %s",
                    len(parse_failures),
                    json.dumps(parse_failures, default=str)[:4000],
                )

            with _sync_lock:
                _sync_status[user_id] = {
                    "status": "done",
                    "result": result,
                    "error": None,
                    "started_at": _sync_status[user_id].get("started_at"),
                }

    except Exception as exc:
        current_app.logger.exception("Gmail sync background thread failed")
        with _sync_lock:
            _sync_status[user_id] = {
                "status": "error",
                "result": None,
                "error": str(exc),
                "started_at": _sync_status.get(user_id, {}).get("started_at"),
            }


# ─── Gmail Sender Discovery ───────────────────────────────────────────────────────

@integrations_bp.route("/integrations/gmail/senders/discover", methods=["GET"])
@jwt_required()
def discover_gmail_senders():
    """Return unique senders from recent Gmail so the user can whitelist them."""
    import re
    user_id = get_jwt_identity()
    integration = GoogleIntegration.query.filter_by(user_id=int(user_id)).first()
    if not integration:
        return api_err("Google account not connected", 403)

    try:
        from googleapiclient.discovery import build as gbuild
        creds = get_google_credentials(integration)
        service = gbuild("gmail", "v1", credentials=creds)

        results = service.users().messages().list(
            userId="me", q="newer_than:30d", maxResults=50
        ).execute()
        messages = results.get("messages", [])

        seen: dict = {}
        for msg_ref in messages:
            msg = service.users().messages().get(
                userId="me", id=msg_ref["id"], format="metadata",
                metadataHeaders=["From"]
            ).execute()
            headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
            from_header = headers.get("From", "")
            match = re.search(r"<([^>]+)>", from_header)
            email_addr = match.group(1).strip().lower() if match else from_header.strip().lower()
            name = re.sub(r"\s*<[^>]+>", "", from_header).strip().strip('"') if match else email_addr
            if not email_addr or "@" not in email_addr:
                continue
            if email_addr in seen:
                seen[email_addr]["count"] += 1
            else:
                seen[email_addr] = {"email": email_addr, "name": name or email_addr, "count": 1}

        senders = sorted(seen.values(), key=lambda x: x["count"], reverse=True)
        return api_ok(senders)
    except Exception:
        current_app.logger.exception("discover_gmail_senders failed")
        return api_err("Failed to fetch Gmail senders. Please try again.", 500)


# ─── Gmail Sync Routes ────────────────────────────────────────────────────────────

@integrations_bp.route("/integrations/gmail/sync", methods=["POST"])
@limiter.limit("5 per hour")
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
