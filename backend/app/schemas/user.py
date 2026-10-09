"""
Pydantic schemas for User. These define API request/response SHAPES, kept
deliberately separate from app.db.models.User (the SQLAlchemy table).

Why separate: the DB model has `hashed_password`, an internal detail that
should never be sent back to a client. Schemas let us be explicit about
exactly what goes in and out of the API, independent of what's stored.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    """What /auth/register expects in the request body."""

    email: EmailStr
    # min_length here is a first line of defense (reject obviously-too-short
    # passwords before we even try to hash them). It's not a substitute for
    # good password practices, just prevents empty/trivial submissions.
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    """
    What we send back after register/login. Deliberately excludes
    hashed_password, there is no field for it here at all, so it's
    structurally impossible to accidentally leak it through this schema.
    """

    id: int
    email: EmailStr
    created_at: datetime

    # This tells Pydantic it's allowed to build this schema FROM an
    # attribute-based object (like a SQLAlchemy model instance), not just
    # from a dict. Without this, UserOut.model_validate(some_user_object)
    # would fail, since SQLAlchemy objects aren't dicts.
    model_config = ConfigDict(from_attributes=True)
