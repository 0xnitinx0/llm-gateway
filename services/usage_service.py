from sqlalchemy import func
from sqlalchemy.orm import Session

from database.models import RequestLog


def get_usage(db: Session) -> dict:
    total_requests = (
        db.query(func.count(RequestLog.id))
        .scalar()
        or 0
    )

    cache_hits = (
        db.query(func.count(RequestLog.id))
        .filter(RequestLog.cache_hit.is_(True))
        .scalar()
        or 0
    )

    cache_misses = total_requests - cache_hits

    llm_calls = (
        db.query(func.count(RequestLog.id))
        .filter(RequestLog.llm_called.is_(True))
        .scalar()
        or 0
    )

    llm_calls_avoided = total_requests - llm_calls

    avg_latency_ms = (
        db.query(func.avg(RequestLog.latency_ms))
        .scalar()
    )

    cache_hit_rate = (
        (cache_hits / total_requests) * 100
        if total_requests > 0
        else 0.0
    )

    total_input_tokens = (
        db.query(func.sum(RequestLog.input_tokens))
        .scalar()
        or 0
    )

    total_output_tokens = (
        db.query(func.sum(RequestLog.output_tokens))
        .scalar()
        or 0
    )

    total_tokens = (
        db.query(func.sum(RequestLog.total_tokens))
        .scalar()
        or 0
    )

    total_cost = (
        db.query(func.sum(RequestLog.estimated_cost))
        .scalar()
        or 0.0
    )

    avg_llm_cost = (total_cost / llm_calls) if llm_calls > 0 else 0.0
    estimated_savings = avg_llm_cost * llm_calls_avoided

    return {
        "total_requests": total_requests,
        "cache_hits": cache_hits,
        "cache_misses": cache_misses,
        "cache_hit_rate": round(float(cache_hit_rate), 2),
        "llm_calls": llm_calls,
        "llm_calls_avoided": llm_calls_avoided,
        "avg_latency_ms": (
            round(float(avg_latency_ms), 2)
            if avg_latency_ms is not None
            else 0.0
        ),
        "total_input_tokens": int(total_input_tokens),
        "total_output_tokens": int(total_output_tokens),
        "total_tokens": int(total_tokens),
        "estimated_cost": round(float(total_cost), 6),
        "estimated_savings": round(float(estimated_savings), 6),
    }