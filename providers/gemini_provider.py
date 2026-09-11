import os
from typing import Any, List

from google import genai
from google.genai.errors import APIError

from providers.base import LLMProvider


class GeminiProvider(LLMProvider):

    def __init__(
        self,
        model_name: str = "gemini-3.5-flash",
        embedding_model_name: str = "gemini-embedding-001",
    ):
        self.model_name = model_name
        self.embedding_model_name = embedding_model_name

    def get_client(self) -> genai.Client:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not configured in environment")
        return genai.Client(api_key=api_key)

    async def generate(self, messages: List[Any]) -> str:
        client = self.get_client()

        formatted_messages = []
        for msg in messages:
            if isinstance(msg, dict):
                role = msg.get("role", "user")
                content = msg.get("content", "")
            else:
                role = getattr(msg, "role", "user")
                content = getattr(msg, "content", "")
            formatted_messages.append(f"{role}: {content}")

        prompt = "\n".join(formatted_messages)

        try:
            response = await client.aio.models.generate_content(
                model=self.model_name,
                contents=prompt,
            )
            return response.text or ""
        except APIError as err:
            raise RuntimeError(f"Gemini API error: {err.message or 'Provider request failed'}") from err
        except Exception as exc:
            raise RuntimeError(f"Failed to generate response from Gemini provider: {exc}") from exc

    async def embed(self, text: str) -> List[float]:
        client = self.get_client()

        try:
            response = await client.aio.models.embed_content(
                model=self.embedding_model_name,
                contents=text,
            )
            if hasattr(response, "embeddings") and response.embeddings:
                return response.embeddings[0].values
            raise RuntimeError("No embedding vector returned by provider")
        except APIError as err:
            raise RuntimeError(f"Gemini embedding API error: {err.message or 'Embedding request failed'}") from err
        except Exception as exc:
            raise RuntimeError(f"Failed to generate embeddings from Gemini provider: {exc}") from exc