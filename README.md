# LLM Gateway

A local-first, backend-only LLM gateway written in Python. One FastAPI process
contains an edge layer (authentication, Redis rate limiting, HTTP/SSE) and an
intelligence layer (routing, pgvector deduplication, prompt compression, and
multi-model judging). The modular-monolith boundary keeps a solo demo easy to
trace while leaving each service replaceable.

## Local stack

- FastAPI and async SQLAlchemy
- PostgreSQL 16 with pgvector and an HNSW cosine index
- Redis token-bucket rate limiting implemented atomically in Lua
- ONNX FastEmbed BGE-small embeddings, baked into the image
- Deterministic local generation and judge profiles; Gemini, Groq, and Cerebras
  are optional

Start everything:

    docker compose up --build

The initial image build downloads the embedding model. Runtime requests require
no cloud API or paid credentials. Readiness is available at
http://localhost:8000/ready and interactive API documentation at
http://localhost:8000/docs.

Run the complete narrated demo from another terminal:

    python3 -m scripts.demo all

Individual stages are also available:

    python3 -m scripts.demo edge
    python3 -m scripts.demo rate-limit
    python3 -m scripts.demo cache
    python3 -m scripts.demo compression
    python3 -m scripts.demo tournament

The seeded keys are gw_demo_local and gw_demo_rate. Admin-only endpoints use
X-Admin-Key: admin-local-demo. Override these values for anything beyond a local
demo.

## Client API

POST /v1/chat/completions accepts the standard model, messages, temperature,
max_tokens, stream, and stream_options fields. Authenticate using either
Authorization: Bearer GATEWAY_KEY or X-Gateway-API-Key. Non-streaming responses
retain the standard choices and usage objects and add a gateway metadata object.
Streaming responses use SSE chat-completion chunks and terminate with [DONE].

POST /v1/tools/compress exposes compression independently. POST /v1/tournaments
returns candidates, errors, timing, token usage, judge scores/reasoning, and the
winner. Cache, key-management, reset, and usage endpoints require the admin key.

## Development

    python3 -m pip install -r requirements.txt
    pytest -q

Raw prompts and API keys are never written to logs or semantic-cache rows. Only
key hashes, embeddings, generated responses, and operational metrics persist.
