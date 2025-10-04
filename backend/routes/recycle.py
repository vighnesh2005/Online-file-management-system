from fastapi import APIRouter, Depends,HTTPException,Form,File,UploadFile
from utils import get_db
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
        SET status = 'not_deleted'
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

    return {'message':'Files restored successfully'}


#permanantly delete files
@router.delete('/permanent_delete')
def permanent_delete(db: Session = Depends(get_db) , current_user = Depends(get_current_user),file_ids: list[int] = Form(None)):
    user_id = current_user["user_id"]

    if(file_ids is None):
        raise HTTPException(status_code=400, detail="No files selected")

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

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error deleting files")
    
    db.commit()

    return {'message':'Files permanently deleted successfully'}


