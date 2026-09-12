import asyncio
import json
import time
from dataclasses import dataclass

from providers.base import LLMProvider, ProviderResult, ProviderUsage


@dataclass(slots=True)
class CandidateOutcome:
    candidate_id: str
    provider: str
    model: str
    result: ProviderResult | None
    latency_ms: float
    error: str | None = None


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


class TournamentService:
    """Parallel ensemble plus a separate judge call.

    Independent candidates reduce single-model bias; preserving the trace makes
    the selection auditable instead of treating the judge as an oracle.
    """

    def __init__(
        self,
        providers: dict[str, LLMProvider],
        candidate_names: list[str],
        judge_name: str,
    ):
        self.providers = providers
        self.candidate_names = candidate_names
        self.judge_name = judge_name

    async def _candidate(
        self,
        candidate_id: str,
        provider: LLMProvider,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int | None,
    ) -> CandidateOutcome:
        started = time.perf_counter()
        try:
            result = await provider.generate(
                messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return CandidateOutcome(
                candidate_id, result.provider, result.model, result, (time.perf_counter() - started) * 1000
            )
        except Exception as exc:
            return CandidateOutcome(
                candidate_id,
                provider.name,
                provider.model_name,
                None,
                (time.perf_counter() - started) * 1000,
                str(exc)[:300],
            )

    def _judge_prompt(self, prompt: str, candidates: list[CandidateOutcome]) -> str:
        blocks = [
            "Judge the candidate responses for correctness, relevance, clarity, and completeness.",
            f"ORIGINAL_PROMPT:\n{prompt}",
            "Return JSON with winner_id, scores (0 to 1), and reasoning.",
        ]
        for candidate in candidates:
            if candidate.result:
                blocks.append(
                    f"CANDIDATE_ID: {candidate.candidate_id}\nRESPONSE: {candidate.result.text}"
                )
        return "\n".join(blocks)

    async def run(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float,
        max_tokens: int | None,
    ) -> TournamentOutcome:
        configured = [
            (name, self.providers[name])
            for name in self.candidate_names
            if name in self.providers and self.providers[name].is_available()
        ][:3]
        if len(configured) < 2:
            raise RuntimeError("Tournament mode requires at least two available candidates")

        outcomes = await asyncio.gather(
            *[
                self._candidate(f"candidate-{index + 1}", provider, messages, temperature, max_tokens)
                for index, (_, provider) in enumerate(configured)
            ]
        )
        successful = [item for item in outcomes if item.result]
        if not successful:
            raise RuntimeError("All tournament candidates failed")

        prompt = next(
            (message["content"] for message in reversed(messages) if message["role"] == "user"),
            messages[-1]["content"],
        )
        judge = self.providers[self.judge_name]
        judge_message = [{"role": "user", "content": self._judge_prompt(prompt, outcomes)}]
        fallback = False
        judge_result = None
        parsed = None
        for _ in range(2):
            try:
                judge_result = await judge.generate(judge_message, temperature=0.0)
                parsed = json.loads(judge_result.text)
                valid_ids = {item.candidate_id for item in successful}
                if parsed.get("winner_id") not in valid_ids:
                    raise ValueError("judge selected an unknown candidate")
                break
            except Exception:
                parsed = None
                judge_message.append(
                    {"role": "system", "content": "Your previous output was invalid. Return only valid JSON."}
                )

        if parsed is None:
            fallback = True
            winner = max(successful, key=lambda item: len(item.result.text if item.result else ""))
            parsed = {
                "winner_id": winner.candidate_id,
                "scores": {
                    item.candidate_id: round(len(item.result.text if item.result else "") / 1000, 3)
                    for item in successful
                },
                "reasoning": "Deterministic fallback selected the most complete successful response.",
            }
        winner = next(item for item in successful if item.candidate_id == parsed["winner_id"])
        prompt_total = sum(item.result.usage.prompt_tokens for item in successful if item.result)
        completion_total = sum(item.result.usage.completion_tokens for item in successful if item.result)
        if judge_result:
            prompt_total += judge_result.usage.prompt_tokens
            completion_total += judge_result.usage.completion_tokens

        return TournamentOutcome(
            winner_id=winner.candidate_id,
            winning_response=winner.result.text,
            candidates=outcomes,
            judge_provider=judge.name,
            judge_model=judge.model_name,
            scores={key: float(value) for key, value in parsed.get("scores", {}).items()},
            reasoning=str(parsed.get("reasoning", "")),
            fallback_used=fallback,
            usage=ProviderUsage(prompt_total, completion_total),
        )
