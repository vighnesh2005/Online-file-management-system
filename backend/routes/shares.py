from fastapi import APIRouter, Depends,HTTPException,Form,File,UploadFile
from utils import get_db,check_permission
from verify_token import get_current_user
from sqlalchemy import text,bindparam
from datetime import datetime
from sqlalchemy.orm import Session
import os, shutil
import secrets

router = APIRouter()

# make share permissions
@router.post('/share_link')
def share(db: Session = Depends(get_db) , current_user = Depends(get_current_user),
          file_id: int = Form(None), folder_id: int = Form(None), emails: list[str] = Form([]),
          is_public: bool = Form(False), permission: str = Form(None)):
    
    user_id = current_user["user_id"]

    from utils import check_permission

    if file_id:
        if not check_permission(db, user_id, file_id=file_id, operation='edit'):
            raise HTTPException(status_code=403, detail="You don't have permission to share this file")
    elif folder_id:
        if not check_permission(db, user_id, folder_id=folder_id, operation='edit'):
            raise HTTPException(status_code=403, detail="You don't have permission to share this folder")
    else:
        raise HTTPException(status_code=400, detail="Provide file_id or folder_id")

    token = secrets.token_urlsafe(16)

    result = db.execute(text(
        '''
            INSERT INTO shares(folder_id,file_id,token,permission,created_at,updated_at,is_public)
            VALUES(:folder_id,:file_id,:token,:permission,:created_at,:updated_at,:is_public)
        '''
    ),{
        'folder_id': folder_id,
        'file_id': file_id,
        'token': token,
        'permission': permission,
        'created_at': datetime.now(),
        'updated_at': datetime.now(),
        'is_public': is_public
    })

    share_id = result.lastrowid

    if not is_public:
        for e in emails:
            user = db.execute(text(
                '''
                    SELECT user_id FROM users WHERE email = :email
                '''
            ),{
                'email': e
            }).fetchone()

            if not user:
                continue

            db.execute(text(
                '''
                    INSERT INTO share_access (share_id,user_id)
                    VALUES(:share_id,:user_id)
                ''' 
            ),{
                'share_id': share_id,
                'user_id': user.user_id
            })

    db.commit()

    return {
        'message':'Item shared successfully',
        'token':token,
        'is_public':is_public,
        'shared_with':emails
    }

#get details of the share
@router.get("/share_details")
def share_details(db: Session = Depends(get_db), file_id: int = None, folder_id: int = None):
    if not file_id and not folder_id:
        raise HTTPException(status_code=400, detail="Provide file_id or folder_id")

    query = "SELECT share_id, token, permission, created_at, updated_at, is_public, file_id, folder_id FROM shares WHERE 1=1"
    params = {}

    if file_id is not None:
        query += " AND file_id = :file_id"
        params["file_id"] = file_id

    if folder_id is not None:
        query += " AND folder_id = :folder_id"
        params["folder_id"] = folder_id

    shares = db.execute(text(query), params).fetchall()
    result = []

    for s in shares:
        share_dict = dict(s._mapping)

        if share_dict["is_public"]:
            share_dict["users"] = "Anyone with the link"
        else:
            users = db.execute(text("""
                SELECT u.user_id, u.username, u.email
                FROM share_access sa
                JOIN users u ON sa.user_id = u.user_id
                WHERE sa.share_id = :share_id
            """), {"share_id": share_dict["share_id"]}).fetchall()
            share_dict["users"] = [dict(u._mapping) for u in users]

        result.append(share_dict)

    return {"shares": result}



