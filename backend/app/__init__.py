import os
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from dotenv import load_dotenv
from werkzeug.middleware.proxy_fix import ProxyFix

from .models import db
from .routes.auth import auth_bp
from .routes.calendar import calendar_bp
from .routes.clients import clients_bp
from .routes.meetings import meetings_bp
from .routes.notes import notes_bp
from .routes.voice import voice_bp
from .routes.ai import ai_bp

load_dotenv()


def create_app(config_name=None):
    app = Flask(__name__)
    # Derrière nginx (reverse proxy), faire confiance à X-Forwarded-Proto/Host
    app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

    # ── Configuration ──────────────────────────────────────────────────────────
    app.config["SECRET_KEY"] = os.environ["FLASK_SECRET_KEY"]
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SECURE"] = os.getenv("FLASK_ENV") == "production"
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ["DATABASE_URL"]
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"] = os.environ["JWT_SECRET_KEY"]
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", 3600))
    app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_CONTENT_LENGTH", 52428800))
    app.config["UPLOAD_FOLDER"] = os.getenv("UPLOAD_FOLDER", "./uploads/audio")

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Google expands short scope aliases to full URIs; relax oauthlib's strict check.
    os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

    if os.getenv("FLASK_ENV") == "development":
        os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

    # ── Extensions ─────────────────────────────────────────────────────────────
    db.init_app(app)
    Migrate(app, db)
    JWTManager(app)
    CORS(app, origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
         supports_credentials=True)

    # ── Blueprints ─────────────────────────────────────────────────────────────
    app.register_blueprint(auth_bp,     url_prefix="/auth")
    app.register_blueprint(calendar_bp, url_prefix="/calendar")
    app.register_blueprint(clients_bp,  url_prefix="/clients")
    app.register_blueprint(meetings_bp, url_prefix="/meetings")
    app.register_blueprint(notes_bp,    url_prefix="/notes")
    app.register_blueprint(voice_bp,    url_prefix="/voice")
    app.register_blueprint(ai_bp,       url_prefix="/ai")

    # ── Health check ───────────────────────────────────────────────────────────
    @app.get("/health")
    def health():
        return {"status": "ok", "version": "1.0.0"}

    return app
