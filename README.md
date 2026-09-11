# LLM Gateway

An Intelligent API Gateway for LLM Providers with Semantic Caching.

The gateway acts as a unified abstraction over LLM providers. Developers use one Gateway API Key and submit standard prompt message objects without managing provider API keys or model names directly.

## Features

- **Provider Abstraction**: Automatically routes requests to Gemini (free tier) internally.
- **Prompt-Minimizing Semantic Caching**: In-memory cosine similarity caching of embeddings eliminates duplicate LLM API generation calls without persisting raw user prompts.
- **Development Debug Endpoint**: Inspect in-memory cache contents via `GET /debug/cache` (excludes raw prompts and API keys).
- **API Key Security**: Validates incoming `X-Gateway-API-Key` headers and hides provider API keys.

## Project Structure

```
llm-gateway
│
├── app
│   ├── __init__.py
│   └── main.py
│
├── cache
│   ├── __init__.py
│   └── semantic_cache.py
│
├── providers
│   ├── __init__.py
│   ├── base.py
│   └── gemini_provider.py
│
├── tests
│   ├── __init__.py
│   ├── test_gateway.py
│   └── test_semantic_cache.py
│
├── .env
├── .gitignore
├── requirements.txt
├── docker-compose.yml
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.9+
- Virtual Environment

### Installation & Setup

1. Activate virtual environment:
   ```bash
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment variables in `.env`:
   ```env
   PORT=8000
   HOST=0.0.0.0
   LOG_LEVEL=info

   GATEWAY_API_KEY=gateway-secret-key
   CACHE_SIMILARITY_THRESHOLD=0.75

   GEMINI_API_KEY=your_gemini_api_key_here
   ```

### Running the Server

Start the FastAPI application with `uvicorn`:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive API documentation (Swagger UI) is available at:
- `http://localhost:8000/docs`

### Running Tests

Run the test suite with `pytest`:

```bash
pytest
```

## API Usage

### Health Check

```bash
curl -X GET http://localhost:8000/health
```

**Response:**
```json
{
  "status": "ok"
}
```

### Chat Completions

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Gateway-API-Key: gateway-secret-key" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "What is machine learning?"
      }
    ]
  }'
```

**Response (Cache Miss):**
```json
{
  "response": "Machine learning is a branch of artificial intelligence...",
  "cache_hit": false,
  "similarity": 0.0
}
```

**Response for Similar Request (Cache Hit):**
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Gateway-API-Key: gateway-secret-key" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Can you explain what machine learning is?"
      }
    ]
  }'
```

**Response (Cache Hit):**
```json
{
  "response": "Machine learning is a branch of artificial intelligence...",
  "cache_hit": true,
  "similarity": 0.7831
}
```

### Debug: Inspect Semantic Cache

```bash
curl -X GET http://localhost:8000/debug/cache
```

**Response (Raw prompts are never stored or exposed):**
```json
{
  "total_entries": 1,
  "entries": [
    {
      "entry_id": "cache_a1b2c3d4",
      "response_preview": "Machine learning is a branch of artificial intelligence...",
      "embedding_dim": 3072,
      "created_at": "2026-09-11T21:10:00+00:00"
    }
  ]
}
```
