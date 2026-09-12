# Demo Narration Guide

## 1. Edge gateway

The API key is hashed in PostgreSQL, while an atomic Redis Lua script refills and
consumes a per-key token bucket. The response stream is an async generator: each
provider token becomes an SSE delta immediately, and the final chunk contains
gateway metrics. The local provider makes this behavior reproducible offline.

## 2. Semantic deduplication

The embedding model maps differently worded prompts into nearby points in a
384-dimensional vector space. PostgreSQL pgvector searches an HNSW graph by
cosine distance. A result above the configured similarity threshold bypasses
generation, which explains the lower hit latency. Entries are isolated by API
key and contain no raw prompt.

## 3. Prompt compression

Compression runs only after a cache miss. It removes filler and repeated
sentences while protecting code, numbers, negations, and explicit formatting
constraints. Both token counts use the same local tokenizer, so the displayed
reduction is consistent and inspectable.

## 4. Response tournament

Candidate profiles execute concurrently, so wall time approaches the slowest
candidate rather than their sum. A separate judge call scores correctness,
relevance, clarity, and completeness. The API returns candidate failures,
latencies, scores, reasoning, and the winner so the ensemble decision is
auditable.

## 5. Observability

Every request receives a request ID and a JSON access log. Chat and tournament
paths additionally persist provider, cache, compression, token, status, and
latency metrics. The CLI prints the same measurements at the client boundary,
making server-side and observed latency easy to compare.
