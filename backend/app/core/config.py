import os
from pathlib import Path
from dotenv import load_dotenv

# Load backend/.env without overriding process settings.
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings:
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "Management Web API")
    API_V1_STR: str = os.getenv("API_V1_STR", "/api/v1")
    # Calendar dates match the application's UTC+7 display timezone.
    APP_TIMEZONE: str = "Asia/Ho_Chi_Minh"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    DATABASE_URL_UNPOOLED: str = os.getenv("DATABASE_URL_UNPOOLED", "")
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:6006,http://127.0.0.1:6006,http://localhost:5173,http://127.0.0.1:5173").split(",")
        if origin.strip()
    ]


settings = Settings()

if not settings.DATABASE_URL:
    raise RuntimeError("DATABASE_URL must be configured in the environment or backend/.env")
