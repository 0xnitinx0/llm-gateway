import time
from uuid import uuid4

import structlog
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from database.connection import AsyncSessionLocal
from services.api_key_service import validate_gateway_api_key
from services.rate_limiter import RedisTokenBucket
from services.request_logging import emit_request_log, persist_request_log

logger = structlog.get_logger("llm_gateway.access")

PROTECTED_PREFIXES = (
    "/v1/chat/completions",
    "/v1/tournaments",
    "/v1/tools/",
)


def error_response(status_code: int, message: str, error_type: str, code: str, headers=None):
    return JSONResponse(
        status_code=status_code,
        content={"error": {"message": message, "type": error_type, "code": code}},
        headers=headers or {},
    )


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.request_id = request.headers.get("X-Request-ID") or f"req_{uuid4().hex}"
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception(
                "request_failed",
                request_id=request.state.request_id,
                method=request.method,
                path=request.url.path,
                latency_ms=round((time.perf_counter() - started) * 1000, 2),
            )
            raise
        response.headers["X-Request-ID"] = request.state.request_id
        logger.info(
            "http_request",
            request_id=request.state.request_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            latency_ms=round((time.perf_counter() - started) * 1000, 2),
        )
        return response


class GatewaySecurityMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, redis: Redis):
        super().__init__(app)
        self.limiter = RedisTokenBucket(redis)

    @staticmethod
    def _raw_key(request: Request) -> tuple[str | None, str | None]:
        authorization = request.headers.get("Authorization", "")
        bearer = authorization[7:].strip() if authorization.lower().startswith("bearer ") else None
        legacy = request.headers.get("X-Gateway-API-Key")
        if bearer and legacy and bearer != legacy:
            return None, "conflicting"
        return bearer or legacy, None

    async def dispatch(self, request: Request, call_next):
        started = time.perf_counter()
        if not request.url.path.startswith(PROTECTED_PREFIXES):
            return await call_next(request)

        raw_key, error = self._raw_key(request)
        if error:
            return error_response(400, "Conflicting API key headers", "invalid_request_error", error)
        if not raw_key:
            return error_response(401, "Missing gateway API key", "authentication_error", "missing_api_key")

        try:
            async with AsyncSessionLocal() as db:
                api_key = await validate_gateway_api_key(db, raw_key)
            if api_key is None:
                return error_response(401, "Invalid or revoked gateway API key", "authentication_error", "invalid_api_key")
            result = await self.limiter.consume(
                api_key.id,
                api_key.rate_limit_capacity,
                api_key.refill_rate_per_second,
            )
        except Exception:
            logger.exception("security_backend_unavailable", path=request.url.path)
            return error_response(503, "Authentication or rate-limit backend unavailable", "service_unavailable", "security_backend_unavailable")

        headers = {
            "X-RateLimit-Limit": str(result.limit),
            "X-RateLimit-Remaining": str(result.remaining),
        }
        if not result.allowed:
            headers["Retry-After"] = str(result.retry_after)
            values = {
                "request_id": getattr(request.state, "request_id", "unknown"),
                "api_key_id": api_key.id,
                "path": request.url.path,
                "status_code": 429,
                "latency_ms": (time.perf_counter() - started) * 1000,
                "rate_limited": True,
                "error_code": "rate_limit_exceeded",
            }
            emit_request_log(**values)
            await persist_request_log(**values)
            return error_response(429, "Rate limit exceeded", "rate_limit_error", "rate_limit_exceeded", headers)

        request.state.api_key = api_key
        request.state.rate_limiter = self.limiter
        response = await call_next(request)
        response.headers.update(headers)
        return response
