from fastapi import APIRouter, Depends,HTTPException,Form,File,UploadFile
from utils import get_db,check_permission, log_action_for_owner
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
        'is_public': is_public,
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
    # Log share creation (attribute to resource owner)
    try:
        rtype = 'file' if file_id else 'folder'
        rid = file_id if file_id else folder_id
        detail = f"permission={permission} is_public={is_public} emails={','.join(emails) if emails else ''} token={token}"
        log_action_for_owner(db, actor_user_id=user_id, action="create_share", resource_type=rtype, resource_id=rid, details=detail)
        db.commit()
    except Exception:
        pass

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

@router.get('/get_shares')
def get_shares(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user) , token: str = None):
    user_id = current_user["user_id"]

    share = db.execute(text(
        '''
            SELECT file_id,folder_id FROM shares WHERE token = :token
        '''
    ),{
        "token": token
    }).fetchone()

    if not share:
        raise HTTPException(status_code=404, detail="Invalid token")

    files, folders = [],[]
    if share.file_id:
        result = db.execute(text(
            '''
                SELECT file_id,file_name FROM files WHERE file_id = :file_id
            '''
        ),{
            "file_id": share.file_id
        })

        files = [dict(row._mapping) for row in result]
    else:
        result = db.execute(text(
            '''
                SELECT folder_id,folder_name FROM folders WHERE folder_id = :folder_id
            '''
        ),{
            "folder_id": share.folder_id
        })

        folders = [dict(row._mapping) for row in result]

    return {"files": files, "folders": folders}

@router.put('/update_shares')
def update_shares(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user),
                  share_id:int = Form(None), is_public: bool = Form(False), permission: str = Form(None),
                  emails: list[str] = Form([])):
    user_id = current_user["user_id"]

    share = db.execute(text('''
        SELECT s.share_id, s.folder_id, s.file_id,
            COALESCE(f.user_id, fi.user_id) AS owner_id
        FROM shares s
        LEFT JOIN folders f ON s.folder_id = f.folder_id
        LEFT JOIN files fi ON s.file_id = fi.file_id
        WHERE s.share_id = :share_id
        '''), 
        {"share_id": share_id}).fetchone()
    
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    if share.owner_id != user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to update this share")

    update_query = '''
        UPDATE shares 
        SET updated_at = :updatedat    
    '''

    params = {
        'updatedat': datetime.now(),
        'share_id': share_id
    }

    if permission is not None:
        update_query += ',permission = :permission'
        params['permission'] = permission

    if is_public is not None:
        update_query += ',is_public = :is_public'
        params['is_public'] = is_public

    update_query += ' WHERE share_id = :share_id'
    db.execute(text(update_query), params)

    if emails:
        db.execute(text('''
            DELETE FROM share_access WHERE share_id = :share_id
        '''),{
            "share_id": share_id
        })

        for email in emails:
            user = db.execute(text('SELECT user_id FROM users WHERE email = :email'), {"email": email}).fetchone()
            if not user:
                continue

            db.execute(text('''
                INSERT INTO share_access (share_id, user_id)
                VALUES (:share_id, :user_id)
            '''), {"share_id": share_id, "user_id": user.user_id})
        
    db.commit()
    # Log share update (attribute to resource owner)
    try:
        rtype = 'file' if share.file_id else 'folder'
        rid = share.file_id if share.file_id else share.folder_id
        detail = f"permission={permission} is_public={is_public} emails={','.join(emails) if emails else ''}"
        log_action_for_owner(db, actor_user_id=user_id, action="update_share", resource_type=rtype, resource_id=rid, details=detail)
        db.commit()
    except Exception:
        pass
    return {"message": "Share updated successfully"}
    
@router.delete('/delete_share')
def delete_share(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user), share_id:int = Form(None)):
    user_id = current_user["user_id"]

    share = db.execute(text('''
        SELECT s.share_id, s.folder_id, s.file_id,
            COALESCE(f.user_id, fi.user_id) AS owner_id
        FROM shares s
        LEFT JOIN folders f ON s.folder_id = f.folder_id
        LEFT JOIN files fi ON s.file_id = fi.file_id
        WHERE s.share_id = :share_id
        '''), 
        {"share_id": share_id}).fetchone()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    if share.owner_id != user_id:
        raise HTTPException(status_code=403, detail="You don't have permission to delete this share")
    
    db.execute(text(
        '''
            DELETE FROM share_access WHERE share_id = :share_id
        '''
    ),{
        "share_id": share_id
    })

    db.execute(text(
        '''
            DELETE FROM shares WHERE share_id = :share_id
        '''
    ),{
        "share_id": share_id
    })

    db.commit()
    # Log share delete (attribute to resource owner)
    try:
        rtype = 'file' if share.file_id else 'folder'
        rid = share.file_id if share.file_id else share.folder_id
        log_action_for_owner(db, actor_user_id=user_id, action="delete_share", resource_type=rtype, resource_id=rid)
        db.commit()
    except Exception:
        pass
    return {"message": "Share deleted successfully"}

@router.get('/shared_with_me')
def get_shared_with_me(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Get all files and folders shared with the current user"""
    user_id = current_user["user_id"]
    
    # Get shares where user has explicit access
    user_shares = db.execute(text('''
        SELECT s.share_id, s.file_id, s.folder_id, s.token, s.permission, s.is_public,
               s.created_at, s.updated_at
        FROM shares s
        INNER JOIN share_access sa ON s.share_id = sa.share_id
        WHERE sa.user_id = :user_id
    '''), {"user_id": user_id}).fetchall()
    
    files = []
    folders = []
    
    for share in user_shares:
        share_dict = dict(share._mapping)
        
        if share.file_id:
            # Get file details
            file_data = db.execute(text('''
                SELECT f.file_id, f.file_name, f.file_size, f.created_at, f.updated_at,
                       u.username as owner_name, u.email as owner_email
                FROM files f
                JOIN users u ON f.user_id = u.user_id
                WHERE f.file_id = :file_id AND f.status != 'deleted'
            '''), {"file_id": share.file_id}).fetchone()
            
            if file_data:
                file_dict = dict(file_data._mapping)
                file_dict['share_token'] = share.token
                file_dict['permission'] = share.permission
                file_dict['shared_at'] = share.created_at
                files.append(file_dict)
        
        elif share.folder_id:
            # Get folder details
            folder_data = db.execute(text('''
                SELECT f.folder_id, f.folder_name, f.created_at, f.updated_at,
                       u.username as owner_name, u.email as owner_email
                FROM folders f
                JOIN users u ON f.user_id = u.user_id
                WHERE f.folder_id = :folder_id
            '''), {"folder_id": share.folder_id}).fetchone()
            
            if folder_data:
                folder_dict = dict(folder_data._mapping)
                folder_dict['share_token'] = share.token
                folder_dict['permission'] = share.permission
                folder_dict['shared_at'] = share.created_at
                folders.append(folder_dict)
    
    return {"files": files, "folders": folders}