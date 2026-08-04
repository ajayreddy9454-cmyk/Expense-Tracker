from database import db


class Expense(db.Model):
    __tablename__ = "expenses"

    # Composite index on user_id + expense_date speeds up the dashboard
    # (this-month sum) and reports (monthly grouping) for a single user.
    __table_args__ = (
        db.Index("ix_expenses_user_date", "user_id", "expense_date"),
        db.Index("ix_expenses_category", "category_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    title = db.Column(db.String(255), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    payment_method = db.Column(db.String(50))
    expense_date = db.Column(db.Date)
    notes = db.Column(db.Text)
    receipt = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, server_default=db.func.now())

