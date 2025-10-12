from fastapi import APIRouter, Depends, Body, HTTPException, status
from pydantics import UserOut, TokenOut, LoginIn, SignupIn 
from database import engine, create_tables
from utils import hash_password, verify_password, create_access_token
from sqlalchemy import text
from db_helpers import create_user, get_user_by_username
from verify_token import get_current_user 
from sqlalchemy import text
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime

router = APIRouter()

@router.post("/signup", response_model=UserOut)
async def signup(data: SignupIn):
    with engine.connect() as conn:
        # check existing username or email
        q_user = text("SELECT user_id FROM users WHERE email = :email")
        existing = conn.execute(q_user, { "email": data.email}).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Username or email already exists")

        hashed = hash_password(data.password)
        create_user(conn, data.username, hashed, data.email, data.profile or "", data.storage or 0)
        conn.commit()

        # fetch the created user to return
        created = conn.execute(text("SELECT user_id, username, email, profile, storage FROM users WHERE username = :username"),
                               {"username": data.username}).fetchone()
        return {
            "user_id": created.user_id,
            "username": created.username,
            "email": created.email,
            "profile": created.profile,
            "storage": created.storage,
        }

@router.post("/login", response_model=TokenOut)
async def login(data: OAuth2PasswordRequestForm = Depends()): 
    with engine.connect() as conn:
        user = conn.execute(text(
            '''
            SELECT * FROM users WHERE email = :email
            '''
        ), dict(
            email=data.username   
        )   
        ).fetchone()

        if not user:
            raise HTTPException(status_code=401, detail="Incorrect username or password")
        
        if not verify_password(data.password, user.password):
            raise HTTPException(status_code=401, detail="Incorrect username or password")

        token = create_access_token({"user_id": user.user_id, "username": user.username})
        return {"access_token": token, "token_type": "bearer"}

@router.get("/me", response_model=UserOut)
async def read_me(current_user = Depends(get_current_user)):
    return current_user

