import math
from dataclasses import dataclass

from redis.asyncio import Redis


TOKEN_BUCKET_LUA = """
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local now_parts = redis.call('TIME')
local now = tonumber(now_parts[1]) + tonumber(now_parts[2]) / 1000000

local state = redis.call('HMGET', key, 'tokens', 'updated_at')
local tokens = tonumber(state[1])
local updated_at = tonumber(state[2])
if tokens == nil then tokens = capacity end
if updated_at == nil then updated_at = now end

tokens = math.min(capacity, tokens + math.max(0, now - updated_at) * refill_rate)
local allowed = 0
local retry_after = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
else
  retry_after = (cost - tokens) / refill_rate
end

redis.call('HSET', key, 'tokens', tokens, 'updated_at', now)
redis.call('EXPIRE', key, math.max(60, math.ceil((capacity / refill_rate) * 2)))
return {allowed, tostring(tokens), tostring(retry_after)}
"""


@dataclass(slots=True)
class RateLimitResult:
    allowed: bool
    limit: int
    remaining: int
    retry_after: int


class RedisTokenBucket:
    """Atomic per-key token bucket; Lua makes refill and consumption one operation."""

    def __init__(self, redis: Redis):
        self.redis = redis

    async def consume(self, key_id: str, capacity: int, refill_rate: float) -> RateLimitResult:
        result = await self.redis.eval(
            TOKEN_BUCKET_LUA,
            1,
            f"rate_limit:{key_id}",
            capacity,
            refill_rate,
            1,
        )
        allowed = bool(int(result[0]))
        tokens = float(result[1])
        retry_after = max(0, math.ceil(float(result[2])))
        return RateLimitResult(allowed, capacity, max(0, math.floor(tokens)), retry_after)

    async def reset(self, key_id: str) -> None:
        await self.redis.delete(f"rate_limit:{key_id}")
