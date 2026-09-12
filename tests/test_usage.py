from providers.base import ProviderUsage


def test_usage_total_is_derived():
    usage = ProviderUsage(prompt_tokens=11, completion_tokens=7)
    assert usage.total_tokens == 18
