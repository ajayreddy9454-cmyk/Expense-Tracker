from flask import Blueprint, jsonify
from sqlalchemy import text

from database import db
from models.expense import Expense
from utils.helpers import get_current_user


reports_bp = Blueprint("reports", __name__)


# ==========================
# Get Reports (for logged-in user)
# ==========================
@reports_bp.route("/", methods=["GET"])
def get_reports():
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    uid = user.id

    # Total expenses count
    total_expenses = (
        db.session.query(db.func.count(Expense.id))
        .filter(Expense.user_id == uid)
        .scalar()
    ) or 0

    # Total amount spent
    total_amount_spent = (
        db.session.query(db.func.coalesce(db.func.sum(Expense.amount), 0))
        .filter(Expense.user_id == uid)
        .scalar()
    ) or 0

    # Monthly expense totals
    monthly_rows = db.session.execute(
        text("""
            SELECT MONTH(expense_date) AS month_num,
                   COALESCE(SUM(amount), 0) AS amount
            FROM expenses
            WHERE expense_date IS NOT NULL AND user_id = :uid
            GROUP BY MONTH(expense_date)
            ORDER BY month_num
        """), {"uid": uid}
    ).fetchall()

    month_names = ["", "January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"]

    monthly_expenses = [
        {
            "month": month_names[row.month_num],
            "amount": float(row.amount),
        }
        for row in monthly_rows
    ]

    # Category-wise expense totals
    category_rows = db.session.execute(
        text("""
            SELECT c.name AS category_name,
                   COALESCE(SUM(e.amount), 0) AS amount
            FROM expenses e
            JOIN categories c ON e.category_id = c.id
            WHERE e.user_id = :uid
            GROUP BY c.name
            ORDER BY amount DESC
        """), {"uid": uid}
    ).fetchall()

    category_expenses = [
        {
            "category_name": row.category_name,
            "amount": float(row.amount),
        }
        for row in category_rows
    ]

    # Budget vs Spent summary
    budget_rows = db.session.execute(
        text("""
            SELECT c.name AS category_name,
                   COALESCE(b.amount, 0) AS budget,
                   COALESCE(SUM(e.amount), 0) AS spent
            FROM categories c
            LEFT JOIN budgets b ON c.id = b.category_id AND b.user_id = :uid
            LEFT JOIN expenses e ON c.id = e.category_id AND e.user_id = :uid
            WHERE c.user_id = :uid
            GROUP BY c.name, b.amount
            ORDER BY c.name
        """), {"uid": uid}
    ).fetchall()

    budget_summary = [
        {
            "category_name": row.category_name,
            "budget": float(row.budget),
            "spent": float(row.spent),
            "remaining": float(row.budget) - float(row.spent),
        }
        for row in budget_rows
    ]

    return jsonify(
        {
            "total_expenses": int(total_expenses),
            "total_amount_spent": float(total_amount_spent),
            "monthly_expenses": monthly_expenses,
            "category_expenses": category_expenses,
            "budget_summary": budget_summary,
        }
    )

