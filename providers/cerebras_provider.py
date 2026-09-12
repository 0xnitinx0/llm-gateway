import os
from typing import Any, List, Optional, Tuple
import httpx

from providers.base import LLMProvider


class CerebrasProvider(LLMProvider):

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or os.getenv("CEREBRAS_MODEL", "gpt-oss-120b")
        self.api_url = "https://api.cerebras.ai/v1/chat/completions"

    def is_available(self) -> bool:
        return bool(os.getenv("CEREBRAS_API_KEY", "").strip())

    async def generate(self, messages: List[Any]) -> Tuple[str, Optional[dict]]:
        api_key = os.getenv("CEREBRAS_API_KEY", "").strip()
        if not api_key:
            raise ValueError("CEREBRAS_API_KEY is not configured in environment")

        formatted_messages = []
        for msg in messages:
            if isinstance(msg, dict):
                role = msg.get("role", "user")
                content = msg.get("content", "")
            else:
                role = getattr(msg, "role", "user")
                content = getattr(msg, "content", "")
            formatted_messages.append({"role": role, "content": content})

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model_name,
            "messages": formatted_messages,
            "temperature": 0.7,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(self.api_url, headers=headers, json=payload)
                if response.status_code != 200:
                    raise RuntimeError(f"Cerebras API returned status {response.status_code}: {response.text}")
                data = response.json()
                text = data["choices"][0]["message"]["content"]
                usage_raw = data.get("usage", {})
                token_usage = None
                if usage_raw:
                    token_usage = {
                        "input_tokens": usage_raw.get("prompt_tokens"),
                        "output_tokens": usage_raw.get("completion_tokens"),
                        "total_tokens": usage_raw.get("total_tokens"),
                    }
                return (text or "", token_usage)
        except Exception as exc:
            raise RuntimeError(f"Failed to generate response from Cerebras provider: {exc}") from exc

    async def embed(self, text: str) -> List[float]:
        from providers.gemini_provider import GeminiProvider
        return await GeminiProvider().embed(text)
