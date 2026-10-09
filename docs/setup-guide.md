# LLM Gateway: Database and Configuration Setup

This guide sets up the complete local LLM Gateway: PostgreSQL with pgvector, Redis, FastAPI, local embeddings and models, and the React/Vite portal.

## 1. Prerequisites
`
Install:

- Docker Engine or Docker Desktop
- Docker Compose v2
- Node.js 20 or newer
- npm

Verify the tools:

```bash
docker --version
docker compose version
node --version
npm --version
```

PostgreSQL and Redis do not need to be installed directly on the host.

## 2. Create the environment file

From the repository root:

```bash
cd /home/daksh/programming/llm-gateway
cp .env.example .env
```

The default configuration is suitable for an offline local demo:

```dotenv
DATABASE_URL=postgresql+asyncpg://gateway:gateway_password@localhost:5433/llm_gateway
REDIS_URL=redis://localhost:6379/0

ADMIN_API_KEY=admin-local-demo
DEMO_API_KEY=gw_demo_local
RATE_LIMIT_DEMO_API_KEY=gw_demo_rate

CACHE_SIMILARITY_THRESHOLD=0.82
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
EMBEDDING_MODEL_PATH=

LOCAL_TOKEN_DELAY_MS=35
ENABLED_PROVIDERS=local

TOURNAMENT_PROVIDERS=auto
JUDGE_PROVIDER=auto
MODEL_PRICING_JSON={}

GEMINI_API_KEY=
GROQ_API_KEY=
CEREBRAS_API_KEY=
```

The demo credentials are intentionally simple. Generate a stronger admin key before exposing the gateway outside your machine:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Place the result in `.env` as `ADMIN_API_KEY`.

## 3. Host and Docker addresses

Processes running on the host use:

| Service | Address |
| --- | --- |
| PostgreSQL | `localhost:5433` |
| Redis | `localhost:6379` |
| FastAPI | `localhost:8000` |
| Vite frontend | `localhost:5173` |

Containers communicate using Compose service names:

| Service | Address |
| --- | --- |
| PostgreSQL | `postgres:5432` |
| Redis | `redis:6379` |

Consequently, the gateway container uses:

```text
postgresql+asyncpg://gateway:gateway_password@postgres:5432/llm_gateway
redis://redis:6379/0
```

The host-side `.env` uses `localhost:5433` and `localhost:6379`.

## 4. Start the backend stack

Build and start PostgreSQL, Redis, and FastAPI:

```bash
docker compose up --build -d
```

The first build downloads the BGE embedding model and bakes it into the image. Later builds normally reuse Docker's cache.

Check status:

```bash
docker compose ps
```

The `gateway`, `postgres`, and `redis` services should all become healthy. Inspect startup if necessary:

```bash
docker compose logs -f gateway
```

The gateway starts through `python -m scripts.start`. Startup runs `alembic upgrade head`, starts FastAPI, verifies the database and Redis, loads the embedding model, and seeds the local API keys.

## 5. PostgreSQL and pgvector

Compose creates:

```text
Database: llm_gateway
User: gateway
Password: gateway_password
Host port: 5433
Container port: 5432
```

PostgreSQL data persists in the named `postgres_data` Docker volume.

### Schema

Alembic creates:

- `alembic_version`: applied schema revision.
- `gateway_api_keys`: hashed keys, status, and per-key rate limits.
- `semantic_cache_entries`: 384-dimensional embeddings and cached responses.
- `request_logs`: prompt-free request, token, cache, rate-limit, and tournament telemetry.

The semantic cache uses a `vector(384)` column and an HNSW cosine index.

### Inspect the database

Open an interactive PostgreSQL shell:

```bash
docker compose exec postgres psql -U gateway -d llm_gateway
```

Run:

```sql
\dx
\dt
\di
SELECT * FROM alembic_version;

SELECT extname, extversion
FROM pg_extension
WHERE extname = 'vector';

SELECT indexname, indexdef
FROM pg_indexes
WHERE indexname = 'ix_semantic_cache_embedding_hnsw';
```

Exit with:

```sql
\q
```

A non-interactive migration check is:

```bash
docker compose exec postgres psql \
  -U gateway \
  -d llm_gateway \
  -c "SELECT * FROM alembic_version;"
```

Migrations are automatic during normal gateway startup. To apply them manually from a configured host environment:

```bash
alembic upgrade head
```

## 6. Redis

Redis uses database zero:

```text
redis://redis:6379/0
```

Append-only persistence is stored in the `redis_data` Docker volume. Redis contains token-bucket state, not semantic responses. Bucket keys use:

```text
rate_limit:<database-api-key-id>
```

Verify Redis:

```bash
docker compose exec redis redis-cli ping
```

Expected output:

```text
PONG
```

List bucket records safely:

```bash
docker compose exec redis redis-cli --scan --pattern 'rate_limit:*'
```

Inspect a bucket:

```bash
docker compose exec redis redis-cli HGETALL 'rate_limit:<key-id>'
```

Each bucket records its remaining fractional `tokens` and Redis-server `updated_at` timestamp. The Lua script performs refill and consumption atomically.

## 7. Credentials and API keys

### Gateway keys

Gateway keys authenticate:

- `POST /v1/chat/completions`
- `POST /v1/tournaments`
- `POST /v1/tools/compress`

Use either:

```http
X-Gateway-API-Key: gw_demo_local
```

or:

```http
Authorization: Bearer gw_demo_local
```

The seeded local key is `gw_demo_local`.

The seeded rate-limit demonstration key is `gw_demo_rate`. It has capacity 3 and refills at 0.2 requests per second, so four immediate requests trigger a 429 response.

### Admin key

The admin key is a separate environment secret, not a gateway key stored in PostgreSQL. Send it as:

```http
X-Admin-Key: admin-local-demo
```

It protects usage, runtime configuration, cache administration, and API-key lifecycle endpoints.

### Create a key

```bash
curl -X POST http://localhost:8000/v1/api-keys \
  -H "X-Admin-Key: admin-local-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Local Client",
    "rate_limit_capacity": 20,
    "refill_rate_per_second": 1.0
  }'
```

The raw `key` is returned only once. PostgreSQL stores its SHA-256 hash.

List keys:

```bash
curl http://localhost:8000/v1/api-keys \
  -H "X-Admin-Key: admin-local-demo"
```

## 8. Embedding and semantic-cache settings

The default model is:

```text
BAAI/bge-small-en-v1.5
```

It produces 384-dimensional vectors. Docker stores the downloaded model under `/models/fastembed`.

The cache threshold is controlled by:

```dotenv
CACHE_SIMILARITY_THRESHOLD=0.82
```

A lookup is a cache hit when cosine similarity is greater than or equal to this threshold. Higher values require closer matches; lower values increase reuse but risk false matches.

Do not change `EMBEDDING_DIMENSIONS` or use a model with a different vector size without also changing the SQLAlchemy `Vector(384)` column, creating an Alembic migration, and rebuilding existing cache data and its index.

After changing runtime settings, recreate the gateway:

```bash
docker compose up -d --force-recreate gateway
```

## 9. Cloud providers, tournaments, and USD estimates

Put the cloud API keys you have in `.env`:

```dotenv
GEMINI_API_KEY=your-gemini-key
GROQ_API_KEY=your-groq-key
CEREBRAS_API_KEY=your-cerebras-key
```

Docker Compose registers these three adapters and `local` for ordinary chat routing. An empty key disables its cloud adapter. Tournament mode selects up to three cloud providers with keys, sends candidates in parallel, and uses a separate cloud judge call. It requires **two successful cloud candidates**. A provider with no credit or an invalid model is shown as a failed candidate when the other two succeed; otherwise the endpoint returns an actionable 502. Local fake candidates and local judges are never used in tournament mode.

For host Python runs, set `ENABLED_PROVIDERS=gemini,groq,cerebras,local`. Tournament defaults to `TOURNAMENT_PROVIDERS=auto` and `JUDGE_PROVIDER=auto`. If an older `.env` explicitly sets `local-analytical` or `local-judge`, change those values to `auto`. Optional cloud-only overrides can name providers, for example `TOURNAMENT_PROVIDERS=gemini,groq` and `JUDGE_PROVIDER=gemini`.

USD estimates require rates you supply. Add a single-line JSON value to `.env`, keyed by the exact `provider/model` reported by the gateway:

```dotenv
MODEL_PRICING_JSON='{"gemini/gemini-3.6-flash":{"input_per_million_usd":<input-rate>,"output_per_million_usd":<output-rate>},"groq/openai/gpt-oss-20b":{"input_per_million_usd":<input-rate>,"output_per_million_usd":<output-rate>}}'
```

Replace each `<...-rate>` with your provider's current USD rate per million tokens; the example is a template, not valid JSON until you replace the placeholders. Include each model you use, including the judge model. Missing model rates leave that request unpriced. The **Usage & Efficiency** tab shows only fully priced requests in dollar totals, plus an unpriced-request count. Previously logged requests remain unpriced. Cache savings, compression savings, and tournament overhead reconcile to net savings relative to one direct, uncompressed call. For Gemini, reported thinking tokens count as output tokens in the estimate ([Gemini token guide](https://ai.google.dev/gemini-api/docs/generate-content/thinking#pricing)). Failed calls may be billed by a provider without returning usage, so these figures are estimates rather than invoices.

After editing `.env`, rebuild or recreate the gateway:

```bash
docker compose up --build -d gateway
```

## 10. Start the frontend

The frontend runs separately:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api/*` to `http://127.0.0.1:8000/*`, so the local setup needs no CORS middleware.

In the portal:

1. Open **Settings**.
2. Enter the admin key and save it for the session.
3. Open **API Keys** to create a key, or use `gw_demo_local`.
4. Open **Playground**.
5. Enter the gateway key manually.
6. Submit a normal request or enable tournament mode.

The admin key is stored only in `sessionStorage`. The gateway key is stored in `localStorage`.

## 11. Verify the installation

Health:

```bash
curl http://localhost:8000/health
```

Readiness:

```bash
curl http://localhost:8000/ready
```

Expected readiness fields are `postgres: ok`, `redis: ok`, and `embedder: ok`.

Send a completion:

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "X-Gateway-API-Key: gw_demo_local" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gateway-auto",
    "messages": [
      {"role": "user", "content": "Explain semantic caching."}
    ]
  }'
```

Check live telemetry:

```bash
curl http://localhost:8000/usage \
  -H "X-Admin-Key: admin-local-demo"
```

Run the complete CLI demonstration:

```bash
python3 -m scripts.demo all
```

## 12. Run FastAPI outside Docker

To keep only PostgreSQL and Redis in Docker:

```bash
docker compose up -d postgres redis

python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
cp .env.example .env
python3 -m scripts.start
```

The host connection values are then correct:

```dotenv
DATABASE_URL=postgresql+asyncpg://gateway:gateway_password@localhost:5433/llm_gateway
REDIS_URL=redis://localhost:6379/0
```

## 13. Persistence, backups, and resets

Stop services while preserving data:

```bash
docker compose down
```

Restart with the existing volumes:

```bash
docker compose up -d
```

Clear semantic cache and rate buckets without deleting API keys or usage history:

```bash
curl -X POST http://localhost:8000/v1/admin/reset-demo \
  -H "X-Admin-Key: admin-local-demo"
```

Create a PostgreSQL backup:

```bash
docker compose exec -T postgres pg_dump \
  -U gateway llm_gateway > llm_gateway_backup.sql
```

Completely remove PostgreSQL and Redis data:

```bash
docker compose down -v
```

Warning: `-v` permanently deletes API keys, cache entries, request telemetry, migration state, and Redis bucket state.

## 14. Troubleshooting

### Port conflicts

The local ports are 8000, 5433, 6379, and 5173. Stop the conflicting process or change the left side of the corresponding Compose port mapping.

### Gateway is unhealthy

```bash
docker compose logs gateway
docker compose logs postgres
docker compose logs redis
```

### Database authentication fails

Ensure the PostgreSQL database, user, and password match the credentials embedded in `DATABASE_URL`.

### Admin pages remain locked

Enter the exact `ADMIN_API_KEY` value in frontend Settings. A gateway API key cannot authenticate admin endpoints.

### The embedding build fails

The initial image build needs internet access to download the model. Once the image is built, the default local runtime does not need internet or paid provider credentials.

### Local compression and routing algorithms

`COMPRESSION_STRATEGY=conservative_tfidf` is the default. Set it to `basic` to use
request-introduction cleanup and exact prose sentence deduplication alone. Both
strategies preserve non-user messages and protect code, quotations, structured
data, lists, and indentation-sensitive text. Cleanup begins at
`COMPRESSION_MIN_TOKENS=30` across the request. `COMPRESSION_TARGET_RATIO=0.70` is
a soft goal: distinct facts and constraints take priority, so the achieved ratio
may be higher. Sentences are never discarded merely to hit that goal.

The TF-IDF strategy additionally compares prose sentences using cosine similarity
(minimum 0.92). Removal requires matching constraint/number markers and the same
ordered content words after excluding articles. This conservative check permits
minor wording redundancy without accepting bag-of-words reversals or added facts.
Messages containing more than 200 prose sentences use basic cleanup to bound
pairwise comparison work. Ambiguous structured content is kept unchanged.

Routing uses word unigram/bigram TF-IDF matching against synthetic examples in
`services/routing/task_examples.py`, fitted once when the router starts. Clear code
syntax and explicit math override matching. Otherwise, a category needs a score
of at least 0.20 and a lead of at least 0.05; ambiguous requests use focused rules,
then default to `simple`. This is lexical classification, so unfamiliar wording
can still be misclassified. It does not download a model or call a cloud service.

Task selection uses the original latest user turn, with the preceding user turn
for short ambiguous follow-ups. Generic system instructions do not choose the
task. Context sizing counts the forwarded compressed messages once using the
existing approximate token counter; these figures are not provider tokenizer
counts. Streaming and regular requests share the same classification path.

The active strategy appears in `/v1/admin/config` and existing compression
metrics, including the compression preview and tournament responses. No request
selector is needed. Reinstall `requirements.txt` and restart the gateway after
changing these settings. Run `pytest tests/test_classifier.py -s` to see the
held-out synthetic evaluation against the previous keyword baseline; it is a
regression check, not a production accuracy guarantee.
