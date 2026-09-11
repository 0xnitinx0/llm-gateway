from cache.semantic_cache import SemanticCache, cosine_similarity


def test_cosine_similarity():
    assert cosine_similarity([1.0, 0.0], [1.0, 0.0]) == 1.0
    assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == 0.0
    assert cosine_similarity([], [1.0, 0.0]) == 0.0
    assert cosine_similarity([1.0], [1.0, 0.0]) == 0.0


def test_semantic_cache_lookup_and_add():
    cache = SemanticCache(threshold=0.8)

    # Empty cache lookup
    cached_resp, is_hit, similarity = cache.lookup([1.0, 0.0])
    assert cached_resp is None
    assert is_hit is False
    assert similarity == 0.0

    # Add entry without prompt
    entry = cache.add([1.0, 0.0], "response 1")
    assert entry.entry_id.startswith("cache_")
    assert hasattr(entry, "prompt") is False

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

    # Verify summary excludes prompt
    summary = cache.get_entries_summary()
    assert summary["total_entries"] == 1
    assert len(summary["entries"]) == 1
    assert "prompt" not in summary["entries"][0]