"""
User business logic: lookups, creation, and credential checking.

Kept out of the route functions so routes stay thin (HTTP only) and this
logic can be reused and tested without going through HTTP.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.db.models import User


def normalize_email(email: str) -> str:
    """
    Emails are effectively case-insensitive, but Postgres string comparison
    is case-sensitive. Without this, Fiona@x.com and fiona@x.com would be
    two separate accounts. We store and look up everything lowercased.
    """
    return email.strip().lower()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == normalize_email(email)))


def create_user(db: Session, email: str, password: str) -> User:
    """
    Hash the password and insert the user. Commits, so callers get back a
    persisted row. May raise sqlalchemy.exc.IntegrityError if the email
    already exists (the unique index is the real guard, see the route).
    """
    user = User(email=normalize_email(email), hashed_password=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)  # reload server-generated fields (id, created_at)
    return user


# Hashed once at import. Used to burn the same amount of time when a login
# email does not exist (see authenticate_user).
_DUMMY_HASH = hash_password("not-a-real-password")


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """Return the user if credentials are valid, otherwise None."""
    user = get_user_by_email(db, email)
    if user is None:
        # Argon2 verification is deliberately slow. If we returned instantly
        # for unknown emails, response time would reveal which emails have
        # accounts (user enumeration). Verifying against a dummy hash makes
        # both failure paths take about the same time.
        verify_password(password, _DUMMY_HASH)
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
