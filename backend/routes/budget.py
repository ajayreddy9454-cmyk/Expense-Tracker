from flask import Blueprint, request, jsonify
from sqlalchemy import text

from database import db
from models.budget import Budget
from models.category import Category
from utils.helpers import get_current_user

budget_bp = Blueprint("budget", __name__)


# ==========================
# Get All Budgets (for logged-in user)
# ==========================
@budget_bp.route("/", methods=["GET"])
def get_budgets():
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    # Single optimized query: budgets joined with categories and a LEFT JOIN
    # to expenses for the aggregate spent amount. This eliminates the N+1
    # per-budget SUM query that the old implementation issued in a loop.
    #
    # Budgets with no month/year have no matching expenses (the MONTH(e)=b.month
    # comparison simply never matches NULL), so their spent amount is 0 —
    # identical to the old per-budget behaviour.
    rows = db.session.execute(
        text("""
            SELECT
                b.id,
                b.category_id,
                c.name AS category_name,
                c.icon AS category_icon,
                b.amount AS budget_amount,
                b.month,
                b.year,
                COALESCE(SUM(e.amount), 0) AS spent_amount
            FROM budgets b
            JOIN categories c ON b.category_id = c.id
            LEFT JOIN expenses e
                ON e.category_id = b.category_id
                AND e.user_id = b.user_id
                AND MONTH(e.expense_date) = b.month
                AND YEAR(e.expense_date) = b.year
            WHERE b.user_id = :uid
            GROUP BY
                b.id, b.category_id, c.name, c.icon,
                b.amount, b.month, b.year
            ORDER BY b.id
        """),
        {"uid": user.id},
    ).fetchall()

    budget_list = []
    for row in rows:
        budget_amount = float(row.budget_amount)
        spent_amount = float(row.spent_amount or 0.0)
        remaining_amount = budget_amount - spent_amount

        budget_list.append({
            "id": row.id,
            "category_id": row.category_id,
            "category_name": row.category_name,
            "category_icon": row.category_icon if row.category_icon else None,
            "budget_amount": budget_amount,
            "spent_amount": spent_amount,
            "remaining_amount": remaining_amount,
            "month": int(row.month) if row.month else None,
            "year": int(row.year) if row.year else None,
        })

    return jsonify(budget_list)


# ==========================
# Add Budget (for logged-in user)
# ==========================
@budget_bp.route("/", methods=["POST"])
def add_budget():
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    data = request.get_json(silent=True) or {}

    category_id = data.get("category_id")
    amount = data.get("amount")
    month = data.get("month")
    year = data.get("year")

    if not category_id or amount in (None, ""):
        return jsonify({"message": "category_id and amount are required"}), 400

    # Validate category exists and belongs to this user
    category = Category.query.filter_by(id=category_id, user_id=user.id).first()
    if not category:
        return jsonify({"message": "Category not found"}), 404

    budget = Budget(
        user_id=user.id,
        category_id=int(category_id),
        amount=float(amount),
        month=str(month) if month else None,
        year=int(year) if year else None,
    )
    db.session.add(budget)
    db.session.commit()

    return jsonify({"message": "Budget added successfully"}), 201


# ==========================
# Update Budget (must own it)
# ==========================
@budget_bp.route("/<int:id>", methods=["PUT"])
def update_budget(id):
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    budget = Budget.query.filter_by(id=id, user_id=user.id).first()
    if not budget:
        return jsonify({"message": "Budget not found"}), 404

    data = request.get_json(silent=True) or {}

    category_id = data.get("category_id")
    amount = data.get("amount")
    month = data.get("month")
    year = data.get("year")

    if category_id is not None and category_id != "":
        # Verify category belongs to user
        cat = Category.query.filter_by(id=int(category_id), user_id=user.id).first()
        if not cat:
            return jsonify({"message": "Category not found"}), 404
        budget.category_id = int(category_id)

    if amount is not None and amount != "":
        budget.amount = float(amount)
    if month is not None:
        budget.month = str(month)
    if year is not None and year != "":
        budget.year = int(year)

    db.session.commit()
    return jsonify({"message": "Budget updated successfully"}), 200


# ==========================
# Delete Budget (must own it)
# ==========================
@budget_bp.route("/<int:id>", methods=["DELETE"])
def delete_budget(id):
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    budget = Budget.query.filter_by(id=id, user_id=user.id).first()
    if not budget:
        return jsonify({"message": "Budget not found"}), 404

    db.session.delete(budget)
    db.session.commit()
    return jsonify({"message": "Budget deleted successfully"}), 200

