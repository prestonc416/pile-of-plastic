"""Pydantic schemas for auth: the login request body and the token response."""
 
from pydantic import BaseModel, EmailStr, Field
 
 
class UserLogin(BaseModel):
    """
    What /auth/login expects as a JSON body.
 
    No min_length on the password on purpose: login should answer every
    wrong credential with the same generic error, not leak password rules.
    max_length still caps it so nobody can make the server hash a giant string.
    """
 
    email: EmailStr
    password: str = Field(max_length=128)
 
 
class Token(BaseModel):
    access_token: str
    # "bearer" is the standard OAuth2 convention for how the client should
    # present this token, in an Authorization: Bearer <token> header.
    # Hardcoded as a default since we only support one token type.
    token_type: str = "bearer"
