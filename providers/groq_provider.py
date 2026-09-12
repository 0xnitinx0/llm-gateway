import os

from providers.http_provider import OpenAIWireProvider


class GroqProvider(OpenAIWireProvider):
    def __init__(self, model_name: str | None = None):
        super().__init__(
            name="groq",
            model_name=model_name or os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            api_url="https://api.groq.com/openai/v1/chat/completions",
            api_key_env="GROQ_API_KEY",
        )
