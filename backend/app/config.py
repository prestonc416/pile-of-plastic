"""
Central app configuration.

Why this file exists: hardcoding secrets/DB URLs in your code means they end up
in git history. pydantic-settings reads from environment variables (or a .env
file) and validates them, so a missing/misspelled var fails fast at startup
instead of silently breaking a request later.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- Database ---
    # Sync driver URL, e.g. postgresql+psycopg2://user:pass@host:port/dbname
    database_url: str

    # --- Auth ---
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # --- App metadata ---
    app_name: str = "Collection Tracker API"
    debug: bool = False

    # Tells pydantic-settings to load a .env file if present, and to be
    # case-insensitive about env var names (DATABASE_URL or database_url both work).
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """
    Cached so Settings() is only constructed once per process, not once per
    request. FastAPI will call this via Depends(get_settings) later.
    """
    return Settings()
