"""
App Configuration — reads from .env
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from functools import lru_cache
from typing import Optional
import os

class Settings(BaseSettings):
    # App
    APP_NAME: str = "MilkyRoots"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production-use-256-bit-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database (PostgreSQL)
    # We check for both DATABASE_URL and POSTGRES_URL (common on Vercel)
    DATABASE_URL: str = "postgresql+asyncpg://milkyroots:password@localhost:5432/milkyroots_db"
    POSTGRES_URL: Optional[str] = None

    @property
    def effective_database_url(self) -> str:
        """Prioritize POSTGRES_URL if provided, else use DATABASE_URL."""
        if self.POSTGRES_URL:
            return self.POSTGRES_URL
        return self.DATABASE_URL

    @property
    def async_database_url(self) -> str:
        """Ensure the URL uses postgresql+asyncpg:// scheme and remove incompatible params."""
        url = self.effective_database_url
        
        # 1. Handle scheme replacement
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            
        # 2. Strip sslmode if present (asyncpg uses its own ssl logic and fails on this param)
        if "sslmode=" in url:
            import re
            url = re.sub(r'[?&]sslmode=[^&]*', '', url)
            
        return url

    # WhatsApp
    WHATSAPP_SELLER_NUMBER: str = "918949553581"

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
