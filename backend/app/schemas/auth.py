from pydantic import BaseModel
from pydantic import EmailStr


class RegisterRequest(BaseModel):

    username: str

    email: EmailStr

    password: str

    role: str


class LoginRequest(BaseModel):

    username: str

    password: str


class RefreshRequest(BaseModel):

    refresh_token: str


class TokenResponse(BaseModel):

    access_token: str

    refresh_token: str

    token_type: str = "bearer"


class UserResponse(BaseModel):

    id: int

    username: str

    email: str

    role: str