import pytest

from providers.local_provider import LocalFakeProvider
from services.tournament_service import TournamentService


@pytest.mark.asyncio
async def test_tournament_returns_candidates_judge_reasoning_and_winner():
    count = lambda value: len(value.split())
    providers = {
        name: LocalFakeProvider(profile, count, 0)
        for name, profile in {
            "local-concise": "concise",
            "local-analytical": "analytical",
            "local-practical": "practical",
            "local-judge": "judge",
        }.items()
    }
    service = TournamentService(
        providers,
        ["local-concise", "local-analytical", "local-practical"],
        "local-judge",
    )
    outcome = await service.run(
        [{"role": "user", "content": "Explain semantic caching."}],
        temperature=0.7,
        max_tokens=None,
    )
    assert len(outcome.candidates) == 3
    assert outcome.winner_id in {item.candidate_id for item in outcome.candidates}
    assert outcome.reasoning
    assert outcome.scores
    assert outcome.usage.total_tokens > 0
