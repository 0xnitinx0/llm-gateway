from app.schemas import ChatCompletionRequest, ChatCompletionResponse


def test_request_defaults_to_gateway_auto():
    request = ChatCompletionRequest(messages=[{"role": "user", "content": "hello"}])
    assert request.model == "gateway-auto"
    assert request.stream is False


def test_openai_compatible_response_shape():
    response = ChatCompletionResponse.model_validate(
        {
            "id": "chatcmpl-1",
            "created": 1,
            "model": "local-fake-balanced",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": "hello"},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            "gateway": {
                "request_id": "req-1",
                "provider": "local-balanced",
                "model": "local-fake-balanced",
                "cache_hit": False,
                "similarity": 0.0,
                "llm_called": True,
                "latency_ms": 1.0,
                "compression": None,
            },
        }
    )
    assert response.object == "chat.completion"
    assert response.choices[0]["message"]["role"] == "assistant"
