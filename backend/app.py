import logging
import os

from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from config import Config
from database import db

# Import all models so db.create_all() picks them up
from models.user import User
from models.expense import Expense
from models.category import Category
from models.budget import Budget
from models.setting import UserSetting

# Blueprints
from routes.auth import auth_bp
from routes.expenses import expenses_bp
from routes.dashboard import dashboard_bp
from routes.categories import categories_bp
from routes.reports import reports_bp
from routes.budget import budget_bp
from routes.profile import profile_bp
from routes.settings import settings_bp

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config.from_object(Config)

CORS(
    app,
    supports_credentials=True,
    expose_headers=["Authorization"],
    allow_headers=["Authorization", "Content-Type"],
)

db.init_app(app)

app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(expenses_bp, url_prefix="/api/expenses")
app.register_blueprint(dashboard_bp)
app.register_blueprint(categories_bp, url_prefix="/api/categories")
app.register_blueprint(reports_bp, url_prefix="/api/reports")
app.register_blueprint(budget_bp, url_prefix="/api/budgets")
app.register_blueprint(profile_bp, url_prefix="/api/profile")
app.register_blueprint(settings_bp, url_prefix="/api/settings")


@app.route("/")
def home():
    return jsonify({"message": "Expense Tracker Backend Running"})


@app.route("/healthz")
def healthz():
    """Lightweight health check for Render.

    Always returns 200 while the process is alive. If the database is
    temporarily unreachable (cold start, DNS blip, Aiven maintenance) the
    instance must NOT be killed/restarted by Render — the app stays up and
    recovers on the next request. DB status is reported in the payload.
    """
    db_ok = True
    db_error = None
    try:
        with app.app_context():
            db.engine.connect().close()
    except Exception as exc:  # noqa: BLE001
        db_ok = False
        db_error = str(exc)

    payload = {"status": "ok" if db_ok else "degraded"}
    if not db_ok:
        payload["database"] = f"unavailable: {db_error}"
    return jsonify(payload), 200


@app.route("/test-db")
def test_db():
    try:
        with app.app_context():
            db.engine.connect()
        return jsonify({"status": "success", "message": "Database Connected Successfully"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.errorhandler(HTTPException)
def handle_http_exception(exc):
    """Return HTTP errors as JSON instead of HTML pages."""
    response = jsonify({
        "message": exc.description,
        "error": exc.name,
    })
    response.status_code = exc.code
    return response


@app.errorhandler(404)
def not_found(exc):
    return jsonify({"message": "Endpoint not found", "error": "Not Found"}), 404


@app.errorhandler(500)
def internal_error(exc):
    """Return a clean JSON 500 instead of the default HTML error page.

    This is especially important when the database is unreachable: the
    frontend can parse the JSON and show a friendly toast rather than an
    opaque HTML "Internal Server Error" page.
    """
    try:
        db.session.rollback()
    except Exception:
        pass
    logger.error("Unhandled exception: %s", exc)
    return jsonify({"message": "Internal server error. Please try again."}), 500


# Auto-create database tables on startup.
#
# This must NEVER crash the boot: if the database is temporarily unreachable
# (cold start, DNS blip, Aiven maintenance) gunicorn must still bind so Render
# marks the instance as started and the connection can recover on the next
# request. This is what turns Render's "Exited with status 1" crash-loop into
# a resilient production deployment.
with app.app_context():
    try:
        db.create_all()
        logger.info("Database tables are present and verified.")
    except Exception as exc:  # noqa: BLE001
        logger.error("Startup table check failed: %s", exc)
        logger.exception("Detailed startup database traceback:")


if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "0") == "1"
    port = int(os.getenv("PORT", "5000"))
    # Production uses gunicorn; this block is only for local development.
    app.run(host="0.0.0.0", port=port, debug=debug)

