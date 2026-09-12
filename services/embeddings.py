import asyncio
import hashlib
import math
from typing import Protocol

from app.config import Settings


class Embedder(Protocol):
    async def embed(self, text: str) -> list[float]: ...
    def count_tokens(self, text: str) -> int: ...


class FastEmbedEmbedder:
    """Maps prompt meaning into normalized 384-D vectors using local ONNX inference."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._model = None

    def load(self) -> None:
        from fastembed import TextEmbedding

        kwargs = {"model_name": self.settings.embedding_model}
        if self.settings.embedding_model_path:
            kwargs["cache_dir"] = self.settings.embedding_model_path
        self._model = TextEmbedding(**kwargs)
        list(self._model.embed(["warmup"], batch_size=1))

    def _require_model(self):
        if self._model is None:
            self.load()
        return self._model

    async def embed(self, text: str) -> list[float]:
        model = self._require_model()

        def encode() -> list[float]:
            return next(model.embed([text], batch_size=1)).tolist()

        return await asyncio.to_thread(encode)

    def count_tokens(self, text: str) -> int:
        """Stable local approximation used consistently for before/after metrics."""
        import re

        return len(re.findall(r"\w+|[^\w\s]", text, flags=re.UNICODE))


class HashingEmbedder:
    """Tiny deterministic test double; production uses FastEmbedEmbedder."""

    def __init__(self, dimensions: int = 384):
        self.dimensions = dimensions

    async def embed(self, text: str) -> list[float]:
        vector = [0.0] * self.dimensions
        for word in text.lower().split():
            digest = hashlib.sha256(word.encode()).digest()
            index = int.from_bytes(digest[:4], "big") % self.dimensions
            vector[index] += 1.0
        norm = math.sqrt(sum(value * value for value in vector)) or 1.0
        return [value / norm for value in vector]

    def count_tokens(self, text: str) -> int:
        return len(text.split())
