import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from backend directory
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

class Settings:
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "Management Web API")
    API_V1_STR: str = os.getenv("API_V1_STR", "/api/v1")
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://neondb_owner:npg_hlUwyLQ5AxE6@ep-super-art-azwbthia-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
    )
    CORS_ORIGINS: list[str] = [
        origin.strip() 
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:6006,http://127.0.0.1:6006,http://localhost:5173,http://127.0.0.1:5173").split(",")
        if origin.strip()
    ]

settings = Settings()
