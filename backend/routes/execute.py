from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
import os
import base64
import requests

from utils import get_db, check_permission
from verify_token import get_current_user

router = APIRouter()

LANGUAGE_MAP = {
    "py": 71,
    "java": 62,
    "c": 50,
    "cpp": 54,
    "go": 60,
    "rb": 72,
    "php": 68,
    "sh": 46,
    "js": 63,
    "ts": 74,
}


def b64(s: str) -> str:
    if s is None:
        s = ""
    if isinstance(s, bytes):
        return base64.b64encode(s).decode("utf-8")
    return base64.b64encode(s.encode("utf-8", errors="ignore")).decode("utf-8")


@router.post("/run")
def run_code(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    file_id: int = Form(...),
    stdin: Optional[str] = Form("")
):
    user_id = current_user["user_id"]

    # Check permission to view the file (required to execute)
    if not check_permission(db, user_id, file_id=file_id, operation='view'):
        raise HTTPException(status_code=403, detail="You don't have permission to execute this file")

    # Get file path and name
    row = db.execute(text("SELECT file_path, file_name FROM files WHERE file_id = :fid"), {"fid": file_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = row.file_path
    file_name = row.file_name or ""
    ext = file_name.split(".")[-1].lower() if "." in file_name else ""

    language_id = LANGUAGE_MAP.get(ext)
    if language_id is None:
        raise HTTPException(status_code=400, detail=f"Unsupported language for extension: {ext}")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    # Read source code
    try:
        with open(file_path, "rb") as f:
            source_bytes = f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {e}")

    # Judge0 config
    base_url = os.getenv("JUDGE0_URL")
    api_key = os.getenv("JUDGE0_KEY")
    if not base_url:
        raise HTTPException(status_code=500, detail="Judge0 URL not configured on server")

    payload = {
        "language_id": language_id,
        "source_code": b64(source_bytes),
        "stdin": b64(stdin or ""),
    }

    headers = {"Content-Type": "application/json"}
    # Support both header names; downstream provider may use either
    if api_key:
        headers["X-Auth-Token"] = api_key
        headers["X-RapidAPI-Key"] = api_key

    try:
        resp = requests.post(
            url=f"{base_url.rstrip('/')}/submissions",
            params={"base64_encoded": "true", "wait": "true"},
            headers=headers,
            json=payload,
            timeout=30,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Judge0 request failed: {e}")

    if not resp.ok:
        try:
            data = resp.json()
        except Exception:
            data = {"detail": resp.text}
        raise HTTPException(status_code=resp.status_code, detail=data)

    data = resp.json()

    # Add decoded helpers for convenience
    def safe_decode(k):
        v = data.get(k)
        try:
            return base64.b64decode(v).decode("utf-8") if v else None
        except Exception:
            return None

    return {
        "status": data.get("status"),
        "time": data.get("time"),
        "memory": data.get("memory"),
        "stdout": data.get("stdout"),
        "stderr": data.get("stderr"),
        "compile_output": data.get("compile_output"),
        "decoded": {
            "stdout": safe_decode("stdout"),
            "stderr": safe_decode("stderr"),
            "compile_output": safe_decode("compile_output"),
        }
    }
