from dataclasses import dataclass
import re
from typing import Any, Callable

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


@dataclass(slots=True)
class CompressionStats:
    strategy: str
    original_tokens: int
    compressed_tokens: int
    tokens_saved: int
    reduction_percent: float


class PromptCompressor:
    """Remove prose redundancy while preserving distinct instructions and formatting."""

    STRATEGIES = {"basic", "conservative_tfidf"}
    MAX_PROSE_SENTENCES = 200
    FILLER_PATTERNS = (
        r"would you mind\s+",
        r"(?:could|can|would|will) you (?:please |kindly )?",
        r"(?:please kindly|kindly please|please|kindly)\s+",
        r"(?:i was wondering if you could|i would appreciate it if you could|"
        r"i would be grateful if you could|i would like you to|i want you to|"
        r"would you be so kind as to|be so kind as to)\s+",
        r"(?:for your information|to be honest with you|without further ado|"
        r"as a matter of fact)[,:]?\s+",
    )
    # Protection is deliberately broad: ambiguous data is cheaper to keep than damage.
    PROTECTED = re.compile(
        r"```[\s\S]*?(?:```|\Z)|~~~[\s\S]*?(?:~~~|\Z)|`[^`\n]*`|"
        r'"(?:\\.|[^"\\])*(?:"|\Z)|“[^”]*(?:”|\Z)|‘[^’]*(?:’|\Z)|(?<!\w)\'[^\']*\'(?!\w)|'
        r"(?m:^[ \t]*(?:[\[{<]|[-*+]\s|\d+[.)]\s|#{1,6}\s|\||>)[^\n]*(?:\n|$))|"
        r"(?m:^(?:\t| {2,})[^\n]*(?:\n|$))|"
        r"(?m:^[^\n]*(?:\||[{}\[\]]|https?://|;|\w+\s*[:=]\s*\S)[^\n]*(?:\n|$))"
    )
    UNFENCED_CODE = re.compile(
        r"(?m)^[ \t]*(?:def|class|import|from|return|async|await|const|let|var|SELECT|INSERT|UPDATE|DELETE)\b"
    )
    SENTENCE = re.compile(r".+?(?:[.!?]+(?=\s|$)|(?=\n|$))")
    MARKERS = re.compile(
        r"\d+(?:\.\d+)?|\b(?:not|no|never|only|must|exactly|always|unless|"
        r"before|after|more|less|at least|at most)\b|[<>=+/%-]", re.IGNORECASE
    )
    ARTICLES = {"a", "an", "the"}

    def __init__(
        self,
        token_counter: Callable[[str], int] | None = None,
        min_tokens: int = 30,
        target_ratio: float = 0.70,
        strategy: str = "conservative_tfidf",
    ):
        if strategy not in self.STRATEGIES:
            raise ValueError(f"Unknown compression strategy: {strategy}")
        self.count_tokens = token_counter or (lambda value: len(value.split()))
        self.min_tokens = min_tokens
        self.target_ratio = target_ratio  # Soft target; never truncate unique content.
        self.strategy = strategy

    @staticmethod
    def _parts(message: Any) -> tuple[str, str]:
        if isinstance(message, dict):
            return str(message.get("role", "user")), str(message.get("content", ""))
        return str(getattr(message, "role", "user")), str(getattr(message, "content", ""))

    def _cleanup(self, sentence: str) -> str:
        leading = sentence[:len(sentence) - len(sentence.lstrip())]
        body = sentence.lstrip()
        if re.fullmatch(r"(?:hello|hi|hey|thank you|thanks|thanks in advance)[.! ]*", body, re.I):
            return ""
        # Only request introductions at sentence starts are removable.
        while body:
            previous = body
            for pattern in self.FILLER_PATTERNS:
                body = re.sub(r"^(?:" + pattern + r")", "", body, count=1, flags=re.I)
            if body == previous:
                break
        return leading + body if body.strip(" .!?") else ""

    @classmethod
    def _content_words(cls, sentence: str) -> list[str]:
        return [word for word in re.findall(r"\w+|[^\w\s]", sentence.strip().rstrip(".!?"))
                if word.casefold() not in cls.ARTICLES]

    def _compress_prose(self, text: str, use_tfidf: bool) -> str:
        matches = list(self.SENTENCE.finditer(text))
        cleaned = [self._cleanup(match.group()) for match in matches]
        matrix = None
        if use_tfidf and len(matches) > 1 and any(re.search(r"\w\w", item) for item in cleaned):
            try:
                vectors = TfidfVectorizer().fit_transform(cleaned)
                matrix = cosine_similarity(vectors)
            except ValueError:  # Empty vocabulary after cleanup.
                pass
        seen: set[str] = set()
        retained: list[int] = []
        edits: list[tuple[int, int, str]] = []
        
        for index, (match, sentence) in enumerate(zip(matches, cleaned)):
            fingerprint = re.sub(r"\s+", " ", sentence.strip())
            duplicate = fingerprint in seen
            
            if not duplicate and matrix is not None:
                words = self._content_words(sentence)
                markers = self.MARKERS.findall(sentence.casefold())
                duplicate = any(
                    matrix[index, other] >= 0.92
                    and markers == self.MARKERS.findall(cleaned[other].casefold())
                    # Ordered equality is stronger than containment: added facts survive.
                    and words == self._content_words(cleaned[other])
                    for other in retained
                )
            
            if not fingerprint or duplicate:
                edits.append((match.start(), match.end(), ""))
            else:
                seen.add(fingerprint)
                retained.append(index)
                if sentence != match.group():
                    edits.append((match.start(), match.end(), sentence))
        
        for start, end, replacement in reversed(edits):
            text = text[:start] + replacement + text[end:]
        return text

    def _compress_text(self, text: str) -> str:
        protected = list(self.PROTECTED.finditer(text))
        spans: list[tuple[int, int]] = []
        cursor = 0
        
        for match in protected:
            spans.append((cursor, match.start()))
            cursor = match.end()
        spans.append((cursor, len(text)))
        
        if any(self.UNFENCED_CODE.search(text[start:end]) for start, end in spans):
            return text
        
        sentence_count = sum(len(self.SENTENCE.findall(text[start:end])) for start, end in spans)
        use_tfidf = self.strategy == "conservative_tfidf" and sentence_count <= self.MAX_PROSE_SENTENCES
        result = text
        for start, end in reversed(spans):
            result = result[:start] + self._compress_prose(text[start:end], use_tfidf) + result[end:]
        if not result.strip() or self.count_tokens(result) > self.count_tokens(text) or len(result) > len(text):
            return text
        return result

    def compress(self, messages: list[Any]) -> tuple[list[dict[str, str]], CompressionStats]:
        normalized = [{"role": role, "content": content} for role, content in map(self._parts, messages)]
        original_tokens = sum(self.count_tokens(item["content"]) for item in normalized)
        compressed = [
            {"role": item["role"], "content": self._compress_text(item["content"])
             if item["role"] == "user" and original_tokens >= self.min_tokens else item["content"]}
            for item in normalized
        ]
        compressed_tokens = sum(self.count_tokens(item["content"]) for item in compressed)
        saved = max(0, original_tokens - compressed_tokens)
        return compressed, CompressionStats(
            strategy=self.strategy,
            original_tokens=original_tokens,
            compressed_tokens=compressed_tokens,
            tokens_saved=saved,
            reduction_percent=round(saved / original_tokens * 100, 2) if original_tokens else 0.0,
        )
