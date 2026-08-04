import logging
import os
import smtplib
from email.mime.text import MIMEText
from email.header import Header
from email.utils import formataddr

from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from database import db
from models.user import User
from models.setting import UserSetting
from utils.helpers import generate_token, ensure_default_categories

auth_bp = Blueprint("auth", __name__)
logger = logging.getLogger(__name__)


def _get_json_data():
    """Safely parse the request JSON body."""
    return request.get_json(silent=True) or {}


def _get_reset_serializer():
    """Serializer used for password-reset tokens (24h expiry)."""
    return URLSafeTimedSerializer(
        current_app.config["SECRET_KEY"], salt="password-reset-token"
    )


def _send_reset_email(to_email, reset_url):
    """Send the password-reset email via SMTP.

    This is optional. If SMTP is not configured, the function returns False and
    the caller falls back to returning the reset link in the JSON response
    (dev / single-page mode).
    """
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT", "587")
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    mail_from = os.getenv("MAIL_FROM", smtp_user or "no-reply@expensetracker.app")

    if not smtp_host or not smtp_user or not smtp_password:
        logger.info(
            "SMTP not configured - password reset link returned in response "
            "instead of being emailed."
        )
        return False

    subject = Header("Reset your Expense Tracker password", "utf-8")
    body = (
        "Hello,\n\n"
        "We received a request to reset your Expense Tracker password.\n\n"
        "Click the link below to choose a new password (valid for 24 hours):\n\n"
        f"{reset_url}\n\n"
        "If you did not request this, you can safely ignore this email.\n\n"
        "- The Expense Tracker Team"
    )

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = formataddr(("Expense Tracker", mail_from))
    msg["To"] = to_email

    try:
        if str(smtp_port) == "465":
            server = smtplib.SMTP_SSL(smtp_host, int(smtp_port), timeout=10)
        else:
            server = smtplib.SMTP(smtp_host, int(smtp_port), timeout=10)
        try:
            server.ehlo()
            if str(smtp_port) != "465":
                server.starttls()
                server.ehlo()
            server.login(smtp_user, smtp_password)
            server.sendmail(mail_from, [to_email], msg.as_string())
        finally:
            try:
                server.quit()
            except Exception:
                pass
        logger.info("Password reset email sent to %s", to_email)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("SMTP send failure for %s: %s", to_email, exc)
        return False


# ==========================
# Register
# ==========================
@auth_bp.route("/register", methods=["POST"])
def register():
    data = _get_json_data()

    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")

    if not full_name or not email or not password:
        return jsonify({"message": "All fields are required"}), 400

    if len(password) < 6:
        return jsonify({"message": "Password must be at least 6 characters"}), 400

    if len(full_name) > 100 or len(email) > 100:
        return jsonify({"message": "Name or email is too long"}), 400

    try:
        existing_user = User.query.filter_by(email=email).first()

        if existing_user:
            return jsonify({"message": "Email already exists"}), 400

        hashed_password = generate_password_hash(password)

        user = User(
            full_name=full_name,
            email=email,
            password=hashed_password
        )

        db.session.add(user)
        db.session.commit()

        # Seed default categories for the new user
        ensure_default_categories(user.id)

        # Create default settings for the new user
        defaults = UserSetting.get_defaults()
        settings = UserSetting(
            user_id=user.id,
            theme=defaults["theme"],
            language=defaults["language"],
            notifications=defaults["notifications"],
            currency=defaults["currency"],
        )
        db.session.add(settings)
        db.session.commit()

        # Auto-login: generate token for the new user
        token = generate_token(user.id)

        return jsonify({
            "message": "Registration Successful",
            "token": token,
            "user": {
                "id": user.id,
                "full_name": user.full_name,
                "name": user.full_name,
                "email": user.email
            }
        }), 201
    except IntegrityError:
        db.session.rollback()
        logger.warning("Register IntegrityError for email: %s", email)
        return jsonify({"message": "Email already exists"}), 400
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception("Register database error for email: %s", email)
        return jsonify({"message": "Unable to connect to the database. Please try again."}), 503
    except Exception:
        db.session.rollback()
        logger.exception("Unexpected register error for email: %s", email)
        return jsonify({"message": "Registration failed. Please try again."}), 500


# ==========================
# Login
# ==========================
@auth_bp.route("/login", methods=["POST"])
def login():
    data = _get_json_data()

    email = (data.get("email") or "").strip().lower()
    password = data.get("password")

    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400

    try:
        user = User.query.filter_by(email=email).first()

        if not user or not check_password_hash(user.password, password):
            return jsonify({"message": "Invalid credentials. Please check your email and password."}), 401

        token = generate_token(user.id)

        return jsonify({
            "message": "Login Successful",
            "token": token,
            "user": {
                "id": user.id,
                "full_name": user.full_name,
                "name": user.full_name,
                "email": user.email
            }
        })
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception("Login database error for email: %s", email)
        return jsonify({"message": "Unable to connect to the database. Please try again."}), 503
    except Exception:
        db.session.rollback()
        logger.exception("Unexpected login error for email: %s", email)
        return jsonify({"message": "Login failed. Please try again."}), 500


# ==========================
# Forgot Password
# ==========================
@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    """Start the password-reset flow.

    Generates a signed, 24h token for the account (if it exists) and either
    emails the reset link (SMTP configured) or returns the link in the JSON
    body so the frontend can display it (dev / single-page mode).

    We always return a 200 so that unregistered emails are not distinguishable
    from registered ones; the delivery method may differ.
    """
    data = _get_json_data()
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"message": "Email is required"}), 400

    user = None
    try:
        user = User.query.filter_by(email=email).first()
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception("Forgot-password DB error for email: %s", email)
        return jsonify({"message": "Unable to connect to the database. Please try again."}), 503

    if not user:
        return jsonify({
            "message": "If an account exists for that email, a reset link has been sent."
        }), 200

    s = _get_reset_serializer()
    token = s.dumps(str(user.id))
    base = current_app.config.get("FRONTEND_URL") or request.host_url.rstrip("/")
    reset_url = f"{base}/reset-password.html?token={token}"

    sent = _send_reset_email(email, reset_url)

    # When SMTP is unavailable, return the link so the demo flow still works.
    if sent:
        return jsonify({
            "message": "If an account exists for that email, a reset link has been sent."
        }), 200

    return jsonify({
        "message": "Password reset link generated (SMTP not configured on this server).",
        "reset_url": reset_url,
    }), 200


# ==========================
# Reset Password
# ==========================
@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    """Complete the password-reset flow.

    Accepts a signed token and a new password. Validates the token (24h
    expiry), then updates the account's password hash.
    """
    data = _get_json_data()
    token = data.get("token")
    new_password = data.get("new_password")

    if not token:
        return jsonify({"message": "Token is required"}), 400
    if not new_password or len(new_password) < 6:
        return jsonify({"message": "New password must be at least 6 characters"}), 400

    s = _get_reset_serializer()
    try:
        user_id_str = s.loads(token, max_age=86400)  # 24 hours
        user_id = int(user_id_str)
    except (BadSignature, SignatureExpired, ValueError, TypeError):
        return jsonify({"message": "This reset link is invalid or has expired. Please request a new one."}), 400

    user = None
    try:
        user = User.query.get(user_id)
    except SQLAlchemyError:
        db.session.rollback()
        logger.exception("Reset-password DB error for user %s", user_id)
        return jsonify({"message": "Unable to connect to the database. Please try again."}), 503

    if not user:
        return jsonify({"message": "This reset link is invalid or has expired. Please request a new one."}), 400

    try:
        user.password = generate_password_hash(new_password)
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.exception("Reset-password commit error for user %s", user_id)
        return jsonify({"message": "Unable to update password. Please try again."}), 500

    return jsonify({"message": "Password reset successfully. You can now sign in."}), 200

