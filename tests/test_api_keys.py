from services.api_key_service import hash_api_key, mask_api_key


def test_key_hash_is_stable_and_does_not_expose_key():
    raw = "gw_live_supersecret"
    digest = hash_api_key(raw)
    assert digest == hash_api_key(raw)
    assert raw not in digest


def test_mask_retains_only_identifying_edges():
    masked = mask_api_key("gw_live_1234567890")
    assert masked.startswith("gw_live_")
    assert masked.endswith("7890")
    assert "123456" not in masked
