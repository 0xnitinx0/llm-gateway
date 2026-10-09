import re
from dataclasses import dataclass
from typing import Any, Callable

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from services.routing.task_examples import TASK_EXAMPLES


@dataclass
class RequestClassification:
    task_type: str  # coding, reasoning, general, simple
    complexity: str
    estimated_input_tokens: int
    context_size: int
    latency_sensitive: bool


class RequestClassifier:
    """Local lexical example matching with explicit syntax and ambiguity rules."""

    CODING_SYNTAX = re.compile(
        r"```|\bdef\s+\w+\s*\(|\b(?:const|let|var)\s+\w+\s*=|"
        r"\bSELECT\s+.+\s+FROM\b|\bclass\s+\w+\s*[:{]|\bfunction\s+\w+\s*\(", re.I
    )
    MATH = re.compile(
        r"\b(?:prove|theorem|equation|calculus|integral|derivative|algebra|probability)\b|"
        r"\b\w+\s*[+*/^]\s*\w+\s*=", re.I
    )
    CODING = re.compile(
        r"\b(?:debug|refactor|programming|compiler|syntax error|unit tests?|"
        r"python|javascript|typescript|react|html|css|rust|sql|leetcode|"
        r"code|endpoint|regex|dataframe)\b|\bc\+\+\b", re.I
    )
    REASONING = re.compile(
        r"\b(?:proof|solve|deduce|tradeoffs|trade-offs|hypothesis|logic puzzle|"
        r"step.by.step|compare and contrast|architectural decision|causal|"
        r"evaluate the impact|weigh the evidence|formulate)\b", re.I
    )
    GENERAL = re.compile(r"\b(?:summari[sz]e|summary|overview|tell me about|history of|explain|describe)\b", re.I)
    FOLLOWUP = re.compile(
        r"^(?:and |also )?(?:why|how|continue|go on|explain more|tell me more|"
        r"make it .*|do it .*|what about .*|can you expand.*|expand on (?:it|that))\s*[.!?]*$", re.I
    )

    def __init__(self, token_counter: Callable[[str], int] | None = None):
        self.count_tokens = token_counter or (lambda text: max(1, len(text) // 4) if text else 0)
        self.labels = [label for label, examples in TASK_EXAMPLES.items() for _ in examples]
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words="english")
        self.examples = self.vectorizer.fit_transform(
            [example for examples in TASK_EXAMPLES.values() for example in examples]
        )

    @staticmethod
    def _parts(message: Any) -> tuple[str, str]:
        if isinstance(message, dict):
            return str(message.get("role", "user")), str(message.get("content", ""))
        return str(getattr(message, "role", "user")), str(getattr(message, "content", ""))

    def _task(self, text: str) -> str:
        if self.CODING_SYNTAX.search(text):
            return "coding"
        if self.MATH.search(text):
            return "reasoning"
        similarities = cosine_similarity(self.vectorizer.transform([text]), self.examples)[0]
        scores = {label: max(score for score, candidate in zip(similarities, self.labels) if candidate == label)
                  for label in TASK_EXAMPLES}
        ranked = sorted(scores, key=scores.get, reverse=True)
        if scores[ranked[0]] >= 0.20 and scores[ranked[0]] - scores[ranked[1]] >= 0.05:
            return ranked[0]
        if self.CODING.search(text):
            return "coding"
        if self.REASONING.search(text):
            return "reasoning"
        if self.GENERAL.search(text):
            return "general"
        return "simple"

    def classify(
        self, prompt_text: str, messages: list[Any], *, original_messages: list[Any] | None = None,
    ) -> RequestClassification:
        original = original_messages if original_messages is not None else messages
        users = [content for role, content in map(self._parts, original) if role == "user"]
        task_text = users[-1] if users else (prompt_text if not original else "")
        if len(task_text.split()) <= 12 and self.FOLLOWUP.fullmatch(task_text.strip()) and len(users) > 1:
            task_text = users[-2] + "\n" + task_text
        task_type = self._task(task_text)
        # Count forwarded content exactly once, including system and assistant context.
        estimated_tokens = sum(self.count_tokens(content) for _, content in map(self._parts, messages))
        complexity = "high" if estimated_tokens > 2000 or task_type == "reasoning" else (
            "medium" if estimated_tokens > 500 or task_type == "coding" else "low"
        )
        return RequestClassification(
            task_type=task_type, complexity=complexity,
            estimated_input_tokens=estimated_tokens, context_size=estimated_tokens,
            latency_sensitive=(task_type == "simple" and estimated_tokens < 300)
            or bool(re.search(r"\b(?:fast|quickly|urgent)\b", task_text, re.I)),
        )
