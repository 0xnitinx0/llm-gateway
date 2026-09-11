import os
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field

from providers.gemini_provider import GeminiProvider

load_dotenv()

app = FastAPI(
    title="LLM Gateway",
    description="Intelligent LLM Gateway API",
    version="0.1.0",
)

# Gateway Security Scheme for Swagger / OpenAPI docs
gateway_key_header = APIKeyHeader(name="X-Gateway-API-Key", auto_error=False)

# Provider singleton
provider = GeminiProvider()


class ChatMessage(BaseModel):
    role: str = Field(..., description="Role of the message sender (e.g. 'user', 'assistant')")
    content: str = Field(..., description="Text content of the message")


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., description="List of chat messages")


async def verify_gateway_key(api_key: Optional[str] = Security(gateway_key_header)):
    expected_key = os.getenv("GATEWAY_API_KEY", "gateway-secret-key")
    if not api_key or api_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing Gateway API key",
        )
    return api_key


@app.get("/health", summary="Health Check")
def health():
    return {"status": "ok"}


@app.post(
    "/v1/chat/completions",
    summary="Chat Completions",
    dependencies=[Depends(verify_gateway_key)],
)
async def chat_completions(request: ChatRequest):
    try:
        response_text = await provider.generate(request.messages)
        return {"response": response_text}
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