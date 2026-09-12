from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app, get_db
from database.connection import Base
import database.models

from services.usage_service import get_usage
from services.usage_tracker import log_request

# Create isolated in-memory SQLite database for usage testing
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_test_db():
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


client = TestClient(app)
VALID_GATEWAY_KEY = "gateway-secret-key"


def test_get_usage_empty_db(setup_test_db):
    """Test get_usage with an empty database returns zero for cost metrics."""
    db = setup_test_db
    usage_data = get_usage(db)

    assert usage_data["total_requests"] == 0
    assert usage_data["cache_hits"] == 0
    assert usage_data["cache_misses"] == 0
    assert usage_data["cache_hit_rate"] == 0.0
    assert usage_data["llm_calls"] == 0
    assert usage_data["llm_calls_avoided"] == 0
    assert usage_data["avg_latency_ms"] is None
    assert usage_data["total_input_tokens"] is None
    assert usage_data["total_output_tokens"] is None
    assert usage_data["total_tokens"] is None
    assert usage_data["actual_provider_cost"] == 0.0
    assert usage_data["estimated_cost_without_gateway"] == 0.0
    assert usage_data["estimated_cost_saved"] == 0.0


def test_get_usage_populated_db(setup_test_db):
    """Test get_usage with known records calculates accurate cost breakdown and savings."""
    db = setup_test_db

    # Log 1: Cache Miss (LLM called, actual token usage)
    log_request(
        db=db,
        cache_hit=False,
        similarity=0.0,
        latency_ms=100.0,
        llm_called=True,
        input_tokens=10,
        output_tokens=20,
        total_tokens=30,
    )

    # Log 2: Cache Hit (LLM avoided)
    log_request(
        db=db,
        cache_hit=True,
        similarity=0.85,
        latency_ms=20.0,
        llm_called=False,
        input_tokens=None,
        output_tokens=None,
        total_tokens=None,
    )

    usage_data = get_usage(db)

    assert usage_data["total_requests"] == 2
    assert usage_data["cache_hits"] == 1
    assert usage_data["cache_misses"] == 1
    assert usage_data["cache_hit_rate"] == 50.0
    assert usage_data["llm_calls"] == 1
    assert usage_data["llm_calls_avoided"] == 1
    assert usage_data["avg_latency_ms"] == 60.0
    assert usage_data["total_input_tokens"] == 10
    assert usage_data["total_output_tokens"] == 20
    assert usage_data["total_tokens"] == 30
    assert usage_data["actual_provider_cost"] > 0
    assert usage_data["estimated_cost_without_gateway"] > usage_data["actual_provider_cost"]
    assert usage_data["estimated_cost_saved"] > 0


def test_usage_endpoint_success_without_auth(setup_test_db):
    """Test GET /usage returns metrics payload for the dashboard."""
    db = setup_test_db
    log_request(db=db, cache_hit=True, similarity=0.9, latency_ms=15.0, llm_called=False)

    res = client.get("/usage")
    assert res.status_code == 200
    data = res.json()
    assert data["total_requests"] == 1
    assert data["cache_hits"] == 1


def test_usage_endpoint_success(setup_test_db):
    """Test GET /usage with valid API key returns 200 OK and metric payload."""
    db = setup_test_db
    log_request(db=db, cache_hit=True, similarity=0.9, latency_ms=15.0, llm_called=False)

    res = client.get("/usage", headers={"X-Gateway-API-Key": VALID_GATEWAY_KEY})
    assert res.status_code == 200
    data = res.json()
    assert data["total_requests"] == 1
    assert data["cache_hits"] == 1
    assert data["cache_hit_rate"] == 100.0
    assert data["llm_calls_avoided"] == 1
    assert data["actual_provider_cost"] == 0.0
    assert data["estimated_cost_saved"] == 0.0

