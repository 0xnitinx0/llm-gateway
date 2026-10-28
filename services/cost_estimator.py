"""Estimate USD spend against a direct, uncompressed model call.

These are rate-card estimates, not provider invoices. Saving the amounts per
request keeps historical totals stable when the configured rates change.
"""

import json
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from providers.base import ProviderResult

MILLION = Decimal("1000000")
ZERO = Decimal("0")


@dataclass(frozen=True, slots=True)
class ModelPrice:
    input_per_million_usd: Decimal
    output_per_million_usd: Decimal


@dataclass(frozen=True, slots=True)
class CostEstimate:
    pricing_status: str
    baseline_cost_usd: Decimal | None = None
    actual_cost_usd: Decimal | None = None
    net_savings_usd: Decimal | None = None
    cache_savings_usd: Decimal | None = None
    compression_savings_usd: Decimal | None = None
    tournament_overhead_usd: Decimal | None = None

    def log_values(self) -> dict:
        return {
            "pricing_status": self.pricing_status,
            "baseline_cost_usd": self.baseline_cost_usd,
            "actual_cost_usd": self.actual_cost_usd,
            "net_savings_usd": self.net_savings_usd,
            "cache_savings_usd": self.cache_savings_usd,
            "compression_savings_usd": self.compression_savings_usd,
            "tournament_overhead_usd": self.tournament_overhead_usd,
        }


UNPRICED = CostEstimate("unpriced")


class CostEstimator:
    """Price successful model usage using explicit provider/model rate pairs."""

    def __init__(self, pricing_json: str):
        try:
            raw = json.loads(pricing_json)
        except json.JSONDecodeError as exc:
            raise ValueError("MODEL_PRICING_JSON must be a JSON object") from exc
        if not isinstance(raw, dict):
            raise ValueError("MODEL_PRICING_JSON must be a JSON object")
        self.prices: dict[str, ModelPrice] = {}
        for key, value in raw.items():
            if not isinstance(key, str) or "/" not in key or key.split("/", 1)[0] not in {"gemini", "groq", "cerebras"} or not isinstance(value, dict):
                raise ValueError("Pricing keys must be cloud provider/model pairs")
            if set(value) != {"input_per_million_usd", "output_per_million_usd"}:
                raise ValueError(f"Pricing for {key} needs input_per_million_usd and output_per_million_usd")
            try:
                input_rate = Decimal(str(value["input_per_million_usd"]))
                output_rate = Decimal(str(value["output_per_million_usd"]))
            except (InvalidOperation, ValueError) as exc:
                raise ValueError(f"Invalid USD rates for {key}") from exc
            if any(not rate.is_finite() or rate < 0 for rate in (input_rate, output_rate)):
                raise ValueError(f"USD rates for {key} must be finite and nonnegative")
            self.prices[key] = ModelPrice(input_rate, output_rate)

    def _price(self, provider: str, model: str) -> ModelPrice | None:
        return self.prices.get(f"{provider}/{model}")

    @staticmethod
    def _amount(price: ModelPrice, prompt_tokens: int, completion_tokens: int) -> Decimal:
        return (
            price.input_per_million_usd * max(prompt_tokens, 0)
            + price.output_per_million_usd * max(completion_tokens, 0)
        ) / MILLION

    def chat(
        self,
        *,
        provider: str,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        compression_tokens_saved: int,
        cache_hit: bool,
    ) -> CostEstimate:
        price = self._price(provider, model)
        if price is None or provider.startswith("local"):
            return UNPRICED
        if cache_hit:
            baseline = self._amount(price, prompt_tokens, completion_tokens)
            return CostEstimate("priced", baseline, ZERO, baseline, baseline, ZERO, ZERO)
        actual = self._amount(price, prompt_tokens, completion_tokens)
        compression = price.input_per_million_usd * max(compression_tokens_saved, 0) / MILLION
        baseline = actual + compression
        return CostEstimate("priced", baseline, actual, compression, ZERO, compression, ZERO)

    def tournament(
        self,
        *,
        winner: ProviderResult,
        charged_results: list[ProviderResult],
        compression_tokens_saved: int,
    ) -> CostEstimate:
        winner_price = self._price(winner.provider, winner.model)
        if winner_price is None or any(self._price(result.provider, result.model) is None for result in charged_results):
            return UNPRICED
        winner_cost = self._amount(winner_price, winner.usage.prompt_tokens, winner.usage.completion_tokens)
        actual = sum(
            (self._amount(self._price(result.provider, result.model), result.usage.prompt_tokens, result.usage.completion_tokens)
             for result in charged_results),
            ZERO,
        )
        compression = winner_price.input_per_million_usd * max(compression_tokens_saved, 0) / MILLION
        baseline = winner_cost + compression
        overhead = actual - winner_cost
        return CostEstimate("priced", baseline, actual, baseline - actual, ZERO, compression, overhead)
