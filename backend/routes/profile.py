from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import os
import uuid
from datetime import datetime

from database import db
from models.user import User
from models.expense import Expense
from models.budget import Budget
from utils.helpers import get_current_user

profile_bp = Blueprint("profile", __name__)

# Profile avatar upload directory
AVATAR_UPLOAD_DIR = os.path.join(
    os.path.dirname(__file__), "..", "static", "uploads", "profile"
)
os.makedirs(AVATAR_UPLOAD_DIR, exist_ok=True)


# ============================
# GET /api/profile/
# ============================
@profile_bp.route("/", methods=["GET"])
def get_profile():
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    # Account statistics
    total_expenses = (
        db.session.query(db.func.count(Expense.id))
        .filter(Expense.user_id == user.id)
        .scalar()
    ) or 0

    categories_used = (
        db.session.query(db.func.count(db.func.distinct(Expense.category_id)))
        .filter(Expense.user_id == user.id)
        .scalar()
    ) or 0

    budgets_created = (
        db.session.query(db.func.count(Budget.id))
        .filter(Budget.user_id == user.id)
        .scalar()
    ) or 0

    # Profile image URL
    profile_image_url = None
    if user.profile_image:
        profile_image_url = f"/static/uploads/profile/{user.profile_image}"

    # Date of birth string
    dob_str = ""
    if user.date_of_birth:
        try:
            dob_str = user.date_of_birth.strftime("%Y-%m-%d")
        except Exception:
            dob_str = str(user.date_of_birth)

    # Created at string
    created_at_str = ""
    if user.created_at:
        try:
            created_at_str = user.created_at.isoformat()
        except Exception:
            created_at_str = str(user.created_at)

    return jsonify({
        "full_name": user.full_name or "",
        "email": user.email or "",
        "phone": user.phone or "",
        "country": user.country or "",
        "occupation": user.occupation or "",
        "date_of_birth": dob_str,
        "about_me": user.about_me or "",
        "created_at": created_at_str,
        "profile_image": profile_image_url,
        "total_expenses": int(total_expenses),
        "categories_used": int(categories_used),
        "budgets_created": int(budgets_created),
    })


# ============================
# PUT /api/profile/
# ============================
@profile_bp.route("/", methods=["PUT"])
def update_profile():
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"message": "No data provided"}), 400

    full_name = data.get("full_name")
    phone = data.get("phone")
    country = data.get("country")
    occupation = data.get("occupation")
    date_of_birth = data.get("date_of_birth")
    about_me = data.get("about_me")

    if full_name is not None:
        if not full_name.strip():
            return jsonify({"message": "Full name cannot be empty"}), 400
        user.full_name = full_name.strip()

    if phone is not None:
        user.phone = phone.strip() if phone.strip() else None

    if country is not None:
        user.country = country.strip() if country.strip() else None

    if occupation is not None:
        user.occupation = occupation.strip() if occupation.strip() else None

    if date_of_birth is not None:
        if date_of_birth.strip():
            try:
                user.date_of_birth = datetime.strptime(
                    date_of_birth.strip(), "%Y-%m-%d"
                ).date()
            except ValueError:
                return jsonify({"message": "Invalid date format. Use YYYY-MM-DD"}), 400
        else:
            user.date_of_birth = None

    if about_me is not None:
        user.about_me = about_me.strip() if about_me.strip() else None

    db.session.commit()
    return jsonify({"message": "Profile updated successfully"}), 200


# ============================
# PUT /api/profile/password
# ============================
@profile_bp.route("/password", methods=["PUT"])
def change_password():
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    data = request.get_json(silent=True)
    if not data:
        return jsonify({"message": "No data provided"}), 400

    current_password = data.get("current_password")
    new_password = data.get("new_password")
    confirm_password = data.get("confirm_password")

    if not current_password or not new_password or not confirm_password:
        return jsonify({"message": "All password fields are required"}), 400

    if not check_password_hash(user.password, current_password):
        return jsonify({"message": "Current password is incorrect"}), 400

    if new_password != confirm_password:
        return jsonify({"message": "New password and confirm password do not match"}), 400

    if len(new_password) < 6:
        return jsonify({"message": "New password must be at least 6 characters"}), 400

    user.password = generate_password_hash(new_password)
    db.session.commit()

    return jsonify({"message": "Password changed successfully"}), 200


# ============================
# POST /api/profile/avatar
# ============================
@profile_bp.route("/avatar", methods=["POST"])
def upload_avatar():
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    if "avatar" not in request.files:
        return jsonify({"message": "No avatar file provided"}), 400

    avatar_file = request.files["avatar"]

    if not avatar_file.filename:
        return jsonify({"message": "No file selected"}), 400

    # Validate file type
    allowed_extensions = {"png", "jpg", "jpeg", "gif", "webp"}
    ext = os.path.splitext(avatar_file.filename)[1].lower().lstrip(".")
    if ext not in allowed_extensions:
        return jsonify({
            "message": "Invalid file type. Allowed: png, jpg, jpeg, gif, webp"
        }), 400

    # Delete old avatar if exists
    if user.profile_image:
        old_path = os.path.join(AVATAR_UPLOAD_DIR, user.profile_image)
        if os.path.exists(old_path):
            os.remove(old_path)

    # Save new avatar
    unique_name = f"avatar_{uuid.uuid4().hex}.{ext}"
    save_path = os.path.join(AVATAR_UPLOAD_DIR, unique_name)
    avatar_file.save(save_path)

    user.profile_image = unique_name
    db.session.commit()

    return jsonify({
        "message": "Avatar updated successfully",
        "profile_image": f"/static/uploads/profile/{unique_name}",
    }), 200
