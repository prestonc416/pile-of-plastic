"""
Central app configuration.

Why this file exists: hardcoding secrets/DB URLs in your code means they end up
in git history. pydantic-settings reads from environment variables (or a .env
file) and validates them, so a missing/misspelled var fails fast at startup
instead of silently breaking a request later.
"""

from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    # --- Database ---
    # Sync driver URL, e.g. postgresql+psycopg2://user:pass@host:port/dbname
    database_url: str

    # --- Auth ---
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # --- CORS ---
    # Browser origins allowed to call the API. Env format is comma-separated,
    # e.g. CORS_ORIGINS=http://localhost:5173,https://app.example.com
    # NoDecode stops pydantic-settings from JSON-decoding the env string, so
    # the validator below can split it instead.
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]

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

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_cors_origins(cls, v: object) -> object:
        """
        Parse a comma-separated env string into a list of origins.

        Strips whitespace and trailing slashes, because the browser's Origin
        header never has a trailing slash and CORS matching is exact.
        Non-string input (the default list) passes through unchanged.
        """
        if isinstance(v, str):
            return [o.strip().rstrip("/") for o in v.split(",") if o.strip()]
        return v

    @field_validator("jwt_secret_key")
    @classmethod
    def reject_weak_jwt_secret(cls, v: str) -> str:
        """
        Fail fast at startup if the JWT signing key is a placeholder or too
        short. HS256 needs at least 32 bytes of key material (RFC 7518,
        section 3.2); token_urlsafe(64) gives ~86 characters.
        """
        placeholders = {"changeme", "change-me", "secret", "your-secret-key"}
        if v.strip().lower() in placeholders or len(v) < 32:
            raise ValueError(
                "JWT_SECRET_KEY is a placeholder or shorter than 32 characters. "
                'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(64))"'
            )
        return v

@lru_cache
def get_settings() -> Settings:
    """
    Cached so Settings() is only constructed once per process, not once per
    request. FastAPI will call this via Depends(get_settings) later.
    """
    return Settings()
