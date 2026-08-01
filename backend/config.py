import os
import tempfile
import logging

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def _resolve_ssl_ca():
    """Return a path to the Aiven CA certificate, or None.

    ``DB_SSL_CA`` may be either:
      - a filesystem path to a ``.pem`` file, or
      - the raw PEM certificate content pasted directly into the env var
        (the common pattern on Render, where pasting the full cert into the
        environment is easier than shipping a file).
    """
    ssl_ca = os.getenv("DB_SSL_CA")
    if not ssl_ca:
        logger.warning(
            "DB_SSL_CA is not set. Aiven MySQL requires SSL; the database "
            "connection will likely fail until this is configured."
        )
        return None

    # If it points to an existing file, use it directly.
    if os.path.isfile(ssl_ca):
        logger.info("Using DB_SSL_CA file at %s", ssl_ca)
        return ssl_ca

    # Otherwise treat the value as PEM content and persist it to a temp file.
    if "BEGIN CERTIFICATE" in ssl_ca:
        ca_path = os.path.join(tempfile.gettempdir(), "aiven_ca.pem")
        try:
            with open(ca_path, "w", encoding="utf-8") as f:
                f.write(ssl_ca)
            logger.info("Wrote DB_SSL_CA PEM content to %s", ca_path)
            return ca_path
        except OSError as exc:
            logger.error("Could not write DB_SSL_CA PEM content to temp file: %s", exc)
            return None

    logger.warning(
        "DB_SSL_CA is set but does not point to an existing file and does not "
        "contain PEM content. SSL will be left unconfigured for this connection."
    )
    return None


def _build_database_uri():
    """Build the SQLAlchemy database URI.

    Prefers a full ``DATABASE_URL`` (the standard variable used by Render
    managed databases) and falls back to the individual ``DB_*`` variables
    used by the original Aiven setup.

    Returns:
        str: A SQLAlchemy-compatible database URI.
    """
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        # Aiven / Render often expose a plain mysql:// URL. SQLAlchemy needs
        # the PyMySQL driver component so mysql:// is converted.
        if db_url.startswith("mysql://"):
            db_url = db_url.replace("mysql://", "mysql+pymysql://", 1)
        logger.info("Using DATABASE_URL for the database connection.")
        return db_url

    host = os.getenv("DB_HOST")
    port = os.getenv("DB_PORT", "3306")
    name = os.getenv("DB_NAME")
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD", "")

    if not host or not name or not user:
        logger.error(
            "Incomplete database configuration. Set DATABASE_URL (preferred) or "
            "DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD."
        )
        # A local fallback so the app can still boot for diagnostics instead of
        # crashing the worker with an unhelpful exit-code-1.
        return "sqlite:///" + os.path.join(
            tempfile.gettempdir(), "expense_tracker_fallback.db"
        )

    # charset=utf8mb4 is required for the emoji category icons (🍔 🚗 🛍️ ...)
    return f"mysql+pymysql://{user}:{password}@{host}:{port}/{name}?charset=utf8mb4"


class Config:
    # A fallback is provided so a missing SECRET_KEY never crashes the boot.
    # In production you MUST set a strong random SECRET_KEY in Render's env vars.
    SECRET_KEY = os.getenv("SECRET_KEY") or "dev-fallback-secret-key-change-me"

    SQLALCHEMY_DATABASE_URI = _build_database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Production-safe engine options for MySQL / Aiven.
    SQLALCHEMY_ENGINE_OPTIONS = {
        # Verify a pooled connection is still alive before handing it out.
        "pool_pre_ping": True,
        # Recycle connections before Aiven's ~300s wait_timeout kills them.
        "pool_recycle": 280,
        # Give up waiting for a pooled connection after 30 seconds.
        "pool_timeout": 30,
        # Keep the pool small so a couple of gunicorn workers don't exhaust
        # the free-tier Aiven connection limit.
        "pool_size": 3,
        "max_overflow": 3,
        "connect_args": {
            # Fail fast (10s) if the database host is unreachable.
            "connect_timeout": 10,
        },
    }

    # ---- Aiven MySQL SSL Support ----
    _ca_path = _resolve_ssl_ca()
    if _ca_path:
        SQLALCHEMY_ENGINE_OPTIONS["connect_args"]["ssl"] = {"ca": _ca_path}
    # ---- End SSL Support ----

