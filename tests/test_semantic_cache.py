import pytest

from services.embeddings import HashingEmbedder


@pytest.mark.asyncio
async def test_hashing_embedder_is_deterministic_and_normalized():
    embedder = HashingEmbedder(16)
    first = await embedder.embed("semantic cache")
    second = await embedder.embed("semantic cache")
    assert first == second
    assert pytest.approx(sum(value * value for value in first), rel=1e-6) == 1.0


@pytest.mark.asyncio
async def test_hashing_embedder_places_shared_words_nearby():
    embedder = HashingEmbedder(64)
    first = await embedder.embed("semantic cache gateway")
    second = await embedder.embed("explain semantic cache")
    dot = sum(a * b for a, b in zip(first, second))
    assert dot > 0
