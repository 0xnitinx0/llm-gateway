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

    raw_avg_latency = db.query(func.avg(RequestLog.latency_ms)).scalar()
    avg_latency_ms = (
        round(float(raw_avg_latency), 2)
        if raw_avg_latency is not None
        else None
    )

    cache_hit_rate = (
        round(float((cache_hits / total_requests) * 100), 2)
        if total_requests > 0
        else 0.0
    )

    raw_input_tokens = db.query(func.sum(RequestLog.input_tokens)).scalar()
    total_input_tokens = (
        int(raw_input_tokens) if raw_input_tokens is not None else None
    )

    raw_output_tokens = db.query(func.sum(RequestLog.output_tokens)).scalar()
    total_output_tokens = (
        int(raw_output_tokens) if raw_output_tokens is not None else None
    )

    raw_total_tokens = db.query(func.sum(RequestLog.total_tokens)).scalar()
    total_tokens = (
        int(raw_total_tokens) if raw_total_tokens is not None else None
    )

    from services.usage_tracker import calculate_cost

    logs = db.query(RequestLog).all()
    actual_provider_cost = 0.0
    for log in logs:
        if log.llm_called:
            if log.estimated_cost is not None:
                actual_provider_cost += log.estimated_cost
            elif log.input_tokens is not None and log.output_tokens is not None:
                cost = calculate_cost(log.input_tokens, log.output_tokens)
                if cost is not None:
                    actual_provider_cost += cost

    actual_provider_cost = round(actual_provider_cost, 6)

    if llm_calls > 0 and actual_provider_cost > 0:
        avg_llm_cost = actual_provider_cost / llm_calls
        estimated_cost_without_gateway = round(actual_provider_cost + (cache_hits * avg_llm_cost), 6)
    else:
        estimated_cost_without_gateway = actual_provider_cost

    estimated_cost_saved = max(0.0, round(estimated_cost_without_gateway - actual_provider_cost, 6))

    # Recent activity logs (last 10)
    recent_logs = (
        db.query(RequestLog)
        .order_by(RequestLog.created_at.desc())
        .limit(10)
        .all()
    )
    recent_activity = [
        {
            "id": log.id[:8] + "...",
            "time": log.created_at.strftime("%H:%M:%S") if log.created_at else "N/A",
            "result": "HIT" if log.cache_hit else "MISS",
            "similarity": round(log.similarity, 2) if log.similarity is not None else 0.0,
            "latency": f"{int(log.latency_ms)}ms" if log.latency_ms is not None else "0ms",
        }
        for log in recent_logs
    ]

    # Daily request history for chart
    from collections import defaultdict
    daily_counts = defaultdict(int)
    all_logs = db.query(RequestLog).order_by(RequestLog.created_at.asc()).all()
    for log in all_logs:
        if log.created_at:
            day_str = log.created_at.strftime("%b %d")
            daily_counts[day_str] += 1

    history = [
        {"day": day, "requests": count}
        for day, count in daily_counts.items()
    ]

    # Similarity distribution
    sim_buckets = {
        "0.0 - 0.50": 0,
        "0.50 - 0.74": 0,
        "0.75 - 0.89": 0,
        "0.90 - 1.00": 0,
    }
    for log in all_logs:
        sim = log.similarity or 0.0
        if sim < 0.50:
            sim_buckets["0.0 - 0.50"] += 1
        elif sim < 0.75:
            sim_buckets["0.50 - 0.74"] += 1
        elif sim < 0.90:
            sim_buckets["0.75 - 0.89"] += 1
        else:
            sim_buckets["0.90 - 1.00"] += 1

    similarity_distribution = [
        {"range": r, "count": c}
        for r, c in sim_buckets.items()
    ]

    return {
        "total_requests": total_requests,
        "cache_hits": cache_hits,
        "cache_misses": cache_misses,
        "cache_hit_rate": cache_hit_rate,
        "llm_calls": llm_calls,
        "llm_calls_avoided": llm_calls_avoided,
        "avg_latency_ms": avg_latency_ms,
        "total_input_tokens": total_input_tokens,
        "total_output_tokens": total_output_tokens,
        "total_tokens": total_tokens,
        "actual_provider_cost": actual_provider_cost,
        "estimated_cost_without_gateway": estimated_cost_without_gateway,
        "estimated_cost_saved": estimated_cost_saved,
        "estimated_cost": actual_provider_cost,
        "estimated_savings": estimated_cost_saved,
        "history": history,
        "recent_activity": recent_activity,
        "similarity_distribution": similarity_distribution,
    }