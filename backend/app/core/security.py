"""
Auth utilities: password hashing (pwdlib/Argon2) and JWT creation/verification
(PyJWT). Pure functions here, no FastAPI dependency, no database access, so
they're easy to test in isolation and easy to reason about.
"""

from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings

settings = get_settings()

# .recommended() configures Argon2id with pwdlib's maintained-and-updated
# default settings (memory cost, time cost, parallelism). We don't hand-pick
# these numbers ourselves, since getting them wrong in either direction
# creates a real vulnerability (too weak) or a DoS risk (too slow).
password_hash = PasswordHash.recommended()


def hash_password(plain_password: str) -> str:
    """Turn a plaintext password into a one-way Argon2 hash for storage."""
    return password_hash.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Check a login attempt against the stored hash.

    NOTE the argument order: password first, hash second. pwdlib changed
    this in a past release (used to be hash-first) to match passlib's
    convention, easy to get backwards if you're copying older examples.
    """
    return password_hash.verify(plain_password, hashed_password)


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    """
    Build a signed JWT. `subject` is typically the user's id or email, the
    thing that identifies WHO this token is for.

    The token itself is not secret data, it's base64-encoded and readable by
    anyone (try pasting one into jwt.io). What makes it trustworthy is the
    signature: only someone with `jwt_secret_key` could have produced a
    signature that validates, so the server can trust a token it receives
    wasn't forged or tampered with, without needing a database lookup.
    """
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    # "sub" (subject) and "exp" (expiration) are standard JWT claim names,
    # not something we invented, other JWT libraries/tools expect these
    # exact keys.
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str | None:
    """
    Verify a token's signature and expiration, return the subject if valid,
    None if the token is invalid, tampered with, or expired.

    jwt.decode() does the expiration check automatically, raising
    ExpiredSignatureError past `exp`, we don't have to manually compare
    timestamps.
    """
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        return payload.get("sub")
    except jwt.PyJWTError:
        return None
