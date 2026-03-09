from datetime import datetime, timezone
from extensions import db


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(200), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=_utcnow)


class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.String(500), default="")
    priority = db.Column(db.String(20), nullable=False, default="Medium")
    category = db.Column(db.String(50), default="General")
    due_date = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=_utcnow)
    completed = db.Column(db.Boolean, default=False)
    completed_at = db.Column(db.DateTime, nullable=True)
    source_email_id = db.Column(db.String(200), nullable=True)   # Gmail dedup
    calendar_event_id = db.Column(db.String(200), nullable=True)  # Calendar dedup
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

    __table_args__ = (
        db.Index("idx_task_user_completed", "user_id", "completed"),
        db.Index("idx_task_user_due_date", "user_id", "due_date"),
        db.Index("idx_task_user_created", "user_id", "created_at"),
        db.Index("idx_task_source_email", "user_id", "source_email_id"),
    )


class Note(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), default="")
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=_utcnow)
    updated_at = db.Column(db.DateTime, default=_utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)


class GoogleIntegration(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), unique=True, nullable=False)
    access_token = db.Column(db.Text, nullable=False)
    refresh_token = db.Column(db.Text, nullable=True)
    token_expiry = db.Column(db.DateTime, nullable=True)
    google_email = db.Column(db.String(200), nullable=True)
    connected_at = db.Column(db.DateTime, default=_utcnow)


class GmailSenderWhitelist(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    sender_email = db.Column(db.String(200), nullable=False)
    added_at = db.Column(db.DateTime, default=_utcnow)
    __table_args__ = (db.UniqueConstraint("user_id", "sender_email"),)


class DigestSettings(db.Model):
    """Per-user weekly email digest configuration."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), unique=True, nullable=False)
    enabled = db.Column(db.Boolean, default=False)
    digest_email = db.Column(db.String(200), nullable=True)  # None = use account email
    last_sent = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=_utcnow)
