"""
Pydantic schemas for JWT tokens.
"""
from pydantic import BaseModel


class Token(BaseModel):
    """Schema for JWT access token response."""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Schema for JWT token payload data."""
    email: str | None = None
    doctor_id: int | None = None


class PasswordResetRequest(BaseModel):
    """Schema for password reset request."""
    email: str


class PasswordResetConfirm(BaseModel):
    """Schema for password reset confirmation."""
    token: str
    new_password: str
