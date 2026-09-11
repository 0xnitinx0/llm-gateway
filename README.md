# LLM Gateway

A unified API Gateway for LLM providers.

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
│   └── base.py
│
├── tests
│   └── __init__.py
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
- Virtual Environment (recommended)

### Installation

1. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On macOS/Linux
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment variables in `.env`:
   ```bash
   cp .env.example .env  # or edit .env directly
   ```

4. Run the development server:
   ```bash
   uvicorn app.main:app --reload
   ```

5. Access the API documentation at `http://localhost:8000/docs`.
