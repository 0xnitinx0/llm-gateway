from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

VALID_GATEWAY_KEY = "gateway-secret-key"


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
def test_chat_completions_success(mock_generate):
    """Test POST /v1/chat/completions with valid key returns 200 and mocked response."""
    mock_generate.return_value = "Machine learning is a field of artificial intelligence."

    payload = {
        "messages": [
            {"role": "user", "content": "What is machine learning?"}
        ]
    }
    headers = {"X-Gateway-API-Key": VALID_GATEWAY_KEY}
    response = client.post("/v1/chat/completions", json=payload, headers=headers)

    assert response.status_code == 200
    assert response.json() == {
        "response": "Machine learning is a field of artificial intelligence."
    }
    mock_generate.assert_awaited_once()


@patch("app.main.provider.generate", new_callable=AsyncMock)
def test_chat_completions_no_model_in_request(mock_generate):
    """Verify request structure has no model field requirement."""
    mock_generate.return_value = "Model-free response"

    payload = {
        "messages": [
            {"role": "user", "content": "Test"}
        ]
    }
    headers = {"X-Gateway-API-Key": VALID_GATEWAY_KEY}
    response = client.post("/v1/chat/completions", json=payload, headers=headers)

    assert response.status_code == 200
    assert "response" in response.json()
