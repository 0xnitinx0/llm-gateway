from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app, semantic_cache
from services.prompt_compressor import PromptCompressor, CompressionStats

client = TestClient(app)
VALID_GATEWAY_KEY = "gateway-secret-key"


def test_compressor_unit_short_prompt():
    """Verify short prompts below length threshold skip compression."""
    compressor = PromptCompressor(min_length_threshold=100)
    messages = [{"role": "user", "content": "What is machine learning?"}]

    compressed, stats = compressor.compress(messages)
    assert compressed[0]["content"] == "What is machine learning?"
    assert stats.original_length == stats.compressed_length
    assert stats.compression_ratio == 0.0


def test_compressor_unit_long_prompt_with_filler():
    """Verify long prompts strip polite filler phrases while preserving core instructions."""
    compressor = PromptCompressor(min_length_threshold=30)
    messages = [
        {
            "role": "user",
            "content": "Could you please be so kind as to explain what artificial intelligence is in full detail?",
        }
    ]

    compressed, stats = compressor.compress(messages)
    content = compressed[0]["content"]
    assert "could you please" not in content.lower()
    assert "be so kind as to" not in content.lower()
    assert "explain what artificial intelligence is in full detail?" in content
    assert stats.compressed_length < stats.original_length
    assert stats.compression_ratio > 0.0


@patch("app.main.model_router.execute", new_callable=AsyncMock)
@patch("app.main.provider.embed", new_callable=AsyncMock)
def test_compression_gateway_pipeline(mock_embed, mock_router_execute):
    """Integration test verifying compression pipeline on Cache MISS and bypass on Cache HIT."""
    semantic_cache.clear()

    v1 = [1.0, 0.0]
    v2 = [0.99, 0.05]

    mock_embed.return_value = v1
    mock_router_execute.return_value = (
        "AI Explanation",
        {"input_tokens": 12, "output_tokens": 20, "total_tokens": 32},
        "groq",
        "groq/compound",
        False,
    )

    headers = {"X-Gateway-API-Key": VALID_GATEWAY_KEY}
    long_prompt = "Could you please be so kind as to explain what artificial intelligence is in full detail?"

    # Request 1: Cache MISS -> Prompt compressed and sent to LLM
    res1 = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": long_prompt}]},
        headers=headers,
    )
    assert res1.status_code == 200
    assert res1.json()["cache_hit"] is False
    assert mock_router_execute.call_count == 1

    # Inspect call args passed to mock_router_execute: should be compressed messages
    called_messages = mock_router_execute.call_args[0][0]
    sent_content = (
        called_messages[0]["content"]
        if isinstance(called_messages[0], dict)
        else called_messages[0].content
    )
    assert "could you please" not in sent_content.lower()
    assert "be so kind as to" not in sent_content.lower()

    # Request 2: Cache HIT -> Bypasses compression and LLM call completely
    mock_embed.return_value = v2
    res2 = client.post(
        "/v1/chat/completions",
        json={"messages": [{"role": "user", "content": "Explain AI in detail"}]},
        headers=headers,
    )
    assert res2.status_code == 200
    assert res2.json()["cache_hit"] is True
    # mock_router_execute should NOT be called again
    assert mock_router_execute.call_count == 1
