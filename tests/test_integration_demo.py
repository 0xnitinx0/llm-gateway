import os

import httpx
import pytest


pytestmark = pytest.mark.integration


@pytest.mark.skipif(os.getenv("RUN_INTEGRATION") != "1", reason="requires docker compose")
def test_live_gateway_cache_and_rate_limit():
    base = os.getenv("GATEWAY_URL", "http://localhost:8000")
    admin = {"X-Admin-Key": os.getenv("ADMIN_API_KEY", "admin-local-demo")}
    httpx.post(f"{base}/v1/admin/reset-demo", headers=admin).raise_for_status()

    payload = {
        "model": "gateway-auto",
        "messages": [{"role": "user", "content": "Explain semantic caching."}],
    }
    headers = {"Authorization": f"Bearer {os.getenv('DEMO_API_KEY', 'gw_demo_local')}"}
    miss = httpx.post(f"{base}/v1/chat/completions", headers=headers, json=payload)
    hit = httpx.post(f"{base}/v1/chat/completions", headers=headers, json=payload)
    assert miss.json()["gateway"]["cache_hit"] is False
    assert hit.json()["gateway"]["cache_hit"] is True

    rate_headers = {
        "X-Gateway-API-Key": os.getenv("RATE_LIMIT_DEMO_API_KEY", "gw_demo_rate")
    }
    statuses = [
        httpx.post(f"{base}/v1/chat/completions", headers=rate_headers, json=payload).status_code
        for _ in range(4)
    ]
    assert statuses[-1] == 429


@pytest.mark.skipif(os.getenv("RUN_INTEGRATION") != "1", reason="requires docker compose")
def test_live_admin_portal_contracts():
    base = os.getenv("GATEWAY_URL", "http://localhost:8000")
    admin = {"X-Admin-Key": os.getenv("ADMIN_API_KEY", "admin-local-demo")}

    assert httpx.get(f"{base}/usage").status_code == 401
    config = httpx.get(f"{base}/v1/admin/config", headers=admin)
    config.raise_for_status()
    assert config.json()["embedding_dimensions"] == 384
    assert "enabled_providers" in config.json()

    usage = httpx.get(f"{base}/usage", headers=admin)
    usage.raise_for_status()
    body = usage.json()
    assert body["cache_hits"] >= 0
    assert body["cache_misses"] >= 0
    assert len(body["history"]) == 7
    assert "compression" in body
    assert "tournaments" in body
    assert "costs" in body
    assert body["costs"]["currency"] == "USD"
