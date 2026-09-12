# Repository Guidelines

## Project Structure & Module Organization

The FastAPI entry point and request schemas live in `app/main.py`. Keep provider integrations in `providers/`, routing and gateway business logic in `services/`, persistence code in `database/`, and semantic caching in `cache/`. Backend tests belong in `tests/` and mirror behavior by feature, for example `tests/test_router.py`. The React/TypeScript dashboard is under `frontend/`; pages are in `frontend/src/pages`, reusable components in `frontend/src/components`, and API clients in `frontend/src/services`.

## Build, Test, and Development Commands

- `pip install -r requirements.txt` installs backend dependencies.
- `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload` runs the API locally with reload support.
- `pytest` runs the complete backend test suite; use `pytest tests/test_router.py -q` for a focused run.
- `docker compose up --build` starts the gateway and PostgreSQL together.
- `cd frontend && npm install` installs frontend dependencies.
- From `frontend/`, `npm run dev` starts Vite on port 5173, while `npm run build` type-checks and creates a production bundle.

## Coding Style & Naming Conventions

Use four-space indentation and type hints in Python. Name modules and functions with `snake_case`, classes with `PascalCase`, and constants with `UPPER_SNAKE_CASE`. In TypeScript, follow the existing two-space indentation, single quotes, `camelCase` variables, and `PascalCase` React components such as `DashboardPage.tsx`. Keep provider-specific behavior behind `LLMProvider`. No repository-wide formatter or linter is currently configured, so match nearby code and keep imports organized.

## Testing Guidelines

Tests use `pytest`, FastAPI's `TestClient`, and `unittest.mock`. Name files `test_*.py` and functions `test_<behavior>`. Mock external LLM calls, isolate database state with fixtures, and cover success, authentication, cache, routing, and provider-failure paths. There is no enforced coverage threshold; add regression tests for every behavior change. No frontend test runner is currently configured, so at minimum run `npm run build` for frontend changes.

## Commit & Pull Request Guidelines

History favors short, imperative summaries, sometimes using Conventional Commit prefixes (for example, `feat: add provider routing`). Keep commits focused. Pull requests should explain the behavior change, list validation commands, link relevant issues, and include screenshots for visible frontend changes.

## Security & Configuration

Store API keys and database credentials in ignored `.env` files. Never commit secrets, raw prompts, generated keys, or sensitive logs. Use placeholder values in documentation and tests.
