from flask import Blueprint, request
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db, limiter
from models import User
from helpers import api_ok, api_err, serialize_user

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
@limiter.limit("10 per minute")
def register():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        return api_err("Name, email, and password are required")

    if User.query.filter_by(email=email).first():
        return api_err("Email already registered", 400)

    hashed = generate_password_hash(password)
    user = User(name=name, email=email, password=hashed)
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return api_ok({"token": token, "user": serialize_user(user)}, "Registered successfully", 201)


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("5 per minute")
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return api_err("Email and password are required")

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password, password):
        return api_err("Invalid email or password", 401)

    token = create_access_token(identity=str(user.id))
    return api_ok({"token": token, "user": serialize_user(user)})


@auth_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id))
    if not user:
        return api_err("User not found", 404)
    return api_ok(serialize_user(user))


@auth_bp.route("/profile", methods=["PUT", "PATCH"])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id))
    if not user:
        return api_err("User not found", 404)

    data = request.get_json() or {}
    if "name" in data and data["name"].strip():
        user.name = data["name"].strip()
    if "email" in data and data["email"].strip():
        new_email = data["email"].strip().lower()
        existing = User.query.filter_by(email=new_email).first()
        if existing and existing.id != user.id:
            return api_err("Email already in use", 400)
        user.email = new_email

    db.session.commit()
    return api_ok(serialize_user(user))


@auth_bp.route("/auth/change-password", methods=["POST"])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id))
    if not user:
        return api_err("User not found", 404)

    data = request.get_json() or {}
    current = data.get("current_password", "")
    new_pw = data.get("new_password", "")

    if not current or not new_pw:
        return api_err("current_password and new_password are required")

    if not check_password_hash(user.password, current):
        return api_err("Current password is incorrect", 401)

    if len(new_pw) < 8:
        return api_err("New password must be at least 8 characters")

    user.password = generate_password_hash(new_pw)
    db.session.commit()
    return api_ok(None, "Password updated successfully")
