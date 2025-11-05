from fastapi import APIRouter, Depends,HTTPException,Form
from utils import get_db,check_permission, log_action_for_owner
from verify_token import get_current_user
from sqlalchemy import text,bindparam
from datetime import datetime
from sqlalchemy.orm import Session
import zipfile
from fastapi.responses import StreamingResponse
from io import BytesIO

router = APIRouter()

# Create a Folder
@router.post('/create_folder' )
def create_folder(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user),
                   folder_name: str = Form(...), parent_id: int = Form(...)):
    user_id = current_user["user_id"]


    perm = check_permission(db,user_id,folder_id=parent_id,operation='edit')
    if not perm and parent_id != 0:
        raise HTTPException(status_code=400, detail="You don't have permission to create a folder in this folder")
    
    if folder_name is None:
        raise HTTPException(status_code=400, detail="folder_name is required")
    
    
    #checking if the folder_name is already taken
    search_folder = db.execute(text(
        '''
            SELECT * FROM folders WHERE folder_name = :folder_name AND user_id = :user_id AND parent_id = :parent_id
        '''
    ),{
        "folder_name": folder_name,
        "parent_id": parent_id,
        "user_id": user_id
    })

    if search_folder.fetchone():
        raise HTTPException(status_code=400, detail="Folder already exists")

    #inserting into the database
    result = db.execute(text(
        '''
            INSERT INTO folders(folder_name,parent_id,user_id,created_at,updated_at) VALUES(:folder_name,:parent_id,:user_id,:created_at,:updated_at) 
            RETURNING folder_id,folder_name,parent_id,user_id,created_at,updated_at
         '''    
    ),{
        "folder_name": folder_name,
        "parent_id": parent_id,
        "user_id": user_id,
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    })

    new_folder = result.fetchone()
    db.commit()

    if not new_folder:
        raise HTTPException(status_code=400, detail="Failed to create folder")
    # Log folder create (attribute to folder owner)
    try:
        log_action_for_owner(db, actor_user_id=user_id, action="create_folder", resource_type="folder", resource_id=new_folder.folder_id, details=folder_name)
        db.commit()
    except Exception:
        pass

    return {"message": "Folder created successfully", "folder": dict(new_folder._mapping)}

#get details of the folder
@router.get('/get_folder_details')
def get_folder_details(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user),folder_id: int = None):
    user_id = current_user["user_id"]
    result = db.execute(text(
        '''
            SELECT folder_id,folder_name,parent_id,user_id,created_at,updated_at FROM folders WHERE user_id = :user_id AND folder_id = :folder_id
        '''
    ),{"user_id": user_id,
       "folder_id": folder_id})

    folders = result.fetchone()
    if not folders:
        raise HTTPException(status_code=400, detail="No folders found")
    
    return {"message": "Folder details", "folder": dict(folders._mapping)}

#rename a folder
@router.put('/folder_rename')
def folder_rename(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user),
                  folder_id: int = Form(...), folder_name: str = Form(...),parent_id: int = Form(...)):
    user_id = current_user["user_id"]
    # check for permission of the user
    perm = check_permission(db,user_id,folder_id=folder_id,operation='edit')
    if not perm:
        raise HTTPException(status_code=400, detail="You don't have permission to rename this folder")

    if folder_name is None:
        raise HTTPException(status_code=400, detail="folder_name is required")
    
    #check if the new name is already taken
    result = db.execute(text(
        '''
            SELECT * FROM folders WHERE user_id = :user_id AND parent_id = :parent_id AND folder_name = :folder_name
        '''
    ),{
        "folder_name": folder_name,
        "parent_id": parent_id,
        "user_id": user_id
    }).fetchall()
    if result:
        raise HTTPException(status_code=400, detail="Folder already exists")

    #renaming the folder
    result = db.execute(text(
        '''
            UPDATE folders SET folder_name = :folder_name, updated_at = :updated_at 
            WHERE folder_id = :folder_id
            RETURNING folder_id,folder_name
        '''
    ),{
        'folder_id': folder_id,
        'folder_name': folder_name,
        'updated_at': datetime.now()
    }).fetchall()

    db.commit()

    if not result:
        raise HTTPException(status_code=400, detail="Failed to rename folder")
    # Log folder rename (attribute to folder owner)
    try:
        log_action_for_owner(db, actor_user_id=user_id, action="rename_folder", resource_type="folder", resource_id=folder_id, details=folder_name)
        db.commit()
    except Exception:
        pass

    return {"message": "Folder renamed successfully", "folder_id": folder_id, "folder_name": folder_name}

@router.put('/bulk_move')
def folder_move(
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user),
    folder_ids: list[int] = Form(None), 
    parent_id: int = Form(...), 
    file_ids: list[int] = Form(None)
):
    user_id = current_user["user_id"]

    # check if the folder belongs to the user
    if folder_ids is not None:
        result = db.execute(
            text('''
                SELECT * FROM folders WHERE folder_id IN :folder_ids AND user_id = :user_id
            ''').bindparams(bindparam("folder_ids", expanding=True)),
            {"folder_ids": folder_ids, "user_id": user_id}
        ).fetchall()

        if len(result) != len(folder_ids):
            raise HTTPException(status_code=400, detail="Folder not found")
    
    # check if the file belongs to the user
    if file_ids is not None:
        result = db.execute(
            text('''
                SELECT * FROM files WHERE file_id IN :file_ids AND user_id = :user_id
            ''').bindparams(bindparam("file_ids", expanding=True)),
            {"file_ids": file_ids, "user_id": user_id}
        ).fetchall()

        if len(result) != len(file_ids):
            raise HTTPException(status_code=400, detail="File not found")


    if folder_ids is not None:
    # check if the folder is moved to its children or itself
        descendants = db.execute(
            text('''
                WITH RECURSIVE descendants AS (
                SELECT folder_id
                FROM folders
                WHERE folder_id IN :folder_ids
                UNION ALL
                SELECT f.folder_id
                FROM folders f
                JOIN descendants d ON f.parent_id = d.folder_id
                WHERE f.user_id = :user_id
            )
            SELECT folder_id FROM descendants
            ''').bindparams(bindparam("folder_ids", expanding=True)),
            {"folder_ids": folder_ids, "user_id": user_id}
        ).fetchall()

        descendant_ids = [d[0] for d in descendants]

        if parent_id in descendant_ids:
            raise HTTPException(status_code=400, detail="Cannot move folder to its descendant")

    # updating the positions of the folders if they exist
    if folder_ids is not None:
        db.execute(
            text('''
                UPDATE folders SET parent_id = :parent_id, updated_at = :updated_at
                WHERE folder_id IN :folder_ids
            ''').bindparams(bindparam("folder_ids", expanding=True)),
            {"folder_ids": folder_ids, "parent_id": parent_id, "updated_at": datetime.now()}
        )

    # updating the positions of the files if they exist
    if file_ids is not None:
        db.execute(
            text('''
                UPDATE files SET parent_id = :parent_id, updated_at = :updated_at
                WHERE file_id IN :file_ids
            ''').bindparams(bindparam("file_ids", expanding=True)),
            {"file_ids": file_ids, "parent_id": parent_id, "updated_at": datetime.now()}
        )


    db.commit()

    new_files = db.execute(text(
        '''
            SELECT * from files WHERE parent_id = :parent_id
        '''
    ),{
        'parent_id': parent_id
    }).fetchall()

    new_folders = db.execute(text(
        '''
            SELECT * FROM folders WHERE parent_id = :parent_id
        '''
    ),{
        'parent_id': parent_id
    }).fetchall()

    # Log moves (attribute to resource owners)
    try:
        if folder_ids:
            for fid in folder_ids:
                log_action_for_owner(db, actor_user_id=user_id, action="move_folder", resource_type="folder", resource_id=fid, details=f"to={parent_id}")
        if file_ids:
            for fid in file_ids:
                log_action_for_owner(db, actor_user_id=user_id, action="move_file", resource_type="file", resource_id=fid, details=f"to={parent_id}")
        db.commit()
    except Exception:
        pass

    return {
        "message": "moved successfully",
        "folders": [dict(r._mapping) for r in new_folders],
        "files": [dict(r._mapping) for r in new_files]
    }

def delete_folder(db, folder_ids, user_id,file_ids):
    # get all children including self
    if folder_ids:
        descendant_folders = db.execute(
            text('''
                WITH RECURSIVE descendants AS (
                    SELECT folder_id
                    FROM folders
                    WHERE folder_id IN :folder_ids
                    UNION ALL
                    SELECT f.folder_id
                    FROM folders f
                    INNER JOIN descendants d ON f.parent_id = d.folder_id
                )
                SELECT folder_id FROM descendants;
            ''').bindparams(bindparam("folder_ids", expanding=True)),
            {"folder_ids": folder_ids, "user_id": user_id}
        ).fetchall()

        descendant_ids = [f[0] for f in descendant_folders]
        if not descendant_ids:
            raise HTTPException(status_code=400, detail="Folder not found")

        placeholders = ", ".join([f":id{i}" for i in range(len(descendant_ids))])
        
        params = {
            **{f"id{i}": descendant_ids[i] for i in range(len(descendant_ids))},
            "updated_at": datetime.now(),
            "status": "deleted"
        }

        # Soft-delete all files inside these folders
        db.execute(
            text(f"""
                UPDATE files 
                SET parent_id = NULL, updated_at = :updated_at, status = :status 
                WHERE parent_id IN ({placeholders})
            """),
            params
        )  
        # Hard delete all children folders
        db.execute(
            text(f"DELETE FROM folders WHERE folder_id IN ({placeholders})"),
            params
        )

        db.commit()
    if file_ids:
        db.execute(text(
            '''
            UPDATE files SET parent_id = NULL, updated_at = :updated_at, status = 'deleted'
            WHERE file_id IN :file_ids 
            '''
        ).bindparams(bindparam("file_ids", expanding=True)),
        {"file_ids": file_ids, "user_id": user_id , "updated_at": datetime.now()}
        )
        db.commit()

    return {"message": "Folder deleted successfully" , "folders":folder_ids , "files":file_ids}


@router.post('/bulk_delete')
def folder_delete(db: Session = Depends(get_db) , current_user = Depends(get_current_user), folder_ids: list[int] = Form(None) , file_ids: list[int] = Form(None)):    
    user_id = current_user["user_id"]
    folder_ids = folder_ids or []
    file_ids = file_ids or []

    #check permission before deleting
    folders , files = [],[]
    for i in folder_ids:
        if check_permission(db,user_id,folder_id=i,operation='edit'): folders.append(i)
    for i in file_ids:
        if check_permission(db,user_id,file_id=i,operation='edit'): files.append(i)
    
    message = delete_folder(db, folders, user_id,files)
    # Log bulk delete (attribute to resource owners)
    try:
        if folders:
            for fid in folders:
                log_action_for_owner(db, actor_user_id=user_id, action="delete_folder", resource_type="folder", resource_id=fid)
        if files:
            for fid in files:
                log_action_for_owner(db, actor_user_id=user_id, action="delete_file", resource_type="file", resource_id=fid)
        db.commit()
    except Exception:
        pass
    return message

@router.get('/get_all_children/{folder_id}')
def get_all_childern(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user), folder_id: int = None):
    user_id = current_user["user_id"]

    #check for permission of the user
    perm = check_permission(db,user_id,folder_id=folder_id,operation='view')

    if folder_id == 0:
        perm = True


    if not perm:
        raise HTTPException(status_code=400, detail="You don't have permission to access this folder")

    folders = []
    files = []

    if folder_id == 0:
        folders = db.execute(text(
            '''
                SELECT folder_id,folder_name,parent_id,user_id,created_at,updated_at
                FROM folders
                WHERE parent_id = 0 
                AND user_id = :user_id
            '''
        ),{
            "user_id": user_id,
            "parent_id": folder_id
        }).fetchall()
        
        files = db.execute(text(
            '''
                SELECT file_id,file_name,parent_id,user_id,created_at,updated_at
                FROM files
                WHERE parent_id = 0 AND status != 'deleted'
                AND user_id = :user_id
            '''
        ),{
            "parent_id": folder_id,
            "user_id": user_id
        }).fetchall()

        folders_list = [dict(f._mapping) for f in folders]
        files_list = [dict(f._mapping) for f in files]

        return {"folders": folders_list, "files": files_list}

    folders = db.execute(text(
        '''
            SELECT folder_id,folder_name,parent_id,user_id,created_at,updated_at
            FROM folders
            WHERE  parent_id = :folder_id 
        '''
    ),{
        "folder_id": folder_id,
    }).fetchall()
    
    files = db.execute(text(
        '''
            SELECT file_id,file_name,parent_id,user_id,created_at,updated_at
            FROM files
            WHERE parent_id = :folder_id AND status != 'deleted' 
        '''
    ),{
        "folder_id": folder_id,
        "user_id": user_id
    }).fetchall()

    folders_list = [dict(f._mapping) for f in folders]
    files_list = [dict(f._mapping) for f in files]

    return {"folders": folders_list, "files": files_list}

def add_folder_to_zip(zip_file: zipfile.ZipFile, folder_id: int, db: Session, parent_path=""):
    # Get all the files in the folder
    files = db.execute(text(
        "SELECT file_name, file_path FROM files WHERE parent_id = :folder_id AND status='not_deleted'"
        ),{"folder_id": folder_id}
    ).fetchall()

    for f in files:
        file_name, file_path = f
        zip_file.write(file_path, arcname=f"{parent_path}{file_name}")

    # Get all the subfolders
    subfolders = db.execute(text(
        "SELECT folder_id, folder_name FROM folders WHERE parent_id = :folder_id"
        ),{"folder_id": folder_id}
    ).fetchall()

    for sub in subfolders:
        sub_id, sub_name = sub
        # Add the subfolders to the zip
        add_folder_to_zip(zip_file, sub_id, db, parent_path=f"{parent_path}{sub_name}/")


@router.get("/download_folder/{folder_id}")
def download_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["user_id"]

    # Check user permission
    perm = check_permission(db, user_id, folder_id=folder_id, operation="view")
    if not perm:
        raise HTTPException(status_code=403, detail="You don't have permission to access this folder")

    # Get root folder name
    folder = db.execute(text(
        "SELECT folder_name FROM folders WHERE folder_id = :folder_id"),
        {"folder_id": folder_id}
    ).fetchone()

    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    folder_name = folder[0]

    # Create zip in memory
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zip_file:
        add_folder_to_zip(zip_file, folder_id, db, parent_path=f"{folder_name}/")

    zip_buffer.seek(0)
    # Log folder download (attribute to folder owner)
    try:
        log_action_for_owner(db, actor_user_id=user_id, action="download_folder", resource_type="folder", resource_id=folder_id)
        db.commit()
    except Exception:
        pass

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={folder_name}.zip"}
    )