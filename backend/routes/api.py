from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from utils import get_db
from verify_token import get_current_user

router = APIRouter()

 

@router.post("/star")
def star_item(file_id: int | None = None, folder_id: int | None = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    if not file_id and not folder_id:
        raise HTTPException(status_code=400, detail="file_id or folder_id required")
    if file_id and folder_id:
        raise HTTPException(status_code=400, detail="Provide only one of file_id or folder_id")
    try:
        db.execute(text(
            """
            INSERT OR IGNORE INTO starred(user_id, file_id, folder_id, created_at)
            VALUES (:uid, :fid, :folid, CURRENT_TIMESTAMP)
            """
        ), {"uid": user_id, "fid": file_id, "folid": folder_id})
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to star item")
    return {"status": "ok"}

@router.delete("/star")
def unstar_item(file_id: int | None = None, folder_id: int | None = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    if not file_id and not folder_id:
        raise HTTPException(status_code=400, detail="file_id or folder_id required")
    if file_id and folder_id:
        raise HTTPException(status_code=400, detail="Provide only one of file_id or folder_id")
    try:
        if file_id:
            db.execute(text("DELETE FROM starred WHERE user_id = :uid AND file_id = :fid"), {"uid": user_id, "fid": file_id})
        else:
            db.execute(text("DELETE FROM starred WHERE user_id = :uid AND folder_id = :folid"), {"uid": user_id, "folid": folder_id})
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to unstar item")
    return {"status": "ok"}

@router.get("/starred")
def get_starred(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    files = db.execute(text(
        """
        SELECT s.id, s.file_id, f.file_name, f.parent_id, f.updated_at
        FROM starred s
        JOIN files f ON f.file_id = s.file_id
        WHERE s.user_id = :uid AND s.file_id IS NOT NULL
        """
    ), {"uid": user_id}).fetchall()
    folders = db.execute(text(
        """
        SELECT s.id, s.folder_id, d.folder_name, d.parent_id, d.updated_at
        FROM starred s
        JOIN folders d ON d.folder_id = s.folder_id
        WHERE s.user_id = :uid AND s.folder_id IS NOT NULL
        """
    ), {"uid": user_id}).fetchall()
    return {
        "files": [dict(r._mapping) for r in files],
        "folders": [dict(r._mapping) for r in folders],
    }
