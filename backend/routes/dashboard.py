from datetime import datetime
from flask import Blueprint, jsonify
from sqlalchemy import text

from database import db
from models.expense import Expense
from utils.helpers import get_current_user


dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/api/dashboard/", methods=["GET"])
def get_dashboard():
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    uid = user.id

    now = datetime.utcnow()
    current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Single aggregate query replaces 4 separate COUNT/SUM queries. Computes
    # total expense count, lifetime amount, this-month amount and distinct
    # category count in one pass over the user's expenses.
    summary_row = db.session.execute(
        text("""
            SELECT COUNT(e.id) AS total_expenses,
                   COALESCE(SUM(e.amount), 0) AS total_expense_amount,
                   COALESCE(SUM(
                       CASE WHEN e.expense_date >= :month_start
                            THEN e.amount ELSE 0 END
                   ), 0) AS this_month_expenses,
                   COUNT(DISTINCT e.category_id) AS categories_used
            FROM expenses e
            WHERE e.user_id = :uid
        """),
        {"uid": uid, "month_start": current_month_start},
    ).fetchone()

    total_expenses = summary_row.total_expenses or 0
    total_expense_amount = summary_row.total_expense_amount or 0
    this_month_expenses = summary_row.this_month_expenses or 0
    categories_used = summary_row.categories_used or 0

    top_categories_rows = db.session.execute(
        text("""
            SELECT c.id AS category_id,
                   c.name AS category_name,
                   c.icon AS category_icon,
                   COALESCE(SUM(e.amount), 0) AS total_amount
            FROM expenses e
            JOIN categories c ON e.category_id = c.id
            WHERE e.user_id = :uid
            GROUP BY c.id, c.name, c.icon
            ORDER BY total_amount DESC
        """), {"uid": uid}
    ).fetchall()

    top_categories = [
        {
            "category_id": row.category_id,
            "category_name": row.category_name,
            "category_icon": row.category_icon,
            "total_amount": float(row.total_amount),
        }
        for row in top_categories_rows
    ]

    recent_rows = db.session.execute(
        text("""
            SELECT e.id,
                   e.title,
                   e.amount,
                   e.expense_date,
                   c.name AS category_name,
                   c.icon AS category_icon
            FROM expenses e
            LEFT JOIN categories c ON e.category_id = c.id
            WHERE e.user_id = :uid
            ORDER BY e.id DESC
            LIMIT 5
        """), {"uid": uid}
    ).fetchall()

    recent_expenses = [
        {
            "id": row.id,
            "title": row.title,
            "amount": float(row.amount),
            "expense_date": str(row.expense_date) if row.expense_date else None,
            "category_name": row.category_name or "Unknown",
            "category_icon": row.category_icon or "📦",
        }
        for row in recent_rows
    ]

    return jsonify(
        {
            "total_expenses": int(total_expenses),
            "total_expense_amount": float(total_expense_amount),
            "this_month_expenses": float(this_month_expenses),
            "categories_used": int(categories_used),
            "top_categories": top_categories,
            "recent_expenses": recent_expenses,
        }
    )
