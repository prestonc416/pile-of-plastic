"""
Shared FastAPI dependencies. Routes declare what they need in their
signature and FastAPI supplies it.

    def my_route(db: DbSession, user: CurrentUser): ...
"""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.base import get_db
from app.db.models import User

# Reads the "Authorization: Bearer <token>" header. Also makes /docs show an
# Authorize button where you paste a token to test protected routes.
bearer_scheme = HTTPBearer()

# Annotated aliases so route signatures stay short.
DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: DbSession,
) -> User:
    """
    Turn a bearer token into a User row, or raise 401.

    Every failure (bad signature, expired, malformed subject, user deleted)
    returns the same error, so a caller learns nothing about why it failed.
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    subject = decode_access_token(credentials.credentials)
    if subject is None:
        raise unauthorized

    # The token's "sub" is the user's id as a string. Guard against a validly
    # signed token with a non-numeric subject instead of crashing with a 500.
    try:
        user_id = int(subject)
    except ValueError:
        raise unauthorized

    # Re-check the database on every request, so a deleted user's old token
    # stops working immediately.
    user = db.get(User, user_id)
    if user is None:
        raise unauthorized
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
