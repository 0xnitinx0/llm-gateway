import logging
from typing import Any, Dict, List, Optional, Tuple

from providers.base import LLMProvider
from providers.gemini_provider import GeminiProvider
from providers.groq_provider import GroqProvider
from providers.cerebras_provider import CerebrasProvider
from services.routing.classifier import RequestClassification, RequestClassifier
from services.routing.rules import RoutingRuleEngine

logger = logging.getLogger("llm_gateway.router")


class ModelRouter:
    """Intelligent model router for Normal Mode.
    
    Determines request characteristics locally and routes to ONE provider,
    with automatic failover if the selected provider fails (Rule 6).
    Does NOT fan out in normal mode (Rule 8).
    """

    def __init__(self, providers: Optional[Dict[str, LLMProvider]] = None):
        if providers:
            self.providers = providers
        else:
            self.providers = {
                "gemini": GeminiProvider(),
                "groq": GroqProvider(),
                "cerebras": CerebrasProvider(),
            }
        self.classifier = RequestClassifier()
        self.rule_engine = RoutingRuleEngine()

    def get_available_providers(self) -> Dict[str, LLMProvider]:
        """Dynamically return providers whose API keys are configured in environment (Rule 7)."""
        available = {}
        for name, provider in self.providers.items():
            try:
                if provider.is_available():
                    available[name] = provider
            except Exception:
                pass
        return available

    def select_model(
        self, prompt_text: str, messages: List[Any]
    ) -> Tuple[Optional[str], List[str], RequestClassification]:
        """Classify request and select ordered candidate provider list."""
        classification = self.classifier.classify(prompt_text, messages)
        available = list(self.get_available_providers().keys())
        candidates = self.rule_engine.select_candidates(classification, available)
        primary = candidates[0] if candidates else None
        return (primary, candidates, classification)

    async def execute(
        self, messages: List[Any], prompt_text: str = ""
    ) -> Tuple[str, Optional[dict], str, str, bool]:
        """Execute request using ONE selected provider with sequential failover.
        
        Returns:
            (response_text, token_usage, provider_name, model_name, was_fallback)
        """
        primary, candidates, classification = self.select_model(prompt_text, messages)

        if not candidates:
            raise RuntimeError("No LLM providers are configured or available in environment")

        available_map = self.get_available_providers()
        errors = []

        candidates = candidates[:3]

        for index, provider_name in enumerate(candidates):
            provider = available_map.get(provider_name)
            if not provider:
                continue

            model_name = getattr(provider, "model_name", provider_name)
            was_fallback = (index > 0)

            try:
                logger.info(
                    f"Routing request (task={classification.task_type}) to provider '{provider_name}' (model='{model_name}', fallback={was_fallback})"
                )
                response_text, token_usage = await provider.generate(messages)
                return (response_text, token_usage, provider_name, model_name, was_fallback)
            except Exception as exc:
                err_msg = str(exc)
                logger.warning(
                    f"Provider '{provider_name}' failed: {err_msg}. Attempting failover to next provider..."
                )
                errors.append(f"{provider_name}: {err_msg}")

        raise RuntimeError(f"All available LLM providers failed: {'; '.join(errors)}")
