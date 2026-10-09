from unittest.mock import patch

import pytest

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


@pytest.mark.parametrize("strategy", ["basic", "conservative_tfidf"])
@pytest.mark.parametrize("prefix", [
    "I would appreciate it if you could ", "Please kindly ",
    "Would you be so kind as to ", "I was wondering if you could ",
    "Without further ado, ", "Can you please ", "Would you mind ",
])
def test_expanded_request_introductions(strategy, prefix):
    result, stats = PromptCompressor(count, min_tokens=0, strategy=strategy).compress(
        [{"role": "user", "content": prefix + "explain caching."}]
    )
    assert result[0]["content"] == "explain caching."
    assert stats.strategy == strategy


@pytest.mark.parametrize("content", [
    '```python\ndef f():\n    return "Could you please"\n```',
    '~~~python\ndef f():\n    return 2\n~~~',
    '    if enabled:\n        return "please"\n',
    '{"message": "Could you please", "limit": 12}',
    '[1, 2, 3]', '| label | value |\n| please | 12 |',
    '`Could you please`', '"Could you please explain caching."',
    "'Could you please explain caching.'", '“Could you please explain caching.”',
    '- Could you please keep this list item.\n- Next item.',
])
def test_protected_content_preserved_byte_for_byte(content):
    prompt = "Could you please explain caching.\n" + content
    result, _ = PromptCompressor(count, min_tokens=0).compress([{"role": "user", "content": prompt}])
    assert result[0]["content"] == "explain caching.\n" + content


@pytest.mark.parametrize("prompt", [
    "Use 12 tokens. Use 13 tokens.",
    "Allow access. Do not allow access.",
    "Dogs chase cats. Cats chase dogs.",
    "Alice pays Bob. Bob pays Alice.",
    "Send the report before lunch. Send the report after lunch.",
    "Explain caching. Include latency figures. Discuss eviction. Keep four sections.",
    "The limit is 2.5 requests. The limit is 2.6 requests.",
    "I actually need just one result. If possible, use the backup server.",
    "Use a-b. Use ab.",
])
def test_distinct_facts_constraints_and_meaning_survive(prompt):
    result, _ = PromptCompressor(count, min_tokens=0, target_ratio=0.1).compress(
        [{"role": "user", "content": prompt}]
    )
    assert result[0]["content"] == prompt


def test_tfidf_removes_only_guarded_near_duplicates():
    first = "Explain how the token bucket tracks available capacity and refills tokens over time."
    second = "Explain how token bucket tracks available capacity and refills tokens over time."
    basic, _ = PromptCompressor(count, min_tokens=0, strategy="basic").compress(
        [{"role": "user", "content": first + " " + second}]
    )
    advanced, _ = PromptCompressor(count, min_tokens=0).compress(
        [{"role": "user", "content": first + " " + second}]
    )
    assert second in basic[0]["content"]
    assert advanced[0]["content"].strip() == first


def test_short_empty_and_non_user_messages():
    messages = [
        {"role": "system", "content": "Please keep this."},
        {"role": "assistant", "content": "Please keep this too."},
        {"role": "user", "content": "Please explain caching."},
    ]
    result, _ = PromptCompressor(count).compress(messages)
    assert result == messages
    assert PromptCompressor(count, min_tokens=0).compress([{"role": "user", "content": "Thanks!"}])[0][0]["content"] == "Thanks!"
    assert PromptCompressor(count).compress([])[1].original_tokens == 0


def test_long_prompt_skips_pairwise_analysis():
    prompt = " ".join(f"Explain detail number {number}." for number in range(201))
    with patch("services.prompt_compressor.TfidfVectorizer", side_effect=AssertionError("must skip")):
        result, _ = PromptCompressor(count, min_tokens=0).compress([{"role": "user", "content": prompt}])
    assert result[0]["content"] == prompt


@pytest.mark.parametrize("prompt", ["Use US. Use us.", "Let's eat, Grandma. Let's eat Grandma."])
def test_case_and_internal_punctuation_can_carry_meaning(prompt):
    result, _ = PromptCompressor(count, min_tokens=0).compress([{"role": "user", "content": prompt}])
    assert result[0]["content"] == prompt


@pytest.mark.parametrize("content", [
    '"Could you please explain caching.\nPlease keep this quotation."',
    '"Could you please keep this unfinished quotation.',
    '"A quote with an escaped \\" character. Please preserve it."',
    '“Could you please explain caching.\nPlease keep this quotation.”',
    "import os\nimport os\nreturn value", "do_work();\ndo_work();",
])
def test_multiline_quotes_and_unfenced_code_preserved(content):
    result, _ = PromptCompressor(count, min_tokens=0).compress([{"role": "user", "content": content}])
    assert result[0]["content"] == content
