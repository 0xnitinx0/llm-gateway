from dataclasses import asdict
from typing import Any, Callable

import structlog

from providers.base import LLMProvider, ProviderResult
from services.routing.classifier import RequestClassifier
from services.routing.rules import RoutingRuleEngine

logger = structlog.get_logger("llm_gateway.router")

class ModelRouter:
    """Select one provider, then fail over sequentially without normal-mode fan-out."""

    def __init__(self, providers: dict[str, LLMProvider], token_counter: Callable[[str], int] | None = None):
        self.providers = providers
        self.classifier = RequestClassifier(token_counter)
        self.rule_engine = RoutingRuleEngine()

    def available(self) -> dict[str, LLMProvider]:
        return {name: provider for name, provider in self.providers.items() if provider.is_available()}

    def candidates(self, prompt: str, messages: list[Any], *, original_messages: list[Any] | None = None) -> list[str]:
        return self.plan(prompt, messages, original_messages=original_messages)["provider_preference_order"]

    def plan(self, prompt: str, messages: list[Any], *, original_messages: list[Any] | None = None) -> dict[str, Any]:
        available = list(self.available())
        classification = self.classifier.classify(prompt, messages, original_messages=original_messages)
        ordered = self.rule_engine.select_candidates(classification, available)
        if "local" in available and "local" not in ordered:
            ordered.append("local")
        return {"status": "routed", "classification": asdict(classification), "provider_preference_order": ordered}

    async def execute(
        self,
        messages: list[Any],
        *,
        prompt: str,
        temperature: float,
        max_tokens: int | None,
        original_messages: list[Any] | None = None,
        routing: dict[str, Any] | None = None,
    ) -> ProviderResult:
        errors = []
        providers = self.available()
        decision = routing if routing is not None else self.plan(prompt, messages, original_messages=original_messages)
        for name in decision["provider_preference_order"]:
            try:
                return await providers[name].generate(
                    messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            except Exception as exc:
                errors.append(f"{name}: {exc}")
                logger.warning(
                    "provider_failed_trying_fallback",
                    provider=name,
                    model=providers[name].model_name,
                    error_type=type(exc).__name__,
                    error=str(exc),
                )
        raise RuntimeError("All providers failed: " + "; ".join(errors))

    def streaming_provider(self, prompt: str, messages: list[Any], *, original_messages: list[Any] | None = None, routing: dict[str, Any] | None = None) -> LLMProvider:
        providers = self.available()
        candidates = routing["provider_preference_order"] if routing is not None else self.candidates(prompt, messages, original_messages=original_messages)
        if not candidates:
            raise RuntimeError("No provider is available")
        return providers[candidates[0]]
