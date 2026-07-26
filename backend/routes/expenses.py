from flask import Blueprint, request, jsonify
from datetime import datetime
import os
import traceback
import uuid

from sqlalchemy import text

from database import db
from models.expense import Expense
from models.category import Category
from utils.helpers import get_current_user

expenses_bp = Blueprint("expenses", __name__)

# Receipt uploads are stored in backend/static/uploads/
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _extract_data():
    """Extract data from either FormData (multipart) or JSON (application/json).

    If the request has form data (multipart/form-data, typically with file
    uploads), return that. Otherwise try to parse the body as JSON.
    This allows the frontend to send expenses as JSON when no file is
    attached, and as FormData when a receipt file is included.
    """
    if request.form and len(request.form) > 0:
        return request.form.to_dict()
    data = request.get_json(silent=True)
    if data:
        return data
    return {}


def _parse_date(date_str):
    return datetime.strptime(date_str, "%Y-%m-%d").date() if date_str else None


def _handle_receipt_upload():
    uploaded_file = request.files.get("receipt") if hasattr(request, "files") else None
    if not uploaded_file or not uploaded_file.filename:
        return None

    ext = os.path.splitext(uploaded_file.filename)[1].lower()
    unique_name = f"receipt_{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(UPLOAD_DIR, unique_name)
    uploaded_file.save(save_path)
    return unique_name


# ==========================
# Add Expense
# ==========================
@expenses_bp.route("/", methods=["POST"])
def add_expense():
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    try:
        data = _extract_data()
        receipt_value = _handle_receipt_upload()

        title = data.get("title")
        amount = data.get("amount")
        category_id = data.get("category_id")
        payment_method = data.get("payment_method")
        expense_date = data.get("expense_date")
        notes = data.get("notes")

        amount_num = float(amount) if amount is not None and amount != "" else None
        category_id_num = int(category_id) if category_id is not None and category_id != "" else None

        if not title or amount_num is None:
            return jsonify({"message": "Title and Amount are required"}), 400

        expense = Expense(
            user_id=user.id,
            category_id=category_id_num,
            title=title,
            amount=amount_num,
            payment_method=payment_method,
            expense_date=_parse_date(expense_date),
            notes=notes,
            receipt=receipt_value,
        )

        db.session.add(expense)
        db.session.commit()

        return jsonify({"message": "Expense added successfully"}), 201
    except Exception as e:
        traceback.print_exc()
        return jsonify({"message": str(e)}), 500


# ==========================
# Get All Expenses (for logged-in user)
# ==========================
@expenses_bp.route("/", methods=["GET"])
def get_expenses():
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    results = (
        db.session.query(Expense, Category.name)
        .outerjoin(Category, Expense.category_id == Category.id)
        .filter(Expense.user_id == user.id)
        .all()
    )

    expense_list = []
    for expense, category_name in results:
        expense_list.append(
            {
                "id": expense.id,
                "user_id": expense.user_id,
                "category_id": expense.category_id,
                "category_name": category_name,
                "title": expense.title,
                "amount": expense.amount,
                "payment_method": expense.payment_method,
                "expense_date": str(expense.expense_date) if expense.expense_date else None,
                "notes": expense.notes,
                "receipt": expense.receipt if expense.receipt else None,
            }
        )

    return jsonify(expense_list)


# ==========================
# Edit Expense
# ==========================
@expenses_bp.route("/<int:id>", methods=["PUT"])
def edit_expense(id):
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    data = _extract_data()
    receipt_value = _handle_receipt_upload()

    expense = Expense.query.filter_by(id=id, user_id=user.id).first()
    if not expense:
        return jsonify({"message": "Expense not found"}), 404

    title = data.get("title")
    amount = data.get("amount")
    category_id = data.get("category_id")
    payment_method = data.get("payment_method")
    expense_date = data.get("expense_date")
    notes = data.get("notes")

    if title is not None and title != "":
        expense.title = title
    if amount is not None and amount != "":
        expense.amount = float(amount)
    if category_id is not None and category_id != "":
        expense.category_id = int(category_id)
    if payment_method is not None:
        expense.payment_method = payment_method
    if expense_date is not None and expense_date != "":
        expense.expense_date = _parse_date(expense_date)
    if notes is not None:
        expense.notes = notes

    expense.receipt = receipt_value

    db.session.commit()
    return jsonify({"message": "Expense updated successfully"}), 200


# ==========================
# Delete Expense
# ==========================
@expenses_bp.route("/<int:id>", methods=["DELETE"])
def delete_expense(id):
    user = get_current_user()
    if not user:
        return jsonify({"message": "Authentication required"}), 401

    expense = Expense.query.filter_by(id=id, user_id=user.id).first()
    if not expense:
        return jsonify({"message": "Expense not found"}), 404

    db.session.delete(expense)
    db.session.commit()
    return jsonify({"message": "Expense deleted successfully"}), 200

