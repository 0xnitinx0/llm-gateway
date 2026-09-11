from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app, semantic_cache

client = TestClient(app)

VALID_GATEWAY_KEY = "gateway-secret-key"


@pytest.fixture(autouse=True)
def clear_cache_before_test():
    semantic_cache.clear()
    yield
    semantic_cache.clear()


def test_health_check():
    """Test GET /health returns status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_chat_completions_missing_key():
    """Test POST /v1/chat/completions without X-Gateway-API-Key header returns 401."""
    payload = {
        "messages": [
            {"role": "user", "content": "Hello"}
        ]
    }
    response = client.post("/v1/chat/completions", json=payload)
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or missing Gateway API key"


def test_chat_completions_invalid_key():
    """Test POST /v1/chat/completions with invalid X-Gateway-API-Key returns 401."""
    payload = {
        "messages": [
            {"role": "user", "content": "Hello"}
        ]
    }
    headers = {"X-Gateway-API-Key": "wrong-key"}
    response = client.post("/v1/chat/completions", json=payload, headers=headers)
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or missing Gateway API key"


@patch("app.main.provider.generate", new_callable=AsyncMock)
@patch("app.main.provider.embed", new_callable=AsyncMock)
def test_semantic_cache_flow(mock_embed, mock_generate):
    """Test semantic cache flow: MISS -> HIT for similar prompt -> MISS for unrelated prompt."""

    # Set up mock embedding vectors
    v1 = [1.0, 0.0]   # Prompt 1
    v2 = [0.99, 0.1]  # Prompt 2 (very similar to Prompt 1)
    v3 = [0.0, 1.0]   # Prompt 3 (unrelated)

    mock_generate.side_effect = [
        "ML response from Gemini",
        "France response from Gemini",
    ]

    headers = {"X-Gateway-API-Key": VALID_GATEWAY_KEY}

    # Request 1: Initial request (Cache MISS)
    mock_embed.return_value = v1
    res1 = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "What is machine learning?"}]},
        headers=headers,
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["response"] == "ML response from Gemini"
    assert data1["cache_hit"] is False
    assert mock_generate.call_count == 1

    # Request 2: Semantically similar request (Cache HIT)
    mock_embed.return_value = v2
    res2 = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "Can you explain machine learning?"}]},
        headers=headers,
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["response"] == "ML response from Gemini"
    assert data2["cache_hit"] is True
    assert data2["similarity"] >= 0.75
    # Gemini text generation should NOT be called again
    assert mock_generate.call_count == 1

    # Request 3: Unrelated request (Cache MISS)
    mock_embed.return_value = v3
    res3 = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "What is the capital of France?"}]},
        headers=headers,
    )
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3["response"] == "France response from Gemini"
    assert data3["cache_hit"] is False
    # Gemini text generation should now be called a 2nd time
    assert mock_generate.call_count == 2


def test_debug_cache_endpoint():
    """Test GET /debug/cache returns cache entry summary without exposing full embeddings or keys."""
    # Initially empty
    res_empty = client.get("/debug/cache")
    assert res_empty.status_code == 200
    assert res_empty.json() == {"total_entries": 0, "entries": []}

    # Add entry to cache
    semantic_cache.add("What is AI?", [0.1, 0.2, 0.3], "Artificial intelligence explanation...")

    res = client.get("/debug/cache")
    assert res.status_code == 200
    data = res.json()
    assert data["total_entries"] == 1
    assert len(data["entries"]) == 1
    entry = data["entries"][0]
    assert entry["prompt"] == "What is AI?"
    assert entry["response_preview"] == "Artificial intelligence explanation..."
    assert entry["embedding_dim"] == 3
    assert "embedding" not in entry  # Ensure full vector is not returned

