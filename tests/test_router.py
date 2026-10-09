from unittest.mock import AsyncMock, Mock

import pytest

from providers.base import ProviderResult, ProviderUsage
from providers.local_provider import LocalFakeProvider
from services.routing.router import ModelRouter


@pytest.mark.asyncio
async def test_router_always_has_offline_fallback():
    local = LocalFakeProvider("balanced", lambda value: len(value.split()), 0)
    router = ModelRouter({"local": local})
    result = await router.execute(
        [{"role": "user", "content": "hello"}],
        prompt="hello",
        temperature=0.7,
        max_tokens=None,
    )
    assert result.provider == "local-balanced"
    assert result.text.startswith("Local demo response")


@pytest.mark.asyncio
async def test_local_stream_is_incremental():
    provider = LocalFakeProvider("concise", lambda value: len(value.split()), 0)
    chunks = [
        chunk
        async for chunk in provider.stream([{"role": "user", "content": "explain caching"}])
    ]
    assert len(chunks) > 1
    assert "".join(chunks).startswith("Concise answer")


@pytest.mark.asyncio
async def test_original_classification_compressed_payload_and_streaming_parity():
    providers = {name: Mock(name=name) for name in ("gemini", "groq", "cerebras")}
    for name, provider in providers.items():
        provider.is_available.return_value = True
        provider.generate = AsyncMock(return_value=ProviderResult("ok", ProviderUsage(2, 1), name, "fake"))
    router = ModelRouter(providers, lambda text: len(text.split()))
    original = [{"role": "user", "content": "Prove this theorem."}]
    compressed = [{"role": "user", "content": "short payload"}]
    result = await router.execute(compressed, prompt="ignored", temperature=0.7, max_tokens=None,
                                  original_messages=original)
    assert result.provider == "gemini"
    providers["gemini"].generate.assert_awaited_once_with(compressed, temperature=0.7, max_tokens=None)
    assert router.streaming_provider("ignored", compressed, original_messages=original) is providers["gemini"]
    classification = router.classifier.classify("ignored", compressed, original_messages=original)
    assert classification.estimated_input_tokens == 2


@pytest.mark.asyncio
async def test_router_still_fails_over_in_order():
    providers = {name: Mock(name=name) for name in ("gemini", "groq")}
    for provider in providers.values():
        provider.is_available.return_value = True
    providers["gemini"].generate = AsyncMock(side_effect=RuntimeError("unavailable"))
    providers["groq"].generate = AsyncMock(return_value=ProviderResult("ok", ProviderUsage(), "groq", "fake"))
    router = ModelRouter(providers)
    result = await router.execute([{"role": "user", "content": "Solve this equation."}],
                                  prompt="", temperature=0.7, max_tokens=None)
    assert result.provider == "groq"
    assert providers["gemini"].generate.await_count == 1
