from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from database.connection import Base


class RequestLog(Base):
    __tablename__ = "request_logs"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    cache_hit: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
    )
    similarity: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    latency_ms: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    llm_called: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
    )
    input_tokens: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    output_tokens: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    total_tokens: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    estimated_cost: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )


class GatewayAPIKey(Base):
    __tablename__ = "gateway_api_keys"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    key_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
    )
    masked_key: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
    is_revoked: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )