from dataclasses import dataclass

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import SemanticCacheEntry


@dataclass(slots=True)
class CacheLookup:
    hit: bool
    similarity: float
    entry: SemanticCacheEntry | None = None


class PgVectorSemanticCache:
    """HNSW-backed nearest-neighbor cache scoped to one gateway API key."""

    def __init__(self, threshold: float):
        self.threshold = threshold

    async def lookup(
        self,
        db: AsyncSession,
        *,
        api_key_id: str,
        embedding: list[float],
    ) -> CacheLookup:
        distance = SemanticCacheEntry.embedding.cosine_distance(embedding)
        row = (
            await db.execute(
                select(SemanticCacheEntry, distance.label("distance"))
                .where(SemanticCacheEntry.api_key_id == api_key_id)
                .order_by(distance)
                .limit(1)
            )
        ).first()
        if row is None:
            return CacheLookup(False, 0.0)
        entry, raw_distance = row
        similarity = round(max(-1.0, min(1.0, 1.0 - float(raw_distance))), 4)
        return CacheLookup(similarity >= self.threshold, similarity, entry if similarity >= self.threshold else None)

    async def add(
        self,
        db: AsyncSession,
        *,
        api_key_id: str,
        embedding: list[float],
        response: str,
        provider: str,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
    ) -> SemanticCacheEntry:
        entry = SemanticCacheEntry(
            api_key_id=api_key_id,
            embedding=embedding,
            response=response,
            provider=provider,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )
        db.add(entry)
        await db.commit()
        await db.refresh(entry)
        return entry

    async def clear(self, db: AsyncSession) -> int:
        count = int(await db.scalar(select(func.count(SemanticCacheEntry.id))) or 0)
        await db.execute(delete(SemanticCacheEntry))
        await db.commit()
        return count

    async def summary(self, db: AsyncSession) -> dict:
        entries = (
            await db.scalars(
                select(SemanticCacheEntry).order_by(SemanticCacheEntry.created_at.desc()).limit(20)
            )
        ).all()
        return {
            "total_entries": int(await db.scalar(select(func.count(SemanticCacheEntry.id))) or 0),
            "entries": [
                {
                    "entry_id": entry.id,
                    "api_key_id": entry.api_key_id,
                    "provider": entry.provider,
                    "model": entry.model,
                    "response_preview": entry.response[:100],
                    "embedding_dimensions": len(entry.embedding),
                    "created_at": entry.created_at.isoformat(),
                }
                for entry in entries
            ],
        }
