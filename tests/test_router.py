import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app, get_db, semantic_cache
from database.connection import Base
import database.models
from providers.base import LLMProvider
from services.routing.classifier import RequestClassifier
from services.routing.rules import RoutingRuleEngine
from services.routing.router import ModelRouter
from services.tournament_service import TournamentService

TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_test_db():
    semantic_cache.clear()
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield db
    db.close()
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()
    semantic_cache.clear()


client = TestClient(app)
VALID_GATEWAY_KEY = "gateway-secret-key"


def create_mock_provider(name: str, available: bool = True, model_name: str = "mock-model"):
    p = MagicMock(spec=LLMProvider)
    p.is_available.return_value = available
    p.model_name = model_name
    p.generate = AsyncMock(return_value=(f"Response from {name}", {"input_tokens": 10, "output_tokens": 20, "total_tokens": 30}))
    p.embed = AsyncMock(return_value=[0.1, 0.2, 0.3])
    return p


# 1. Simple request -> Groq preferred if available
def test_simple_request_groq_preferred():
    groq = create_mock_provider("groq", available=True, model_name="openai/gpt-oss-120b")
    cerebras = create_mock_provider("cerebras", available=True, model_name="gpt-oss-120b")
    gemini = create_mock_provider("gemini", available=True, model_name="gemini-3.5-flash-lite")

    router = ModelRouter(providers={"groq": groq, "cerebras": cerebras, "gemini": gemini})
    primary, candidates, _ = router.select_model("In exactly 3 concise bullet points, explain what DNS is and how it works.", [])

    assert primary == "groq"
    assert candidates[0] == "groq"


# 2. Simple request -> Cerebras fallback if Groq unavailable
def test_simple_request_cerebras_fallback():
    groq = create_mock_provider("groq", available=False)
    cerebras = create_mock_provider("cerebras", available=True)
    gemini = create_mock_provider("gemini", available=True)

    router = ModelRouter(providers={"groq": groq, "cerebras": cerebras, "gemini": gemini})
    primary, candidates, _ = router.select_model("What is the capital of France?", [])

    assert primary == "cerebras"
    assert candidates[0] == "cerebras"


# 3. Simple request -> Gemini if Groq and Cerebras unavailable
def test_simple_request_gemini_fallback():
    groq = create_mock_provider("groq", available=False)
    cerebras = create_mock_provider("cerebras", available=False)
    gemini = create_mock_provider("gemini", available=True)

    router = ModelRouter(providers={"groq": groq, "cerebras": cerebras, "gemini": gemini})
    primary, candidates, _ = router.select_model("Define photosynthesis", [])

    assert primary == "gemini"
    assert candidates == ["gemini"]


# 4. Complex reasoning -> Gemini preferred
def test_complex_reasoning_gemini_preferred():
    groq = create_mock_provider("groq", available=True)
    cerebras = create_mock_provider("cerebras", available=True)
    gemini = create_mock_provider("gemini", available=True)

    router = ModelRouter(providers={"groq": groq, "cerebras": cerebras, "gemini": gemini})
    prompt = "Prove the pythagorean theorem step-by-step and evaluate the architectural trade-offs."
    primary, candidates, classification = router.select_model(prompt, [])

    assert classification.task_type == "reasoning"
    assert primary == "gemini"
    assert candidates[0] == "gemini"


# 5. Coding request -> strongest configured coding provider
def test_coding_request_routing():
    groq = create_mock_provider("groq", available=True)
    cerebras = create_mock_provider("cerebras", available=True)
    gemini = create_mock_provider("gemini", available=True)

    router = ModelRouter(providers={"groq": groq, "cerebras": cerebras, "gemini": gemini})
    prompt = "Write a Python function using def to compute binary search over an array"
    primary, candidates, classification = router.select_model(prompt, [])

    assert classification.task_type == "coding"
    assert primary == "gemini"


# 6. Long context -> provider with sufficient context capacity (Gemini)
def test_long_context_routing():
    groq = create_mock_provider("groq", available=True)
    cerebras = create_mock_provider("cerebras", available=True)
    gemini = create_mock_provider("gemini", available=True)

    router = ModelRouter(providers={"groq": groq, "cerebras": cerebras, "gemini": gemini})
    long_prompt = "word " * 9000  # > 8000 tokens
    primary, candidates, classification = router.select_model(long_prompt, [])

    assert classification.context_size > 8000
    assert primary == "gemini"


# 7. Failed selected provider -> fallback provider
def test_provider_failover():
    groq = create_mock_provider("groq", available=True)
    groq.generate.side_effect = RuntimeError("Groq API rate limit exceeded")

    cerebras = create_mock_provider("cerebras", available=True, model_name="gpt-oss-120b")
    cerebras.generate.return_value = ("Cerebras failover response", {"input_tokens": 5, "output_tokens": 5, "total_tokens": 10})

    gemini = create_mock_provider("gemini", available=True)

    router = ModelRouter(providers={"groq": groq, "cerebras": cerebras, "gemini": gemini})
    response_text, token_usage, provider_name, model_name, was_fallback = asyncio.run(
        router.execute([], "Hello")
    )

    assert provider_name == "cerebras"
    assert response_text == "Cerebras failover response"
    assert was_fallback is True
    assert groq.generate.call_count == 1
    assert cerebras.generate.call_count == 1


# 8. No providers available -> clear configuration error
def test_no_providers_available():
    groq = create_mock_provider("groq", available=False)
    cerebras = create_mock_provider("cerebras", available=False)
    gemini = create_mock_provider("gemini", available=False)

    router = ModelRouter(providers={"groq": groq, "cerebras": cerebras, "gemini": gemini})
    with pytest.raises(RuntimeError, match="No LLM providers are configured or available"):
        asyncio.run(router.execute([], "Hello"))


# 9. Normal mode never calls more than one provider when primary succeeds
def test_normal_mode_single_provider_call():
    groq = create_mock_provider("groq", available=True)
    cerebras = create_mock_provider("cerebras", available=True)
    gemini = create_mock_provider("gemini", available=True)

    router = ModelRouter(providers={"groq": groq, "cerebras": cerebras, "gemini": gemini})
    response_text, _, provider_name, _, was_fallback = asyncio.run(
        router.execute([], "What is 2+2?")
    )

    assert provider_name == "groq"
    assert was_fallback is False
    assert groq.generate.call_count == 1
    assert cerebras.generate.call_count == 0
    assert gemini.generate.call_count == 0


# 10. Cache HIT bypasses routing/provider call in normal mode
@patch("app.main.provider.embed", new_callable=AsyncMock)
@patch("app.main.model_router.execute", new_callable=AsyncMock)
def test_cache_hit_bypasses_router(mock_router_execute, mock_embed):
    mock_embed.return_value = [0.1, 0.2, 0.3]
    semantic_cache.add([0.1, 0.2, 0.3], "Cached answer")

    headers = {"X-Gateway-API-Key": VALID_GATEWAY_KEY}
    payload = {"messages": [{"role": "user", "content": "What is machine learning?"}]}

    res = client.post("/v1/chat/completions", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["cache_hit"] is True
    assert data["response"] == "Cached answer"
    assert mock_router_execute.call_count == 0


# 11. Tournament mode invokes all 3 providers concurrently
def test_tournament_invokes_all_available_providers_concurrently():
    gemini = create_mock_provider("gemini", available=True, model_name="gemini-3.5-flash-lite")
    groq = create_mock_provider("groq", available=True, model_name="openai/gpt-oss-120b")
    cerebras = create_mock_provider("cerebras", available=True, model_name="gpt-oss-120b")

    tourney = TournamentService(providers={"gemini": gemini, "groq": groq, "cerebras": cerebras})
    
    with patch("providers.gemini_provider.GeminiProvider.generate", new_callable=AsyncMock) as mock_judge:
        mock_judge.return_value = ("WINNER: 2\nSCORE: 0.95\nREASON: Better explanation", {"input_tokens": 10, "output_tokens": 10, "total_tokens": 20})
        
        res_text, winner_prov, winner_mod, candidates, score, _ = asyncio.run(
            tourney.run_tournament([{"role": "user", "content": "Explain relativity"}])
        )

        assert len(candidates) == 3
        assert gemini.generate.call_count == 1
        assert groq.generate.call_count == 1
        assert cerebras.generate.call_count == 1
        assert winner_prov == "groq"
        assert winner_mod == "openai/gpt-oss-120b"
        assert score == 0.95


# 12. Tournament mode handles single provider failure gracefully
def test_tournament_one_provider_failure_resiliency():
    gemini = create_mock_provider("gemini", available=True, model_name="gemini-3.5-flash-lite")
    groq = create_mock_provider("groq", available=True, model_name="openai/gpt-oss-120b")
    
    cerebras = create_mock_provider("cerebras", available=True, model_name="gpt-oss-120b")
    cerebras.generate.side_effect = RuntimeError("Cerebras 402 payment required")

    tourney = TournamentService(providers={"gemini": gemini, "groq": groq, "cerebras": cerebras})
    
    with patch("providers.gemini_provider.GeminiProvider.generate", new_callable=AsyncMock) as mock_judge:
        mock_judge.return_value = ("WINNER: 1\nSCORE: 0.90", {"input_tokens": 5, "output_tokens": 5, "total_tokens": 10})
        
        res_text, winner_prov, winner_mod, candidates, score, _ = asyncio.run(
            tourney.run_tournament([{"role": "user", "content": "Explain gravity"}])
        )

        assert len(candidates) == 2  # Cerebras failed, gemini and groq succeeded
        assert winner_prov == "gemini"
        assert score == 0.90


# 13. Tournament mode bypasses normal single-model cache entry
@patch("app.main.provider.embed", new_callable=AsyncMock)
@patch("app.main.tournament_service.run_tournament", new_callable=AsyncMock)
def test_tournament_bypasses_normal_cache_entry(mock_run_tournament, mock_embed):
    mock_embed.return_value = [0.1, 0.2, 0.3]
    # Add normal mode single-model response to cache
    semantic_cache.add([0.1, 0.2, 0.3], "Cached normal response")

    mock_run_tournament.return_value = (
        "Tournament winner response",
        "groq",
        "openai/gpt-oss-120b",
        [
            {"provider": "gemini", "model": "gemini-3.5-flash-lite", "text": "Gemini res"},
            {"provider": "groq", "model": "openai/gpt-oss-120b", "text": "Groq res"}
        ],
        0.95,
        {"input_tokens": 20, "output_tokens": 20, "total_tokens": 40},
    )

    headers = {"X-Gateway-API-Key": VALID_GATEWAY_KEY}
    payload = {
        "messages": [{"role": "user", "content": "What is machine learning?"}],
        "tournament": True
    }

    res = client.post("/v1/chat/completions", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["cache_hit"] is False
    assert data["response"] == "Tournament winner response"
    assert data["winning_model"] == "openai/gpt-oss-120b"
    assert data["candidate_count"] == 2
    assert mock_run_tournament.call_count == 1
