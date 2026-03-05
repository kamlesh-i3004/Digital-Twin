from datetime import datetime, timezone
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import Note
from helpers import api_ok, api_err, serialize_note

notes_bp = Blueprint("notes", __name__)


@notes_bp.route("/notes", methods=["POST"])
@jwt_required()
def create_note():
    data = request.get_json() or {}
    if not data.get("content"):
        return api_err("Content is required")
    user_id = get_jwt_identity()
    note = Note(title=data.get("title", ""), content=data["content"], user_id=user_id)
    db.session.add(note)
    db.session.commit()
    return api_ok(serialize_note(note), "Note saved", 201)


@notes_bp.route("/notes", methods=["GET"])
@jwt_required()
def list_notes():
    user_id = get_jwt_identity()
    notes = Note.query.filter_by(user_id=user_id).order_by(Note.updated_at.desc()).all()
    return api_ok([serialize_note(n) for n in notes])


@notes_bp.route("/notes/<int:note_id>", methods=["GET"])
@jwt_required()
def get_note(note_id):
    user_id = get_jwt_identity()
    note = Note.query.filter_by(id=note_id, user_id=user_id).first()
    if not note:
        return api_err("Note not found", 404)
    return api_ok(serialize_note(note))


@notes_bp.route("/notes/<int:note_id>", methods=["PUT", "PATCH"])
@jwt_required()
def update_note(note_id):
    user_id = get_jwt_identity()
    note = Note.query.filter_by(id=note_id, user_id=user_id).first()
    if not note:
        return api_err("Note not found", 404)
    data = request.get_json() or {}
    if "title" in data:
        note.title = data["title"]
    if "content" in data:
        note.content = data["content"]
    note.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.session.commit()
    return api_ok(serialize_note(note))


@notes_bp.route("/notes/<int:note_id>", methods=["DELETE"])
@jwt_required()
def delete_note(note_id):
    user_id = get_jwt_identity()
    note = Note.query.filter_by(id=note_id, user_id=user_id).first()
    if not note:
        return api_err("Note not found", 404)
    db.session.delete(note)
    db.session.commit()
    return api_ok(None, "Note deleted")
