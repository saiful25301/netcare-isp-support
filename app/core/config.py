import os
from typing import List
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directory of the repository (netcare root)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class Settings(BaseSettings):
    PROJECT_NAME: str = "NetCare ISP Support & Complaint System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str = f"sqlite:///{os.path.join(BASE_DIR, 'netcare.db').replace(os.sep, '/')}"

    # Security
    SECRET_KEY: str = "netcare-super-secret-jwt-key-for-development-change-in-production-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Outage Detection Rules
    OUTAGE_WINDOW_MINUTES: int = 30
    OUTAGE_TICKET_THRESHOLD: int = 3

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost",
        "http://localhost:8000",
        "http://127.0.0.1",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://localhost:5000",
        "*"
    ]

    @model_validator(mode="after")
    def resolve_sqlite_path(self):
        if self.DATABASE_URL.startswith("sqlite:///."):
            rel = self.DATABASE_URL[11:]
            abs_path = os.path.normpath(os.path.join(BASE_DIR, rel.lstrip("/\\"))).replace(os.sep, "/")
            self.DATABASE_URL = f"sqlite:///{abs_path}"
        return self

    model_config = SettingsConfigDict(
        env_file=os.path.join(BASE_DIR, ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"
    )


settings = Settings()
