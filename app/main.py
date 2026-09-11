import os
import time
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field

from sqlalchemy.orm import Session

from cache.semantic_cache import SemanticCache
from database.connection import SessionLocal, get_db
from providers.gemini_provider import GeminiProvider
from services.prompt_compressor import PromptCompressor
from services.usage_service import get_usage
from services.usage_tracker import log_request


load_dotenv()

app = FastAPI(
    title="LLM Gateway",
    description="Intelligent LLM Gateway API with Semantic Caching & Adaptive Compression",
    version="0.4.0",
)

gateway_key_header = APIKeyHeader(
    name="X-Gateway-API-Key",
    auto_error=False,
)

provider = GeminiProvider()
semantic_cache = SemanticCache()
compressor = PromptCompressor()


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


async def verify_gateway_key(
    api_key: Optional[str] = Security(gateway_key_header),
):
    expected_key = os.getenv(
        "GATEWAY_API_KEY",
        "gateway-secret-key",
    )

    if not api_key or api_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing Gateway API key",
        )

    return api_key


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
    dependencies=[Depends(verify_gateway_key)],
)
def usage(db: Session = Depends(get_db)):
    return get_usage(db)


@app.post(
    "/v1/chat/completions",
    response_model=ChatResponse,
    summary="Chat Completions",
    dependencies=[Depends(verify_gateway_key)],
)
async def chat_completions(request: ChatRequest):
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

        if is_hit and cached_resp is not None:
            latency_ms = (
                time.perf_counter() - start_time
            ) * 1000

            db = SessionLocal()

            try:
                log_request(
                    db=db,
                    cache_hit=True,
                    similarity=similarity,
                    latency_ms=latency_ms,
                    llm_called=False,
                )
            finally:
                db.close()

            return ChatResponse(
                response=cached_resp,
                cache_hit=True,
                similarity=similarity,
            )

        # Cache MISS: compress messages conservatively before sending to LLM
        compressed_messages, _ = compressor.compress(request.messages)

        generated_response, token_usage = await provider.generate(
            compressed_messages
        )

        semantic_cache.add(
            embedding,
            generated_response,
        )

        latency_ms = (
            time.perf_counter() - start_time
        ) * 1000

        input_tokens = token_usage.get("input_tokens") if token_usage else None
        output_tokens = token_usage.get("output_tokens") if token_usage else None
        total_tokens = token_usage.get("total_tokens") if token_usage else None

        db = SessionLocal()

        try:
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
        finally:
            db.close()


        return ChatResponse(
            response=generated_response,
            cache_hit=False,
            similarity=similarity,
        )

    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(val_err),
        )

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing the request with the LLM provider",
        )