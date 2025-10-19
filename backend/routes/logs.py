from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
from utils import get_db
from verify_token import get_current_user

router = APIRouter()

@router.get("/me")
def get_my_logs(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    user_id = current_user["user_id"]
    rows = db.execute(text(
        """
        SELECT al.log_id,
               al.user_id,
               u.username AS username,
               al.action,
               al.resource_type,
               al.resource_id,
               al.details,
               al.created_at
        FROM activity_logs al
        JOIN users u ON u.user_id = al.user_id
        WHERE al.user_id = :user_id
        ORDER BY datetime(al.created_at) DESC
        LIMIT :limit OFFSET :offset
        """
    ), {
        "user_id": user_id,
        "limit": limit,
        "offset": offset
    }).fetchall()

    logs = [dict(r._mapping) for r in rows]
    return {"logs": logs, "count": len(logs)}
