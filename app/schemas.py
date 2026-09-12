from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str = Field(min_length=1)


class StreamOptions(BaseModel):
    include_usage: bool = False


class ChatCompletionRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    model: str = "gateway-auto"
    messages: list[ChatMessage] = Field(min_length=1)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int | None = Field(default=None, gt=0)
    stream: bool = False
    stream_options: StreamOptions | None = None


class TokenUsage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class CompressionMetrics(BaseModel):
    strategy: str
    original_tokens: int
    compressed_tokens: int
    tokens_saved: int
    reduction_percent: float


class GatewayMetadata(BaseModel):
    request_id: str
    provider: str
    model: str
    cache_hit: bool
    similarity: float
    llm_called: bool
    latency_ms: float
    compression: CompressionMetrics | None = None


class ChatCompletionResponse(BaseModel):
    id: str
    object: Literal["chat.completion"] = "chat.completion"
    created: int
    model: str
    choices: list[dict[str, Any]]
    usage: TokenUsage
    gateway: GatewayMetadata


class CompressionRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)


class CompressionResponse(BaseModel):
    original_messages: list[ChatMessage]
    compressed_messages: list[ChatMessage]
    metrics: CompressionMetrics


class TournamentRequest(BaseModel):
    model: str = "gateway-tournament"
    messages: list[ChatMessage] = Field(min_length=1)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int | None = Field(default=None, gt=0)


class CandidateTrace(BaseModel):
    candidate_id: str
    provider: str
    model: str
    response: str | None = None
    latency_ms: float
    usage: TokenUsage | None = None
    error: str | None = None


class JudgeTrace(BaseModel):
    provider: str
    model: str
    scores: dict[str, float]
    reasoning: str
    fallback_used: bool = False


class TournamentResponse(BaseModel):
    id: str
    object: Literal["gateway.tournament"] = "gateway.tournament"
    created: int
    winner_id: str
    winning_response: str
    candidates: list[CandidateTrace]
    judge: JudgeTrace
    usage: TokenUsage
    compression: CompressionMetrics
    latency_ms: float


class APIKeyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    rate_limit_capacity: int = Field(default=60, gt=0)
    refill_rate_per_second: float = Field(default=1.0, gt=0)


class ErrorBody(BaseModel):
    message: str
    type: str
    code: str


class ErrorResponse(BaseModel):
    error: ErrorBody
