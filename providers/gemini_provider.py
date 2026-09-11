import os
from typing import Any, List

from google import genai
from google.genai.errors import APIError

from providers.base import LLMProvider


class GeminiProvider(LLMProvider):

    def __init__(self, model_name: str = "gemini-3.5-flash"):
        self.model_name = model_name
        self._client = None

    @property
    def client(self) -> genai.Client:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not configured in environment")
        if self._client is None:
            self._client = genai.Client(api_key=api_key)
        return self._client

    async def generate(self, messages: List[Any]) -> str:
        # Validate environment configuration
        client = self.client

        # Format messages into string prompt for Gemini
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
            raise RuntimeError("Failed to generate response from Gemini provider") from exc