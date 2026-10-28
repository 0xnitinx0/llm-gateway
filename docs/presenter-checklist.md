# Guided demo presenter checklist

## Before presenting

- Follow [setup-guide.md](setup-guide.md) to start FastAPI, PostgreSQL with pgvector, Redis, and the frontend (`cd frontend && npm run dev`). Open `/demo` from **Start demo**.
- Keep the admin key and provider credentials in ignored `.env` configuration. Save the admin key in Prepare, then check readiness. A gateway key can be supplied directly; **Prepare live session** creates dedicated normal and capacity-3 demo keys. Their secrets stay in browser session storage.
- Configure at least two cloud providers for the tournament, with `TOURNAMENT_PROVIDERS=auto` and `JUDGE_PROVIDER=auto` or supported cloud names. Configuration readiness does not verify credit or successful inference. A local provider is clearly identified as simulated inference.
- Use synthetic prompts. Verify gateway access with the preview action. Test the tournament before the presentation if cloud reliability matters.

## Recommended sequence (about 6 minutes)

| Step | Time | Action and evidence |
| --- | --- | --- |
| Prepare | 45 sec | Check backend readiness, admin access, gateway credentials, and provider configuration. Click **Prepare live session** once. |
| Compression | 60 sec | Edit the synthetic prompt and click **Preview compression**. Compare removed words, strategy, original/compressed tokens, and reduction. Preview makes no provider call. |
| Semantic cache | 60 sec | Send the initial request, repeat the exact request, then optionally try a paraphrase. Compare actual hit/miss, similarity, round-trip latency, and calls avoided. Explain a paraphrase miss honestly. |
| Routing & streaming | 75 sec | Choose Simple, Coding, or Reasoning and click **Start stream**. Read the actual classification, preference order, selected model, and final evidence. **Stop** marks the output as incomplete. A cached response skips routing. |
| Tournament | 75 sec | Click **Run tournament**. Compare answers, scores, latency, token usage, and visible candidate failures. Explain the winner and judge reasoning. If prerequisites or inference fail, show that state. |
| Rate limit & recap | 60 sec | Send four previews against the dedicated bucket. Read response statuses, capacity headers, and Retry-After; retry when the countdown finishes. Recap session results and open Usage, Cache, or API Keys. |

Steps advance only when the presenter clicks; entering a step never calls a provider. Previous cache entries can make an initial request hit. Slow requests or prior use can alter the expected three-successes/one-429 sequence. Report the observed outcomes.

## Fallback and cleanup

- If services or providers are unavailable, explicitly click **Use sample walkthrough**. The persistent **Sample demo** label identifies illustrative answers, scores, token counts, and timings. Demo and Playground sample actions make no backend requests; monitoring pages continue to display live telemetry when connected.
- Live and sample results remain separate. Navigation and reload retain completed presentation results for the browser session. **Restart walkthrough** clears presentation results only; it does not clear shared cache, reset rate buckets, delete keys, or erase usage history.
- Return to **Use live results** when ready. Revoke dedicated demo keys in API Keys after presenting. Negative savings retain the absolute-value display labeled **Net saved (extra spending)**.

## Verification commands

```bash
.venv/bin/pytest -q
cd frontend
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser regressions use synthetic API fixtures and cover the walkthrough, offline fallback, credentials, cache misses, streaming cancellation, tournament failures, 429 recovery, monitoring refresh, keyboard access, reduced motion, and 1920/1440/tablet/mobile layouts. They do not verify live provider credit. Screenshots are written under `frontend/test-results/`. For an installed browser, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable instead of installing Chromium.
