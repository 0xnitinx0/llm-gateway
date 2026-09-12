from typing import List
from services.routing.classifier import RequestClassification


class RoutingRuleEngine:
    """Applies deterministic routing rules based on request classification and provider availability."""

    def select_candidates(
        self, classification: RequestClassification, available_providers: List[str]
    ) -> List[str]:
        if not available_providers:
            return []

        # Rule E: Long Context (> 8000 tokens) -> Gemini preferred
        if classification.context_size > 8000:
            preferred_order = ["gemini", "groq", "cerebras"]

        # Rule D: Complex Reasoning / Mathematics / Technical Analysis -> Gemini preferred
        elif classification.task_type == "reasoning":
            preferred_order = ["gemini", "groq", "cerebras"]

        # Rule C: Coding Requests -> Gemini preferred
        elif classification.task_type == "coding":
            preferred_order = ["gemini", "groq", "cerebras"]

        # Rule B: General Knowledge / Short Summarization -> Cerebras preferred
        elif classification.task_type == "general":
            preferred_order = ["cerebras", "groq", "gemini"]

        # Rule A: Simple / Casual / Basic / Latency-Sensitive -> Groq preferred
        else:
            preferred_order = ["groq", "cerebras", "gemini"]

        # Filter preferred order by actually available configured providers (Rule 7)
        candidates = [p for p in preferred_order if p in available_providers]

        # Add any remaining available providers as last-resort fallback
        for p in available_providers:
            if p not in candidates:
                candidates.append(p)

        return candidates
