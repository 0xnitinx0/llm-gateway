import json

import pytest

from providers.base import LLMProvider, ProviderResult, ProviderUsage
from providers.local_provider import LocalFakeProvider
from services.tournament_service import TournamentService


class FakeCloudProvider(LLMProvider):
    def __init__(self, name, *, fail=False, invalid_judge=False, transient_status=None):
        self.name = name
        self.model_name = f"{name}-model"
        self.fail = fail
        self.invalid_judge = invalid_judge
        self.transient_status = transient_status
        self.calls = 0

    def is_available(self):
        return True

    async def generate(self, messages, *, temperature=0.7, max_tokens=None):
        self.calls += 1
        if self.transient_status and self.calls == 1:
            class TransientError(Exception):
                response = type("Response", (), {"status_code": self.transient_status})()
            raise TransientError()
        if self.fail:
            raise RuntimeError("provider unavailable")
        prompt = messages[0]["content"]
        if "ORIGINAL_PROMPT:" in prompt:
            if self.invalid_judge:
                text = "not json"
            else:
                ids = [line.split(": ", 1)[1] for line in prompt.splitlines() if line.startswith("CANDIDATE_ID: ")]
                text = json.dumps({"winner_id": ids[0], "scores": {item: 0.8 for item in ids}, "reasoning": "Most relevant answer."})
        else:
            text = f"{self.name} response"
        return ProviderResult(text, ProviderUsage(20, 5), self.name, self.model_name)

    async def stream(self, messages, *, temperature=0.7, max_tokens=None):
        yield "unused"


@pytest.mark.asyncio
async def test_tournament_uses_cloud_candidates_and_judge():
    providers = {name: FakeCloudProvider(name) for name in ("gemini", "groq", "cerebras")}
    providers["local-judge"] = LocalFakeProvider("judge")
    service = TournamentService(providers, ["auto"], "auto")
    outcome = await service.run([{"role": "user", "content": "Explain caching."}], temperature=0.7, max_tokens=None)
    assert len(outcome.candidates) == 3
    assert {item.provider for item in outcome.candidates} == {"gemini", "groq", "cerebras"}
    assert outcome.judge_provider == "gemini"
    assert outcome.reasoning == "Most relevant answer."
    assert outcome.judge_attempts == 1
    assert len(outcome.charged_results) == 4
    assert outcome.usage.total_tokens == 100


@pytest.mark.asyncio
async def test_tournament_keeps_failed_candidate_and_uses_two_successful_cloud_models():
    providers = {name: FakeCloudProvider(name, fail=name == "cerebras") for name in ("gemini", "groq", "cerebras")}
    service = TournamentService(providers, ["auto"], "auto")
    outcome = await service.run([{"role": "user", "content": "Explain caching."}], temperature=0.7, max_tokens=None)
    assert len(outcome.candidates) == 3
    assert outcome.candidates[2].error == "RuntimeError"
    assert len(outcome.charged_results) == 3


@pytest.mark.asyncio
async def test_tournament_retries_invalid_judge_then_uses_another_cloud_judge():
    providers = {"gemini": FakeCloudProvider("gemini", invalid_judge=True), "groq": FakeCloudProvider("groq")}
    outcome = await TournamentService(providers, ["auto"], "auto").run(
        [{"role": "user", "content": "Explain caching."}], temperature=0.7, max_tokens=None,
    )
    assert outcome.judge_provider == "groq"
    assert outcome.fallback_used is True
    assert outcome.judge_attempts == 3
    assert len(outcome.judge_results) == 3
    assert outcome.usage.total_tokens == 125


@pytest.mark.asyncio
async def test_tournament_fails_without_two_cloud_answers():
    providers = {"gemini": FakeCloudProvider("gemini"), "groq": FakeCloudProvider("groq", fail=True)}
    with pytest.raises(RuntimeError, match="two successful cloud candidates"):
        await TournamentService(providers, ["auto"], "auto").run(
            [{"role": "user", "content": "Explain caching."}], temperature=0.7, max_tokens=None,
        )


@pytest.mark.asyncio
async def test_tournament_rejects_legacy_local_configuration():
    providers = {"gemini": FakeCloudProvider("gemini"), "groq": FakeCloudProvider("groq")}
    with pytest.raises(RuntimeError, match="TOURNAMENT_PROVIDERS=auto"):
        await TournamentService(providers, ["local-analytical", "groq"], "auto").run(
            [{"role": "user", "content": "Explain caching."}], temperature=0.7, max_tokens=None,
        )


@pytest.mark.asyncio
async def test_tournament_retries_transient_cloud_error():
    providers = {"gemini": FakeCloudProvider("gemini", transient_status=503), "groq": FakeCloudProvider("groq")}
    outcome = await TournamentService(providers, ["auto"], "auto").run(
        [{"role": "user", "content": "Explain caching."}], temperature=0.7, max_tokens=None,
    )
    assert outcome.candidates[0].attempts == 2
    assert outcome.candidates[0].error is None
    assert providers["gemini"].calls >= 2


@pytest.mark.parametrize(
    "candidates,judge,available,ready",
    [
        (["auto"], "auto", ["gemini", "groq"], True),
        (["auto"], "auto", ["groq"], False),
        (["groq", "groq"], "auto", ["groq", "gemini"], False),
        (["local"], "auto", ["groq", "gemini"], False),
        (["auto"], "local-judge", ["groq", "gemini"], False),
        (["groq", "gemini"], "cerebras", ["groq", "gemini"], True),
    ],
)
def test_readiness_uses_candidate_and_judge_rules_without_inference(candidates, judge, available, ready):
    providers = {name: FakeCloudProvider(name) for name in available}
    result = TournamentService(providers, candidates, judge).readiness()
    assert result["ready"] is ready
    assert result["inference_verified"] is False
    assert bool(result["reason"]) is (not ready)
    assert all(provider.calls == 0 for provider in providers.values())
