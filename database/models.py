from datetime import datetime, timezone
from uuid import uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database.connection import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class GatewayAPIKey(Base):
    __tablename__ = "gateway_api_keys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    masked_key: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    rate_limit_capacity: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    refill_rate_per_second: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)


class SemanticCacheEntry(Base):
    """A response indexed by vector meaning without retaining the raw prompt."""

    __tablename__ = "semantic_cache_entries"
    __table_args__ = (Index("ix_semantic_cache_key_created", "api_key_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    api_key_id: Mapped[str] = mapped_column(
        ForeignKey("gateway_api_keys.id", ondelete="CASCADE"), nullable=False, index=True
    )
    embedding: Mapped[list[float]] = mapped_column(Vector(384), nullable=False)
    response: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str] = mapped_column(String(80), nullable=False)
    model: Mapped[str] = mapped_column(String(160), nullable=False)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class RequestLog(Base):
    __tablename__ = "request_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    request_id: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    api_key_id: Mapped[str | None] = mapped_column(String(36), index=True)
    path: Mapped[str] = mapped_column(String(255), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    latency_ms: Mapped[float] = mapped_column(Float, nullable=False)
    provider: Mapped[str | None] = mapped_column(String(80))
    model: Mapped[str | None] = mapped_column(String(160))
    cache_hit: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    similarity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    llm_called: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    streaming: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    rate_limited: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tournament: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    original_tokens: Mapped[int | None] = mapped_column(Integer)
    compressed_tokens: Mapped[int | None] = mapped_column(Integer)
    input_tokens: Mapped[int | None] = mapped_column(Integer)
    output_tokens: Mapped[int | None] = mapped_column(Integer)
    total_tokens: Mapped[int | None] = mapped_column(Integer)
    error_code: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
