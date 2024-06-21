import shutil
import os
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from src.loader import get_dir_summaries
from src.tree_generator import create_file_tree

# Set to True for debug printing.
os.environ["DEBUG_MODE"] = "true"

app = FastAPI()

origins = [
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "organize it!"}

# We take in a folder located at path, and use the given model and instructions to generate recommended 
# new file locations for every file within the path.
# Example input:
# {
#     "path": "/Users/A/Downloads/images",
#     "instruction": "Organize and rename the images by the dominant color present in the image and the actual content itself.",
#     "model": "llama3",
#     "max_tree_depth": "3",
#     "file_format": "{MONTH}_{DAY}_{YEAR}_{CONTENT}.{EXTENSION}",
#     "groq_api_key": ""
# }
class Request(BaseModel):
    path: Optional[str] = None
    instruction: Optional[str] = None
    model: Optional[str] = "llama3"
    max_tree_depth: Optional[str] = "3"
    file_format: Optional[str] = "{MONTH}_{DAY}_{YEAR}_{CONTENT}.{EXTENSION}"
    groq_api_key: Optional[str] = ""

# Example output from endpoint:
# [
#    {
#         "file_path": "0.jpg",
#         "new_path": "monochrome/images/2D World Building.jpg",
#         "summary": "\n A black and white image of a building with the text \"2D World Building\" in white letters."
#    },
# ]
@app.post("/batch")
async def batch(request: Request):

    path = request.path
    model = request.model
    instruction = request.instruction
    max_tree_depth = request.max_tree_depth
    file_format = request.file_format
    groq_api_key = request.groq_api_key

    if not os.path.exists(path):
        raise HTTPException(
            status_code=400, detail="Path does not exist in filesystem")
    
    summaries = await get_dir_summaries(path, model, instruction, groq_api_key)
    files = create_file_tree(summaries, model, instruction, max_tree_depth, file_format, groq_api_key)

    tree = {}
    for file in files:
        parts = Path(file["new_path"]).parts
        current = tree
        for part in parts:
            current = current.setdefault(part, {})

    tree = {path: tree}

    if os.environ.get("DEBUG_MODE") == "true":
        from asciitree import LeftAligned
        from asciitree.drawing import BOX_LIGHT, BoxStyle
        tr = LeftAligned(draw=BoxStyle(gfx=BOX_LIGHT, horiz_len=1))
        print(tr(tree))

    for file in files:
        file["summary"] = summaries[files.index(file)]["summary"]

    if os.environ.get("DEBUG_MODE") == "true":
        print("operation complete!")

    return files

# Perform OS operation to move a single file to a new location.
class MoveRequest(BaseModel):
    base_path: str
    src_path: str 
    new_path: str 

@app.post("/move")
async def move(request: MoveRequest):
    src = os.path.join(request.base_path, request.src_path)
    dst = os.path.join(request.base_path, request.new_path)

    if not os.path.exists(src):
        raise HTTPException(
            status_code=400, detail="Source path does not exist in filesystem"
        )

    dst_directory = os.path.dirname(dst)
    os.makedirs(dst_directory, exist_ok=True)

    try:
        if os.path.isfile(src) and os.path.isdir(dst):
            shutil.move(src, os.path.join(dst, os.path.basename(src)))
        else:
            shutil.move(src, dst)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while moving the resource: {e}"
        )

    return {"message": "Move successful"}


# Perform OS operation to duplicate a single file to a new location.
class DuplicateRequest(BaseModel):
    base_path: str
    src_path: str 
    new_path: str 

@app.post("/duplicate")
async def duplicate(request: DuplicateRequest):
    src = os.path.join(request.base_path, request.src_path)

    if not os.path.exists(src):
        raise HTTPException(
            status_code=400, detail="Source path does not exist in filesystem"
        )

    base_copy_path = request.base_path + " (AI Copy)"
    relative_new_path = request.new_path

    dst = os.path.join(base_copy_path, relative_new_path)
    count = 1
    unique_base_path = base_copy_path
    while os.path.exists(dst):
        unique_base_path = f"{base_copy_path} ({count})"
        dst = os.path.join(unique_base_path, relative_new_path)
        count += 1

    os.makedirs(os.path.dirname(dst), exist_ok=True)

    try:
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while duplicating the resource: {e}"
        )

    return {"message": "Duplicate successful", "new_path": dst}
