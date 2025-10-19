import jwt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException, status
from passlib.context import CryptContext
from database import engine
from sqlalchemy import text
from dotenv import load_dotenv
import os

load_dotenv()
# ---------- Config ----------
JWT_SECRET = os.getenv("JWT_SECRET") # use env var in production
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    token = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token

def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def get_db():
    try:
        db = engine.connect()
        yield db
    finally:
        db.close()

def check_permission(db, user_id: int, folder_id: int = None, file_id: int = None, operation: str = 'view'):
    # Check for file permissions
    if file_id:
        owner = db.execute(
            text("SELECT user_id, parent_id FROM files WHERE file_id = :file_id"),
            {"file_id": file_id}
        ).fetchone()
        import logging
        logger = logging.getLogger("uvicorn.error") 
        
        logger.info(f"File ID: {file_id}")
        logger.info(f"Owner row: {owner}")
        logger.info(f"User ID: {user_id}")

        if owner is None:
            return False  # file doesn't exist

        if str(owner[0]) == str(user_id):
            return True  # user owns the file


        # Check public share
        public = db.execute(
            text("SELECT is_public FROM shares WHERE file_id = :file_id AND is_public = 1"),
            {"file_id": file_id}
        ).fetchone()
        if public and operation == 'view':
            return True

        # Check explicit user share
        shares = db.execute(
            text("""
                SELECT s.permission
                FROM shares s
                JOIN share_access sa ON s.share_id = sa.share_id
                WHERE sa.user_id = :user_id AND s.file_id = :file_id
            """),
            {"user_id": user_id, "file_id": file_id}
        ).fetchone()
        if shares:
            if operation == "view" and shares.permission in ("view", "edit"):
                return True
            if operation == "edit" and shares.permission == "edit":
                return True

        # Check parent folder recursively
        if owner[1] not in (0, None):
            return check_permission(db, user_id, folder_id=owner[1], operation=operation)

        return False

    # Check for folder permissions
    else:
        owner = db.execute(
            text("SELECT user_id, parent_id FROM folders WHERE folder_id = :folder_id"),
            {"folder_id": folder_id}
        ).fetchone()

        if owner is None:
            return False  # folder doesn't exist

        if owner[0] == user_id:
            return True  
        

        # Check public share
        public = db.execute(
            text("SELECT is_public FROM shares WHERE folder_id = :folder_id AND is_public = 1"),
            {"folder_id": folder_id}
        ).fetchone()
        if public and operation == 'view':
            return True

        # Check explicit user share
        shares = db.execute(
            text("""
                SELECT s.permission
                FROM shares s
                JOIN share_access sa ON s.share_id = sa.share_id
                WHERE sa.user_id = :user_id AND s.folder_id = :folder_id
            """),
            {"user_id": user_id, "folder_id": folder_id}
        ).fetchone()
        if shares:
            if operation == "view" and shares.permission in ("view", "edit"):
                return True
            if operation == "edit" and shares.permission == "edit":
                return True

        if owner[1] not in (0, None):
            return check_permission(db, user_id, folder_id=owner[1], operation=operation)

        return False


def log_action(db, user_id: int, action: str, resource_type: str = None, resource_id: int = None, details: str = None, ip_address: str = None):
    """Insert a log entry into activity_logs.
    Expects an open DB connection from get_db().
    """
    db.execute(text(
        """
        INSERT INTO activity_logs (user_id, action, resource_type, resource_id, details, ip_address, created_at)
        VALUES (:user_id, :action, :resource_type, :resource_id, :details, :ip_address, :created_at)
        """
    ), {
        "user_id": user_id,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "details": details,
        "ip_address": ip_address,
        "created_at": datetime.now()
    })

def get_owner_user_id(db, resource_type: str, resource_id: int) -> int | None:
    """Return owner user_id for a given resource (file/folder)."""
    if resource_type == "file":
        row = db.execute(text("SELECT user_id FROM files WHERE file_id = :id"), {"id": resource_id}).fetchone()
        return row.user_id if row else None
    if resource_type == "folder":
        row = db.execute(text("SELECT user_id FROM folders WHERE folder_id = :id"), {"id": resource_id}).fetchone()
        return row.user_id if row else None
    return None

def log_action_for_owner(
    db,
    actor_user_id: int,
    action: str,
    resource_type: str,
    resource_id: int,
    details: str | None = None,
    ip_address: str | None = None,
):
    """Resolve resource owner and store the log under owner's user_id.
    The actor is appended to details for auditing.
    """
    owner_user_id = get_owner_user_id(db, resource_type, resource_id)
    # Fallback: if owner not found, attribute to actor
    target_user_id = owner_user_id if owner_user_id is not None else actor_user_id
    # Fetch actor email for better audit visibility
    actor_email_row = db.execute(text("SELECT email FROM users WHERE user_id = :uid"), {"uid": actor_user_id}).fetchone()
    actor_email = actor_email_row.email if actor_email_row else None
    extra = f" | actor_id={actor_user_id}"
    if actor_email:
        extra += f" actor_email={actor_email}"
    detail_text = (details or "") + extra
    log_action(
        db,
        user_id=target_user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=detail_text,
        ip_address=ip_address,
    )