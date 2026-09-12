import json
import os
import time
from collections.abc import AsyncIterator
from typing import Any

import httpx

from providers.base import LLMProvider, ProviderResult, ProviderUsage


class OpenAIWireProvider(LLMProvider):
    """Adapter for providers exposing the OpenAI chat-completions wire format."""

    def __init__(self, *, name: str, model_name: str, api_url: str, api_key_env: str):
        self.name = name
        self.model_name = model_name
        self.api_url = api_url
        self.api_key_env = api_key_env

    def is_available(self) -> bool:
        return bool(os.getenv(self.api_key_env, "").strip())

    def _messages(self, messages: list[Any]) -> list[dict[str, str]]:
        return [
            {
                "role": message.get("role", "user") if isinstance(message, dict) else getattr(message, "role", "user"),
                "content": message.get("content", "") if isinstance(message, dict) else getattr(message, "content", ""),
            }
            for message in messages
        ]

    def _headers(self) -> dict[str, str]:
        key = os.getenv(self.api_key_env, "").strip()
        if not key:
            raise RuntimeError(f"{self.api_key_env} is not configured")
        return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    async def generate(
        self,
        messages: list[Any],
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> ProviderResult:
        started = time.perf_counter()
        payload: dict[str, Any] = {
            "model": self.model_name,
            "messages": self._messages(messages),
            "temperature": temperature,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(self.api_url, headers=self._headers(), json=payload)
            response.raise_for_status()
        data = response.json()
        raw_usage = data.get("usage", {})
        return ProviderResult(
            text=data["choices"][0]["message"]["content"] or "",
            usage=ProviderUsage(
                raw_usage.get("prompt_tokens", 0),
                raw_usage.get("completion_tokens", 0),
            ),
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
        payload: dict[str, Any] = {
            "model": self.model_name,
            "messages": self._messages(messages),
            "temperature": temperature,
            "stream": True,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream("POST", self.api_url, headers=self._headers(), json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    chunk = json.loads(data)
                    token = chunk.get("choices", [{}])[0].get("delta", {}).get("content")
                    if token:
                        yield token
