from flask import request
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from models.user import User
from flask import current_app
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from database import db

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
        row[0] for row in db.session.execute(
            text("SELECT name FROM categories WHERE user_id = :uid"),
            {"uid": user_id}
        ).fetchall()
    )

    for cat in DEFAULT_CATEGORIES:
        if cat["name"] not in existing_names:
            try:
                db.session.execute(
                    text("INSERT INTO categories (user_id, name, icon) VALUES (:uid, :name, :icon)"),
                    {"uid": user_id, "name": cat["name"], "icon": cat["icon"]}
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

    Expects: Authorization: Bearer <token>

    Returns:
        User object if token is valid, None otherwise.
    """
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:]  # Strip "Bearer " prefix

    if not token:
        return None

    s = get_serializer()
    try:
        user_id_str = s.loads(token, max_age=604800)  # 7 days expiry
        user_id = int(user_id_str)
    except (BadSignature, SignatureExpired, ValueError, TypeError):
        return None

    user = User.query.get(user_id)
    return user

