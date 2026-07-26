from flask import Blueprint, request, jsonify

from database import db
from models.setting import UserSetting
from utils.helpers import get_current_user

settings_bp = Blueprint("settings", __name__)


# ============================
# GET /api/settings/
# ============================
@settings_bp.route("/", methods=["GET"])
def get_settings():
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    # Try to load existing settings
    settings = UserSetting.query.filter_by(user_id=user.id).first()

    # If no settings exist, create defaults on first access
    if not settings:
        defaults = UserSetting.get_defaults()
        settings = UserSetting(
            user_id=user.id,
            theme=defaults["theme"],
            language=defaults["language"],
            notifications=defaults["notifications"],
            currency=defaults["currency"],
        )
        db.session.add(settings)
        db.session.commit()

    return jsonify(settings.to_dict()), 200


# ============================
# PUT /api/settings/
# ============================
@settings_bp.route("/", methods=["PUT"])
def save_settings():
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"message": "No data provided"}), 400

    # Find or create settings record for this user
    settings = UserSetting.query.filter_by(user_id=user.id).first()
    if not settings:
        defaults = UserSetting.get_defaults()
        settings = UserSetting(
            user_id=user.id,
            theme=defaults["theme"],
            language=defaults["language"],
            notifications=defaults["notifications"],
            currency=defaults["currency"],
        )
        db.session.add(settings)

    # Update only the fields that were provided
    if "theme" in data:
        theme = data["theme"]
        if theme not in ("light", "dark"):
            return jsonify({"message": "Invalid theme value. Use 'light' or 'dark'."}), 400
        settings.theme = theme

    if "language" in data:
        language = data["language"]
        allowed_languages = ("en", "es", "fr", "de", "hi")
        if language not in allowed_languages:
            return jsonify({"message": f"Invalid language '{language}'."}), 400
        settings.language = language

    if "notifications" in data:
        settings.notifications = bool(data["notifications"])

    if "currency" in data:
        settings.currency = str(data["currency"])

    db.session.commit()

    return jsonify({
        "message": "Settings saved successfully",
        "settings": settings.to_dict(),
    }), 200

