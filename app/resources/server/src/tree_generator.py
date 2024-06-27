import json
import os
from .modelclient import ModelClient

def create_file_tree(summaries: list, model: str, instruction: str, max_tree_depth: str, file_format: str, groq_api_key: str):
    BATCH_SIZE = 10  # Process 10 summaries at a time

    FILE_PROMPT = f"""
    You just received a list of source files and a summary of their contents. For each file, propose a new path and filename, using a directory structure that optimally organizes the files using known conventions and best practices.
    Follow good naming conventions. Here are a few guidelines:
    - Think about your files: What related files are you working with?
    - Identify metadata (for example, date, sample, experiment): What information is needed to easily locate a specific file?
    - Abbreviate or encode metadata
    - Use versioning: Are you maintaining different versions of the same file?
    - Think about how you will search for your files: What comes first?
    - Deliberately separate metadata elements: Avoid spaces or special characters in your file names
    If the file is already named well or matches a known convention, set the destination path to the same as the source path.

    The user specified the following as what specifically to focus on in this task: {instruction}

    You must keep the new_path at or below a max depth of {max_tree_depth} folders from the base.
    If the new_path is "/organized_file.png", this is a depth of 0. A new_path of "/one/two/three/organized_file.png" is a depth of 3.
    Remember, keep new_path outputs in your response to a max depth of {max_tree_depth} or less.

    When you generate a new_path's file name while organizing it, you must follow this format for naming the file: 
    {file_format}
    You must follow this format when naming the final file. Do not use this format in the directory you place a file in, but the filename itself.
    For example /one/two/three/(use the format here for filename), you use the format for the filename and not the directories before it.
    Here are what elements of the file formats represent:
    - Y, M, D is Year, Month, Day that the file was most recently modified in its metadata.
    - CONTENT is a brief summary of a few key words the content of the file, based on the provided summary.
    - EXT is the extension of the file, taken from the original file path such as jpg, png, pdf, etc.

    Your response must be a JSON object with the following schema:
    {{
        "files": [
            {{
                "file_path": "original file_path",
                "new_path": "new file path under proposed directory structure with proposed file name"
            }}
        ]
    }}

    Limit your response to this JSON content, where there is an entry in "files" for every individual summary.
    Carefully refer to the original file path for each summary, and create an appropriate dst_path.
    Do not include ANYTHING ELSE in your response except this JSON object as plain text. No prepending or appended introduction or explanation of your work, only the JSON.
    The "files" list must be the same length as the original summaries, and for each file_path from the summaries, should exist in the new JSON as file_path with a corresponding new_path.
    Do not make up file_path entries, re-use them from the incoming summaries JSON list.
    """.strip()

    client = ModelClient(model=model, groq_api_key=groq_api_key)
    final_files = []  # List to accumulate results from all batches

    # Process each batch
    for i in range(0, len(summaries), BATCH_SIZE):
        
        done = False

        while not done:
            try:
                batch_summaries = summaries[i:i + BATCH_SIZE]  # Get current batch
                response = client.query_sync([
                    {"role": "user", "content": json.dumps(batch_summaries)},
                    {"role": "user", "content": FILE_PROMPT},
                ])

                if os.environ.get("DEBUG_MODE") == "true":
                    print(f"Processing batch {i//BATCH_SIZE + 1} / {int(len(summaries)/BATCH_SIZE)}")
                    print("summaries:")
                    print(batch_summaries)
                    print('file_tree response:')
                    print(response)

                batch_files = json.loads(response)["files"]
                final_files.extend(batch_files) 
                done = True
            except Exception as e:
                print(e)

    return final_files
