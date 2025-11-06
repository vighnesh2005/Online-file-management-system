from fastapi import APIRouter, Depends,HTTPException,Form,File,UploadFile
from utils import get_db, log_action_for_owner
from verify_token import get_current_user
from sqlalchemy import text,bindparam
from datetime import datetime
from sqlalchemy.orm import Session
import os, shutil
 

router = APIRouter()

#check what files are in recycle bin
@router.get('/recyclebin')
def recyclebin(db: Session = Depends(get_db) , current_user = Depends(get_current_user)):
    user_id = current_user["user_id"]

    files = db.execute(text(
        '''
            SELECT file_id,file_name,file_path FROM files WHERE user_id = :user_id AND status = 'deleted'     
        '''
    ),{
        'user_id':user_id
    }).fetchall()

    files_list = [dict(row._mapping) for row in files]
    
    return {'files':files_list}

#restore files
@router.post('/restore')
def restore(db: Session = Depends(get_db) , current_user = Depends(get_current_user),file_ids: list[int] = Form(None)):
    user_id = current_user["user_id"]

    query = text(
        '''
        UPDATE files
        SET status = 'not_deleted', parent_id = 0
        WHERE file_id IN :file_ids AND user_id = :user_id
        '''
    ).bindparams(bindparam("file_ids", expanding=True), bindparam("user_id"))

    db.execute(
        query
    ,{
        'file_ids':file_ids,
        'user_id':user_id
    })    

    db.commit()
    # Log restore action (attribute to file owners)
    try:
        if file_ids:
            for fid in file_ids:
                log_action_for_owner(db, actor_user_id=user_id, action="restore_file", resource_type="file", resource_id=fid)
            db.commit()
    except Exception:
        pass

    

    return {'message':'Files restored successfully'}


#permanantly delete files
@router.post('/permanent_delete')
def permanent_delete(db: Session = Depends(get_db) , current_user = Depends(get_current_user),file_ids: list[int] = Form(None)):
    user_id = current_user["user_id"]

    if(file_ids is None):
        raise HTTPException(status_code=400, detail="No files selected")

    # Compute total size to decrement from user storage
    size_query = text(
        '''
        SELECT COALESCE(SUM(file_size), 0) FROM files
        WHERE file_id IN :file_ids AND user_id = :user_id
        '''
    ).bindparams(bindparam("file_ids", expanding=True), bindparam("user_id"))

    size_row = db.execute(
        size_query,
        {
            'file_ids': file_ids,
            'user_id': user_id
        }
    ).fetchone()
    total_size = int(size_row[0]) if size_row else 0

    query = text(
        '''
        SELECT file_path FROM files
        WHERE file_id IN :file_ids AND user_id = :user_id
        '''
    ).bindparams(bindparam("file_ids", expanding=True), bindparam("user_id"))

    results = db.execute(
        query
    ,{
        'file_ids':file_ids,
        'user_id':user_id
    }).fetchall()

    for file_path, in results:
        os.remove(file_path)

    try:
        query = text(
            '''
            DELETE FROM files
            WHERE file_id IN :file_ids AND user_id = :user_id
            '''
        ).bindparams(bindparam("file_ids", expanding=True), bindparam("user_id"))

        db.execute(
            query
        ,{
            'file_ids':file_ids,
            'user_id':user_id
        })

        if total_size > 0:
            db.execute(text(
                '''
                UPDATE users
                SET storage = CASE WHEN storage >= :dec THEN storage - :dec ELSE 0 END
                WHERE user_id = :user_id
                '''
            ), {
                'dec': total_size,
                'user_id': user_id
            })

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error deleting files")
    
    db.commit()
    # Log permanent delete (attribute to file owners)
    try:
        if file_ids:
            for fid in file_ids:
                log_action_for_owner(db, actor_user_id=user_id, action="permanent_delete", resource_type="file", resource_id=fid)
            db.commit()
    except Exception:
        pass

    

    return {'message':'Files permanently deleted successfully'}


