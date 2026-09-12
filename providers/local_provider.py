import asyncio
import json
import re
import time
from collections.abc import AsyncIterator
from typing import Any, Callable

from providers.base import LLMProvider, ProviderResult, ProviderUsage


def _content(message: Any) -> str:
    if isinstance(message, dict):
        return str(message.get("content", ""))
    return str(getattr(message, "content", ""))


class LocalFakeProvider(LLMProvider):
    """Deterministic offline stand-in that exercises the real gateway pipeline.

    It intentionally optimizes repeatability rather than pretending to be an
    intelligent model. Profiles make tournament fan-out visible; the judge
    profile is a separate provider call with a deterministic quality rubric.
    """

    def __init__(
        self,
        profile: str = "balanced",
        token_counter: Callable[[str], int] | None = None,
        token_delay_ms: int = 35,
        inference_delay_ms: int = 120,
    ):
        self.profile = profile
        self.name = f"local-{profile}"
        self.model_name = f"local-fake-{profile}"
        self._count = token_counter or (lambda value: len(value.split()))
        self._delay = max(token_delay_ms, 0) / 1000
        self._inference_delay = max(inference_delay_ms, 0) / 1000

    def is_available(self) -> bool:
        return True

    def _last_user_prompt(self, messages: list[Any]) -> str:
        for message in reversed(messages):
            role = message.get("role") if isinstance(message, dict) else getattr(message, "role", "")
            if role == "user":
                return _content(message)
        return _content(messages[-1]) if messages else ""

    def _render(self, messages: list[Any]) -> str:
        prompt = self._last_user_prompt(messages).strip()
        if self.profile == "judge":
            candidates = re.findall(
                r"CANDIDATE_ID:\s*([^\n]+)\nRESPONSE:\s*(.*?)(?=\nCANDIDATE_ID:|\Z)",
                prompt,
                re.DOTALL,
            )
            if not candidates:
                return json.dumps({"winner_id": "", "scores": {}, "reasoning": "No candidates were supplied."})
            scored = []
            for candidate_id, response in candidates:
                words = response.split()
                structure = 0.15 if any(mark in response for mark in ("-", ":", "\n")) else 0.0
                score = min(0.99, 0.45 + min(len(words), 100) / 250 + structure)
                scored.append((candidate_id.strip(), round(score, 3)))
            winner_id, _ = max(scored, key=lambda item: item[1])
            return json.dumps(
                {
                    "winner_id": winner_id,
                    "scores": dict(scored),
                    "reasoning": "Selected the response with the strongest combination of useful detail and readable structure.",
                }
            )

        clipped = prompt[:420]
        if self.profile == "concise":
            return f"Concise answer: {clipped}\n\nKey point: focus on the smallest correct explanation."
        if self.profile == "analytical":
            return (
                f"Analytical answer to: {clipped}\n\n"
                "1. Identify the core requirement.\n"
                "2. Explain the mechanism and trade-offs.\n"
                "3. Validate the result with observable evidence."
            )
        if self.profile == "practical":
            return (
                f"Practical answer: {clipped}\n\n"
                "- Start with a minimal working path.\n"
                "- Measure the result.\n"
                "- Handle failure explicitly and iterate."
            )
        return f"Local demo response: {clipped}\n\nThis response was generated without a cloud API."

    async def generate(
        self,
        messages: list[Any],
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> ProviderResult:
        started = time.perf_counter()
        # A small deterministic delay models local inference and makes the
        # semantic-cache latency benefit visible without a cloud dependency.
        if self._inference_delay:
            await asyncio.sleep(self._inference_delay)
        text = self._render(messages)
        if max_tokens:
            text = " ".join(text.split()[:max_tokens])
        prompt_text = "\n".join(_content(message) for message in messages)
        return ProviderResult(
            text=text,
            usage=ProviderUsage(self._count(prompt_text), self._count(text)),
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
        result = await self.generate(messages, temperature=temperature, max_tokens=max_tokens)
        pieces = re.findall(r"\S+\s*", result.text)
        for piece in pieces:
            if self._delay:
                await asyncio.sleep(self._delay)
            yield piece
