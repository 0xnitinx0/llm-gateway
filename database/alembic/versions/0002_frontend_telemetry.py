"""Persist provider-call and tournament telemetry for the live portal."""

from alembic import op
import sqlalchemy as sa

revision = "0002_frontend_telemetry"
down_revision = "0001_local_gateway"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("request_logs", sa.Column("llm_call_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("request_logs", sa.Column("tournament_candidate_count", sa.Integer(), nullable=True))
    op.add_column("request_logs", sa.Column("tournament_winner_score", sa.Float(), nullable=True))
    op.add_column("request_logs", sa.Column("judge_fallback", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.execute("UPDATE request_logs SET llm_call_count = 1 WHERE llm_called = true")


def downgrade() -> None:
    op.drop_column("request_logs", "judge_fallback")
    op.drop_column("request_logs", "tournament_winner_score")
    op.drop_column("request_logs", "tournament_candidate_count")
    op.drop_column("request_logs", "llm_call_count")
