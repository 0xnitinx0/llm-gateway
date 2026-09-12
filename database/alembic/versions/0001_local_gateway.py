"""Create gateway keys, request logs, and pgvector semantic cache."""

from alembic import op
from pgvector.sqlalchemy import Vector
import sqlalchemy as sa

revision = "0001_local_gateway"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "gateway_api_keys",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("key_hash", sa.String(64), nullable=False),
        sa.Column("masked_key", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
        sa.Column("is_revoked", sa.Boolean(), nullable=False),
        sa.Column("rate_limit_capacity", sa.Integer(), nullable=False),
        sa.Column("refill_rate_per_second", sa.Float(), nullable=False),
    )
    op.create_index("ix_gateway_api_keys_key_hash", "gateway_api_keys", ["key_hash"], unique=True)
    op.create_table(
        "semantic_cache_entries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("api_key_id", sa.String(36), sa.ForeignKey("gateway_api_keys.id", ondelete="CASCADE"), nullable=False),
        sa.Column("embedding", Vector(384), nullable=False),
        sa.Column("response", sa.Text(), nullable=False),
        sa.Column("provider", sa.String(80), nullable=False),
        sa.Column("model", sa.String(160), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False),
        sa.Column("completion_tokens", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_semantic_cache_entries_api_key_id", "semantic_cache_entries", ["api_key_id"])
    op.create_index("ix_semantic_cache_key_created", "semantic_cache_entries", ["api_key_id", "created_at"])
    op.create_index(
        "ix_semantic_cache_embedding_hnsw",
        "semantic_cache_entries",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
        postgresql_with={"m": 16, "ef_construction": 64},
    )
    op.create_table(
        "request_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("request_id", sa.String(40), nullable=False),
        sa.Column("api_key_id", sa.String(36)),
        sa.Column("path", sa.String(255), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("latency_ms", sa.Float(), nullable=False),
        sa.Column("provider", sa.String(80)),
        sa.Column("model", sa.String(160)),
        sa.Column("cache_hit", sa.Boolean(), nullable=False),
        sa.Column("similarity", sa.Float(), nullable=False),
        sa.Column("llm_called", sa.Boolean(), nullable=False),
        sa.Column("streaming", sa.Boolean(), nullable=False),
        sa.Column("rate_limited", sa.Boolean(), nullable=False),
        sa.Column("tournament", sa.Boolean(), nullable=False),
        sa.Column("original_tokens", sa.Integer()),
        sa.Column("compressed_tokens", sa.Integer()),
        sa.Column("input_tokens", sa.Integer()),
        sa.Column("output_tokens", sa.Integer()),
        sa.Column("total_tokens", sa.Integer()),
        sa.Column("error_code", sa.String(80)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_request_logs_request_id", "request_logs", ["request_id"])
    op.create_index("ix_request_logs_api_key_id", "request_logs", ["api_key_id"])


def downgrade() -> None:
    op.drop_table("request_logs")
    op.drop_table("semantic_cache_entries")
    op.drop_table("gateway_api_keys")
