# app.py
from fastapi import FastAPI
from database import engine, create_tables
from routes import auth , folders , files, recycle , shares, logs, search
from fastapi.middleware.cors import CORSMiddleware
from schedular import start_cleanup_scheduler

from sqlalchemy import text

app = FastAPI(title="FileSystemAuthAPI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(prefix="/auth", router=auth.router)
app.include_router(prefix="/folders", router=folders.router)
app.include_router(prefix="/files", router=files.router)
app.include_router(prefix="/recycle", router=recycle.router)
app.include_router(prefix='/shares',router=shares.router)
app.include_router(prefix='/logs', router=logs.router)
app.include_router(prefix='/search', router=search.router)

app.on_event("startup")(start_cleanup_scheduler)

create_tables()

