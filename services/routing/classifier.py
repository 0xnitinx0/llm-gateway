import re
from dataclasses import dataclass
from typing import Any, List


@dataclass
class RequestClassification:
    task_type: str  # "coding", "reasoning", "simple"
    complexity: str  # "low", "medium", "high"
    estimated_input_tokens: int
    context_size: int
    latency_sensitive: bool


class RequestClassifier:
    """Lightweight, deterministic local classifier using heuristics and regex (0 LLM calls)."""

    CODING_KEYWORDS = re.compile(
        r"\b(def|class|import|function|const|let|var|return|async|await|select|from|where|"
        r"python|javascript|typescript|react|html|css|c\+\+|java|rust|go|sql|leetcode|debug|"
        r"refactor|algorithm|code|bug|syntax|api|json|endpoint|schema|regex|pointer|dataframe)\b|```",
        re.IGNORECASE,
    )

    REASONING_KEYWORDS = re.compile(
        r"\b(prove|proof|math|theorem|equation|solve|calculus|integral|derivative|algebra|"
        r"step-by-step|step by step|multi-step|logic|deduce|hypothesis|evaluate the impact|"
        r"trade-offs|tradeoffs|compare and contrast|architectural decision|formulate)\b",
        re.IGNORECASE,
    )

    GENERAL_KEYWORDS = re.compile(
        r"\b(summarize|summary|overview|general knowledge|briefly|tell me about|history of)\b",
        re.IGNORECASE,
    )

    def classify(self, prompt_text: str, messages: List[Any]) -> RequestClassification:
        total_text = prompt_text or ""
        for msg in messages:
            if isinstance(msg, dict):
                total_text += " " + msg.get("content", "")
            else:
                total_text += " " + getattr(msg, "content", "")

        # Estimate tokens (~4 characters per token)
        char_count = len(total_text)
        estimated_tokens = max(1, char_count // 4)

        is_coding = bool(self.CODING_KEYWORDS.search(total_text))
        is_reasoning = bool(self.REASONING_KEYWORDS.search(total_text))
        is_general = bool(self.GENERAL_KEYWORDS.search(total_text))

        if is_coding:
            task_type = "coding"
        elif is_reasoning:
            task_type = "reasoning"
        elif is_general:
            task_type = "general"
        else:
            task_type = "simple"

        if estimated_tokens > 2000 or is_reasoning:
            complexity = "high"
        elif estimated_tokens > 500 or is_coding:
            complexity = "medium"
        else:
            complexity = "low"

        # Simple & short prompts are latency sensitive
        latency_sensitive = (task_type == "simple" and estimated_tokens < 300) or ("fast" in total_text.lower())

        return RequestClassification(
            task_type=task_type,
            complexity=complexity,
            estimated_input_tokens=estimated_tokens,
            context_size=estimated_tokens,
            latency_sensitive=latency_sensitive,
        )
