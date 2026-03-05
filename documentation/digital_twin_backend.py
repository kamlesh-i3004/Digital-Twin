from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (
    JWTManager, create_access_token,
    jwt_required, get_jwt_identity
)
from datetime import datetime
import os

# -----------------------------------
# App setup
# -----------------------------------
app = Flask(__name__)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, "digital_twin.db")

app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_PATH}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = "super-secret-key"

db = SQLAlchemy(app)
jwt = JWTManager(app)

# -----------------------------------
# Models
# -----------------------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    completed = db.Column(db.Boolean, default=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# -----------------------------------
# Create DB tables

# -----------------------------------
with app.app_context():
    db.create_all()

# -----------------------------------
# Health check
# -----------------------------------
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

# -----------------------------------
# Register
# -----------------------------------
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()

    if not data or not data.get("username") or not data.get("password"):
        return jsonify({"error": "Username and password required"}), 400

    if User.query.filter_by(username=data["username"]).first():
        return jsonify({"error": "User already exists"}), 400

    user = User(
        username=data["username"],
        password=data["password"]
    )

    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "User registered successfully"})

# -----------------------------------
# Login
# -----------------------------------
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()

    user = User.query.filter_by(
        username=data.get("username"),
        password=data.get("password")
    ).first()

    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    # ✅ JWT identity MUST be string
    token = create_access_token(identity=str(user.id))
    return jsonify({"access_token": token})

# -----------------------------------
# Create task
# -----------------------------------
@app.route("/api/tasks", methods=["POST"])
@jwt_required()
def create_task():
    user_id = int(get_jwt_identity())  # ✅ FIX
    data = request.get_json()

    if not data or not data.get("title"):
        return jsonify({"error": "Task title required"}), 400

    task = Task(
        title=data["title"],
        user_id=user_id
    )

    db.session.add(task)
    db.session.commit()

    return jsonify({"message": "Task created"})

# -----------------------------------
# Get tasks
# -----------------------------------
@app.route("/api/tasks", methods=["GET"])
@jwt_required()
def get_tasks():
    user_id = int(get_jwt_identity())  # ✅ FIX
    tasks = Task.query.filter_by(user_id=user_id).all()

    result = []
    for t in tasks:
        result.append({
            "id": t.id,
            "title": t.title,
            "completed": t.completed,
            "created_at": t.created_at.isoformat()
        })

    return jsonify(result)

# -----------------------------------
# Toggle task
# -----------------------------------
@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
@jwt_required()
def toggle_task(task_id):
    user_id = int(get_jwt_identity())  # ✅ FIX
    task = Task.query.filter_by(id=task_id, user_id=user_id).first()

    if not task:
        return jsonify({"error": "Task not found"}), 404

    task.completed = not task.completed
    db.session.commit()

    return jsonify({"message": "Task updated"})

# -----------------------------------
# Delete task
# -----------------------------------
@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
@jwt_required()
def delete_task(task_id):
    user_id = int(get_jwt_identity())  # ✅ FIX
    task = Task.query.filter_by(id=task_id, user_id=user_id).first()

    if not task:
        return jsonify({"error": "Task not found"}), 404

    db.session.delete(task)
    db.session.commit()

    return jsonify({"message": "Task deleted"})

# -----------------------------------
# Run server
# -----------------------------------
if __name__ == "__main__":
    app.run(debug=True)
