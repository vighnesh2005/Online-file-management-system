from sqlalchemy import text
from datetime import datetime

def get_user_by_username(conn, username: str):
    q = text("SELECT user_id, username, password, email, profile, storage FROM users WHERE username = :username")
    res = conn.execute(q, {"username": username}).fetchone()
    return res

def get_user_by_id(conn, user_id: int):
    q = text("SELECT user_id, username, password, email, profile, storage FROM users WHERE user_id = :user_id")
    return conn.execute(q, {"user_id": user_id}).fetchone()

def create_user(conn, username: str, hashed_password: str, email: str, profile: str = "", storage: int = 0):
    q = text("""
        INSERT INTO users (username, password, email, profile, storage, created_at)
        VALUES (:username, :password, :email, :profile, :storage,:created_at)
    """)
    conn.execute(q, {"username": username, "password": hashed_password, "email": email, "profile": profile, "storage": storage, "created_at": datetime.now()})