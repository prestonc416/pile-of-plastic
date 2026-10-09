"""Auth endpoints: register, login, and a protected /me to prove tokens work."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, DbSession
from app.core.security import create_access_token
from app.schemas.auth import Token, UserLogin
from app.schemas.user import UserCreate, UserOut
from app.services.user import authenticate_user, create_user, get_user_by_email

router = APIRouter()


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: DbSession):
    """
    Create an account. response_model=UserOut means FastAPI filters the
    returned User through that schema, so hashed_password cannot leak even
    though the object we return has it.
    """
    email_taken = HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="An account with this email already exists",
    )

    # Friendly early check for the common case...
    if get_user_by_email(db, payload.email) is not None:
        raise email_taken

    # ...but two simultaneous requests can both pass that check. The unique
    # index in Postgres is the real guard, so handle its error too.
    try:
        return create_user(db, payload.email, payload.password)
    except IntegrityError:
        db.rollback()
        raise email_taken


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: DbSession):
    """Exchange email + password for a JWT."""
    user = authenticate_user(db, payload.email, payload.password)
    if user is None:
        # Same message whether the email or the password was wrong.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # The subject is the user's id (stable), not the email (can change).
    return Token(access_token=create_access_token(subject=str(user.id)))


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: CurrentUser):
    """Protected route: only works with a valid bearer token."""
    return current_user
