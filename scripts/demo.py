import argparse
import json
import os
import time
from typing import Any

import httpx


DEFAULT_PROMPT = "Explain semantic caching in an LLM gateway in three concise points."


class Demo:
    def __init__(self, base_url: str, api_key: str, rate_key: str, admin_key: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.rate_key = rate_key
        self.admin_key = admin_key

    @staticmethod
    def _title(value: str) -> None:
        print(f"\n{'=' * 72}\n{value}\n{'=' * 72}")

    def _headers(self, key: str | None = None) -> dict[str, str]:
        return {"Authorization": f"Bearer {key or self.api_key}"}

    def reset(self) -> None:
        response = httpx.post(
            f"{self.base_url}/v1/admin/reset-demo",
            headers={"X-Admin-Key": self.admin_key},
            timeout=30,
        )
        response.raise_for_status()

    def edge(self) -> None:
        self._title("1. EDGE GATEWAY: true SSE token streaming")
        payload = {
            "model": "gateway-auto",
            "messages": [{"role": "user", "content": DEFAULT_PROMPT}],
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        started = time.perf_counter()
        with httpx.stream(
            "POST",
            f"{self.base_url}/v1/chat/completions",
            headers=self._headers(),
            json=payload,
            timeout=60,
        ) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line.startswith("data: ") or line == "data: [DONE]":
                    continue
                chunk = json.loads(line[6:])
                token = chunk.get("choices", [{}])[0].get("delta", {}).get("content")
                if token:
                    print(f"[{(time.perf_counter() - started) * 1000:7.1f} ms] {token!r}")
                if chunk.get("gateway"):
                    print("Final metadata:", json.dumps(chunk["gateway"], indent=2))
        print(f"Client-observed latency: {(time.perf_counter() - started) * 1000:.1f} ms")

    def rate_limit(self) -> None:
        self._title("2. RATE LIMIT: Redis token bucket")
        self.reset()
        payload = {"model": "gateway-auto", "messages": [{"role": "user", "content": "ping"}]}
        for number in range(1, 5):
            response = httpx.post(
                f"{self.base_url}/v1/chat/completions",
                headers=self._headers(self.rate_key),
                json=payload,
                timeout=30,
            )
            print(
                f"request={number} status={response.status_code} "
                f"remaining={response.headers.get('X-RateLimit-Remaining')} "
                f"retry_after={response.headers.get('Retry-After')}"
            )

    def cache(self) -> None:
        self._title("3. SEMANTIC DEDUP: cold MISS followed by near-match HIT")
        self.reset()
        prompts = [
            "What is semantic caching for language model requests?",
            "Explain semantic caching in an LLM gateway.",
        ]
        for prompt in prompts:
            started = time.perf_counter()
            response = httpx.post(
                f"{self.base_url}/v1/chat/completions",
                headers=self._headers(),
                json={"model": "gateway-auto", "messages": [{"role": "user", "content": prompt}]},
                timeout=60,
            )
            response.raise_for_status()
            data = response.json()
            elapsed = (time.perf_counter() - started) * 1000
            gateway = data["gateway"]
            print(
                f"cache={'HIT' if gateway['cache_hit'] else 'MISS'} "
                f"similarity={gateway['similarity']:.4f} "
                f"server={gateway['latency_ms']:.1f}ms client={elapsed:.1f}ms"
            )

    def compression(self) -> None:
        self._title("4. PROMPT COMPRESSION: visible token reduction")
        repeated = (
            "Could you please explain Redis token buckets clearly. "
            "Explain Redis token buckets clearly. "
            "The answer must use exactly three bullet points. "
            "Please kindly avoid unnecessary introductory text. "
            "Explain Redis token buckets clearly."
        )
        response = httpx.post(
            f"{self.base_url}/v1/tools/compress",
            headers=self._headers(),
            json={"messages": [{"role": "user", "content": repeated}]},
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        print("Original:", data["original_messages"][0]["content"])
        print("Compressed:", data["compressed_messages"][0]["content"])
        print("Metrics:", json.dumps(data["metrics"], indent=2))

    def tournament(self) -> None:
        self._title("5. TOURNAMENT: parallel candidates and auditable judge")
        response = httpx.post(
            f"{self.base_url}/v1/tournaments",
            headers=self._headers(),
            json={
                "messages": [
                    {
                        "role": "user",
                        "content": "Explain why vector similarity can identify semantically duplicated prompts.",
                    }
                ]
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        for candidate in data["candidates"]:
            print(
                f"\n{candidate['candidate_id']} provider={candidate['provider']} "
                f"latency={candidate['latency_ms']}ms error={candidate['error']}"
            )
            print(candidate["response"])
        print("\nJudge:", json.dumps(data["judge"], indent=2))
        print("Winner:", data["winner_id"])
        print("Total usage:", json.dumps(data["usage"], indent=2))

    def run(self, command: str) -> None:
        if command == "all":
            self.reset()
            for name in ("edge", "rate_limit", "cache", "compression", "tournament"):
                getattr(self, name)()
        else:
            getattr(self, command.replace("-", "_"))()


def main() -> None:
    parser = argparse.ArgumentParser(description="Narrated local LLM Gateway demo")
    parser.add_argument(
        "command",
        choices=["all", "edge", "rate-limit", "cache", "compression", "tournament"],
        default="all",
        nargs="?",
    )
    parser.add_argument("--base-url", default=os.getenv("GATEWAY_URL", "http://localhost:8000"))
    parser.add_argument("--api-key", default=os.getenv("DEMO_API_KEY", "gw_demo_local"))
    parser.add_argument("--rate-key", default=os.getenv("RATE_LIMIT_DEMO_API_KEY", "gw_demo_rate"))
    parser.add_argument("--admin-key", default=os.getenv("ADMIN_API_KEY", "admin-local-demo"))
    args = parser.parse_args()
    Demo(args.base_url, args.api_key, args.rate_key, args.admin_key).run(args.command)


if __name__ == "__main__":
    main()
