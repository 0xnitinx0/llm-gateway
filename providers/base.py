from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class ProviderUsage:
    prompt_tokens: int = 0
    completion_tokens: int = 0

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens


@dataclass(slots=True)
class ProviderResult:
    text: str
    usage: ProviderUsage
    provider: str
    model: str
    latency_ms: float = 0.0


class LLMProvider(ABC):
    """Boundary between gateway orchestration and any local/remote model."""

    name: str
    model_name: str

    @abstractmethod
    def is_available(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def generate(
        self,
        messages: list[Any],
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> ProviderResult:
        raise NotImplementedError

    @abstractmethod
    async def stream(
        self,
        messages: list[Any],
        *,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> AsyncIterator[str]:
        """Yield provider output incrementally rather than buffering a response."""
        if False:
            yield ""
        raise NotImplementedError
