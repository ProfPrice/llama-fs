# tree_generator.py

import json
import os
from .modelclient import ModelClient
import time

# Logging function
def log(text="", console_only=False):
    if not console_only:
        # Write to the latest.log file
        with open('./latest.log', 'a') as log_file:
            timestamp = time.strftime("[%Y-%m-%d %H:%M:%S]")
            log_file.write(f"{timestamp} {text}\n")
    return

def get_deepest_paths(directories):
    # Helper function to get the deepest unique paths
    deepest_paths = set()
    for directory in directories:
        parts = directory.strip('/').split('/')
        for i in range(1, len(parts) + 1):
            deepest_paths.add('/' + '/'.join(parts[:i]))
    return deepest_paths

async def create_file_tree(path: str, summaries: list, model: str, instruction: str, max_tree_depth: str, file_format: str, groq_api_key: str, notify_clients, task_id: str):
    BATCH_SIZE = 1  # Process 10 summaries at a time

    FILE_PROMPT_TEMPLATE = """
    You just received a list of source files and a summary of their contents. For each file, propose a new path and filename, using a directory structure that optimally organizes the files using known conventions and best practices.
    Follow good naming conventions. Here are a few guidelines:
    - Think about your files: What related files are you working with?
    - Identify metadata (for example, date, sample, experiment): What information is needed to easily locate a specific file?
    - Abbreviate or encode metadata
    - Use versioning: Are you maintaining different versions of the same file?
    - Think about how you will search for your files: What comes first?
    - Deliberately separate metadata elements: Avoid spaces or special characters in your file names
    If the file is already named well or matches a known convention, set the destination path to the same as the source path.

    You must keep the new_path at or below a max depth of {max_tree_depth} folders from the base.
    If the new_path is "/organized_file.png", this is a depth of 0. A new_path of "/one/two/three/organized_file.png" is a depth of 3.
    Remember, keep new_path outputs in your response to a max depth of {max_tree_depth} or less. You must not exceed {max_tree_depth} directories deep.
    The number of directories deep any file exists must be no more than {max_tree_depth}, ideally less. Most files should be within 2 or 3 directory levels.

    Here is the list of the deepest paths created so far:
    {deepest_paths}

    Do not use too generic names like "organized" or "organized_files" or similar names in directories or files. Be descriptive with your names, 
    using things such as relevant dates or similar concepts from the summaries for each file.

    Additionally in terms of organizing conventions for each file, use the following as a final guidance for how to name the directories and subdirectires along new_path as you relate the summary to a potential new_path: {instruction}

    Do not include ANYTHING ELSE in your response output except this JSON object as plain text. No prepending or appended introduction or explanation of your work, only the following JSON.
    Your response must be a JSON object with the following schema:
    {{
        "files": [
            {{
                "file_path": "original file_path",
                "new_path": "new file path under proposed directory structure with proposed file name and identical file extension. Keep the file extension and do not modify it."
            }}
        ]
    }}

    Limit your response to this JSON content, where there is an entry in "files" for every individual summary.
    Carefully refer to the original file path for each summary, and create an appropriate dst_path.
    Do not include ANYTHING ELSE in your response except this JSON object as plain text. No prepending or appended introduction or explanation of your work, only the JSON.
    The "files" list must be the same length as the original summaries, and for each file_path from the summaries, should exist in the new JSON as file_path with a corresponding new_path.
    Do not make up file_path entries, re-use them from the incoming summaries JSON list.
    """.strip()

    # TO ADD:
    #    
    #You must keep the new_path at or below a max depth of {max_tree_depth} folders from the base.
    #If the new_path is "/organized_file.png", this is a depth of 0. A new_path of "/one/two/three/organized_file.png" is a depth of 3.
    #Remember, keep new_path outputs in your response to a max depth of {max_tree_depth} or less. You must not exceed {max_tree_depth} directories deep.
    #The number of directories deep any file exists must be no more than {max_tree_depth}, ideally less. Most files should be within 2 or 3 directory levels.
    
    client = ModelClient(model=model, groq_api_key=groq_api_key)
    final_files = []  # List to accumulate results from all batches
    all_new_paths = set()  # Set to track all new paths

    # Adjust file paths in summaries
    for summary in summaries:
        summary["file_path"] = (summary["file_path"]).replace(path, "/").replace("\\", "")

    # Process each batch
    for i in range(0, len(summaries), BATCH_SIZE):
        done = False

        while not done:
            try:
                batch_summaries = summaries[i:i + BATCH_SIZE]  # Get current batch

                # Update the deepest paths for the current FILE_PROMPT
                deepest_paths = "\n".join(sorted(get_deepest_paths(all_new_paths)))

                FILE_PROMPT = FILE_PROMPT_TEMPLATE.format(
                    instruction=instruction,
                    deepest_paths=deepest_paths,
                    max_tree_depth=max_tree_depth
                )

                response = client.query_sync([
                    {"role": "user", "content": json.dumps(batch_summaries)},
                    {"role": "user", "content": FILE_PROMPT},
                ])

                # Log the raw response for debugging
                #log(f"batch_summaries: {batch_summaries}")
                #log(f"deepest_paths: {deepest_paths}")
                log(f"response: {response}")

                # Ensure the response is a valid JSON string
                if not response:
                    raise ValueError("Received empty response from ModelClient")

                try:
                    batch_files = json.loads(response)["files"]
                except json.JSONDecodeError:
                    log(f"Failed to decode JSON response: {response}")
                    raise

                final_files.extend(batch_files)

                # Update the set of all new paths
                for file_info in batch_files:
                    new_path = file_info["new_path"]
                    new_dir = os.path.dirname(new_path)
                    all_new_paths.add(new_dir)

                done = True

                await notify_clients(task_id, {"event": "progress", "type": 2, "progress": f"{i + 1}/{len(summaries)}"})

            except Exception as e:
                log(str(e))

    return final_files