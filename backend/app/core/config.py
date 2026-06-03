"""
App Configuration — reads from .env
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
import os

class Settings(BaseSettings):
    # App
    APP_NAME: str = "MilkyRoots"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production-use-256-bit-key")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database (PostgreSQL)
    # Default to a local dev DB, but Vercel should provide DATABASE_URL
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+asyncpg://milkyroots:password@localhost:5432/milkyroots_db"
    )

    @property
    def async_database_url(self) -> str:
        """Ensure the URL uses postgresql+asyncpg:// scheme."""
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    # WhatsApp
    WHATSAPP_SELLER_NUMBER: str = os.getenv("WHATSAPP_SELLER_NUMBER", "918949553581")

    # Pricing (₹) — single source of truth
    PRICE_MILK_PER_LITRE: float = 70.0
    PRICE_CURD_PER_KG: float = 80.0
    PRICE_BUTTERMILK_500ML: float = 20.0
    PRICE_GHEE_500G: float = 900.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
