# LLM Gateway

An Intelligent API Gateway for LLM Providers.

The gateway acts as a unified abstraction over LLM providers. Developers use one Gateway API Key and submit standard prompt message objects without managing provider API keys or model names directly.

## Project Structure

```
llm-gateway
│
├── app
│   ├── __init__.py
│   └── main.py
│
├── providers
│   ├── __init__.py
│   ├── base.py
│   └── gemini_provider.py
│
├── tests
│   ├── __init__.py
│   └── test_gateway.py
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

**Response:**
```json
{
  "response": "Machine learning is a field of computer science..."
}
```
