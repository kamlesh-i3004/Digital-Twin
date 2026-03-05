import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

from extensions import db, jwt, limiter


def create_app() -> Flask:
    app = Flask(__name__)

    # ── Configuration ─────────────────────────────────────────────────────────
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
        "DATABASE_URL", "mysql+pymysql://root:@localhost/alkapro"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    jwt_secret = os.environ.get("JWT_SECRET_KEY")
    if not jwt_secret:
        raise RuntimeError("JWT_SECRET_KEY must be set in .env")
    app.config["JWT_SECRET_KEY"] = jwt_secret

    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    origins = [url.strip() for url in frontend_url.split(",")]
    CORS(app, origins=origins, supports_credentials=True)

    # ── Extensions ────────────────────────────────────────────────────────────
    db.init_app(app)
    jwt.init_app(app)
    limiter.init_app(app)

    # ── Blueprints ────────────────────────────────────────────────────────────
    from routes.auth import auth_bp
    from routes.tasks import tasks_bp
    from routes.notes import notes_bp
    from routes.analytics import analytics_bp
    from routes.assistant import assistant_bp
    from routes.integrations import integrations_bp

    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(tasks_bp, url_prefix="/api")
    app.register_blueprint(notes_bp, url_prefix="/api")
    app.register_blueprint(analytics_bp, url_prefix="/api")
    app.register_blueprint(assistant_bp, url_prefix="/api")
    app.register_blueprint(integrations_bp, url_prefix="/api")

    # ── Health Check ──────────────────────────────────────────────────────────
    @app.route("/api/health", methods=["GET"])
    def health():
        from helpers import api_ok
        return api_ok({"status": "ok"})

    # ── Create DB Tables ──────────────────────────────────────────────────────
    with app.app_context():
        # Import models so SQLAlchemy knows about them before create_all()
        import models  # noqa: F401
        db.create_all()

    # ── Weekly Digest Scheduler ───────────────────────────────────────────────
    from digest import start_digest_scheduler
    start_digest_scheduler(app)

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
