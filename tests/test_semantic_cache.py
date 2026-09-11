from cache.semantic_cache import CacheEntry, SemanticCache, cosine_similarity


def test_cosine_similarity():
    v1 = [1.0, 0.0, 0.0]
    v2 = [1.0, 0.0, 0.0]
    v3 = [0.0, 1.0, 0.0]

    assert cosine_similarity(v1, v2) == 1.0
    assert cosine_similarity(v1, v3) == 0.0
    assert cosine_similarity([], v1) == 0.0


def test_semantic_cache_lookup_and_add():
    cache = SemanticCache(threshold=0.8)

    # Empty cache lookup
    cached_resp, is_hit, similarity = cache.lookup([1.0, 0.0])
    assert cached_resp is None
    assert is_hit is False
    assert similarity == 0.0

    # Add entry
    cache.add("prompt 1", [1.0, 0.0], "response 1")

    # High similarity lookup -> HIT
    cached_resp, is_hit, similarity = cache.lookup([0.99, 0.05])
    assert cached_resp == "response 1"
    assert is_hit is True
    assert similarity >= 0.8

    # Low similarity lookup -> MISS
    cached_resp, is_hit, similarity = cache.lookup([0.0, 1.0])
    assert cached_resp is None
    assert is_hit is False
    assert similarity < 0.8

    # Clear cache
    cache.clear()
    assert len(cache.entries) == 0
