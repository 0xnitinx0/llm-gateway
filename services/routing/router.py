from typing import Any

from providers.base import LLMProvider, ProviderResult
from services.routing.classifier import RequestClassifier
from services.routing.rules import RoutingRuleEngine


class ModelRouter:
    """Select one provider, then fail over sequentially without normal-mode fan-out."""

    def __init__(self, providers: dict[str, LLMProvider]):
        self.providers = providers
        self.classifier = RequestClassifier()
        self.rule_engine = RoutingRuleEngine()

    def available(self) -> dict[str, LLMProvider]:
        return {name: provider for name, provider in self.providers.items() if provider.is_available()}

    def candidates(self, prompt: str, messages: list[Any]) -> list[str]:
        available = list(self.available())
        classification = self.classifier.classify(prompt, messages)
        ordered = self.rule_engine.select_candidates(classification, available)
        if "local" in available and "local" not in ordered:
            ordered.append("local")
        return ordered

    async def execute(
        self,
        messages: list[Any],
        *,
        prompt: str,
        temperature: float,
        max_tokens: int | None,
    ) -> ProviderResult:
        errors = []
        providers = self.available()
        for name in self.candidates(prompt, messages):
            try:
                return await providers[name].generate(
                    messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            except Exception as exc:
                errors.append(f"{name}: {exc}")
        raise RuntimeError("All providers failed: " + "; ".join(errors))

    def streaming_provider(self, prompt: str, messages: list[Any]) -> LLMProvider:
        providers = self.available()
        candidates = self.candidates(prompt, messages)
        if not candidates:
            raise RuntimeError("No provider is available")
        return providers[candidates[0]]
