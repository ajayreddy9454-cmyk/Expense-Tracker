import logging
import os

from flask import current_app, g, request
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from models.user import User
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from database import db

logger = logging.getLogger(__name__)


def delete_upload(upload_dir, filename):
    """Safely delete an uploaded file from disk.

    Never raises: a missing or unreadable file (e.g. after a Render redeploy
    wiped the ephemeral filesystem) must not break the API request.
    """
    if not filename:
        return
    try:
        path = os.path.join(upload_dir, os.path.basename(filename))
        if os.path.exists(path):
            os.remove(path)
    except OSError:
        logger.warning("Could not delete upload file: %s", filename)


# ==========================
# Default Categories
# ==========================
DEFAULT_CATEGORIES = [
    {"name": "Food", "icon": "🍔"},
    {"name": "Travel", "icon": "🚗"},
    {"name": "Shopping", "icon": "🛍️"},
    {"name": "Health", "icon": "❤️"},
    {"name": "Education", "icon": "🎓"},
    {"name": "Entertainment", "icon": "🎬"},
    {"name": "Bills", "icon": "💡"},
    {"name": "Transport", "icon": "🚌"},
    {"name": "Others", "icon": "📦"},
]


def ensure_default_categories(user_id):
    """Insert default categories for a user if they don't already exist.

    Only inserts categories that are missing for this user.
    Existing custom or default categories are never duplicated.
    Gracefully handles any duplicate key errors.
    """
    existing_names = set(
        row[0]
        for row in db.session.execute(
            text("SELECT name FROM categories WHERE user_id = :uid"),
            {"uid": user_id},
        ).fetchall()
    )

    for cat in DEFAULT_CATEGORIES:
        if cat["name"] not in existing_names:
            try:
                db.session.execute(
                    text(
                        "INSERT INTO categories (user_id, name, icon) "
                        "VALUES (:uid, :name, :icon)"
                    ),
                    {"uid": user_id, "name": cat["name"], "icon": cat["icon"]},
                )
                db.session.commit()
            except IntegrityError:
                db.session.rollback()
                # Category already exists (race condition), skip


def get_serializer():
    """Create a serializer using the app's SECRET_KEY."""
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="auth-token")


def generate_token(user_id):
    """Generate a signed token for the given user_id.

    Token expires after 7 days (604800 seconds).
    """
    s = get_serializer()
    return s.dumps(str(user_id))


def get_current_user():
    """Extract the authenticated user from the Authorization header.

    The resolved user is cached on Flask's per-request ``g`` object so every
    route in the same request reuses the same User instance instead of
    issuing a new ``SELECT`` per call. This cuts a redundant database lookup
    whenever a single request touches multiple helpers/routes.

    Expects: Authorization: Bearer <token>

    Returns:
        User object if token is valid, None otherwise.
    """
    if g.get("_current_user") is not None:
        return g._current_user

    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        g._current_user = None
        return None

    token = auth_header[7:]  # Strip "Bearer " prefix

    if not token:
        g._current_user = None
        return None

    s = get_serializer()
    try:
        user_id_str = s.loads(token, max_age=604800)  # 7 days expiry
        user_id = int(user_id_str)
    except (BadSignature, SignatureExpired, ValueError, TypeError):
        g._current_user = None
        return None

    try:
        user = User.query.get(user_id)
        g._current_user = user
        return user
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception("Failed to load user %s from the database", user_id)
        g._current_user = None
        return None
