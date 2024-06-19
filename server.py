import shutil 
import os
from pathlib import Path
from typing import Optional
from asciitree import LeftAligned
from asciitree.drawing import BOX_LIGHT, BoxStyle
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from src.loader import get_dir_summaries
from src.tree_generator import create_file_tree

# Set to True for debug printing.
os.environ["DEBUG_MODE"] = "true"

class Request(BaseModel):
    path: Optional[str] = None
    instruction: Optional[str] = None
    model: Optional[str] = "ollama"

class CommitRequest(BaseModel):
    base_path: str
    src_path: str  # Relative to base_path
    new_path: str  # Relative to base_path

app = FastAPI()

origins = [
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Or restrict to ['POST', 'GET', etc.]
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.post("/batch")
async def batch(request: Request):

    path = request.path
    model = request.model
    instruction = request.instruction

    if not os.path.exists(path):
        raise HTTPException(
            status_code=400, detail="Path does not exist in filesystem")
    
    # Initialize model for interpreting files.
    summaries = await get_dir_summaries(path, model, instruction)
    
    # Get file tree
    files = create_file_tree(summaries, model, instruction)

    # Recursively create dictionary from file paths
    tree = {}
    for file in files:
        parts = Path(file["new_path"]).parts
        current = tree
        for part in parts:
            current = current.setdefault(part, {})

    tree = {path: tree}

    tr = LeftAligned(draw=BoxStyle(gfx=BOX_LIGHT, horiz_len=1))

    if os.environ.get("DEBUG_MODE") == "true":
        print(tr(tree))

    # Prepend base path to new_path
    for file in files:
        # file["new_path"] = os.path.join(path, file["new_path"])
        file["summary"] = summaries[files.index(file)]["summary"]

    if os.environ.get("DEBUG_MODE") == "true":
        print("operation complete!")

    return files

@app.post("/commit")
async def commit(request: CommitRequest):
    print('*'*80)
    print(request)
    print(request.base_path)
    print(request.src_path)
    print(request.new_path)
    print('*'*80)

    src = os.path.join(request.base_path, request.src_path)
    dst = os.path.join(request.base_path, request.new_path)

    if not os.path.exists(src):
        raise HTTPException(
            status_code=400, detail="Source path does not exist in filesystem"
        )

    # Ensure the destination directory exists
    dst_directory = os.path.dirname(dst)
    os.makedirs(dst_directory, exist_ok=True)

    try:
        # If src is a file and dst is a directory, move the file into dst with the original filename.
        if os.path.isfile(src) and os.path.isdir(dst):
            shutil.move(src, os.path.join(dst, os.path.basename(src)))
        else:
            shutil.move(src, dst)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while moving the resource: {e}"
        )

    return {"message": "Commit successful"}
