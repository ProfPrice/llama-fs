import shutil
from pathlib import Path
from typing import Optional, List, Union
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from src.loader import get_dir_summaries, summarize_single_document
from src.tree_generator import create_file_tree
import uvicorn
import os
import asyncio
import re
from datetime import datetime
import math
import time

from src.db import hash_file_contents, get_summary_from_db, store_summary_in_db, summaries_table, database

# Logging function
def log(text="", console_only=False):
    if not console_only:
        # Write to the latest.log file
        with open('./latest.log', 'a') as log_file:
            timestamp = time.strftime("[%Y-%m-%d %H:%M:%S]")
            log_file.write(f"{timestamp} {text}\n")
    return

# Function to manage log files
def initialize_logs():
    open('./latest.log', 'w').close()

def format_mtime(mtime):
    return datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')

app = FastAPI()

origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

@app.get("/")
async def root():
    return {"message": "organize it!"}

class FilePathRequest(BaseModel):
    file_path: str
    model: str
    groq_api_key: str
    instruction: str

class FolderContentsRequest(BaseModel):
    path: Optional[str] = None

class Request(BaseModel):
    path: Optional[str] = None
    instruction: Optional[str] = None
    model: Optional[str] = "llama3"
    max_tree_depth: Optional[int] = 3
    file_format: Optional[str] = "{MONTH}_{DAY}_{YEAR}_{CONTENT}.{EXTENSION}"
    groq_api_key: Optional[str] = ""
    process_action: Optional[int] = 0  # 0 = move, 1 = duplicate

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

async def async_scandir(path: str):
    loop = asyncio.get_event_loop()
    for entry in await loop.run_in_executor(None, lambda: list(os.scandir(path))):
        yield entry

def format_size(bytes):
    sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if bytes == 0:
        return '0 Bytes'
    i = int(math.floor(math.log(bytes, 1024)))
    return f"{round(bytes / math.pow(1024, i), 2)} {sizes[i]}"

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
                "size": format_size(folder_size),
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
                "size": format_size(entry.stat().st_size),
                "modified": format_mtime(entry.stat().st_mtime),
                "folderContents": [],
                "folderContentsDisplayed": False,
                "depth": depth,
                "summary": summary
            }
            total_size += entry.stat().st_size
        entries.append(entry_info)
    
    # Sort entries so that directories come first
    entries.sort(key=lambda x: not x['isDirectory'])
    
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

@app.post("/summarize-document")
async def summarize_document(request: FilePathRequest):
    file_path = request.file_path

    if not os.path.isfile(file_path):
        raise HTTPException(status_code=400, detail="File does not exist")

    summary = await summarize_single_document(file_path, request.instruction, request.model, request.groq_api_key)

    if not summary:
        raise HTTPException(status_code=500, detail="Failed to generate summary")

    file_hash = await hash_file_contents(file_path)
    file_type = os.path.splitext(file_path)[1][1:]

    await store_summary_in_db(file_hash, file_type, summary)

    return {"summary": summary}

@app.post("/batch")
async def batch(request: Request):
    path = request.path
    model = request.model
    instruction = request.instruction
    max_tree_depth = str(request.max_tree_depth)
    file_format = request.file_format
    groq_api_key = request.groq_api_key
    process_action = request.process_action

    if not os.path.exists(path):
        raise HTTPException(status_code=400, detail="Path does not exist in filesystem")

    # Assess files with LLMs.
    log("Batch: Getting summaries...")
    summaries = await get_dir_summaries(path, model, instruction, groq_api_key)
    log("Batch: Creating file tree...")
    files = create_file_tree(summaries, model, instruction, max_tree_depth, file_format, groq_api_key)

    response_path = path
    if process_action == 1:
        response_path = generate_unique_path(path)

    log("Batch: Storing results...")
    # Store results.
    for file in files:
        summary = summaries[files.index(file)]["summary"]
        full_original_path = path + ensure_beginning_slash(file["file_path"]).replace("\\", "/")
        full_new_path = response_path + ensure_beginning_slash(file["new_path"]).replace("\\", "/")
        file_type = file["file_path"].split(".")[-1]

        # Move or duplicate the file.
        perform_action(full_original_path, full_new_path, process_action)

        # Hash file contents
        file_hash = await hash_file_contents(full_new_path)

        # Insert or update the summary in the database.
        await store_summary_in_db(file_hash, file_type, summary)

    # Convert the path to the required folder structure format
    log("Batch: Preparing results for frontend...")
    response, _ = await build_tree_structure(response_path)

    log("Batch: Operation complete!")
    
    return {
        "folder_contents": response,
        "unique_path": response_path
    }

@app.post("/get-folder-contents")
async def get_folder_contents(request: FolderContentsRequest):
    response, _ = await build_tree_structure(request.path)
    
    unique_path = generate_unique_path(request.path)
    
    return {
        "folder_contents": response,
        "unique_path": unique_path
    }


if __name__ == "__main__":
    # Initialize log files
    initialize_logs()
    uvicorn.run(app, host="0.0.0.0", port=11433)
