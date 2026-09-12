from abc import ABC, abstractmethod
from typing import Any, List, Optional, Tuple


class LLMProvider(ABC):
    """Abstract base class for LLM provider implementations."""

    @abstractmethod
    def is_available(self) -> bool:
        """Check if provider API key and configuration are available."""
        pass

    @abstractmethod
    async def generate(self, messages: List[Any]) -> Tuple[str, Optional[dict]]:
        """Generate a text response and token usage metrics from chat messages."""
        pass

    @abstractmethod
    async def embed(self, text: str) -> List[float]:
        """Generate vector embeddings for the given input text."""
        pass