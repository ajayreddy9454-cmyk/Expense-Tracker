from flask import Flask
from flask_cors import CORS
from routes.auth import auth_bp
from routes.expenses import expenses_bp
from routes.dashboard import dashboard_bp
from routes.categories import categories_bp
from routes.reports import reports_bp
from routes.budget import budget_bp
from routes.profile import profile_bp
from routes.settings import settings_bp
from config import Config
from database import db

# Import all models so db.create_all() picks them up
from models.user import User
from models.expense import Expense
from models.category import Category
from models.budget import Budget
from models.setting import UserSetting

app = Flask(__name__)
app.config.from_object(Config)


CORS(app, supports_credentials=True, expose_headers=["Authorization"], allow_headers=["Authorization", "Content-Type"])

db.init_app(app)

# Auto-create database tables on startup
with app.app_context():
    db.create_all()

app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(expenses_bp, url_prefix="/api/expenses")
app.register_blueprint(dashboard_bp)
app.register_blueprint(categories_bp, url_prefix="/api/categories")
app.register_blueprint(reports_bp, url_prefix="/api/reports")
app.register_blueprint(budget_bp, url_prefix="/api/budgets")
app.register_blueprint(profile_bp, url_prefix="/api/profile")
app.register_blueprint(settings_bp, url_prefix="/api/settings")

@app.route("/")
def home():
    return {
        "message": "Expense Tracker Backend Running"
    }

@app.route("/test-db")
def test_db():
    try:
        with app.app_context():
            db.engine.connect()
        return {
            "status": "success",
            "message": "Database Connected Successfully"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }, 500

if __name__ == "__main__":
    app.run(debug=True)