from types import SimpleNamespace

import pytest

from providers.gemini_provider import GeminiProvider


@pytest.mark.asyncio
async def test_gemini_usage_includes_billable_thinking_tokens(monkeypatch):
    class Models:
        async def generate_content(self, **kwargs):
            return SimpleNamespace(
                text="answer",
                usage_metadata=SimpleNamespace(
                    prompt_token_count=10,
                    candidates_token_count=5,
                    thoughts_token_count=30,
                ),
            )

    provider = GeminiProvider("gemini-test")
    monkeypatch.setattr(provider, "_client", lambda: SimpleNamespace(aio=SimpleNamespace(models=Models())))
    result = await provider.generate([{"role": "user", "content": "question"}])
    assert result.usage.prompt_tokens == 10
    assert result.usage.completion_tokens == 35
