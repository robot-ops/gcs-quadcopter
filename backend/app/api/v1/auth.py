from fastapi import APIRouter
from fastapi import Depends

from sqlalchemy.orm import Session

from app.database.database import get_db

from app.schemas.auth import (RegisterRequest,LoginRequest,RefreshRequest,UserResponse)
from app.services.auth_services import (AuthService)
from app.core.dependencies import (get_current_user)

from fastapi.security import OAuth2PasswordRequestForm

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentication"]
)


@router.post("/register")
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db)
):

    user = AuthService.register(
        db,
        payload
    )

    return {
        "id": user.id,
        "username": user.username
    }


@router.post("/login")
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db)
):

    return AuthService.login(
        db,
        payload
    )


@router.post("/refresh")
def refresh(
    payload: RefreshRequest,
    db: Session = Depends(get_db)
):

    return AuthService.refresh(
        db,
        payload.refresh_token
    )


@router.post("/logout")
def logout(
    payload: RefreshRequest,
    db: Session = Depends(get_db)
):

    AuthService.logout(
        db,
        payload.refresh_token
    )

    return {
        "message": "Logout success"
    }


@router.get("/me")
def me(
    current_user=Depends(
        get_current_user
    )
):

    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role.name
    )
    
@router.post("/token")
def token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):

    payload = LoginRequest(
        username=form_data.username,
        password=form_data.password
    )

    return AuthService.login(
        db,
        payload
    )