import os
import tempfile
from dotenv import load_dotenv

load_dotenv()

class Config:

    SECRET_KEY = os.getenv("SECRET_KEY")

    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{os.getenv('DB_USER')}:"
        f"{os.getenv('DB_PASSWORD')}@"
        f"{os.getenv('DB_HOST')}:"
        f"{os.getenv('DB_PORT')}/"
        f"{os.getenv('DB_NAME')}"
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ---- Aiven MySQL SSL Support ----
    # If DB_SSL_CA is set, configure SSL for the MySQL connection.
    #   - If it points to an existing file, use it directly.
    #   - Otherwise treat it as the PEM content itself (handy for Render
    #     where you can paste the CA certificate content into an env var).
    _ssl_ca = os.getenv("DB_SSL_CA")
    if _ssl_ca:
        if os.path.isfile(_ssl_ca):
            _ca_path = _ssl_ca
        else:
            # Write the PEM content to a temporary file
            _ca_path = os.path.join(tempfile.gettempdir(), "aiven_ca.pem")
            with open(_ca_path, "w", encoding="utf-8") as _f:
                _f.write(_ssl_ca)

        SQLALCHEMY_ENGINE_OPTIONS = {
            "connect_args": {
                "ssl": {
                    "ca": _ca_path,
                }
            }
        }
    # ---- End SSL Support ----
