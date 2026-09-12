import os
import time
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Security, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field

from sqlalchemy.orm import Session

from cache.semantic_cache import SemanticCache
from database.connection import SessionLocal, get_db
import database.models  # Register all models on Base

from providers.gemini_provider import GeminiProvider
from services.api_key_service import (
    create_gateway_api_key,
    get_all_api_keys,
    revoke_gateway_api_key,
    validate_gateway_api_key,
)
from services.prompt_compressor import PromptCompressor
from services.usage_service import get_usage
from services.usage_tracker import log_request


load_dotenv()


try:
    from database.connection import engine, Base
    import database.models
    Base.metadata.create_all(bind=engine)
except Exception as exc:
    print(f"Warning: Database initialization error: {exc}")


from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield



app = FastAPI(
    title="LLM Gateway",
    description="Intelligent LLM Gateway API with Semantic Caching & Adaptive Compression",
    version="0.4.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


gateway_key_header = APIKeyHeader(
    name="X-Gateway-API-Key",
    auto_error=False,
)

from services.routing.router import ModelRouter
from services.tournament_service import TournamentService

provider = GeminiProvider()
semantic_cache = SemanticCache()
compressor = PromptCompressor()
tournament_service = TournamentService()
model_router = ModelRouter()


class ChatMessage(BaseModel):
    role: str = Field(
        ...,
        description="Role of the message sender (e.g. 'user', 'assistant')",
    )
    content: str = Field(
        ...,
        description="Text content of the message",
    )


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(
        ...,
        description="List of chat messages",
    )
    tournament: bool = Field(
        False,
        description="Whether to run multi-model response tournament mode",
    )


class ChatResponse(BaseModel):
    response: str = Field(
        ...,
        description="Generated text response from LLM",
    )
    cache_hit: bool = Field(
        ...,
        description="Whether response was served from semantic cache",
    )
    similarity: float = Field(
        ...,
        description="Cosine similarity score of embedding match",
    )
    winning_model: Optional[str] = Field(
        None,
        description="Winning model name if tournament mode was executed",
    )
    judge_score: Optional[float] = Field(
        None,
        description="Score assigned by LLM Judge if tournament mode was executed",
    )
    provider: Optional[str] = Field(
        None,
        description="Selected LLM provider name used in normal mode",
    )
    model: Optional[str] = Field(
        None,
        description="Selected model name used in normal mode",
    )
    candidates: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="List of candidate responses evaluated during tournament mode",
    )
    candidate_count: Optional[int] = Field(
        None,
        description="Total candidates evaluated in tournament mode",
    )



class CreateApiKeyRequest(BaseModel):
    name: str = Field(
        ...,
        description="Name or label for the new Gateway API key",
    )


async def verify_gateway_key(
    api_key: Optional[str] = Security(gateway_key_header),
    db: Session = Depends(get_db),
):
    expected_key = os.getenv(
        "GATEWAY_API_KEY",
        "gateway-secret-key",
    )

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing Gateway API key",
        )

    # 1. Static bootstrap / admin key check
    if api_key == expected_key:
        return api_key

    # 2. Database portal-generated key check
    if validate_gateway_api_key(db, api_key):
        return api_key

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing Gateway API key",
    )


def _extract_prompt_text(messages: List[ChatMessage]) -> str:
    for msg in reversed(messages):
        if msg.role == "user":
            return msg.content

    if messages:
        return messages[-1].content

    return ""


@app.get("/health", summary="Health Check")
def health():
    return {"status": "ok"}


@app.get("/debug/cache", summary="Debug Semantic Cache")
def debug_cache():
    return semantic_cache.get_entries_summary()


@app.get(
    "/usage",
    summary="Usage Metrics",
)
def usage(db: Session = Depends(get_db)):
    return get_usage(db)



@app.get(
    "/v1/api-keys",
    summary="List API Keys",
)
def list_api_keys(db: Session = Depends(get_db)):
    keys = get_all_api_keys(db)
    return [
        {
            "id": k.id,
            "name": k.name,
            "maskedKey": k.masked_key,
            "createdAt": k.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if k.created_at else "Unknown",
            "lastUsed": k.last_used_at.strftime("%Y-%m-%d %H:%M:%S UTC") if k.last_used_at else "Never",
            "status": "revoked" if k.is_revoked else "active",
        }
        for k in keys
    ]


@app.post(
    "/v1/api-keys",
    summary="Create API Key",
)
def create_api_key_endpoint(req: CreateApiKeyRequest, db: Session = Depends(get_db)):
    if not req.name.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Key name cannot be empty",
        )
    key_obj, raw_key = create_gateway_api_key(db, req.name)
    return {
        "key": {
            "id": key_obj.id,
            "name": key_obj.name,
            "maskedKey": key_obj.masked_key,
            "createdAt": key_obj.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if key_obj.created_at else "Just now",
            "lastUsed": "Never",
            "status": "active",
        },
        "secretKey": raw_key,
    }


@app.delete(
    "/v1/api-keys/{key_id}",
    summary="Revoke API Key",
)
def revoke_api_key_endpoint(key_id: str, db: Session = Depends(get_db)):
    success = revoke_gateway_api_key(db, key_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )
    return {"status": "ok"}



@app.post(
    "/v1/chat/completions",
    response_model=ChatResponse,
    summary="Chat Completions",
    dependencies=[Depends(verify_gateway_key)],
)
async def chat_completions(
    request: ChatRequest,
    db: Session = Depends(get_db),
):
    start_time = time.perf_counter()

    prompt_text = _extract_prompt_text(request.messages)

    if not prompt_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Request must contain at least one non-empty message",
        )

    try:
        embedding = await provider.embed(prompt_text)

        cached_resp, is_hit, similarity = semantic_cache.lookup(embedding)

        # Bypass normal single-response cache HIT if tournament mode is explicitly requested
        if is_hit and cached_resp is not None and not request.tournament:
            latency_ms = (time.perf_counter() - start_time) * 1000

            log_request(
                db=db,
                cache_hit=True,
                similarity=similarity,
                latency_ms=latency_ms,
                llm_called=False,
            )

            return ChatResponse(
                response=cached_resp,
                cache_hit=True,
                similarity=similarity,
            )

        # Cache MISS or Tournament Mode: compress messages conservatively before LLM execution
        compressed_messages, _ = compressor.compress(request.messages)

        winning_model = None
        judge_score = None
        selected_provider = None
        selected_model = None
        candidates = None
        candidate_count = None

        if request.tournament:
            (
                generated_response,
                selected_provider,
                winning_model,
                candidates,
                judge_score,
                token_usage,
            ) = await tournament_service.run_tournament(compressed_messages)
            selected_model = winning_model
            candidate_count = len(candidates) if candidates else 0
        else:
            (
                generated_response,
                token_usage,
                selected_provider,
                selected_model,
                _was_fallback,
            ) = await model_router.execute(compressed_messages, prompt_text=prompt_text)

            semantic_cache.add(
                embedding,
                generated_response,
            )

        latency_ms = (time.perf_counter() - start_time) * 1000

        input_tokens = token_usage.get("input_tokens") if token_usage else None
        output_tokens = token_usage.get("output_tokens") if token_usage else None
        total_tokens = token_usage.get("total_tokens") if token_usage else None

        log_request(
            db=db,
            cache_hit=False,
            similarity=similarity,
            latency_ms=latency_ms,
            llm_called=True,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
        )

        return ChatResponse(
            response=generated_response,
            cache_hit=False,
            similarity=similarity,
            winning_model=winning_model,
            judge_score=judge_score,
            provider=selected_provider,
            model=selected_model,
            candidates=candidates,
            candidate_count=candidate_count,
        )



    except HTTPException:
        raise

    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err),
        )

    except RuntimeError as run_err:
        err_msg = str(run_err)
        if "quota" in err_msg.lower() or "rate" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=err_msg,
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=err_msg,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gateway processing error: {str(exc)}",
        )