from abc import ABC, abstractmethod
from typing import Any, List


class LLMProvider(ABC):
    """Abstract base class for LLM provider implementations."""

    @abstractmethod
    async def generate(self, messages: List[Any]) -> str:
        """Generate a text response from the given chat messages."""
        pass

    @abstractmethod
    async def embed(self, text: str) -> List[float]:
        """Generate vector embeddings for the given input text."""
        pass