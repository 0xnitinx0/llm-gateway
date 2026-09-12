import hashlib
import secrets
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import GatewayAPIKey


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def mask_api_key(raw_key: str) -> str:
    return f"{raw_key[:8]}••••••••{raw_key[-4:]}"


async def create_gateway_api_key(
    db: AsyncSession,
    name: str,
    rate_limit_capacity: int = 60,
    refill_rate_per_second: float = 1.0,
    raw_key: str | None = None,
) -> tuple[GatewayAPIKey, str]:
    raw_key = raw_key or f"gw_live_{secrets.token_hex(16)}"
    key = GatewayAPIKey(
        name=name.strip(),
        key_hash=hash_api_key(raw_key),
        masked_key=mask_api_key(raw_key),
        rate_limit_capacity=rate_limit_capacity,
        refill_rate_per_second=refill_rate_per_second,
    )
    db.add(key)
    await db.commit()
    await db.refresh(key)
    return key, raw_key


async def validate_gateway_api_key(db: AsyncSession, raw_key: str) -> GatewayAPIKey | None:
    key = await db.scalar(select(GatewayAPIKey).where(GatewayAPIKey.key_hash == hash_api_key(raw_key)))
    if key is None or key.is_revoked:
        return None
    key.last_used_at = datetime.now(timezone.utc)
    await db.commit()
    return key


async def seed_gateway_api_key(
    db: AsyncSession,
    *,
    raw_key: str,
    name: str,
    capacity: int,
    refill_rate: float,
) -> GatewayAPIKey:
    existing = await db.scalar(select(GatewayAPIKey).where(GatewayAPIKey.key_hash == hash_api_key(raw_key)))
    if existing:
        existing.rate_limit_capacity = capacity
        existing.refill_rate_per_second = refill_rate
        existing.is_revoked = False
        await db.commit()
        return existing
    key, _ = await create_gateway_api_key(db, name, capacity, refill_rate, raw_key)
    return key
