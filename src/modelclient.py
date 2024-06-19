import os
from groq import AsyncGroq, Groq
import ollama

class ModelClient:
    def __init__(self, model='llama3', async_mode=False):
        self.model = model
        self.async_mode = async_mode
        self.client = None
        self.init_client()

    def init_client(self):
        if self.model == 'groq':
            if self.async_mode:
                self.client = AsyncGroq(api_key=os.environ.get("GROQ_API_KEY"))
            else:
                self.client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        elif self.model in ['llama3', 'moondream']:
            if self.async_mode:
                self.client = ollama.AsyncClient()
            else:
                self.client = ollama.Client()
        else:
            raise ValueError("Unsupported model type. Use 'groq', 'llama3', or 'moondream'.")

    async def query_async(self, messages):
        if not self.async_mode:
            raise RuntimeError("The client is not set up for asynchronous operation.")
        if self.model == 'groq':
            response = await self.client.chat.completions.create(
                messages=messages,
                model="llama3-70b-8192",
                response_format={"type": "json_object"},
                temperature=0
            )
            response = response.choices[0].message.content
        elif self.model in ['llama3', 'moondream']:
            options = {}
            if self.model == 'moondream':
                options = {"num_predict": 128}
            response = await self.client.chat(
                messages=messages,
                model=self.model,
                options=options
            )
            response = response['message']['content']
        else:
            raise ValueError("Unsupported model type during query.")
        return response

    def query_sync(self, messages):
        if self.async_mode:
            raise RuntimeError("The client is not set up for synchronous operation.")
        if self.model == 'groq':
            response = self.client.chat.completions.create(
                messages=messages,
                model="llama3-70b-8192",
                response_format={"type": "json_object"},
                temperature=0
            )
            response = response.choices[0].message.content
        elif self.model in ['llama3', 'moondream']:
            options = {}
            if self.model == 'moondream':
                options = {"num_predict": 128}
            response = self.client.chat(
                messages=messages,
                model=self.model,
                options=options
            )
            response = response['message']['content']
        else:
            raise ValueError("Unsupported model type during query.")
        return response
