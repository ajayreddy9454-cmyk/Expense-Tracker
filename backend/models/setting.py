from database import db


class UserSetting(db.Model):
    """Per-user settings.

    Each user gets exactly one settings record.
    If no record exists, the application should use defaults.
    """
    __tablename__ = "user_settings"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    theme = db.Column(db.String(20), nullable=False, default="light")
    language = db.Column(db.String(10), nullable=False, default="en")
    notifications = db.Column(db.Boolean, nullable=False, default=True)
    currency = db.Column(db.String(50), nullable=False, default="Indian Rupee (₹)")

    # Relationship
    user = db.relationship("User", backref=db.backref("settings", uselist=False))

    @classmethod
    def get_defaults(cls):
        """Return default settings values."""
        return {
            "theme": "light",
            "language": "en",
            "notifications": True,
            "currency": "Indian Rupee (₹)",
        }

    def to_dict(self):
        return {
            "theme": self.theme,
            "language": self.language,
            "notifications": self.notifications,
            "currency": self.currency,
        }

