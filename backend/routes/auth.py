from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash

from database import db
from models.user import User
from models.setting import UserSetting
from utils.helpers import generate_token, ensure_default_categories

auth_bp = Blueprint("auth", __name__)


# ==========================
# Register
# ==========================
@auth_bp.route("/register", methods=["POST"])
def register():

    data = request.get_json()

    full_name = data.get("full_name")
    email = data.get("email")
    password = data.get("password")

    if not full_name or not email or not password:
        return jsonify({"message": "All fields are required"}), 400

    existing_user = User.query.filter_by(email=email).first()

    if existing_user:
        return jsonify({"message": "Email already exists"}), 400

    hashed_password = generate_password_hash(password)

    user = User(
        full_name=full_name,
        email=email,
        password=hashed_password
    )

    db.session.add(user)
    db.session.commit()

    # Seed default categories for the new user
    ensure_default_categories(user.id)

    # Create default settings for the new user
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

    # Auto-login: generate token for the new user
    token = generate_token(user.id)

    return jsonify({
        "message": "Registration Successful",
        "token": token,
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "name": user.full_name,
            "email": user.email
        }
    }), 201


# ==========================
# Login
# ==========================
@auth_bp.route("/login", methods=["POST"])
def login():

    data = request.get_json()

    email = data.get("email")
    password = data.get("password")

    user = User.query.filter_by(email=email).first()

    if not user or not check_password_hash(user.password, password):
        return jsonify({"message": "Invalid credentials. Please check your email and password."}), 401

    token = generate_token(user.id)

    return jsonify({
        "message": "Login Successful",
        "token": token,
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "name": user.full_name,
            "email": user.email
        }
    })

