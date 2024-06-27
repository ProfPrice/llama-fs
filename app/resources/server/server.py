import shutil
from pathlib import Path
from typing import Optional, List, Union
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from src.loader import get_dir_summaries
from src.tree_generator import create_file_tree
import uvicorn
from databases import Database
import sqlalchemy
import aiofiles
import aiofiles.os
from aiofiles.os import wrap
import os
import asyncio
import re
from datetime import datetime

def format_mtime(mtime):
    return datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')

# Set to True for debug printing.
os.environ["DEBUG_MODE"] = "true"

app = FastAPI()

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = "sqlite:///./resources/server/summaries.db"
database = Database(DATABASE_URL)
metadata = sqlalchemy.MetaData()

summaries_table = sqlalchemy.Table(
    "summaries",
    metadata,
    sqlalchemy.Column("id", sqlalchemy.Integer, primary_key=True),
    sqlalchemy.Column("summary", sqlalchemy.Text),
    sqlalchemy.Column("full_original_path", sqlalchemy.Text),
    sqlalchemy.Column("full_new_path", sqlalchemy.Text, unique=True),
)

engine = sqlalchemy.create_engine(DATABASE_URL)
metadata.create_all(engine)

@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

@app.get("/")
async def root():
    return {"message": "organize it!"}

class FolderContentsRequest(BaseModel):
    path: Optional[str] = None

class Request(BaseModel):
    path: Optional[str] = None
    instruction: Optional[str] = None
    model: Optional[str] = "llama3"
    max_tree_depth: Optional[str] = "3"
    file_format: Optional[str] = "{MONTH}_{DAY}_{YEAR}_{CONTENT}.{EXTENSION}"
    groq_api_key: Optional[str] = ""
    process_action: Optional[int] = 0  # 0 = move, 1 = duplicate

class FilePathRequest(BaseModel):
    file_path: str

def perform_action(src, dst, process_action):
    dst_directory = os.path.dirname(dst)
    os.makedirs(dst_directory, exist_ok=True)

    try:
        if process_action == 0:  # Move
            if os.path.isfile(src) and os.path.isdir(dst):
                shutil.move(src, os.path.join(dst, os.path.basename(src)))
            else:
                shutil.move(src, dst)
        elif process_action == 1:  # Duplicate
            if os.path.isdir(src):
                shutil.copytree(src, dst)
            else:
                shutil.copy2(src, dst)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while processing the resource: {e}"
        )

async def get_summary_from_db(full_new_path: str) -> Optional[str]:
    query = summaries_table.select().where(summaries_table.c.full_new_path == full_new_path)
    result = await database.fetch_one(query)
    if result:
        return result['summary']
    return None

async def async_scandir(path: str):
    loop = asyncio.get_event_loop()
    for entry in await loop.run_in_executor(None, lambda: list(os.scandir(path))):
        yield entry

async def build_tree_structure(path, depth=0):
    entries = []
    total_size = 0
    async for entry in async_scandir(path):
        summary = await get_summary_from_db(entry.path.replace("\\", "/"))
        if entry.is_dir():
            folder_contents, folder_size = await build_tree_structure(entry.path, depth + 1)
            entry_info = {
                "name": entry.name.replace("\\", "/"),
                "absolutePath": entry.path.replace("\\", "/"),
                "isDirectory": True,
                "size": folder_size,
                "modified": format_mtime(entry.stat().st_mtime),
                "folderContents": folder_contents,
                "folderContentsDisplayed": False,
                "depth": depth,
                "summary": summary
            }
            total_size += folder_size
        else:
            entry_info = {
                "name": entry.name.replace("\\", "/"),
                "absolutePath": entry.path.replace("\\", "/"),
                "isDirectory": False,
                "size": entry.stat().st_size,
                "modified": format_mtime(entry.stat().st_mtime),
                "folderContents": [],
                "folderContentsDisplayed": False,
                "depth": depth,
                "summary": summary
            }
            total_size += entry.stat().st_size
        entries.append(entry_info)
    return entries, total_size

def ensure_beginning_slash(path: str) -> str:
    return path if path.startswith("/") else f"/{path}"

def generate_unique_path(base_path: str) -> str:
    directory = os.path.dirname(base_path)
    filename = os.path.basename(base_path)
    pattern = re.compile(r"^(.*?)(_duplicated(?:_(\d+))?)?$")
    match = pattern.match(filename)
    
    base_name = match.group(1)
    duplicate_suffix = match.group(2) or "_duplicated"
    existing_numbers = []
    
    for entry in os.scandir(directory):
        entry_match = pattern.match(entry.name)
        if entry_match and entry_match.group(1) == base_name:
            suffix = entry_match.group(2)
            if suffix and suffix.startswith("_duplicated"):
                if suffix == "_duplicated":
                    existing_numbers.append(1)
                else:
                    num = int(entry_match.group(3))
                    existing_numbers.append(num)
    
    if existing_numbers:
        max_number = max(existing_numbers)
        return os.path.join(directory, f"{base_name}_duplicated_{max_number + 1}")
    else:
        return os.path.join(directory, f"{base_name}_duplicated")

@app.post("/batch")
async def batch(request: Request):
    path = request.path
    model = request.model
    instruction = request.instruction
    max_tree_depth = request.max_tree_depth
    file_format = request.file_format
    groq_api_key = request.groq_api_key
    process_action = request.process_action

    if not os.path.exists(path):
        raise HTTPException(status_code=400, detail="Path does not exist in filesystem")

    # Assess files with LLMs.
    summaries = await get_dir_summaries(path, model, instruction, groq_api_key)
    files = create_file_tree(summaries, model, instruction, max_tree_depth, file_format, groq_api_key)

    
    response_path = path
    if process_action == 1:
        response_path = generate_unique_path(path)

    if os.environ.get("DEBUG_MODE") == "true":
        print("response_path: " + response_path)

    # Store results.
    for file in files:
        summary = summaries[files.index(file)]["summary"]
        full_original_path = path + ensure_beginning_slash(file["file_path"]).replace("\\", "/")
        full_new_path = response_path + ensure_beginning_slash(file["new_path"]).replace("\\", "/")

        # Move or duplicate the file.
        perform_action(full_original_path, full_new_path, process_action)

        # Insert or update the summary in the database.
        query = sqlalchemy.dialects.sqlite.insert(summaries_table).values(
            summary=summary,
            full_original_path=full_original_path,
            full_new_path=full_new_path
        ).on_conflict_do_update(
            index_elements=['full_new_path'],
            set_=dict(summary=summary, full_original_path=full_original_path)
        )
        await database.execute(query)

    if os.environ.get("DEBUG_MODE") == "true":
        print("operation complete!")

    # Convert the path to the required folder structure format
    response, _ = await build_tree_structure(response_path)

    return response

@app.post("/get-folder-contents")
async def get_folder_contents(request: FolderContentsRequest):

    response, _ = await build_tree_structure(request.path)
    return response

@app.post("/get-summary")
async def get_summary(request: FilePathRequest):
    summary = await get_summary_from_db(request.file_path)
    if summary is None:
        raise HTTPException(status_code=404, detail="Summary not found for the provided file path")
    return {"summary": summary}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=11433)
