from fastapi import APIRouter, Depends,HTTPException,Form
from utils import get_db,check_permission
from verify_token import get_current_user
from sqlalchemy import text,bindparam
from datetime import datetime
from sqlalchemy.orm import Session



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

    return dict(new_folder._mapping)

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
    
    return dict(folders._mapping)

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

    # check if the folder belongs to the user or not
    if folder_ids is not None:
        result = db.execute(
            text('''
                SELECT * FROM folders WHERE folder_id IN :folder_ids AND user_id = :user_id
            ''').bindparams(bindparam("folder_ids", expanding=True)),
            {"folder_ids": folder_ids, "user_id": user_id}
        ).fetchall()

        if len(result) != len(folder_ids):
            raise HTTPException(status_code=400, detail="Folder not found")
    
    # check if the file belongs to the user or not
    if file_ids is not None:
        result = db.execute(
            text('''
                SELECT * FROM files WHERE file_id IN :file_ids AND user_id = :user_id
            ''').bindparams(bindparam("file_ids", expanding=True)),
            {"file_ids": file_ids, "user_id": user_id}
        ).fetchall()

        if len(result) != len(file_ids):
            raise HTTPException(status_code=400, detail="File not found")

    updated_folders = []
    updated_files = []

    if folder_ids is not None:
    # check if the folder is moved to its descendant
        descendants = db.execute(
            text('''
                WITH RECURSIVE descendants AS (
                    SELECT folder_id
                    FROM folders
                    WHERE parent_id IN :folder_ids AND user_id = :user_id
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

    # updating the position of the folder
        db.execute(
            text('''
                UPDATE folders SET parent_id = :parent_id, updated_at = :updated_at
                WHERE folder_id IN :folder_ids
            ''').bindparams(bindparam("folder_ids", expanding=True)),
            {"folder_ids": folder_ids, "parent_id": parent_id, "updated_at": datetime.now()}
        )

    # fetch updated folders
        updated_folders = db.execute(
            text('''
                SELECT folder_id, folder_name, parent_id, user_id, created_at, updated_at
                FROM folders WHERE folder_id IN :folder_ids
            ''').bindparams(bindparam("folder_ids", expanding=True)),
            {"folder_ids": folder_ids}
        ).fetchall()

    # updating the position of the files
    if file_ids is not None:
        db.execute(
            text('''
                UPDATE files SET parent_id = :parent_id, updated_at = :updated_at
                WHERE file_id IN :file_ids
            ''').bindparams(bindparam("file_ids", expanding=True)),
            {"file_ids": file_ids, "parent_id": parent_id, "updated_at": datetime.now()}
        )

        # fetch updated files
        updated_files = db.execute(
            text('''
                SELECT file_id, file_name, parent_id, user_id, created_at, updated_at
                FROM files WHERE file_id IN :file_ids
            ''').bindparams(bindparam("file_ids", expanding=True)),
            {"file_ids": file_ids}
        ).fetchall()

    db.commit()

    return {
        "folders": [dict(r._mapping) for r in updated_folders],
        "files": [dict(r._mapping) for r in updated_files]
    }

def delete_folder(db, folder_ids, user_id,file_ids):
    # get all descendants including self
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
        # Hard delete all descendant folders
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

    return {"message": "Folder deleted successfully"}


@router.delete('/bulk_delete')
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
    return message

@router.get('/get_all_children')
def get_all_childern(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user), folder_id: int = None):
    user_id = current_user["user_id"]

    #check for permission of the user
    perm = check_permission(db,user_id,folder_id=folder_id,operation='view')

    if folder_id == 0:
        perm = True


    if not perm:
        raise HTTPException(status_code=400, detail="You don't have permission to access this folder")

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




