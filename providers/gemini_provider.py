import os
import time
from collections.abc import AsyncIterator
from typing import Any

from google import genai

from providers.base import LLMProvider, ProviderResult, ProviderUsage


class GeminiProvider(LLMProvider):
    def __init__(self, model_name: str | None = None):
        self.name = "gemini"
        self.model_name = model_name or os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    def is_available(self) -> bool:
        return bool(os.getenv("GEMINI_API_KEY", "").strip())

    def _client(self) -> genai.Client:
        key = os.getenv("GEMINI_API_KEY", "").strip()
        if not key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        return genai.Client(api_key=key)

    def _prompt(self, messages: list[Any]) -> str:
        lines = []
        for message in messages:
            role = message.get("role", "user") if isinstance(message, dict) else getattr(message, "role", "user")
            content = message.get("content", "") if isinstance(message, dict) else getattr(message, "content", "")
            lines.append(f"{role}: {content}")
        return "\n".join(lines)

    async def generate(
        self,
        messages: list[Any],
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> ProviderResult:
        started = time.perf_counter()
        response = await self._client().aio.models.generate_content(
            model=self.model_name,
            contents=self._prompt(messages),
            config={"temperature": temperature, "max_output_tokens": max_tokens} if max_tokens else {"temperature": temperature},
        )
        metadata = getattr(response, "usage_metadata", None)
        usage = ProviderUsage(
            getattr(metadata, "prompt_token_count", 0) or 0,
            getattr(metadata, "candidates_token_count", 0) or 0,
        )
        return ProviderResult(
            text=response.text or "",
            usage=usage,
            provider=self.name,
            model=self.model_name,
            latency_ms=(time.perf_counter() - started) * 1000,
        )

    async def stream(
        self,
        messages: list[Any],
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> AsyncIterator[str]:
        stream = await self._client().aio.models.generate_content_stream(
            model=self.model_name,
            contents=self._prompt(messages),
            config={"temperature": temperature, "max_output_tokens": max_tokens} if max_tokens else {"temperature": temperature},
        )
        async for chunk in stream:
            if chunk.text:
                yield chunk.text
