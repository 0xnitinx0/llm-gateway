import asyncio
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

from providers.base import LLMProvider
from providers.gemini_provider import GeminiProvider
from providers.groq_provider import GroqProvider
from providers.cerebras_provider import CerebrasProvider

logger = logging.getLogger("llm_gateway.tournament")


class TournamentService:
    """Multi-Model Response Tournament Service.

    Generates responses from multiple candidate LLM providers concurrently,
    records any individual provider failures, and uses an LLM judge to evaluate
    and select the best candidate.
    """

    def __init__(
        self,
        providers: Optional[Dict[str, LLMProvider]] = None,
        judge_model: str = "models/gemini-3.5-flash-lite",
    ):
        if providers:
            self.providers = providers
        else:
            self.providers = {
                "gemini": GeminiProvider(),
                "groq": GroqProvider(),
                "cerebras": CerebrasProvider(),
            }
        self.judge_model = judge_model

    def get_available_providers(self) -> Dict[str, LLMProvider]:
        available = {}
        for name, p in self.providers.items():
            try:
                if p.is_available():
                    available[name] = p
            except Exception:
                pass
        return available

    async def _call_provider(
        self, name: str, provider: LLMProvider, messages: List[Any]
    ) -> Dict[str, Any]:
        text, usage = await provider.generate(messages)
        model_name = getattr(provider, "model_name", name)
        return {
            "provider": name,
            "model": model_name,
            "text": text,
            "usage": usage,
        }

    async def run_tournament(
        self, messages: List[Any]
    ) -> Tuple[str, str, str, List[Dict[str, Any]], float, Dict[str, int]]:
        """Run tournament across all available candidate providers concurrently and judge the winner.

        Returns:
            (winning_text, winning_provider, winning_model, candidates_list, judge_score, token_summary)
        """
        available_map = self.get_available_providers()
        if not available_map:
            raise RuntimeError("No LLM providers are available for tournament mode")

        # 1. Execute all available candidate providers concurrently in parallel
        tasks = [
            self._call_provider(name, provider, messages)
            for name, provider in available_map.items()
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        candidates: List[Dict[str, Any]] = []
        total_input_tokens = 0
        total_output_tokens = 0
        total_tokens = 0

        for res in results:
            if isinstance(res, Exception):
                logger.warning(f"Tournament candidate failed: {res}")
                continue

            if res and isinstance(res, dict) and res.get("text"):
                usage = res.get("usage")
                if usage:
                    total_input_tokens += usage.get("input_tokens") or 0
                    total_output_tokens += usage.get("output_tokens") or 0
                    total_tokens += usage.get("total_tokens") or 0
                candidates.append(res)

        if not candidates:
            raise RuntimeError("All tournament candidate models failed to generate responses")

        # Single successful candidate -> automatic winner
        if len(candidates) == 1:
            winner = candidates[0]
            token_summary = {
                "input_tokens": total_input_tokens,
                "output_tokens": total_output_tokens,
                "total_tokens": total_tokens,
            }
            return (
                winner["text"],
                winner["provider"],
                winner["model"],
                candidates,
                1.0,
                token_summary,
            )

        # 2. Evaluate candidates using LLM Judge (Gemini)
        user_prompt = ""
        for msg in reversed(messages):
            if isinstance(msg, dict) and msg.get("role") == "user":
                user_prompt = msg.get("content", "")
                break
            elif getattr(msg, "role", "") == "user":
                user_prompt = getattr(msg, "content", "")
                break

        judge_prompt = (
            "You are an expert AI judge evaluating candidate responses for quality, accuracy, and clarity.\n\n"
            f"User Prompt:\n{user_prompt}\n\n"
        )

        for idx, cand in enumerate(candidates):
            judge_prompt += (
                f"--- Candidate {idx + 1} (Provider: {cand['provider']}, Model: {cand['model']}) ---\n"
                f"{cand['text']}\n\n"
            )

        judge_prompt += (
            "Evaluate which candidate response is superior. Reply in EXACTLY this format:\n"
            "WINNER: <Candidate Number, e.g. 1 or 2>\n"
            "SCORE: <Float between 0.0 and 1.0>\n"
            "REASON: <One sentence explanation>"
        )

        try:
            judge_provider = GeminiProvider(model_name=self.judge_model)
            judge_messages = [{"role": "user", "content": judge_prompt}]
            judge_response_text, judge_usage = await judge_provider.generate(judge_messages)

            if judge_usage:
                total_input_tokens += judge_usage.get("input_tokens") or 0
                total_output_tokens += judge_usage.get("output_tokens") or 0
                total_tokens += judge_usage.get("total_tokens") or 0

            winner_idx = 0
            score = 0.90

            for line in judge_response_text.splitlines():
                if line.startswith("WINNER:"):
                    try:
                        num_str = line.split("WINNER:")[1].strip()
                        parsed_idx = int("".join(filter(str.isdigit, num_str))) - 1
                        if 0 <= parsed_idx < len(candidates):
                            winner_idx = parsed_idx
                    except ValueError:
                        pass
                elif line.startswith("SCORE:"):
                    try:
                        score = float(line.split("SCORE:")[1].strip())
                    except ValueError:
                        pass
        except Exception as exc:
            logger.warning(f"Tournament LLM judge evaluation failed: {exc}. Defaulting to first candidate.")
            winner_idx = 0
            score = 0.85

        winner = candidates[winner_idx]
        token_summary = {
            "input_tokens": total_input_tokens,
            "output_tokens": total_output_tokens,
            "total_tokens": total_tokens,
        }

        return (
            winner["text"],
            winner["provider"],
            winner["model"],
            candidates,
            score,
            token_summary,
        )
