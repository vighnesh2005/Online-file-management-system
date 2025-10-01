from fastapi import APIRouter, Depends,HTTPException,Form
from utils import get_db
from verify_token import get_current_user
from sqlalchemy import text
from datetime import datetime
from sqlalchemy.orm import Session


router = APIRouter()

# Create a Folder
@router.post('/create_folder' )
def create_folder(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user),
                   folder_name: str = Form(...), parent_id: int = Form(...)):
    user_id = current_user["user_id"]

    # check for permission of the user
    # -- some code here to check permission --

    if folder_name is None:
        return HTTPException(status_code=400, detail="folder_name is required")
    
    #checking if the parent folder exists
    if parent_id != 0 :
        result = db.execute(text(
            '''SELECT user_id FROM FOLDERS
                WHERE folder_id = :parent_id AND user_id = :user_id''' 
        ),{
            "parent_id": parent_id,
            "user_id": user_id
        }).fetchone()
        if not result:
            return HTTPException(status_code=400, detail="Invalid parent folder")
    
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
        return HTTPException(status_code=400, detail="Folder already exists")

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
    # -- some code here to check permission --
        
    if folder_name is None:
        return HTTPException(status_code=400, detail="folder_name is required")
    
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

#moving a folder
@router.put('/folder_move')
def folder_move(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user),
                  folder_id: int = Form(...), parent_id: int = Form(...)):
    user_id = current_user["user_id"]

    #check if the folder belongs to the user or not
    result = db.execute(text(
        '''
            SELECT * FROM folders WHERE user_id = :user_id AND folder_id = :folder_id
        '''
    ),{
        "folder_id": folder_id,
        "user_id": user_id
    }).fetchone()

    if not result :
        raise HTTPException(status_code=400, detail="Folder not found")
    
    #check if the folder is moved to its descendant
    descendants = db.execute(text(
        '''
            WITH RECURSIVE descendants AS(
                SELECT folder_id
                FROM folders
                WHERE folder_id = :folder_id
                UNION ALL
                SELECT f.folder_id
                FROM folders f
                INNER JOIN descendants d ON f.parent_id = d.folder_id
            )
            SELECT folder_id FROM descendants;
        '''
    ),{
        "folder_id": folder_id
    }).fetchall()

    descendant_ids = [folder[0] for folder in descendants]
    if parent_id in descendant_ids:
        raise HTTPException(status_code=400, detail="Cannot move folder to its descendant")

    #updating the position of the folder
    result = db.execute(text(
        '''
        UPDATE folders SET parent_id = :parent_id, updated_at = :updated_at
        WHERE folder_id = :folder_id
        RETURNING folder_id,folder_name,parent_id,user_id,created_at,updated_at
    '''
    ),{
        "folder_id": folder_id,
        "parent_id": parent_id,
        "updated_at": datetime.now()
    }).fetchone()

    db.commit()

    if not result:
        raise HTTPException(status_code=400, detail="Failed to move folder")

    return dict(result._mapping)


def delete_folder(db, folder_id, user_id):
    # get all descendants including self
    descendant_folders = db.execute(text(
        '''
            WITH RECURSIVE descendants AS (
            SELECT folder_id
            FROM folders
            WHERE folder_id = :folder_id AND user_id = :user_id
            UNION ALL
            SELECT f.folder_id
            FROM folders f
            INNER JOIN descendants d ON f.parent_id = d.folder_id
            WHERE f.user_id = :user_id
            )
            SELECT folder_id FROM descendants;
        '''
    ), {"folder_id": folder_id,
        "user_id": user_id}).fetchall()

    descendant_ids = [f[0] for f in descendant_folders]
    if not descendant_ids:
        raise HTTPException(status_code=400, detail="Folder not found")

    placeholders = ", ".join([f":id{i}" for i in range(len(descendant_ids))])
    params = {f"id{i}": descendant_ids[i] for i in range(len(descendant_ids))}

    # Delete all children files
    db.execute(text(f"DELETE FROM files WHERE parent_id IN ({placeholders})"), params)

    # Delete all children folders
    db.execute(text(f"DELETE FROM folders WHERE folder_id IN ({placeholders})"), params)

    db.commit()
    return {"message": "Folder deleted successfully"}


@router.delete('/folder_delete')
def folder_delete(db: Session = Depends(get_db) , current_user = Depends(get_current_user), folder_id: int = None):
    user_id = current_user["user_id"]
    
    #check for permission of the user
    # -- some code here to check permission --
    message = delete_folder(db, folder_id, user_id)
    return message

@router.get('/get_all_children')
def get_all_childern(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user), folder_id: int = None):
    user_id = current_user["user_id"]

    #check for permission of the user
    # -- some code here to check permission --

    folders = db.execute(text(
        '''
            SELECT folder_id,folder_name,parent_id,user_id,created_at,updated_at
            FROM folders
            WHERE user_id = :user_id AND parent_id = :folder_id
        '''
    ),{
        "folder_id": folder_id,
        "user_id": user_id
    }).fetchall()
    
    files = db.execute(text(
        '''
            SELECT file_id,file_name,parent_id,user_id,created_at,updated_at
            FROM files
            WHERE user_id = :user_id AND parent_id = :folder_id
        '''
    ),{
        "folder_id": folder_id,
        "user_id": user_id
    }).fetchall()

    folders_list = [dict(f._mapping) for f in folders]
    files_list = [dict(f._mapping) for f in files]

    return {"folders": folders_list, "files": files_list}


