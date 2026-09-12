from datetime import datetime, timezone
import os
from typing import Optional

from sqlalchemy.orm import Session

from database.models import RequestLog


def calculate_cost(input_tokens: Optional[int], output_tokens: Optional[int]) -> Optional[float]:
    if input_tokens is None or output_tokens is None:
        return None

    input_rate_str = os.getenv("INPUT_COST_PER_1K_TOKENS", "0.00015")
    output_rate_str = os.getenv("OUTPUT_COST_PER_1K_TOKENS", "0.0006")

    try:
        input_rate = float(input_rate_str)
        output_rate = float(output_rate_str)
        cost = (input_tokens / 1000.0) * input_rate + (output_tokens / 1000.0) * output_rate
        return round(cost, 6)
    except (ValueError, TypeError):
        return None



def log_request(
    db: Session,
    cache_hit: bool,
    similarity: float,
    latency_ms: float,
    llm_called: bool,
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None,
    total_tokens: Optional[int] = None,
    estimated_cost: Optional[float] = None,
) -> RequestLog:
    if estimated_cost is None and llm_called and input_tokens is not None and output_tokens is not None:
        estimated_cost = calculate_cost(input_tokens, output_tokens)

    request_log = RequestLog(
        cache_hit=cache_hit,
        similarity=similarity,
        latency_ms=latency_ms,
        llm_called=llm_called,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        estimated_cost=estimated_cost,
        created_at=datetime.now(timezone.utc),
    )

    db.add(request_log)
    db.commit()
    db.refresh(request_log)

    return request_log