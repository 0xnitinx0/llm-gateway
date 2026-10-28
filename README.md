# LLM Gateway

A local-first LLM gateway with a Python FastAPI backend and a connected React developer portal. The gateway is a modular monolith: authentication, rate limiting, routing, semantic caching, compression, tournaments, and telemetry are separate Python modules while sharing one observable process.

## Local stack

- FastAPI, async SQLAlchemy, and Alembic
- PostgreSQL 16 with pgvector and an HNSW cosine index
- Redis token-bucket rate limiting implemented atomically in Lua
- Local ONNX FastEmbed embeddings
- Deterministic local generation/judging, with optional Gemini, Groq, and Cerebras adapters
- React/Vite portal using live, prompt-free gateway telemetry

Start the backend infrastructure:

    docker compose up --build

The first image build downloads the embedding model. Runtime requests need no cloud key. FastAPI is available at http://localhost:8000 and readiness at http://localhost:8000/ready.

Start the portal separately:

    cd frontend
    npm install
    npm run dev

Open http://localhost:5173. Vite proxies /api to FastAPI, so no browser CORS setup is required. Enter a gateway key manually in Playground. For the local seeded environment use gw_demo_local. Enter the configured admin key in Settings to unlock Dashboard, Usage, Cache, and API Keys; it is retained only in sessionStorage.

## API and demo

POST /v1/chat/completions accepts the OpenAI-style model, messages, temperature, max_tokens, stream, and stream_options fields. Authenticate with Authorization: Bearer or X-Gateway-API-Key. POST /v1/tournaments returns every candidate, judge scores/reasoning, and the winner. POST /v1/tools/compress exposes compression independently.

Administrative APIs use X-Admin-Key:

- GET /usage: request, token, cache, compression, rate-limit, and tournament telemetry
- GET /v1/admin/config: safe read-only runtime configuration
- GET/POST/DELETE /v1/api-keys: key lifecycle management
- GET/DELETE /v1/admin/cache: sanitized cache metadata and reset

Run the narrated CLI demonstration with:

    python3 -m scripts.demo all

## Development checks

    pytest -q
    cd frontend
    npm test
    npm run build

Raw prompts and API keys are never written to telemetry or returned by admin cache endpoints. The portal intentionally reports measured efficiency instead of fabricated monetary savings for the free local provider.
