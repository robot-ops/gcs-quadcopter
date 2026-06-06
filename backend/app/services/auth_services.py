from datetime import datetime
from datetime import timedelta

from fastapi import HTTPException
from fastapi import status

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.role import Role
from app.models.refresh_token import RefreshToken

from app.schemas.auth import RegisterRequest
from app.schemas.auth import LoginRequest

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token
)

from app.core.config import settings


class AuthService:

    @staticmethod
    def register(
        db: Session,
        payload: RegisterRequest
    ):

        user_exists = (
            db.query(User)
            .filter(
                User.username == payload.username
            )
            .first()
        )

        if user_exists:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )

        email_exists = (
            db.query(User)
            .filter(
                User.email == payload.email
            )
            .first()
        )

        if email_exists:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )

        role = (
            db.query(Role)
            .filter(
                Role.name == payload.role.upper()
            )
            .first()
        )

        if not role:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role not found"
            )

        user = User(
            username=payload.username,
            email=payload.email,
            password_hash=hash_password(
                payload.password
            ),
            role_id=role.id
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        return user

    @staticmethod
    def login(
        db: Session,
        payload: LoginRequest
    ):

        user = (
            db.query(User)
            .filter(
                User.username == payload.username
            )
            .first()
        )

        if not user:

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        if not verify_password(
            payload.password,
            user.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        access_token = create_access_token(
            {
                "sub": str(user.id)
            }
        )

        refresh_token = create_refresh_token(
            {
                "sub": str(user.id)
            }
        )

        db_token = RefreshToken(
            user_id=user.id,
            token=refresh_token,
            expires_at=datetime.utcnow()
            + timedelta(
                days=settings.REFRESH_TOKEN_EXPIRE_DAYS
            )
        )

        db.add(db_token)
        db.commit()

        return {
            "access_token": access_token,
            "refresh_token": refresh_token
        }

    @staticmethod
    def refresh(
        db: Session,
        token: str
    ):

        payload = decode_token(token)

        if not payload:

            raise HTTPException(
                status_code=401,
                detail="Invalid refresh token"
            )

        if payload.get("type") != "refresh":

            raise HTTPException(
                status_code=401,
                detail="Invalid token type"
            )

        db_token = (
            db.query(RefreshToken)
            .filter(
                RefreshToken.token == token,
                RefreshToken.is_revoked == False
            )
            .first()
        )

        if not db_token:

            raise HTTPException(
                status_code=401,
                detail="Refresh token revoked"
            )

        user_id = payload.get("sub")

        access_token = create_access_token(
            {
                "sub": str(user_id)
            }
        )

        return {
            "access_token": access_token,
            "refresh_token": token
        }

    @staticmethod
    def logout(
        db: Session,
        refresh_token: str
    ):

        token = (
            db.query(RefreshToken)
            .filter(
                RefreshToken.token
                == refresh_token
            )
            .first()
        )

        if token:

            token.is_revoked = True

            db.commit()

        return True