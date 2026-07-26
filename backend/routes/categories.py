from flask import Blueprint, request, jsonify
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from database import db
from models.category import Category
from models.expense import Expense
from utils.helpers import get_current_user, ensure_default_categories

categories_bp = Blueprint("categories", __name__)


# ==========================
# Get All Categories (for logged-in user)
# ==========================
@categories_bp.route("/", methods=["GET"])
def get_categories():
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    # Ensure default categories exist for this user
    ensure_default_categories(user.id)

    rows = db.session.execute(
        text("""
            SELECT c.id,
                   c.name,
                   c.icon,
                   COALESCE(COUNT(e.id), 0) AS expense_count
            FROM categories c
            LEFT OUTER JOIN expenses e ON c.id = e.category_id AND e.user_id = :uid
            WHERE c.user_id = :uid
            GROUP BY c.id, c.name, c.icon
            ORDER BY c.name
        """), {"uid": user.id}
    ).fetchall()

    category_list = [
        {
            "id": row.id,
            "name": row.name,
            "icon": row.icon if row.icon else None,
            "expense_count": int(row.expense_count),
        }
        for row in rows
    ]

    return jsonify(category_list)


# ==========================
# Add Category (for logged-in user)
# ==========================
@categories_bp.route("/", methods=["POST"])
def add_category():
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    data = request.get_json()

    name = data.get("name")
    icon = data.get("icon")

    if not name:
        return jsonify({"success": False, "message": "Category name is required"}), 400

    try:
        category = Category(user_id=user.id, name=name, icon=icon)

        db.session.add(category)
        db.session.commit()

        return jsonify({"success": True, "message": "Category added successfully"}), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({"success": False, "message": "A category with this name already exists."}), 409


# ==========================
# Update Category (must own it)
# ==========================
@categories_bp.route("/<int:id>", methods=["PUT"])
def update_category(id):
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    category = Category.query.filter_by(id=id, user_id=user.id).first()

    if not category:
        return jsonify({"message": "Category not found"}), 404

    data = request.get_json()

    name = data.get("name")
    icon = data.get("icon")

    if name is not None and name != "":
        category.name = name

    if icon is not None:
        category.icon = icon

    db.session.commit()

    return jsonify({"message": "Category updated successfully"}), 200


# ==========================
# Delete Category (must own it)
# ==========================
@categories_bp.route("/<int:id>", methods=["DELETE"])
def delete_category(id):
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    category = Category.query.filter_by(id=id, user_id=user.id).first()

    if not category:
        return jsonify({"message": "Category not found"}), 404

    db.session.delete(category)
    db.session.commit()

    return jsonify({"message": "Category deleted successfully"}), 200

