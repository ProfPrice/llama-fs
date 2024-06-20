# LlamaFS v1.1

<img src="frontend/assets/llama_fs.png" width="30%" />

## Note from cappycap

This version of llama-fs is forked from the original over at [iyaja/llama-fs](https://github.com/iyaja/llama-fs).

While they did an excellent job of a proof-of-concept for their hackathon, their application did not work with anything except groq and moondream, didn't actually use the instructions provided by the user, etc. But more importantly, it wasn't accessible to non tech-savvy individuals.

So I decided to take what they started and continue development with my own design principles. Here's what I have planned...

### New Features
| Feature               | Status      | Notes               |
|-----------------------|-------------|---------------------|
| Implement user instructions    | ☒ Done  | Prompt was promised but missing from original repo. Allow users to provide an organization strategy via prompt, and a maximum tree depth value |
| non-moondream llama3 support | ☒ Done  | Promised but missing from original repo. Switch between llama3 or groq depending on your privacy concerns and compute power.  |
| Whisper support | ☐ In Progress  | Promised but missing from original repo. Allows the system to contextualize and organize audio files.  |
| Frontend model controls | ☐ In Progress  | Allow users to provide instructions and max tree depth value. |
| Frontend move, duplicate options | ☐ In Progress  | Toggle how the system handles quick file organization |
| Frontend preview changes mode | ☐ In Progress  | Instead of quick organization, preview changes and individually move, duplicate, or remove files intelligently |
| Frontend Windows context menu (right click) integration | ☐ Todo  | Quickly begin organization by right clicking files in File Explorer |
| Compiled Windows installer for public use | ☐ Todo  | Allows LlamaFS to be installed for general use |
| Compiled Mac installer for public use | ☐ Todo  | Allows LlamaFS to be installed for general use |

## Inspiration

[Watch the explainer video](https://x.com/AlexReibman/status/1789895425828204553)

Open your `~/Downloads` directory. Or your Desktop. It's probably a mess...

> There are only two hard things in Computer Science: cache invalidation and **naming things**.

## What it does

LlamaFS is a self-organizing file manager. It automatically renames and organizes your files based on their content and well-known conventions (e.g., time). It supports many kinds of files, including images (through Moondream) and audio (through Whisper).

LlamaFS runs in two "modes" - as a batch job (batch mode), and an interactive daemon (watch mode).

In batch mode, you can send a directory to LlamaFS, and it will return a suggested file structure and organize your files.

In watch mode, LlamaFS starts a daemon that watches your directory. It intercepts all filesystem operations and uses your most recent edits to proactively learn how you rename file. For example, if you create a folder for your 2023 tax documents, and start moving 1-3 files in it, LlamaFS will automatically create and move the files for you!

Uh... Sending all my personal files to an API provider?! No thank you!

It also has a toggle for "incognito mode," allowing you route every request through Ollama instead of Groq. Since they use the same Llama 3 model, the perform identically.

## How we built it

We built LlamaFS on a Python backend, leveraging the Llama3 model through Groq for file content summarization and tree structuring. For local processing, we integrated Ollama running the same model to ensure privacy in incognito mode. The frontend is crafted with Electron, providing a sleek, user-friendly interface that allows users to interact with the suggested file structures before finalizing changes.

- **It's extremely fast!** (by LLM standards)! Most file operations are processed in <500ms in watch mode (benchmarked by [AgentOps](https://agentops.ai/?utm_source=llama-fs)). This is because of our smart caching that selectively rewrites sections of the index based on the minimum necessary filesystem diff. And of course, Groq's super fast inference API. 😉

- **It's immediately useful** - It's very low friction to use and addresses a problem almost everyone has. We started using it ourselves on this project (very Meta).

## Installation

### Prerequisites

Before installing, ensure you have the following requirements:
- Python 3.10 or higher
- pip (Python package installer)

### Installing

To install the project, follow these steps:
1. Clone the repository:
   ```bash
   git clone https://github.com/iyaja/llama-fs.git
   ```

2. Navigate to the project directory:
    ```bash
    cd llama-fs
    ```

3. Install requirements
   ```bash
   pip install -r requirements.txt
   ```

4. (Optional) Install moondream if you
   want to use the incognito mode
    ```bash
    ollama pull moondream
    ```

## Usage

To serve the application locally using FastAPI, run the following command
   ```bash
   fastapi dev server.py
   ```

This will run the server by default on port 8000. The API can be queried using a `curl` command, and passing in the file path as the argument. For example, on the Downloads folder:
   ```bash
   curl -X POST http://127.0.0.1:8000/batch \
    -H "Content-Type: application/json" \
    -d '{"path": "/Users/<username>/Downloads/", "instruction": "string", "incognito": false}'
   ```
