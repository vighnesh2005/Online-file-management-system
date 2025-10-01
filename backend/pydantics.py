from typing import Optional
from pydantic import BaseModel, EmailStr

class SignupIn(BaseModel):
    username: str
    password: str
    email: EmailStr
    profile: Optional[str] = ""
    storage: Optional[int] = 0

class LoginIn(BaseModel):
    username: str
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    user_id: int
    username: str
    email: EmailStr
    profile: Optional[str] = ""
    storage: Optional[int] = 0