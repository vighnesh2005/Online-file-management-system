from fastapi import APIRouter, Depends,HTTPException,Form,File,UploadFile
from utils import get_db,check_permission, log_action_for_owner
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
STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024

@router.post('/upload_file')
def upload_file(db: Session = Depends(get_db) , current_user: dict = Depends(get_current_user),file: UploadFile = File(...),parent_id: int = Form(None)):
    user_id = current_user["user_id"]
    #check for permission of the user

    perm = check_permission(db,user_id,folder_id=parent_id,operation='edit')
    if not perm and parent_id != 0:
        raise HTTPException(status_code=400, detail="You don't have permission to access this folder")
    
    # Normalize root folder: store NULL in DB instead of 0 to satisfy FK constraints
    normalized_parent_id = 0 if parent_id in (0, None) else parent_id
    
    USER_DIR =os.path.join(UPLOAD_DIR, f'user_{user_id}')

    existing = db.execute(text(
        '''
            SELECT file_name FROM files 
            WHERE file_name = :file_name 
              AND ( (:parent_id IS NULL AND parent_id IS NULL) OR parent_id = :parent_id )
        '''
    ),
    {
        'file_name': file.filename,
        'parent_id': normalized_parent_id
    }).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="File already exists")

    os.makedirs(USER_DIR, exist_ok=True)

    temp_path = os.path.join(USER_DIR, f'temp_{datetime.now().timestamp()}_{file.filename}')
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_size = os.path.getsize(temp_path)

        current_storage_row = db.execute(text('SELECT storage FROM users WHERE user_id = :user_id'), {"user_id": user_id}).fetchone()
        current_storage = int(current_storage_row[0]) if current_storage_row else 0
        if current_storage + file_size > STORAGE_LIMIT_BYTES:
            try:
                os.remove(temp_path)
            except Exception:
                pass
            raise HTTPException(status_code=413, detail="Storage limit exceeded (10GB)")

        inserted = db.execute(text(
            '''
                INSERT INTO FILES (file_name,parent_id,user_id,created_at,updated_at,status) 
                VALUES(:file_name,:parent_id,:user_id,:created_at,:updated_at,'not_deleted')
                RETURNING file_id
            '''
        ),{
            "file_name": file.filename,
            "parent_id": normalized_parent_id,
            "user_id": user_id,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }).fetchone()

        file_id = inserted[0]
        final_path = os.path.join(USER_DIR,f'{file_id}_{file.filename}')
        db.execute(text(
            '''
                UPDATE files SET file_size = :file_size,file_path = :file_path, updated_at = :updated_at 
                WHERE file_id = :file_id
            '''
        ),{
            "file_id": file_id,
            "file_size": file_size,
            "updated_at": datetime.now(),
            "file_path": final_path
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
        os.replace(temp_path, final_path)

        new_file = db.execute(text(
            '''
                SELECT * FROM files WHERE file_id = :file_id
            '''
        ),{
            "file_id": file_id
        }).fetchone()

        try:
            log_action_for_owner(db, actor_user_id=user_id, action="upload", resource_type="file", resource_id=file_id, details=file.filename)
            db.commit()
        except Exception:
            pass

        return {"message": "File uploaded successfully","file": dict(new_file._mapping)}
    except HTTPException:
        raise
    except Exception as e:
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

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

    # Log download action (attribute to file owner)
    try:
        log_action_for_owner(db, actor_user_id=user_id, action="download", resource_type="file", resource_id=file_id, details=file.file_name)
        db.commit()
    except Exception:
        pass

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

    # Log file rename (attribute to file owner)
    try:
        log_action_for_owner(db, actor_user_id=user_id, action="rename_file", resource_type="file", resource_id=file_id, details=file_name)
        db.commit()
    except Exception:
        pass

    return {"file_id": file_id}

@router.put('/replace_file')
def replace_file(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    file_id: int = Form(...),
    file: UploadFile = File(...)
):
    user_id = current_user['user_id']

    # --- Check permission ---
    perm = check_permission(db, user_id, file_id=file_id, operation='edit')
    if not perm:
        raise HTTPException(status_code=403, detail="You don't have permission to edit this file")

    # --- Fetch old file record ---
    old_file = db.execute(text('''
        SELECT file_id, file_name, file_path, file_size, user_id
        FROM files WHERE file_id = :file_id
    '''), {"file_id": file_id}).fetchone()

    if not old_file:
        raise HTTPException(status_code=404, detail="File not found")

    old_file = dict(old_file._mapping)
    USER_DIR = os.path.join(UPLOAD_DIR, f'user_{old_file["user_id"]}')
    os.makedirs(USER_DIR, exist_ok=True)

    # Paths
    temp_new_path = os.path.join(USER_DIR, f'temp_{file_id}_{file.filename}')
    final_new_path = os.path.join(USER_DIR, f'{file_id}_{file.filename}')

    # ---  Write new file to TEMP location ---
    try:
        with open(temp_new_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

    new_file_size = os.path.getsize(temp_new_path)

    current_storage_row = db.execute(text('SELECT storage FROM users WHERE user_id = :user_id'), {"user_id": user_id}).fetchone()
    current_storage = int(current_storage_row[0]) if current_storage_row else 0
    projected_total = current_storage - int(old_file["file_size"] or 0) + new_file_size
    if projected_total > STORAGE_LIMIT_BYTES:
        try:
            os.remove(temp_new_path)
        except Exception:
            pass
        raise HTTPException(status_code=413, detail="Storage limit exceeded (10GB)")

    # ---  Start transactional logic ---
    try:
        # a. Update DB record
        db.execute(text('''
            UPDATE files 
            SET file_name = :file_name,
                file_path = :file_path,
                file_size = :file_size,
                updated_at = :updated_at
            WHERE file_id = :file_id
        '''), {
            "file_id": file_id,
            "file_name": file.filename,
            "file_path": final_new_path,
            "file_size": new_file_size,
            "updated_at": datetime.now()
        })

        # b. Adjust user storage
        size_diff = new_file_size - old_file["file_size"]
        db.execute(text('''
            UPDATE users SET storage = storage + :diff WHERE user_id = :user_id
        '''), {
            "diff": size_diff,
            "user_id": user_id
        })

        # --- Commit DB transaction ---
        db.commit()

        # Move temp → final (atomic rename)
        os.replace(temp_new_path, final_new_path)

        # Delete old file AFTER successful commit
        if os.path.exists(old_file["file_path"]):
            try:
                os.remove(old_file["file_path"])
            except Exception as e:
                print(f"Warning: could not delete old file -> {e}")

    except Exception as e:
        db.rollback()
        if os.path.exists(temp_new_path):
            os.remove(temp_new_path)
        raise HTTPException(status_code=500, detail=f"Replace failed: {str(e)}")

    updated_file = db.execute(text('SELECT * FROM files WHERE file_id = :file_id'),
                              {"file_id": file_id}).fetchone()

    # Log file replace (attribute to file owner)
    try:
        log_action_for_owner(db, actor_user_id=user_id, action="replace_file", resource_type="file", resource_id=file_id, details=file.filename)
        db.commit()
    except Exception:
        pass

    return {
        "message": "File replaced successfully",
        "file": dict(updated_file._mapping)
    }
