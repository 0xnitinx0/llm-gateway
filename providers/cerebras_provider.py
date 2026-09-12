import os

from providers.http_provider import OpenAIWireProvider


class CerebrasProvider(OpenAIWireProvider):
    def __init__(self, model_name: str | None = None):
        super().__init__(
            name="cerebras",
            model_name=model_name or os.getenv("CEREBRAS_MODEL", "llama-3.3-70b"),
            api_url="https://api.cerebras.ai/v1/chat/completions",
            api_key_env="CEREBRAS_API_KEY",
        )
