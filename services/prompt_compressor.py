from dataclasses import dataclass
import re
from typing import Any, List, Tuple


@dataclass
class CompressionStats:
    original_length: int
    compressed_length: int
    compression_ratio: float
    tokens_saved: int = 0


class PromptCompressor:
    """Modular adaptive prompt compressor.

    Compresses long/redundant user messages conservatively while preserving key intent and instructions.
    Prompts below min_length_threshold remain unchanged.
    """

    def __init__(self, min_length_threshold: int = 50):
        self.min_length_threshold = min_length_threshold

        self.filler_patterns = [
            r"\b(?:could you please|would you mind|be so kind as to|can you please|please kindly|i was wondering if you could|if possible)\b",
            r"\b(?:as an ai language model|as you know|in my humble opinion|to be honest with you)\b",
        ]

    def compress_text(self, text: str) -> str:
        if not text or len(text) < self.min_length_threshold:
            return text

        compressed = text
        compressed = re.sub(r"\n{3,}", "\n\n", compressed)
        compressed = re.sub(r"[ \t]{2,}", " ", compressed)

        for pattern in self.filler_patterns:
            compressed = re.sub(pattern, "", compressed, flags=re.IGNORECASE)

        compressed = re.sub(r"[ \t]{2,}", " ", compressed).strip()
        return compressed if compressed else text

    def compress(self, messages: List[Any]) -> Tuple[List[Any], CompressionStats]:
        original_length = sum(
            len(msg.get("content", "") if isinstance(msg, dict) else getattr(msg, "content", ""))
            for msg in messages
        )

        if original_length < self.min_length_threshold:
            stats = CompressionStats(
                original_length=original_length,
                compressed_length=original_length,
                compression_ratio=0.0,
            )
            return messages, stats

        compressed_messages = []
        for msg in messages:
            if isinstance(msg, dict):
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "user":
                    content = self.compress_text(content)
                compressed_messages.append({"role": role, "content": content})
            else:
                role = getattr(msg, "role", "user")
                content = getattr(msg, "content", "")
                if role == "user":
                    content = self.compress_text(content)
                # Create a copy with compressed content if Pydantic model
                if hasattr(msg, "model_copy"):
                    compressed_messages.append(msg.model_copy(update={"content": content}))
                elif hasattr(msg, "copy"):
                    compressed_messages.append(msg.copy(update={"content": content}))

                else:
                    compressed_messages.append({"role": role, "content": content})

        compressed_length = sum(
            len(msg.get("content", "") if isinstance(msg, dict) else getattr(msg, "content", ""))
            for msg in compressed_messages
        )

        ratio = (
            round(1.0 - (compressed_length / original_length), 4)
            if original_length > 0
            else 0.0
        )
        if ratio < 0:
            ratio = 0.0

        stats = CompressionStats(
            original_length=original_length,
            compressed_length=compressed_length,
            compression_ratio=ratio,
        )
        return compressed_messages, stats
