"""Store each request's USD estimate at the rates effective when it ran."""

from alembic import op
import sqlalchemy as sa

revision = "0003_cost_estimates"
down_revision = "0002_frontend_telemetry"
branch_labels = None
depends_on = None


COST_COLUMNS = (
    "baseline_cost_usd", "actual_cost_usd", "net_savings_usd",
    "cache_savings_usd", "compression_savings_usd", "tournament_overhead_usd",
)


def upgrade() -> None:
    op.add_column("request_logs", sa.Column("pricing_status", sa.String(16), nullable=False, server_default="unpriced"))
    for name in COST_COLUMNS:
        op.add_column("request_logs", sa.Column(name, sa.Numeric(20, 10), nullable=True))


def downgrade() -> None:
    for name in reversed(COST_COLUMNS):
        op.drop_column("request_logs", name)
    op.drop_column("request_logs", "pricing_status")
