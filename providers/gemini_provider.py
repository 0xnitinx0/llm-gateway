import os
from typing import Any, List, Optional, Tuple

from google import genai
from google.genai.errors import APIError

from providers.base import LLMProvider


class GeminiProvider(LLMProvider):

    def __init__(
        self,
        model_name: Optional[str] = None,
        embedding_model_name: Optional[str] = None,
    ):
        self.model_name = model_name or os.getenv("GEMINI_MODEL", "models/gemini-3.5-flash-lite")
        self.embedding_model_name = embedding_model_name or os.getenv("GEMINI_EMBEDDING_MODEL", "models/gemini-embedding-001")

    def is_available(self) -> bool:
        return bool(os.getenv("GEMINI_API_KEY", "").strip())

    def get_client(self) -> genai.Client:

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not configured in environment")
        return genai.Client(api_key=api_key)

    async def generate(self, messages: List[Any]) -> Tuple[str, Optional[dict]]:
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
            token_usage = None
            if hasattr(response, "usage_metadata") and response.usage_metadata is not None:
                um = response.usage_metadata
                token_usage = {
                    "input_tokens": getattr(um, "prompt_token_count", None),
                    "output_tokens": getattr(um, "candidates_token_count", None),
                    "total_tokens": getattr(um, "total_token_count", None),
                }
            return (response.text or "", token_usage)
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