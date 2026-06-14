"""Auth API router — registration, login, token refresh, and current user."""

from __future__ import annotations

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models.enums import UserRole
from app.models.organization import Organization
from app.models.user import User
from app.schemas import UserCreate, UserResponse
from app.security.auth import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.security.deps import get_current_user
from app.security.ratelimit import limiter

router = APIRouter(prefix="/api/auth", tags=["auth"])


class TokenResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"  # noqa: S105 — OAuth token type, not a secret


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(max_length=320)
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    refresh_token: str = Field(min_length=1, max_length=4096)


@router.post("/register", response_model=UserResponse, status_code=201)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def register(
    request: Request,
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Register a new user with email and password."""
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Each registration provisions a fresh tenant; the first user owns it.
    org_name = body.organization_name or f"{body.email.split('@')[0]}'s organization"
    org = Organization(name=org_name)
    db.add(org)
    await db.flush()

    user = User(
        organization_id=org.id,
        email=body.email,
        hashed_password=hash_password(body.password),
        role=UserRole.ADMIN,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate with email/password and receive access + refresh tokens."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    sub = {"sub": str(user.id)}
    return TokenResponse(
        access_token=create_access_token(data=sub),
        refresh_token=create_refresh_token(data=sub),
    )


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def refresh(
    request: Request,
    body: RefreshRequest,
) -> TokenResponse:
    """Exchange a valid refresh token for a new short-lived access token."""
    try:
        payload = decode_refresh_token(body.refresh_token)
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        ) from exc
    return TokenResponse(access_token=create_access_token(data={"sub": payload["sub"]}))


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> User:
    """Return the currently authenticated user's profile."""
    return current_user
