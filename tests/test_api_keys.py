from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app, get_db
from database.connection import Base
from database.models import GatewayAPIKey
from services.api_key_service import create_gateway_api_key, revoke_gateway_api_key

from sqlalchemy.pool import StaticPool

TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


from app.main import app, get_db, semantic_cache

@pytest.fixture(autouse=True)
def setup_test_db():
    semantic_cache.clear()
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield db
    db.close()
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()
    semantic_cache.clear()



client = TestClient(app)
STATIC_BOOTSTRAP_KEY = "gateway-secret-key"


@patch("app.main.model_router.execute", new_callable=AsyncMock)
@patch("app.main.provider.embed", new_callable=AsyncMock)
def test_static_bootstrap_key_auth(mock_embed, mock_router_execute, setup_test_db):
    """1. Static bootstrap key -> 200 OK."""
    mock_embed.return_value = [0.1, 0.2]
    mock_router_execute.return_value = ("Test response", {"input_tokens": 5, "output_tokens": 5, "total_tokens": 10}, "groq", "groq/compound", False)

    headers = {"X-Gateway-API-Key": STATIC_BOOTSTRAP_KEY}
    payload = {"messages": [{"role": "user", "content": "Hello"}]}

    res = client.post("/v1/chat/completions", json=payload, headers=headers)
    assert res.status_code == 200
    assert res.json()["response"] == "Test response"


@patch("app.main.model_router.execute", new_callable=AsyncMock)
@patch("app.main.provider.embed", new_callable=AsyncMock)
def test_valid_generated_key_auth(mock_embed, mock_router_execute, setup_test_db):
    """2. Valid generated DB key -> 200 OK."""
    db = setup_test_db
    mock_embed.return_value = [0.1, 0.2]
    mock_router_execute.return_value = ("Generated key response", {"input_tokens": 5, "output_tokens": 5, "total_tokens": 10}, "groq", "groq/compound", False)

    key_obj, raw_key = create_gateway_api_key(db, "Microservice Key")

    headers = {"X-Gateway-API-Key": raw_key}
    payload = {"messages": [{"role": "user", "content": "Hello"}]}

    res = client.post("/v1/chat/completions", json=payload, headers=headers)
    assert res.status_code == 200
    assert res.json()["response"] == "Generated key response"


def test_invalid_generated_key_auth(setup_test_db):
    """3. Invalid generated key -> 401 Unauthorized."""
    headers = {"X-Gateway-API-Key": "gw_live_invalidkey99999999"}
    payload = {"messages": [{"role": "user", "content": "Hello"}]}

    res = client.post("/v1/chat/completions", json=payload, headers=headers)
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid or missing Gateway API key"


@patch("app.main.model_router.execute", new_callable=AsyncMock)
@patch("app.main.provider.embed", new_callable=AsyncMock)
def test_revoked_generated_key_auth(mock_embed, mock_router_execute, setup_test_db):
    """4. Revoked generated key -> 401 Unauthorized."""
    db = setup_test_db
    key_obj, raw_key = create_gateway_api_key(db, "Revoked Key")

    # Revoke key
    revoke_gateway_api_key(db, key_obj.id)

    headers = {"X-Gateway-API-Key": raw_key}
    payload = {"messages": [{"role": "user", "content": "Hello"}]}

    res = client.post("/v1/chat/completions", json=payload, headers=headers)
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid or missing Gateway API key"


@patch("app.main.model_router.execute", new_callable=AsyncMock)
@patch("app.main.provider.embed", new_callable=AsyncMock)
def test_last_used_at_updates_on_valid_key(mock_embed, mock_router_execute, setup_test_db):
    """5. Valid generated key updates last_used_at in DB."""
    db = setup_test_db
    mock_embed.return_value = [0.1, 0.2]
    mock_router_execute.return_value = ("Ok", {"input_tokens": 1, "output_tokens": 1, "total_tokens": 2}, "groq", "groq/compound", False)

    key_obj, raw_key = create_gateway_api_key(db, "Timestamp Key")
    assert key_obj.last_used_at is None

    headers = {"X-Gateway-API-Key": raw_key}
    payload = {"messages": [{"role": "user", "content": "Ping"}]}

    res = client.post("/v1/chat/completions", json=payload, headers=headers)
    assert res.status_code == 200

    # Query DB directly to verify last_used_at was updated
    updated_key = db.query(GatewayAPIKey).filter(GatewayAPIKey.id == key_obj.id).first()
    assert updated_key is not None
    assert updated_key.last_used_at is not None


def test_api_key_management_endpoints(setup_test_db):
    """Test API key CRUD endpoints (list, create, revoke)."""
    headers = {"X-Gateway-API-Key": STATIC_BOOTSTRAP_KEY}

    # 1. Create key
    create_res = client.post("/v1/api-keys", json={"name": "Frontend Portal Key"}, headers=headers)
    assert create_res.status_code == 200
    data = create_res.json()
    assert "secretKey" in data
    assert data["secretKey"].startswith("gw_live_")
    key_info = data["key"]
    assert key_info["name"] == "Frontend Portal Key"
    assert key_info["status"] == "active"
    key_id = key_info["id"]

    # 2. List keys
    list_res = client.get("/v1/api-keys", headers=headers)
    assert list_res.status_code == 200
    keys_list = list_res.json()
    assert len(keys_list) == 1
    assert keys_list[0]["id"] == key_id

    # 3. Revoke key
    revoke_res = client.delete(f"/v1/api-keys/{key_id}", headers=headers)
    assert revoke_res.status_code == 200
    assert revoke_res.json() == {"status": "ok"}

    # 4. List keys again - status should be revoked
    list_res_2 = client.get("/v1/api-keys", headers=headers)
    assert list_res_2.json()[0]["status"] == "revoked"
