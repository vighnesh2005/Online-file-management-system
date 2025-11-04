from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from utils import get_db
from verify_token import get_current_user
from typing import Optional
from datetime import datetime
import io
import csv

router = APIRouter()

@router.get("/me")
def get_my_logs(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    """
    Get activity logs for the current user with optional filters.
    Filters: action, resource_type, start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)
    """
    user_id = current_user["user_id"]
    
    query = """
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
    """
    
    params = {
        "user_id": user_id,
        "limit": limit,
        "offset": offset
    }
    
    if action:
        query += " AND al.action = :action"
        params["action"] = action
    
    if resource_type:
        query += " AND al.resource_type = :resource_type"
        params["resource_type"] = resource_type
    
    if start_date:
        query += " AND date(al.created_at) >= date(:start_date)"
        params["start_date"] = start_date
    
    if end_date:
        query += " AND date(al.created_at) <= date(:end_date)"
        params["end_date"] = end_date
    
    query += " ORDER BY datetime(al.created_at) DESC LIMIT :limit OFFSET :offset"
    
    rows = db.execute(text(query), params).fetchall()
    logs = [dict(r._mapping) for r in rows]
    
    return {"logs": logs, "count": len(logs)}

@router.get("/me/export")
def export_logs_csv(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    """Export activity logs as CSV with optional filters"""
    user_id = current_user["user_id"]
    
    query = """
        SELECT al.log_id,
               u.username,
               al.action,
               al.resource_type,
               al.resource_id,
               al.details,
               al.created_at
        FROM activity_logs al
        JOIN users u ON u.user_id = al.user_id
        WHERE al.user_id = :user_id
    """
    
    params = {"user_id": user_id}
    
    if action:
        query += " AND al.action = :action"
        params["action"] = action
    
    if resource_type:
        query += " AND al.resource_type = :resource_type"
        params["resource_type"] = resource_type
    
    if start_date:
        query += " AND date(al.created_at) >= date(:start_date)"
        params["start_date"] = start_date
    
    if end_date:
        query += " AND date(al.created_at) <= date(:end_date)"
        params["end_date"] = end_date
    
    query += " ORDER BY datetime(al.created_at) DESC"
    
    rows = db.execute(text(query), params).fetchall()
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow(['Log ID', 'Username', 'Action', 'Resource Type', 'Resource ID', 'Details', 'Created At'])
    
    # Write data
    for row in rows:
        writer.writerow([
            row.log_id,
            row.username,
            row.action,
            row.resource_type,
            row.resource_id,
            row.details or '',
            row.created_at
        ])
    
    output.seek(0)
    
    filename = f"activity_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/me/security")
def get_security_highlights(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100)
):
    """Get security-relevant activity logs (destructive actions and share changes)"""
    user_id = current_user["user_id"]
    
    security_actions = [
        'delete_file', 'delete_folder', 'permanent_delete',
        'create_share', 'update_share', 'delete_share'
    ]
    
    # Create placeholders for IN clause
    placeholders = ','.join([f':action{i}' for i in range(len(security_actions))])
    params = {f'action{i}': action for i, action in enumerate(security_actions)}
    params['user_id'] = user_id
    params['limit'] = limit
    
    query = f"""
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
          AND al.action IN ({placeholders})
        ORDER BY datetime(al.created_at) DESC
        LIMIT :limit
    """
    
    rows = db.execute(text(query), params).fetchall()
    logs = [dict(r._mapping) for r in rows]
    
    return {"logs": logs, "count": len(logs)}
