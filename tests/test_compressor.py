from services.prompt_compressor import PromptCompressor


def count(text: str) -> int:
    return len(text.split())


def test_compression_reports_real_before_after_counts():
    compressor = PromptCompressor(count, min_tokens=5, target_ratio=0.7)
    prompt = (
        "Could you please explain token buckets. "
        "Explain token buckets. Explain token buckets. "
        "The answer must use exactly three bullet points."
    )
    messages, stats = compressor.compress([{"role": "user", "content": prompt}])

    assert stats.original_tokens == count(prompt)
    assert stats.compressed_tokens == count(messages[0]["content"])
    assert stats.tokens_saved > 0
    assert stats.reduction_percent > 0
    assert "must use exactly three bullet points" in messages[0]["content"]


def test_system_messages_are_never_rewritten():
    compressor = PromptCompressor(count, min_tokens=1)
    messages, _ = compressor.compress(
        [{"role": "system", "content": "Could you please preserve this exact system instruction."}]
    )
    assert messages[0]["content"] == "Could you please preserve this exact system instruction."
