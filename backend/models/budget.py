from database import db


class Budget(db.Model):
    __tablename__ = "budgets"

    __table_args__ = (
        db.Index("ix_budgets_user", "user_id"),
        db.Index("ix_budgets_category", "category_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    amount = db.Column(db.Float, nullable=False)
    month = db.Column(db.String(20))
    year = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

