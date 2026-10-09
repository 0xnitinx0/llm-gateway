"""Exercise HTTP wiring with infrastructure and cloud calls replaced locally."""
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.middleware import GatewaySecurityMiddleware
from database.connection import get_db
from providers.local_provider import LocalFakeProvider
from services.cost_estimator import CostEstimator
from services.embeddings import HashingEmbedder
from services.prompt_compressor import PromptCompressor
from services.routing.router import ModelRouter
from services.semantic_cache import CacheLookup
from services.tournament_service import TournamentService
from tests.test_tournament import FakeCloudProvider


@pytest.fixture(params=["basic", "conservative_tfidf"])
def gateway(request, monkeypatch):
    settings = Settings(_env_file=None, compression_strategy=request.param, compression_min_tokens=0)
    app = create_app(settings)

    async def authorize(self, request, call_next):
        request.state.api_key = SimpleNamespace(id="synthetic-test-key")
        return await call_next(request)

    monkeypatch.setattr(GatewaySecurityMiddleware, "dispatch", authorize)
    session = AsyncMock()
    session.__aenter__.return_value = session
    monkeypatch.setattr("app.main.AsyncSessionLocal", lambda: session)
    monkeypatch.setattr("app.main.persist_request_log", AsyncMock())
    monkeypatch.setattr("app.main.emit_request_log", Mock())

    async def db_override():
        yield session

    app.dependency_overrides[get_db] = db_override
    app.state.embedder = HashingEmbedder()
    app.state.compressor = PromptCompressor(app.state.embedder.count_tokens, min_tokens=0, strategy=request.param)
    app.state.cache = SimpleNamespace(lookup=AsyncMock(return_value=CacheLookup(False, 0)), add=AsyncMock())
    app.state.cost_estimator = CostEstimator("{}")
    local = LocalFakeProvider(token_delay_ms=0, inference_delay_ms=0)
    local.generate = AsyncMock(wraps=local.generate)
    app.state.router = ModelRouter({"local": local}, app.state.embedder.count_tokens)
    app.state.router.classifier.classify = Mock(wraps=app.state.router.classifier.classify)
    clouds = {name: FakeCloudProvider(name) for name in ("gemini", "groq")}
    for provider in clouds.values():
        provider.generate = AsyncMock(wraps=provider.generate)
    app.state.tournament = TournamentService(clouds, ["auto"], "auto")
    # Deliberately omit lifespan: this fixture supplies isolated infrastructure.
    client = TestClient(app)
    yield client, app, settings, local, clouds
    client.close()


def test_preview_and_runtime_strategy(gateway):
    client, _, settings, _, _ = gateway
    response = client.post("/v1/tools/compress", json={"messages": [{"role": "user", "content": "Could you please explain caching."}]})
    assert response.status_code == 200
    assert response.json()["compressed_messages"][0]["content"] == "explain caching."
    assert response.json()["metrics"]["strategy"] == settings.compression_strategy
    config = client.get("/v1/admin/config", headers={"X-Admin-Key": settings.admin_api_key})
    assert config.status_code == 200
    assert config.json()["compression_strategy"] == settings.compression_strategy


@pytest.mark.parametrize("stream", [False, True])
def test_chat_routes_original_but_forwards_compressed(gateway, stream):
    client, app, settings, local, _ = gateway
    messages = [{"role": "system", "content": "Preserve these instructions."},
                {"role": "user", "content": "Could you please prove the theorem. Prove the theorem."}]
    expected, _ = app.state.compressor.compress(messages)
    response = client.post("/v1/chat/completions", json={"messages": messages, "stream": stream})
    assert response.status_code == 200
    classifier = app.state.router.classifier.classify
    forwarded = classifier.call_args.args[1]
    original = classifier.call_args.kwargs["original_messages"]
    assert [item.model_dump() for item in original] == messages
    assert forwarded == expected
    assert local.generate.call_args.args[0] == expected
    if stream:
        chunks = [json.loads(line[6:]) for line in response.text.splitlines()
                  if line.startswith("data: ") and line != "data: [DONE]"]
        final = chunks[-1]
        assert final["choices"][0]["finish_reason"] == "stop"
        assert final["gateway"]["compression"]["strategy"] == settings.compression_strategy
    else:
        assert response.json()["gateway"]["compression"]["strategy"] == settings.compression_strategy


def test_tournament_candidates_compressed_judge_sees_original(gateway):
    client, app, settings, _, clouds = gateway
    messages = [{"role": "user", "content": "Could you please explain caching. Explain caching."}]
    expected, _ = app.state.compressor.compress(messages)
    response = client.post("/v1/tournaments", json={"messages": messages})
    assert response.status_code == 200
    assert response.json()["compression"]["strategy"] == settings.compression_strategy
    for provider in clouds.values():
        assert provider.generate.call_args_list[0].args[0] == expected
    judge_payload = clouds["gemini"].generate.call_args_list[1].args[0][0]["content"]
    assert messages[0]["content"] in judge_payload
