from dataclasses import dataclass
from datetime import datetime, timezone
import math
import os
from typing import List, Optional, Tuple
import uuid


@dataclass
class CacheEntry:
    entry_id: str
    embedding: List[float]
    response: str
    created_at: str


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0

    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))

    if norm1 == 0 or norm2 == 0:
        return 0.0

    return dot / (norm1 * norm2)


class SemanticCache:
    """Prompt-content-minimizing in-memory semantic cache using embedding vector cosine similarity."""

    def __init__(self, threshold: Optional[float] = None):
        self._threshold = threshold
        self.entries: List[CacheEntry] = []

    @property
    def threshold(self) -> float:
        if self._threshold is not None:
            return self._threshold

        env_val = os.getenv("CACHE_SIMILARITY_THRESHOLD", "0.75")

        try:
            return float(env_val)
        except ValueError:
            return 0.75

    def lookup(self, embedding: List[float]) -> Tuple[Optional[str], bool, float]:
        """Search cache for entry with cosine similarity >= threshold.

        Returns:
            (cached_response, is_hit, similarity_score)
        """
        if not self.entries or not embedding:
            return None, False, 0.0

        best_score = 0.0
        best_entry: Optional[CacheEntry] = None

        for entry in self.entries:
            score = cosine_similarity(embedding, entry.embedding)

            if score > best_score:
                best_score = score
                best_entry = entry

        best_score_rounded = round(best_score, 4)

        if best_entry and best_score >= self.threshold:
            return best_entry.response, True, best_score_rounded

        return None, False, best_score_rounded

    def add(self, embedding: List[float], response: str) -> CacheEntry:
        """Store a new entry in the semantic cache (never stores raw prompts)."""
        entry_id = f"cache_{uuid.uuid4().hex[:8]}"
        created_at = datetime.now(timezone.utc).isoformat()

        entry = CacheEntry(
            entry_id=entry_id,
            embedding=embedding,
            response=response,
            created_at=created_at,
        )

        self.entries.append(entry)

        return entry

    def clear(self) -> None:
        """Clear all stored cache entries."""
        self.entries.clear()

    def get_entries_summary(self) -> dict:
        """Return summary of cache entries without exposing raw prompts or full vectors."""

        summaries = [
            {
                "entry_id": entry.entry_id,
                "response_preview": (
                    entry.response[:100] + "..."
                    if len(entry.response) > 100
                    else entry.response
                ),
                "embedding_dim": len(entry.embedding),
                "created_at": entry.created_at,
            }
            for entry in self.entries
        ]

        return {
            "total_entries": len(summaries),
            "entries": summaries,
        }