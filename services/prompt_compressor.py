from dataclasses import dataclass
import re
from typing import Any, Callable


@dataclass(slots=True)
class CompressionStats:
    strategy: str
    original_tokens: int
    compressed_tokens: int
    tokens_saved: int
    reduction_percent: float


class PromptCompressor:
    """Explainable compression that removes redundancy without rewriting intent."""

    FILLER_PATTERNS = (
        r"\b(?:could you please|would you mind|be so kind as to|can you please|please kindly)\b",
        r"\b(?:i was wondering if you could|if possible|to be honest with you)\b",
    )

    def __init__(
        self,
        token_counter: Callable[[str], int] | None = None,
        min_tokens: int = 30,
        target_ratio: float = 0.70,
    ):
        self.count_tokens = token_counter or (lambda value: len(value.split()))
        self.min_tokens = min_tokens
        self.target_ratio = target_ratio

    @staticmethod
    def _parts(message: Any) -> tuple[str, str]:
        if isinstance(message, dict):
            return str(message.get("role", "user")), str(message.get("content", ""))
        return str(getattr(message, "role", "user")), str(getattr(message, "content", ""))

    def _compress_text(self, text: str) -> str:
        text = re.sub(r"\s+", " ", text).strip()
        for pattern in self.FILLER_PATTERNS:
            text = re.sub(pattern, "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s+", " ", text).strip()

        sentences = re.split(r"(?<=[.!?])\s+", text)
        unique: list[str] = []
        fingerprints: set[str] = set()
        for sentence in sentences:
            fingerprint = re.sub(r"\W+", " ", sentence.lower()).strip()
            if fingerprint and fingerprint not in fingerprints:
                fingerprints.add(fingerprint)
                unique.append(sentence.strip())

        protected = [
            sentence
            for sentence in unique
            if re.search(r"\x60{3}|\b(?:must|never|not|exactly|json|format|\d+)\b", sentence, re.IGNORECASE)
        ]
        others = [sentence for sentence in unique if sentence not in protected]
        target = max(1, int(len(unique) * self.target_ratio))
        selected = unique if len(unique) <= target else protected + others[: max(0, target - len(protected))]
        if not selected:
            return text
        order = {sentence: index for index, sentence in enumerate(unique)}
        return " ".join(sorted(set(selected), key=order.get)).strip() or text

    def compress(self, messages: list[Any]) -> tuple[list[dict[str, str]], CompressionStats]:
        normalized = [{"role": role, "content": content} for role, content in map(self._parts, messages)]
        original_tokens = sum(self.count_tokens(item["content"]) for item in normalized)
        compressed = []
        for item in normalized:
            content = item["content"]
            if item["role"] == "user" and original_tokens >= self.min_tokens:
                content = self._compress_text(content)
            compressed.append({"role": item["role"], "content": content})

        compressed_tokens = sum(self.count_tokens(item["content"]) for item in compressed)
        saved = max(0, original_tokens - compressed_tokens)
        reduction = round((saved / original_tokens) * 100, 2) if original_tokens else 0.0
        return compressed, CompressionStats(
            strategy="filler+sentence-dedup+extractive",
            original_tokens=original_tokens,
            compressed_tokens=compressed_tokens,
            tokens_saved=saved,
            reduction_percent=reduction,
        )
