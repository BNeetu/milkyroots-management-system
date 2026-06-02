"""
App Configuration — reads from .env
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "MilkyRoots"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production-use-256-bit-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database (PostgreSQL)
    DATABASE_URL: str = "postgresql+asyncpg://milkyroots:password@localhost:5432/milkyroots_db"

    # WhatsApp
    WHATSAPP_SELLER_NUMBER: str = "918949553581"  # Neetu's number

    # Pricing (₹) — single source of truth
    PRICE_MILK_PER_LITRE: float = 70.0
    PRICE_CURD_PER_KG: float = 80.0       # 500g = ₹40
    PRICE_BUTTERMILK_500ML: float = 20.0
    PRICE_GHEE_500G: float = 900.0

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
