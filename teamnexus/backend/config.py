import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "teamnexus_super_secret_jwt_key_2026_x87a!")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "teamnexus_jwt_access_token_secret_key_2026_k9p!")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.getenv("JWT_ACCESS_HOURS", 24)))
    
    # MongoDB Config
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/teamnexus_db")
    DB_NAME = os.getenv("DB_NAME", "teamnexus_db")
    
    # App Settings
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    VERIFY_BASE_URL = os.getenv("VERIFY_BASE_URL", "http://localhost:5173/verify")
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max upload
    
    # Registration Defaults
    REQUIRE_SAME_INSTITUTION = os.getenv("REQUIRE_SAME_INSTITUTION", "false").lower() == "true"
    REQUIRE_SAME_DEPARTMENT = os.getenv("REQUIRE_SAME_DEPARTMENT", "false").lower() == "true"
    DEFAULT_EVENT_NAME = "CODE NEXUS HACKATHON 2026"
