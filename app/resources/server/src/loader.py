# loader.py

import asyncio
import json
import os
from collections import defaultdict
from llama_index.core import Document, SimpleDirectoryReader
from llama_index.core.schema import ImageDocument
from llama_index.core.node_parser import TokenTextSplitter
from termcolor import colored
from .modelclient import ModelClient
import time
from .db import get_summary_from_db

# Logging function
def log(text="", console_only=False):
    if not console_only:
        # Write to the latest.log file
        with open('./latest.log', 'a') as log_file:
            timestamp = time.strftime("[%Y-%m-%d %H:%M:%S]")
            log_file.write(f"{timestamp} {text}\n")
    return

# @weave.op()
# @agentops.record_function("summarize")
async def get_dir_summaries(path: str, model: str, instruction: str, groq_api_key: str, notify_clients, task_id: str):
    doc_dicts = load_documents(path)
    async for summary in get_summaries(doc_dicts, model, instruction, groq_api_key, notify_clients, task_id):
        await notify_clients(task_id, {"event": "log", "message": f"Processed: {summary['file_path']}"})
        yield summary
    # [
    #     {
    #         file_path:
    #         file_name:
    #         file_size:
    #         content:
    #         summary:
    #         creation_date:
    #         last_modified_date:
    #     }
    # ]

# @weave.op()
# @agentops.record_function("load")
def load_documents(path: str):
    reader = SimpleDirectoryReader(
        input_dir=path,
        recursive=True,
        required_exts=[
            ".pdf",
            ".txt",
            ".png",
            ".jpg",
            ".jpeg",
        ],
    )
    splitter = TokenTextSplitter(chunk_size=6144)
    documents = []
    for docs in reader.iter_data():
        if len(docs) > 1:
            for d in docs:
                contents = splitter.split_text("\n".join(d.text))
                if len(contents) > 0:
                    text = contents[0]
                else:
                    text = ""
                documents.append(Document(text=text, metadata=docs[0].metadata))
        else:
            documents.append(docs[0])
    return documents

# @weave.op()
# @agentops.record_function("metadata")
def process_metadata(doc_dicts):
    file_seen = set()
    metadata_list = []
    for doc in doc_dicts:
        if doc["file_path"] not in file_seen:
            file_seen.add(doc["file_path"])
            metadata_list.append(doc)
    return metadata_list

async def summarize_single_document(file_path: str, instruction: str, model: str, groq_api_key: str) -> str:
    client = ModelClient(model=model, async_mode=True, groq_api_key=groq_api_key)
    image_client = ModelClient(model="moondream", async_mode=True)

    # Check the file extension to determine if it is an image
    file_extension = os.path.splitext(file_path)[1].lower()

    if file_extension in [".png", ".jpg", ".jpeg"]:
        document = ImageDocument(image_path=file_path, metadata={"file_path": file_path})
        summary = await summarize_image_document(document, image_client, instruction)
    else:
        with open(file_path, 'r') as file:
            content = file.read()
        document = Document(text=content, metadata={"file_path": file_path})
        summary = await summarize_document({"content": document.text, **document.metadata}, client, instruction)

    return summary.get("summary", "")

async def summarize_document(doc, client, instruction):

    PROMPT = f"""
    You will be provided with the contents of a file along with its metadata. Provide a summary of the contents. The purpose of the summary is to organize files based on their content. To this end provide a concise but informative summary. Make the summary as specific to the file as possible.

    This summary will be used in the following larger task: {instruction}

    Keep this larger task in mind when deciding what relevant content to include in the summary.

    Limit your output to a summary of the file only. Do not include any fluff sentences or other information beyond the summary.
    """.strip()

    response = await client.query_async([
        {"role": "system", "content": PROMPT},
        {"role": "user", "content": json.dumps(doc)},
    ])

    if response is not None:
        summary = {
            "file_path": doc["file_path"],
            "summary": response.strip()
        }
    else:
        summary = {
            "file_path":doc["file_path"],
            "summary":"File was too large to be processed."
        }

    log(f"Summary completed: {summary}")

    return summary

async def summarize_image_document(doc: ImageDocument, client, instruction):

    PROMPT = f"""
    Summarize the contents of this image.

    This summary will be used in the following larger task: {instruction}

    Keep this larger task in mind when deciding what relevant content to include in the summary. 

    Limit your output to a summary describing the contents of this image in plain text only.
    ```
    """.strip()

    response = await client.query_async([
        {
            "role": "user",
            "content": PROMPT,
            "images": [doc.image_path]
        }
    ])

    if response is not None:
        summary = {
            "file_path": doc.image_path,
            "summary": response.strip()
        }
    else:
        summary = {
            "file_path":doc.image_path,
            "summary":"Image was too large to be processed."
        }

    log(f"Summary completed: {summary}")

    return summary

async def dispatch_summarize_document(doc, client, image_client, instruction):
    file_path = doc.metadata['file_path'] if isinstance(doc, Document) else doc.image_path

    existing_summary = await get_summary_from_db(file_path)
    if existing_summary:
        log(f"existing summary utilized! {file_path}")
        return {"file_path": file_path, "summary": existing_summary}

    if isinstance(doc, ImageDocument):
        return await summarize_image_document(doc, image_client, instruction)
    elif isinstance(doc, Document):
        return await summarize_document({"content": doc.text, **doc.metadata}, client, instruction)
    else:
        raise ValueError("Document type not supported")
    
async def get_summaries(documents, model: str, instruction: str, groq_api_key: str, notify_clients, task_id: str):
    client = ModelClient(model=model, async_mode=True, groq_api_key=groq_api_key)
    image_client = ModelClient(model="moondream", async_mode=True)

    documents_length = len(documents)

    for i, doc in enumerate(documents):
        summary = await dispatch_summarize_document(doc, client, image_client, instruction)
        await notify_clients(task_id, {"event": "progress", "type": 0, "progress": f"{i + 1}/{documents_length}"})
        yield summary
        
# @weave.op()
# @agentops.record_function("merge")
def merge_summary_documents(summaries, metadata_list):
    list_summaries = defaultdict(list)

    for item in summaries:
        list_summaries[item["file_path"]].append(item["summary"])

    file_summaries = {
        path: ". ".join(summaries) for path, summaries in list_summaries.items()
    }

    file_list = [
        {"summary": file_summaries[file["file_path"]], **file} for file in metadata_list
    ]

    return file_list