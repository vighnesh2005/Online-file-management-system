# app.py
from fastapi import FastAPI
from database import engine, create_tables
from routes import auth , folders , files

from sqlalchemy import text

app = FastAPI(title="FileSystemAuthAPI")
app.include_router(prefix="/auth", router=auth.router)
app.include_router(prefix="/folders", router=folders.router)
app.include_router(prefix="/files", router=files.router)

create_tables()

