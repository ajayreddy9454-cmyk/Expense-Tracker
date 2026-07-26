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

    total_expenses = (
        db.session.query(db.func.count(Expense.id))
        .filter(Expense.user_id == uid)
        .scalar()
    ) or 0

    total_expense_amount = (
        db.session.query(db.func.coalesce(db.func.sum(Expense.amount), 0))
        .filter(Expense.user_id == uid)
        .scalar()
    ) or 0

    now = datetime.utcnow()
    current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    this_month_expenses = (
        db.session.query(db.func.coalesce(db.func.sum(Expense.amount), 0))
        .filter(Expense.expense_date >= current_month_start, Expense.user_id == uid)
        .scalar()
    ) or 0

    categories_used = (
        db.session.query(db.func.count(db.func.distinct(Expense.category_id)))
        .filter(Expense.user_id == uid)
        .scalar()
    ) or 0

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

