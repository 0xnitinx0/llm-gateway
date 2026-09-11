from abc import ABC, abstractmethod
from typing import Any, List, Union


class LLMProvider(ABC):
    """Abstract base class for LLM provider implementations."""

    @abstractmethod
    async def generate(self, messages: List[Any]) -> str:
        """Generate a text response from the given chat messages."""
        pass