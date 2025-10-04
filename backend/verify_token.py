from fastapi.security import OAuth2PasswordBearer
from utils import decode_access_token
from fastapi import Depends, HTTPException
from database import engine
from db_helpers import get_user_by_id

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")  # token endpoint name (we'll use /login instead)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_access_token(token)
    user_id = payload.get("user_id")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    with engine.connect() as conn:
        user = get_user_by_id(conn, user_id)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        # return a dict-like object
        return {
            "user_id": user.user_id,
            "username": user.username,
            "email": user.email,
            "profile": user.profile,
            "storage": user.storage
        }
