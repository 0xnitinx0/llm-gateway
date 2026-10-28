import asyncio
import hmac
import json
import re
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import uuid4

import structlog
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.logging_config import configure_logging
from app.middleware import (
    GatewaySecurityMiddleware,
    RequestContextMiddleware,
    error_response,
)
from app.schemas import (
    APIKeyCreateRequest,
    CandidateTrace,
    ChatCompletionRequest,
    ChatCompletionResponse,
    CompressionMetrics,
    CompressionRequest,
    CompressionResponse,
    GatewayMetadata,
    JudgeTrace,
    TokenUsage,
    TournamentRequest,
    TournamentResponse,
)
from database.connection import (
    AsyncSessionLocal,
    close_database,
    get_db,
    initialize_database,
)
from database.models import GatewayAPIKey, RequestLog, SemanticCacheEntry
from services.api_key_service import (
    create_gateway_api_key,
    seed_gateway_api_key,
)
from services.cost_estimator import CostEstimator
from services.embeddings import FastEmbedEmbedder
from services.prompt_compressor import CompressionStats, PromptCompressor
from services.provider_registry import build_provider_registry
from services.request_logging import emit_request_log, persist_request_log
from services.routing.router import ModelRouter
from services.semantic_cache import PgVectorSemanticCache
from services.tournament_service import CLOUD_PROVIDERS, TournamentService

configure_logging()
logger = structlog.get_logger("llm_gateway")


def _canonical_prompt(messages) -> str:
    return "\n".join(f"{message.role}: {message.content.strip()}" for message in messages)


def _compression_metrics(stats: CompressionStats) -> CompressionMetrics:
    return CompressionMetrics(
        strategy=stats.strategy,
        original_tokens=stats.original_tokens,
        compressed_tokens=stats.compressed_tokens,
        tokens_saved=stats.tokens_saved,
        reduction_percent=stats.reduction_percent,
    )


def _usage(prompt_tokens: int, completion_tokens: int) -> TokenUsage:
    return TokenUsage(
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
    )


def _chat_response(
    *,
    completion_id: str,
    created: int,
    text: str,
    provider: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    request_id: str,
    cache_hit: bool,
    similarity: float,
    llm_called: bool,
    latency_ms: float,
    compression: CompressionMetrics | None,
    routing: dict | None = None,
) -> ChatCompletionResponse:
    return ChatCompletionResponse(
        id=completion_id,
        created=created,
        model=model,
        choices=[
            {
                "index": 0,
                "message": {"role": "assistant", "content": text},
                "finish_reason": "stop",
            }
        ],
        usage=_usage(prompt_tokens, completion_tokens),
        gateway=GatewayMetadata(
            request_id=request_id,
            provider=provider,
            model=model,
            cache_hit=cache_hit,
            similarity=similarity,
            llm_called=llm_called,
            latency_ms=round(latency_ms, 2),
            compression=compression,
            routing=routing,
        ),
    )


async def _seed_demo_keys(settings: Settings) -> None:
    async with AsyncSessionLocal() as db:
        await seed_gateway_api_key(
            db,
            raw_key=settings.demo_api_key,
            name="Local Demo",
            capacity=settings.default_rate_capacity,
            refill_rate=settings.default_rate_refill_per_second,
        )
        await seed_gateway_api_key(
            db,
            raw_key=settings.rate_limit_demo_api_key,
            name="Rate Limit Demo",
            capacity=3,
            refill_rate=0.2,
        )


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    redis = Redis.from_url(settings.redis_url, decode_responses=True)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await initialize_database()
        await redis.ping()
        embedder = FastEmbedEmbedder(settings)
        await asyncio.to_thread(embedder.load)
        await _seed_demo_keys(settings)

        providers = build_provider_registry(settings, embedder.count_tokens)
        app.state.settings = settings
        app.state.redis = redis
        app.state.embedder = embedder
        app.state.compressor = PromptCompressor(
            embedder.count_tokens,
            settings.compression_min_tokens,
            settings.compression_target_ratio,
            strategy=settings.compression_strategy,
        )
        app.state.cache = PgVectorSemanticCache(settings.cache_similarity_threshold)
        app.state.cost_estimator = CostEstimator(settings.model_pricing_json)
        app.state.router = ModelRouter(
            {
                name: providers[name]
                for name in settings.enabled_provider_names
                if name in providers
            },
            token_counter=embedder.count_tokens,
        )
        app.state.tournament = TournamentService(
            providers,
            settings.tournament_provider_names,
            settings.judge_provider,
            embedder.count_tokens,
        )
        logger.info(
            "gateway_started",
            architecture="modular_monolith",
            reason="One process keeps auth, cache, routing, and SSE state observable for a solo demo; service interfaces remain split-ready.",
        )
        yield
        await redis.aclose()
        await close_database()

    app = FastAPI(
        title="LLM Gateway",
        description="Local-first Python LLM gateway with semantic deduplication and tournaments",
        version="1.0.0",
        lifespan=lifespan,
    )
    # Middleware is reverse-wrapped: request context runs before security.
    app.add_middleware(GatewaySecurityMiddleware, redis=redis)
    app.add_middleware(RequestContextMiddleware)

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        return error_response(422, str(exc.errors()), "invalid_request_error", "validation_error")

    @app.exception_handler(HTTPException)
    async def http_error_handler(request: Request, exc: HTTPException):
        if isinstance(exc.detail, dict) and "error" in exc.detail:
            return JSONResponse(exc.detail, status_code=exc.status_code, headers=exc.headers)
        return error_response(exc.status_code, str(exc.detail), "gateway_error", "request_failed", exc.headers)

    async def require_admin(x_admin_key: str | None = Header(default=None)) -> None:
        if not x_admin_key or not hmac.compare_digest(x_admin_key, settings.admin_api_key):
            raise HTTPException(401, "Invalid admin key")

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.get("/ready")
    async def ready():
        try:
            async with AsyncSessionLocal() as db:
                await db.execute(select(1))
            await redis.ping()
            embedder_ready = bool(getattr(app.state, "embedder", None))
            if not embedder_ready:
                raise RuntimeError("embedder not loaded")
            return {"status": "ready", "postgres": "ok", "redis": "ok", "embedder": "ok"}
        except Exception as exc:
            return JSONResponse({"status": "not_ready", "detail": str(exc)}, status_code=503)

    @app.post("/v1/chat/completions", response_model=ChatCompletionResponse)
    async def chat_completions(
        payload: ChatCompletionRequest,
        request: Request,
        db: AsyncSession = Depends(get_db),
    ):
        started = time.perf_counter()
        request_id = request.state.request_id
        api_key = request.state.api_key
        completion_id = f"chatcmpl-{uuid4().hex}"
        created = int(datetime.now(timezone.utc).timestamp())
        canonical = _canonical_prompt(payload.messages)
        embedding = await app.state.embedder.embed(canonical)
        lookup = await app.state.cache.lookup(db, api_key_id=api_key.id, embedding=embedding)

        compressed, stats = app.state.compressor.compress(payload.messages)
        metrics = _compression_metrics(stats)
        routing = (
            {"status": "skipped", "classification": None, "provider_preference_order": []}
            if lookup.hit
            else app.state.router.plan(canonical, compressed, original_messages=payload.messages)
        )

        if payload.stream:
            if lookup.hit and lookup.entry:
                provider = lookup.entry.provider
                model = lookup.entry.model
                source_text = lookup.entry.response
                stream_provider = None
                prompt_tokens = stats.original_tokens
            else:
                try:
                    stream_provider = app.state.router.streaming_provider(
                        canonical, compressed, original_messages=payload.messages, routing=routing,
                    )
                except RuntimeError as exc:
                    raise HTTPException(502, str(exc)) from exc
                provider = stream_provider.name
                model = stream_provider.model_name
                source_text = None
                prompt_tokens = stats.compressed_tokens

            async def event_stream():
                parts: list[str] = []
                status_code = 200
                error_code = None
                first = {
                    "id": completion_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": model,
                    "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}],
                }
                yield f"data: {json.dumps(first)}\n\n"
                try:
                    if source_text is not None:
                        async def cached_tokens():
                            for token in re.findall(r"\S+\s*", source_text):
                                await asyncio.sleep(0)
                                yield token
                        token_source = cached_tokens()
                    else:
                        token_source = stream_provider.stream(
                            compressed,
                            temperature=payload.temperature,
                            max_tokens=payload.max_tokens,
                        )
                    async for token in token_source:
                        parts.append(token)
                        chunk = {
                            "id": completion_id,
                            "object": "chat.completion.chunk",
                            "created": created,
                            "model": model,
                            "choices": [{"index": 0, "delta": {"content": token}, "finish_reason": None}],
                        }
                        yield f"data: {json.dumps(chunk)}\n\n"

                    text = "".join(parts)
                    completion_tokens = lookup.entry.completion_tokens if lookup.hit and lookup.entry else app.state.embedder.count_tokens(text)
                    latency_ms = (time.perf_counter() - started) * 1000
                    if not lookup.hit:
                        async with AsyncSessionLocal() as cache_db:
                            await app.state.cache.add(
                                cache_db,
                                api_key_id=api_key.id,
                                embedding=embedding,
                                response=text,
                                provider=provider,
                                model=model,
                                prompt_tokens=prompt_tokens,
                                completion_tokens=completion_tokens,
                            )
                    gateway = GatewayMetadata(
                        request_id=request_id,
                        provider=provider,
                        model=model,
                        cache_hit=lookup.hit,
                        similarity=lookup.similarity,
                        llm_called=not lookup.hit,
                        latency_ms=round(latency_ms, 2),
                        compression=None if lookup.hit else metrics,
                        routing=routing,
                    )
                    final = {
                        "id": completion_id,
                        "object": "chat.completion.chunk",
                        "created": created,
                        "model": model,
                        "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
                        "gateway": gateway.model_dump(),
                    }
                    if payload.stream_options and payload.stream_options.include_usage:
                        final["usage"] = _usage(prompt_tokens, completion_tokens).model_dump()
                    yield f"data: {json.dumps(final)}\n\n"
                    yield "data: [DONE]\n\n"
                except asyncio.CancelledError:
                    status_code = 499
                    error_code = "client_disconnected"
                    raise
                except Exception as exc:
                    status_code = 502
                    error_code = "provider_error"
                    yield f"data: {json.dumps({'error': {'message': str(exc), 'type': 'provider_error', 'code': error_code}})}\n\n"
                    yield "data: [DONE]\n\n"
                finally:
                    text = "".join(parts)
                    completion_tokens = lookup.entry.completion_tokens if lookup.hit and lookup.entry and status_code == 200 else app.state.embedder.count_tokens(text)
                    latency_ms = (time.perf_counter() - started) * 1000
                    values = {
                        "request_id": request_id,
                        "api_key_id": api_key.id,
                        "path": "/v1/chat/completions",
                        "status_code": status_code,
                        "latency_ms": latency_ms,
                        "provider": provider,
                        "model": model,
                        "cache_hit": lookup.hit,
                        "similarity": lookup.similarity,
                        "llm_called": not lookup.hit,
                        "llm_call_count": 0 if lookup.hit else 1,
                        "streaming": True,
                        "original_tokens": stats.original_tokens,
                        "compressed_tokens": stats.compressed_tokens,
                        "input_tokens": prompt_tokens,
                        "output_tokens": completion_tokens,
                        "total_tokens": prompt_tokens + completion_tokens,
                        "error_code": error_code,
                    }
                    if status_code == 200:
                        values.update(app.state.cost_estimator.chat(
                            provider=provider, model=model, prompt_tokens=prompt_tokens,
                            completion_tokens=completion_tokens,
                            compression_tokens_saved=0 if lookup.hit else stats.tokens_saved,
                            cache_hit=lookup.hit,
                        ).log_values())
                    emit_request_log(**values)
                    await persist_request_log(**values)

            return StreamingResponse(
                event_stream(),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )

        if lookup.hit and lookup.entry:
            text = lookup.entry.response
            provider = lookup.entry.provider
            model = lookup.entry.model
            prompt_tokens = stats.original_tokens
            completion_tokens = lookup.entry.completion_tokens
            llm_called = False
            compression = None
        else:
            try:
                result = await app.state.router.execute(
                    compressed,
                    prompt=canonical,
                    original_messages=payload.messages,
                    temperature=payload.temperature,
                    max_tokens=payload.max_tokens,
                    routing=routing,
                )
            except RuntimeError as exc:
                raise HTTPException(502, str(exc)) from exc
            text = result.text
            provider = result.provider
            model = result.model
            prompt_tokens = result.usage.prompt_tokens or stats.compressed_tokens
            completion_tokens = result.usage.completion_tokens or app.state.embedder.count_tokens(text)
            llm_called = True
            compression = metrics
            await app.state.cache.add(
                db,
                api_key_id=api_key.id,
                embedding=embedding,
                response=text,
                provider=provider,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
            )

        latency_ms = (time.perf_counter() - started) * 1000
        values = {
            "request_id": request_id,
            "api_key_id": api_key.id,
            "path": "/v1/chat/completions",
            "status_code": 200,
            "latency_ms": latency_ms,
            "provider": provider,
            "model": model,
            "cache_hit": lookup.hit,
            "similarity": lookup.similarity,
            "llm_called": llm_called,
            "llm_call_count": 1 if llm_called else 0,
            "streaming": False,
            "original_tokens": stats.original_tokens,
            "compressed_tokens": stats.compressed_tokens,
            "input_tokens": prompt_tokens,
            "output_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        }
        values.update(app.state.cost_estimator.chat(
            provider=provider, model=model, prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            compression_tokens_saved=0 if lookup.hit else stats.tokens_saved,
            cache_hit=lookup.hit,
        ).log_values())
        emit_request_log(**values)
        await persist_request_log(**values)
        return _chat_response(
            completion_id=completion_id,
            created=created,
            text=text,
            provider=provider,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            request_id=request_id,
            cache_hit=lookup.hit,
            similarity=lookup.similarity,
            llm_called=llm_called,
            latency_ms=latency_ms,
            compression=compression,
            routing=routing,
        )

    @app.post("/v1/tools/compress", response_model=CompressionResponse)
    async def compress_prompt(payload: CompressionRequest, request: Request):
        compressed, stats = app.state.compressor.compress(payload.messages)
        return CompressionResponse(
            original_messages=payload.messages,
            compressed_messages=compressed,
            metrics=_compression_metrics(stats),
        )

    @app.post("/v1/tournaments", response_model=TournamentResponse)
    async def tournament(payload: TournamentRequest, request: Request):
        started = time.perf_counter()
        compressed, stats = app.state.compressor.compress(payload.messages)
        try:
            outcome = await app.state.tournament.run(
                compressed,
                temperature=payload.temperature,
                max_tokens=payload.max_tokens,
                original_messages=[message.model_dump() for message in payload.messages],
            )
        except RuntimeError as exc:
            raise HTTPException(502, str(exc)) from exc
        latency_ms = (time.perf_counter() - started) * 1000
        candidates = [
            CandidateTrace(
                candidate_id=item.candidate_id,
                provider=item.provider,
                model=item.model,
                response=item.result.text if item.result else None,
                latency_ms=round(item.latency_ms, 2),
                usage=(
                    _usage(item.result.usage.prompt_tokens, item.result.usage.completion_tokens)
                    if item.result
                    else None
                ),
                error=item.error,
                attempts=item.attempts,
            )
            for item in outcome.candidates
        ]
        api_key = request.state.api_key
        values = {
            "request_id": request.state.request_id,
            "api_key_id": api_key.id,
            "path": "/v1/tournaments",
            "status_code": 200,
            "latency_ms": latency_ms,
            "provider": outcome.judge_provider,
            "model": outcome.judge_model,
            "llm_called": True,
            "llm_call_count": sum(item.attempts for item in outcome.candidates) + outcome.judge_attempts,
            "tournament": True,
            "tournament_candidate_count": len(outcome.candidates),
            "tournament_winner_score": outcome.scores.get(outcome.winner_id),
            "judge_fallback": outcome.fallback_used,
            "original_tokens": stats.original_tokens,
            "compressed_tokens": stats.compressed_tokens,
            "input_tokens": outcome.usage.prompt_tokens,
            "output_tokens": outcome.usage.completion_tokens,
            "total_tokens": outcome.usage.total_tokens,
        }
        winner = next(item.result for item in outcome.candidates if item.candidate_id == outcome.winner_id)
        values.update(app.state.cost_estimator.tournament(
            winner=winner, charged_results=outcome.charged_results,
            compression_tokens_saved=stats.tokens_saved,
        ).log_values())
        emit_request_log(**values)
        await persist_request_log(**values)
        return TournamentResponse(
            id=f"tournament-{uuid4().hex}",
            created=int(time.time()),
            winner_id=outcome.winner_id,
            winning_response=outcome.winning_response,
            candidates=candidates,
            judge=JudgeTrace(
                provider=outcome.judge_provider,
                model=outcome.judge_model,
                scores=outcome.scores,
                reasoning=outcome.reasoning,
                fallback_used=outcome.fallback_used,
            ),
            usage=_usage(outcome.usage.prompt_tokens, outcome.usage.completion_tokens),
            compression=_compression_metrics(stats),
            latency_ms=round(latency_ms, 2),
        )

    @app.get("/v1/api-keys", dependencies=[Depends(require_admin)])
    async def list_api_keys(db: AsyncSession = Depends(get_db)):
        keys = (await db.scalars(select(GatewayAPIKey).order_by(GatewayAPIKey.created_at.desc()))).all()
        return [
            {
                "id": key.id,
                "name": key.name,
                "masked_key": key.masked_key,
                "created_at": key.created_at,
                "last_used_at": key.last_used_at,
                "status": "revoked" if key.is_revoked else "active",
                "rate_limit_capacity": key.rate_limit_capacity,
                "refill_rate_per_second": key.refill_rate_per_second,
            }
            for key in keys
        ]

    @app.post("/v1/api-keys", dependencies=[Depends(require_admin)])
    async def create_api_key(payload: APIKeyCreateRequest, db: AsyncSession = Depends(get_db)):
        key, raw_key = await create_gateway_api_key(
            db,
            payload.name,
            payload.rate_limit_capacity,
            payload.refill_rate_per_second,
        )
        return {"id": key.id, "name": key.name, "key": raw_key, "masked_key": key.masked_key}

    @app.delete("/v1/api-keys/{key_id}", dependencies=[Depends(require_admin)])
    async def revoke_api_key(key_id: str, db: AsyncSession = Depends(get_db)):
        key = await db.get(GatewayAPIKey, key_id)
        if not key:
            raise HTTPException(404, "API key not found")
        key.is_revoked = True
        await db.commit()
        return {"status": "revoked", "id": key_id}

    @app.get("/v1/admin/cache", dependencies=[Depends(require_admin)])
    async def cache_summary(db: AsyncSession = Depends(get_db)):
        return await app.state.cache.summary(db)

    @app.delete("/v1/admin/cache", dependencies=[Depends(require_admin)])
    async def clear_cache(db: AsyncSession = Depends(get_db)):
        return {"cleared": await app.state.cache.clear(db)}

    @app.post("/v1/admin/reset-demo", dependencies=[Depends(require_admin)])
    async def reset_demo(db: AsyncSession = Depends(get_db)):
        cleared = await app.state.cache.clear(db)
        async for key in redis.scan_iter("rate_limit:*"):
            await redis.delete(key)
        return {"cache_entries_cleared": cleared, "rate_limits_reset": True}

    @app.get("/v1/admin/config", dependencies=[Depends(require_admin)])
    async def runtime_config():
        return {
            "cache_similarity_threshold": settings.cache_similarity_threshold,
            "embedding_model": settings.embedding_model,
            "embedding_dimensions": settings.embedding_dimensions,
            "compression_strategy": settings.compression_strategy,
            "compression_min_tokens": settings.compression_min_tokens,
            "compression_target_ratio": settings.compression_target_ratio,
            "enabled_providers": settings.enabled_provider_names,
            "tournament_providers": settings.tournament_provider_names,
            "judge_provider": settings.judge_provider,
            "provider_availability": [
                {"name": name, "model": provider.model_name, "available": provider.is_available(),
                 "kind": "local" if name.startswith("local") else "cloud"}
                for name, provider in {**app.state.tournament.providers, **app.state.router.providers}.items()
                if name in app.state.router.providers or name in CLOUD_PROVIDERS
            ],
            "tournament_readiness": app.state.tournament.readiness(),
        }

    @app.get("/usage", dependencies=[Depends(require_admin)])
    async def usage(db: AsyncSession = Depends(get_db)):
        """Return bounded, prompt-free telemetry shaped for the local portal."""
        logs = list(
            (
                await db.scalars(
                    select(RequestLog).order_by(RequestLog.created_at.desc()).limit(5000)
                )
            ).all()
        )
        chat = [
            row
            for row in logs
            if row.path == "/v1/chat/completions" and row.status_code == 200
        ]
        hits = sum(1 for row in chat if row.cache_hit)
        misses = len(chat) - hits
        forwarded = [row for row in logs if row.llm_called]
        total_original = sum(row.original_tokens or 0 for row in forwarded)
        total_compressed = sum(row.compressed_tokens or 0 for row in forwarded)
        tokens_saved = sum(
            max((row.original_tokens or 0) - (row.compressed_tokens or 0), 0)
            for row in forwarded
        )
        tournaments = [row for row in logs if row.tournament and row.status_code == 200]
        candidate_counts = [row.tournament_candidate_count for row in tournaments if row.tournament_candidate_count is not None]
        winner_scores = [row.tournament_winner_score for row in tournaments if row.tournament_winner_score is not None]

        today = datetime.now(timezone.utc).date()
        history = []
        for offset in range(6, -1, -1):
            day = today.fromordinal(today.toordinal() - offset)
            history.append({
                "day": day.strftime("%a"),
                "date": day.isoformat(),
                "requests": sum(1 for row in logs if row.created_at.date() == day),
            })

        threshold = settings.cache_similarity_threshold
        similarities = [row.similarity for row in chat]
        similarity_distribution = [
            {"range": "0.95-1.00", "count": sum(value >= 0.95 for value in similarities)},
            {"range": "0.90-0.95", "count": sum(0.90 <= value < 0.95 for value in similarities)},
            {"range": f"{threshold:.2f}-0.90", "count": sum(threshold <= value < 0.90 for value in similarities)},
            {"range": f"<{threshold:.2f}", "count": sum(value < threshold for value in similarities)},
        ]
        avg_latency = sum(row.latency_ms for row in logs) / len(logs) if logs else None
        active_entries = int(await db.scalar(select(func.count(SemanticCacheEntry.id))) or 0)
        # Financial totals cover every persisted request, unlike the bounded activity feed.
        priced = (await db.execute(
            select(
                func.count(RequestLog.id),
                func.coalesce(func.sum(RequestLog.baseline_cost_usd), 0),
                func.coalesce(func.sum(RequestLog.actual_cost_usd), 0),
                func.coalesce(func.sum(RequestLog.net_savings_usd), 0),
                func.coalesce(func.sum(RequestLog.cache_savings_usd), 0),
                func.coalesce(func.sum(RequestLog.compression_savings_usd), 0),
                func.coalesce(func.sum(RequestLog.tournament_overhead_usd), 0),
            ).where(
                RequestLog.path.in_(("/v1/chat/completions", "/v1/tournaments")),
                RequestLog.status_code == 200,
                RequestLog.pricing_status == "priced",
            )
        )).one()
        unpriced_count = int(await db.scalar(
            select(func.count(RequestLog.id)).where(
                RequestLog.path.in_(("/v1/chat/completions", "/v1/tournaments")),
                RequestLog.status_code == 200,
                RequestLog.pricing_status != "priced",
            )
        ) or 0)
        return {
            "total_requests": len(logs),
            "cache_hits": hits,
            "cache_misses": misses,
            "cache_hit_rate": round(hits / len(chat) * 100, 2) if chat else 0.0,
            "active_cache_entries": active_entries,
            "llm_calls": sum(row.llm_call_count for row in logs),
            "llm_calls_avoided": hits,
            "rate_limited_requests": sum(1 for row in logs if row.rate_limited),
            "avg_latency_ms": round(avg_latency, 2) if avg_latency is not None else None,
            "total_input_tokens": sum(row.input_tokens or 0 for row in logs),
            "total_output_tokens": sum(row.output_tokens or 0 for row in logs),
            "total_tokens": sum(row.total_tokens or 0 for row in logs),
            "compressed_tokens_saved": tokens_saved,
            "costs": {
                "currency": "USD",
                "baseline_spend_usd": float(priced[1]),
                "actual_spend_usd": float(priced[2]),
                "net_savings_usd": float(priced[3]),
                "cache_savings_usd": float(priced[4]),
                "compression_savings_usd": float(priced[5]),
                "tournament_overhead_usd": float(priced[6]),
                "priced_requests": priced[0],
                "unpriced_requests": unpriced_count,
                "configured_models": len(app.state.cost_estimator.prices),
            },
            "compression": {
                "original_tokens": total_original,
                "compressed_tokens": total_compressed,
                "tokens_saved": tokens_saved,
                "reduction_percent": round(tokens_saved / total_original * 100, 2) if total_original else 0.0,
            },
            "tournaments": {
                "count": len(tournaments),
                "average_candidates": round(sum(candidate_counts) / len(candidate_counts), 2) if candidate_counts else 0.0,
                "average_winning_score": round(sum(winner_scores) / len(winner_scores), 3) if winner_scores else 0.0,
                "judge_fallback_rate": round(sum(row.judge_fallback for row in tournaments) / len(tournaments) * 100, 2) if tournaments else 0.0,
            },
            "history": history,
            "recent_activity": [
                {
                    "id": row.request_id,
                    "time": row.created_at.isoformat(),
                    "result": "HIT" if row.cache_hit else "MISS",
                    "similarity": row.similarity,
                    "latency_ms": round(row.latency_ms, 2),
                }
                for row in chat[:20]
            ],
            "similarity_distribution": similarity_distribution,
        }

    return app


app = create_app()
