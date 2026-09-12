import pytest

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
