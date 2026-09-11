import os
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field

from cache.semantic_cache import SemanticCache
from providers.gemini_provider import GeminiProvider

load_dotenv()

app = FastAPI(
    title="LLM Gateway",
    description="Intelligent LLM Gateway API with Semantic Caching",
    version="0.2.0",
)

# Gateway Security Scheme for Swagger / OpenAPI docs
gateway_key_header = APIKeyHeader(name="X-Gateway-API-Key", auto_error=False)

# Provider & Cache singletons
provider = GeminiProvider()
semantic_cache = SemanticCache()


class ChatMessage(BaseModel):
    role: str = Field(..., description="Role of the message sender (e.g. 'user', 'assistant')")
    content: str = Field(..., description="Text content of the message")


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., description="List of chat messages")


class ChatResponse(BaseModel):
    response: str = Field(..., description="Generated text response from LLM")
    cache_hit: bool = Field(..., description="Whether response was served from semantic cache")
    similarity: float = Field(..., description="Cosine similarity score of embedding match")


async def verify_gateway_key(api_key: Optional[str] = Security(gateway_key_header)):
    expected_key = os.getenv("GATEWAY_API_KEY", "gateway-secret-key")
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


@app.get("/debug/cache", summary="[Development/Debug] Inspect Semantic Cache")
def debug_cache():
    """Development/Debug endpoint to inspect in-memory semantic cache contents."""
    summary_entries = semantic_cache.get_entries_summary()
    return {
        "total_entries": len(summary_entries),
        "entries": summary_entries,
    }



@app.post(
    "/v1/chat/completions",
    response_model=ChatResponse,
    summary="Chat Completions",
    dependencies=[Depends(verify_gateway_key)],
)
async def chat_completions(request: ChatRequest):
    prompt_text = _extract_prompt_text(request.messages)
    if not prompt_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Request must contain at least one non-empty message",
        )

    try:
        # Generate embedding for prompt
        embedding = await provider.embed(prompt_text)

        # Lookup in semantic cache
        cached_resp, is_hit, similarity = semantic_cache.lookup(embedding)

        if is_hit and cached_resp is not None:
            return ChatResponse(
                response=cached_resp,
                cache_hit=True,
                similarity=similarity,
            )

        # Cache miss: call LLM provider
        generated_response = await provider.generate(request.messages)

        # Store in semantic cache
        semantic_cache.add(prompt_text, embedding, generated_response)

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
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing the request with the LLM provider",
        )