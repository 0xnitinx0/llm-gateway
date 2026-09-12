from typing import Any

import structlog

from database.connection import AsyncSessionLocal
from database.models import RequestLog

logger = structlog.get_logger("llm_gateway.request")


async def persist_request_log(**values: Any) -> None:
    """Persist metrics independently so streaming generators can log on finish."""
    defaults = {
        "api_key_id": None,
        "provider": None,
        "model": None,
        "cache_hit": False,
        "similarity": 0.0,
        "llm_called": False,
        "streaming": False,
        "rate_limited": False,
        "tournament": False,
        "original_tokens": None,
        "compressed_tokens": None,
        "input_tokens": None,
        "output_tokens": None,
        "total_tokens": None,
        "error_code": None,
    }
    defaults.update(values)
    async with AsyncSessionLocal() as db:
        db.add(RequestLog(**defaults))
        await db.commit()


def emit_request_log(**values: Any) -> None:
    logger.info("request_completed", **values)
