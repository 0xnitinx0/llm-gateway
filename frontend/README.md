# LLM Gateway — Developer Portal Frontend

A developer portal and observability dashboard for the **LLM Gateway** (`AWS-Deployed Intelligent LLM Gateway with Semantic Deduplication, Adaptive Prompt Compression, and Multi-Model Response Tournaments`).

This frontend is designed as a developer infrastructure product (similar in clarity to Vercel or Stripe), providing a unified developer interface where clients interact with **ONE endpoint**, while the Gateway handles model routing, caching, and compression transparently.

---

## Getting Started

### Prerequisites

* Node.js v18+ (tested on Node v20.17.0)
* npm v9+

### Installation & Development

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

4. Build for production:
   ```bash
   npm run build
   ```

---

## Environment Configuration

A template configuration is provided in `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

* **Vite Development Proxy (`vite.config.ts`):**
  To respect the requirement that backend files (FastAPI) remain untouched (no CORS middleware added), the frontend dev server transparently proxies all `/api/*` traffic to `http://127.0.0.1:8000/*`.
  * `/api/health` ➔ `http://127.0.0.1:8000/health`
  * `/api/v1/chat/completions` ➔ `http://127.0.0.1:8000/v1/chat/completions`

---

## Architecture: Live vs. Demo / Mock Telemetry

In strict adherence to truthful developer infrastructure reporting, the portal distinguishes live functionality from mock telemetry:

### 1. LIVE Backend Integration
* **Playground (`/playground`):**
  * Dispatches real HTTP `POST /v1/chat/completions` requests to the FastAPI backend.
  * Sends the custom authentication header `X-Gateway-API-Key`.
  * Passes payload format:
    ```json
    {
      "messages": [
        { "role": "user", "content": "<prompt>" }
      ]
    }
    ```
  * Parses the backend's custom response schema:
    ```json
    {
      "response": "..."
    }
    ```
  * Measures real client-observed round-trip latency via `performance.now()`.
  * Handles HTTP 401 (Invalid Key), HTTP 500 (Provider/Environment Error), and network timeouts with inline recovery alerts.
* **Health Check Indicator (Sidebar / Header / Settings):**
  * Continuously polls `GET /health` to verify if the FastAPI gateway is online.

### 2. DEMO / MOCK Observability
Because the current Phase 1 backend implements the proxy and Gemini driver without emitting telemetry, the advanced optimization sections display demo data:
* **Dashboard (`/dashboard`):**
  * KPI cards (Total Requests: 1,248, Cache Hit Rate: 67.4%, Tokens Saved: 42,180, Est. Savings: $12.84, Avg. Latency: 1.24s).
  * Request overview time-series chart (Mon–Sun).
  * Cache donut chart (842 hits vs 406 misses).
  * Recent activity table (Anonymized `REQ-A81F` identifiers; **no raw prompts are ever displayed or persisted**, preserving zero-exposure privacy).
* **Usage & Savings (`/usage`):**
  * Token comparison (60,240 tokens without gateway vs 42,180 with gateway).
  * Cost comparison ($38.40 vs $25.56, saving $12.84).
  * Optimization breakdown across deduplication ($7.33) and prompt compression ($5.51).
  * Adaptive prompt compression before/after preview (420 tokens ➔ 294 tokens, 30% reduction).
  * Autonomous response tournament pipeline preview (Candidate A, B, C evaluated by judge).
* **Semantic Cache (`/cache`):**
  * Cosine similarity distribution chart (0.90–1.00: 320, 0.80–0.90: 210, 0.75–0.80: 90, <0.75: 40).
  * Anonymized cache entry activity log (`ENTRY-8A21`, etc.).
* **API Keys (`/api-keys`):**
  * Multi-tenant mock key generation and revocation interface.
* **Settings (`/settings`):**
  * Live gateway health tester and simulated similarity threshold slider.

---

## Design System & UX Standards

* **Cohesive Theme:** Dark sidebar (`#0d131f`), crisp white cards with subtle borders (`border-slate-200/80`), neutral background (`#f8fafc`), and indigo accent (`#2563eb`).
* **Zero Model Selection:** The developer is never prompted to select a provider (OpenAI, Anthropic, Gemini) or model. The Gateway assumes full ownership of model routing and execution.
* **Privacy by Design:** Prompts are never stored in localStorage, never saved to browser history, and never logged to console.
