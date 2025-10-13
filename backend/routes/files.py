from fastapi import APIRouter, Depends,HTTPException,Form,File,UploadFile
from utils import get_db,check_permission
from verify_token import get_current_user
from sqlalchemy import text,bindparam
from datetime import datetime
from sqlalchemy.orm import Session
import os, shutil
from fastapi.responses import FileResponse
from urllib.parse import quote


router = APIRouter()    

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post('/upload_file')
def upload_file(db: Session = Depends(get_db) , current_user: dict = Depends(get_current_user),file: UploadFile = File(...),parent_id: int = Form(None)):
    user_id = current_user["user_id"]
    #check for permission of the user

    perm = check_permission(db,user_id,folder_id=parent_id,operation='edit')
    if not perm and parent_id != 0:
        raise HTTPException(status_code=400, detail="You don't have permission to access this folder")
    
    USER_DIR =os.path.join(UPLOAD_DIR, f'user_{user_id}')

    result = db.execute(text(
        '''
            SELECT file_name FROM files WHERE file_name = :file_name AND parent_id = :parent_id 
        '''
    ),
    {
        'file_name': file.filename,
        'parent_id': parent_id
    }).fetchone()
    if result :
        raise HTTPException(status_code=400, detail="File already exists")
    

    os.makedirs(USER_DIR, exist_ok=True)

    
    result = db.execute(text(
        '''
            INSERT INTO FILES (file_name,parent_id,user_id,created_at,updated_at,status) 
            VALUES(:file_name,:parent_id,:user_id,:created_at,:updated_at,'not_deleted')
            RETURNING file_id
        '''
    ),{
        "file_name": file.filename,
        "parent_id": parent_id,
        "user_id": user_id,
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }).fetchone()

    file_path = os.path.join(USER_DIR,f'{result[0]}_{file.filename}')

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = os.path.getsize(file_path)

    db.execute(text(
        '''
            UPDATE files SET file_size = :file_size,file_path = :file_path, updated_at = :updated_at 
            WHERE file_id = :file_id
        '''
    ),{
        "file_id": result[0],
        "file_size": file_size,
        "updated_at": datetime.now(),
        "file_path": file_path
    })

    db.execute(text(
        '''
            UPDATE users SET storage = storage + :file_size WHERE user_id = :user_id 
        '''
    ),{
        "file_size": file_size,
        "user_id": user_id
    })

    db.commit()
    new_file = db.execute(text(
        '''
            SELECT * FROM files WHERE file_id = :file_id
        '''
    ),{
        "file_id": result[0]
    }).fetchone()

    return {"message": "File uploaded successfully","file": dict(new_file._mapping)}

@router.get('/download_file/{file_id}')
def download_file(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    file_id: int = None
):
    user_id = current_user["user_id"]

    # Check permission
    perm = check_permission(db, user_id, file_id=file_id, operation='view')
    if not perm:
        raise HTTPException(status_code=403, detail="You don't have permission")

    # Fetch file
    file = db.execute(
        text("SELECT file_path, file_name FROM files WHERE file_id = :file_id "),
        {"file_id": file_id}
    ).fetchone()

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = os.path.abspath(file.file_path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    # Use quote to handle special characters in filename
    safe_filename = quote(file.file_name)

    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{safe_filename}"
    }

    return FileResponse(
        path=file_path,
        media_type="application/octet-stream",
        headers=headers
    )
@router.get('/file_metadata')
def file_metadata(db: Session = Depends(get_db) , current_user = Depends(get_current_user),file_id: int = None):
    user_id = current_user["user_id"]

    perm = check_permission(db,user_id,file_id=file_id,operation='view')
    if not perm:
        raise HTTPException(status_code=400, detail="You don't have permission to access this folder")

    result = db.execute(text(
        '''
            SELECT file_name,file_size,created_at,updated_at FROM files WHERE file_id = :file_id AND status != 'deleted'
        '''
    ),{
        "file_id": file_id
    }).fetchone()

    if not result:
        raise HTTPException(status_code=400, detail="File not found")
    
    return {"file_name": result[0],"file_size": result[1],"created_at": result[2],"updated_at": result[3]}

@router.put('/rename_file')
def rename_file(db: Session = Depends(get_db) , current_user = Depends(get_current_user),file_id: int = Form(...),file_name: str = Form(...)):
    user_id = current_user['user_id']

    #check for permission of the user
    perm = check_permission(db,user_id,file_id=file_id,operation='edit')
    if not perm:
        raise HTTPException(status_code=400, detail="You don't have permission to access this folder")

    parent_id = db.execute(text(
        '''
            SELECT parent_id FROM files WHERE file_id = :file_id
        '''
    ),{
        'file_id':file_id
    }).fetchone()

    result = db.execute(text(
        '''
            SELECT * FROM files WHERE parent_id = :parent_id AND file_name = :file_name
        '''
    ),{
        "parent_id": parent_id[0],
        "file_name": file_name
    }).fetchone()

    if result:
        raise HTTPException(status_code=400, detail="File already exists")

    db.execute(text(
        '''
            UPDATE files SET file_name = :file_name, updated_at = :updated_at 
            WHERE file_id = :file_id
        '''
    ),{
        "file_id": file_id,
        "file_name": file_name,
        "updated_at": datetime.now()
    })

    db.commit()

    return {"file_id": file_id}
