"""Parallel cloud candidates with an auditable cloud judge."""

import asyncio
import json
import time
from dataclasses import dataclass
from typing import Callable

import structlog

from providers.base import LLMProvider, ProviderResult, ProviderUsage

logger = structlog.get_logger("llm_gateway.tournament")
CLOUD_PROVIDERS = ("gemini", "groq", "cerebras")


@dataclass(slots=True)
class CandidateOutcome:
    candidate_id: str
    provider: str
    model: str
    result: ProviderResult | None
    latency_ms: float
    error: str | None = None
    attempts: int = 1


@dataclass(slots=True)
class TournamentOutcome:
    winner_id: str
    winning_response: str
    candidates: list[CandidateOutcome]
    judge_provider: str
    judge_model: str
    scores: dict[str, float]
    reasoning: str
    fallback_used: bool
    usage: ProviderUsage
    judge_results: list[ProviderResult]
    judge_attempts: int

    @property
    def charged_results(self) -> list[ProviderResult]:
        return [item.result for item in self.candidates if item.result] + self.judge_results


class TournamentService:
    """Use independent cloud candidates and a separate cloud judge call.

    A local fake answer would make the comparison misleading. Failed providers
    remain visible in the trace; a tournament needs two real answers to proceed.
    """

    def __init__(
        self,
        providers: dict[str, LLMProvider],
        candidate_names: list[str],
        judge_name: str,
        token_counter: Callable[[str], int] | None = None,
    ):
        self.providers = providers
        self.candidate_names = candidate_names
        self.judge_name = judge_name
        self.count_tokens = token_counter or (lambda text: len(text.split()))

    def _normalize_usage(self, result: ProviderResult, messages: list[dict[str, str]]) -> ProviderResult:
        """Some adapters omit usage; estimate it so the trace does not show zero tokens."""
        if not result.usage.prompt_tokens:
            result.usage.prompt_tokens = self.count_tokens("\n".join(item["content"] for item in messages))
        if not result.usage.completion_tokens:
            result.usage.completion_tokens = self.count_tokens(result.text)
        return result

    @staticmethod
    def _failure(exc: Exception) -> str:
        response = getattr(exc, "response", None)
        status = getattr(response, "status_code", None)
        return f"HTTP {status}" if status else type(exc).__name__

    async def _candidate(
        self,
        candidate_id: str,
        provider: LLMProvider,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int | None,
    ) -> CandidateOutcome:
        started = time.perf_counter()
        for attempt in range(1, 4):
            try:
                result = self._normalize_usage(
                    await provider.generate(messages, temperature=temperature, max_tokens=max_tokens),
                    messages,
                )
                if not result.text.strip():
                    raise ValueError("empty candidate response")
                return CandidateOutcome(candidate_id, result.provider, result.model, result, (time.perf_counter() - started) * 1000, attempts=attempt)
            except Exception as exc:
                status = getattr(getattr(exc, "response", None), "status_code", None)
                logger.warning("candidate_failed", provider=provider.name, attempt=attempt, failure=self._failure(exc))
                if attempt < 3 and (status == 429 or status is not None and 500 <= status < 600):
                    await asyncio.sleep(0.5 * attempt)
                    continue
                return CandidateOutcome(candidate_id, provider.name, provider.model_name, None, (time.perf_counter() - started) * 1000, self._failure(exc), attempt)
        raise AssertionError("candidate retry loop exhausted")

    @staticmethod
    def _judge_prompt(prompt: str, candidates: list[CandidateOutcome]) -> str:
        blocks = [
            "Judge the responses for correctness, relevance, clarity, and completeness.",
            f"ORIGINAL_PROMPT:\n{prompt}",
            "Return only a JSON object with winner_id, scores (one 0-to-1 score for every candidate), and reasoning.",
        ]
        for candidate in candidates:
            if candidate.result:
                blocks.append(f"CANDIDATE_ID: {candidate.candidate_id}\nRESPONSE: {candidate.result.text}")
        return "\n".join(blocks)

    @staticmethod
    def _parse_judgment(text: str, valid_ids: set[str]) -> dict:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        parsed = json.loads(cleaned)
        if not isinstance(parsed, dict) or parsed.get("winner_id") not in valid_ids:
            raise ValueError("judge selected an unknown candidate")
        scores = parsed.get("scores")
        if not isinstance(scores, dict) or set(scores) != valid_ids:
            raise ValueError("judge must score each successful candidate")
        if any(isinstance(score, bool) or not isinstance(score, (int, float)) or not 0 <= score <= 1 for score in scores.values()):
            raise ValueError("judge scores must be between 0 and 1")
        if not isinstance(parsed.get("reasoning"), str) or not parsed["reasoning"].strip():
            raise ValueError("judge reasoning is missing")
        return parsed

    def _configured_candidates(self) -> list[tuple[str, LLMProvider]]:
        names = list(CLOUD_PROVIDERS) if self.candidate_names == ["auto"] else self.candidate_names
        if any(name not in CLOUD_PROVIDERS for name in names):
            raise RuntimeError("Tournament candidates must be cloud providers; set TOURNAMENT_PROVIDERS=auto")

        selected = []
        for name in dict.fromkeys(names):
            provider = self.providers.get(name)
            if provider and provider.is_available():
                selected.append((name, provider))

        return selected[:3]

    def readiness(self) -> dict:
        """Configuration only: no inference, credit checks, or credentials exposed."""
        try:
            configured = self._configured_candidates()
            reason = None
            if len(configured) < 2:
                reason = "Configure at least two cloud candidate providers."
            elif self.judge_name != "auto" and self.judge_name not in CLOUD_PROVIDERS:
                reason = "Tournament judge must be a cloud provider; set JUDGE_PROVIDER=auto."
            return {"ready": reason is None, "candidates": [name for name, _ in configured],
                    "judge": self.judge_name, "reason": reason, "inference_verified": False}
        except RuntimeError as exc:
            return {"ready": False, "candidates": [], "judge": self.judge_name,
                    "reason": str(exc), "inference_verified": False}

    async def run(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float,
        max_tokens: int | None,
        original_messages: list[dict[str, str]] | None = None,
    ) -> TournamentOutcome:
        configured = self._configured_candidates()
        if len(configured) < 2:
            available = ", ".join(name for name, _ in configured) or "none"
            raise RuntimeError(f"Tournament requires API keys for at least two cloud providers; available: {available}")

        if self.judge_name != "auto" and self.judge_name not in CLOUD_PROVIDERS:
            raise RuntimeError("Tournament judge must be a cloud provider; set JUDGE_PROVIDER=auto")

        outcomes = await asyncio.gather(*[
            self._candidate(f"candidate-{index + 1}", provider, messages, temperature, max_tokens)
            for index, (_, provider) in enumerate(configured)
        ])
        
        successful = [item for item in outcomes if item.result]
        if len(successful) < 2:
            failures = ", ".join(f"{item.provider}: {item.error}" for item in outcomes if item.error)
            raise RuntimeError(f"Tournament requires two successful cloud candidates; {failures}")

        original = original_messages or messages
        prompt = next((item["content"] for item in reversed(original) if item["role"] == "user"), original[-1]["content"])
        judge_prompt = self._judge_prompt(prompt, successful)
        valid_ids = {item.candidate_id for item in successful}
        successful_names = [item.provider for item in successful]
        preferred = [self.judge_name] if self.judge_name != "auto" else []
        judge_names = list(dict.fromkeys(preferred + [name for name in CLOUD_PROVIDERS if name in successful_names]))
        judge_results: list[ProviderResult] = []
        judge_attempts = 0
        failures = []
        
        for name in judge_names:
            judge = self.providers.get(name)
            if not judge or not judge.is_available():
                continue
            for attempt in range(2):
                judge_attempts += 1
                message = [{"role": "user", "content": judge_prompt + ("\nYour previous output was invalid. Return only valid JSON." if attempt else "") }]
                try:
                    result = self._normalize_usage(await judge.generate(message, temperature=0.0), message)
                    judge_results.append(result)
                    parsed = self._parse_judgment(result.text, valid_ids)
                except Exception as exc:
                    failures.append(f"{name}: {self._failure(exc)}")
                    logger.warning("judge_failed", provider=name, failure=self._failure(exc))
                    if getattr(exc, "response", None) is not None:
                        break
                    continue
                    
                winner = next(item for item in successful if item.candidate_id == parsed["winner_id"])
                charged = [item.result for item in successful] + judge_results
                
                return TournamentOutcome(
                    winner_id=winner.candidate_id,
                    winning_response=winner.result.text,
                    candidates=outcomes,
                    judge_provider=judge.name,
                    judge_model=judge.model_name,
                    scores={key: float(value) for key, value in parsed["scores"].items()},
                    reasoning=parsed["reasoning"],
                    fallback_used=judge_attempts > 1,
                    usage=ProviderUsage(
                        sum(item.usage.prompt_tokens for item in charged),
                        sum(item.usage.completion_tokens for item in charged),
                    ),
                    judge_results=judge_results,
                    judge_attempts=judge_attempts,
                )
                
        raise RuntimeError("Cloud judge failed; " + ", ".join(failures))
