from decimal import Decimal

import pytest

from providers.base import ProviderResult, ProviderUsage
from services.cost_estimator import CostEstimator


def estimator():
    return CostEstimator('''{"gemini/flash":{"input_per_million_usd":1,"output_per_million_usd":2},"groq/model":{"input_per_million_usd":0.5,"output_per_million_usd":1}}''')


def test_chat_cost_splits_cache_and_compression():
    cost = estimator()
    miss = cost.chat(provider="gemini", model="flash", prompt_tokens=80, completion_tokens=20, compression_tokens_saved=20, cache_hit=False)
    assert miss.actual_cost_usd == Decimal("0.00012")
    assert miss.baseline_cost_usd == Decimal("0.00014")
    assert miss.compression_savings_usd == Decimal("0.00002")
    hit = cost.chat(provider="gemini", model="flash", prompt_tokens=100, completion_tokens=20, compression_tokens_saved=0, cache_hit=True)
    assert hit.actual_cost_usd == 0
    assert hit.cache_savings_usd == Decimal("0.00014")


def test_tournament_extra_calls_can_make_net_savings_negative():
    cost = estimator()
    winner = ProviderResult("answer", ProviderUsage(80, 20), "gemini", "flash")
    other = ProviderResult("other", ProviderUsage(80, 20), "groq", "model")
    judge = ProviderResult("judgment", ProviderUsage(200, 20), "gemini", "flash")
    estimate = cost.tournament(winner=winner, charged_results=[winner, other, judge], compression_tokens_saved=20)
    assert estimate.baseline_cost_usd == Decimal("0.00014")
    assert estimate.actual_cost_usd == Decimal("0.00042")
    assert estimate.tournament_overhead_usd == Decimal("0.00030")
    assert estimate.net_savings_usd == Decimal("-0.00028")
    assert estimate.cache_savings_usd + estimate.compression_savings_usd - estimate.tournament_overhead_usd == estimate.net_savings_usd


def test_missing_or_invalid_rates_never_invent_savings():
    assert estimator().chat(provider="local-balanced", model="local-fake", prompt_tokens=10, completion_tokens=10, compression_tokens_saved=0, cache_hit=True).pricing_status == "unpriced"
    assert CostEstimator("{}").chat(provider="gemini", model="flash", prompt_tokens=10, completion_tokens=10, compression_tokens_saved=0, cache_hit=False).pricing_status == "unpriced"
    for pricing in ('{"gemini/flash":{"input_per_million_usd":-1,"output_per_million_usd":2}}', '{"gemini/flash":{"input_per_million_usd":"NaN","output_per_million_usd":2}}'):
        with pytest.raises(ValueError):
            CostEstimator(pricing)
