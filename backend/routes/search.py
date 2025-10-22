from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional

from utils import get_db
from verify_token import get_current_user

router = APIRouter()

@router.get("/items")
def search_items(
    q: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    parent_id: Optional[int] = None,
):
    """
    Dynamic search across folders and files for the current user.
    - No pagination.
    - Does not change existing logic; new read-only endpoint.
    - Filters out deleted files.
    - If parent_id is provided, narrows results to that folder scope.
    """
    if not q or not q.strip():
        raise HTTPException(status_code=400, detail="Query 'q' is required")

    user_id = current_user["user_id"]
    like_q = f"%{q.strip()}%"

    params = {"user_id": user_id, "q": like_q}

    if parent_id is not None:
        params["parent_id"] = parent_id
        folders_sql = text(
            """
            SELECT folder_id, folder_name, parent_id, user_id, created_at, updated_at
            FROM folders
            WHERE user_id = :user_id
              AND parent_id = :parent_id
              AND LOWER(folder_name) LIKE LOWER(:q)
            ORDER BY updated_at DESC
            """
        )
        files_sql = text(
            """
            SELECT file_id, file_name, parent_id, user_id, file_size, created_at, updated_at
            FROM files
            WHERE user_id = :user_id
              AND status != 'deleted'
              AND parent_id = :parent_id
              AND LOWER(file_name) LIKE LOWER(:q)
            ORDER BY updated_at DESC
            """
        )
    else:
        folders_sql = text(
            """
            SELECT folder_id, folder_name, parent_id, user_id, created_at, updated_at
            FROM folders
            WHERE user_id = :user_id
              AND LOWER(folder_name) LIKE LOWER(:q)
            ORDER BY updated_at DESC
            """
        )
        files_sql = text(
            """
            SELECT file_id, file_name, parent_id, user_id, file_size, created_at, updated_at
            FROM files
            WHERE user_id = :user_id
              AND status != 'deleted'
              AND LOWER(file_name) LIKE LOWER(:q)
            ORDER BY updated_at DESC
            """
        )

    folders = db.execute(folders_sql, params).fetchall()
    files = db.execute(files_sql, params).fetchall()

    return {
        "folders": [dict(r._mapping) for r in folders],
        "files": [dict(r._mapping) for r in files],
    }
