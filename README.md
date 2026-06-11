# NOSYOR.M.I — Money Intelligence
> *Your money, reflected.*

You glance at your balance and freeze. The number is smaller than it should be — and you have no idea why. There's a hole somewhere in the month, and you can't see it.

**NOSYOR.M.I reflects the holes you couldn't see.**

Upload a bank statement. The app reads it, categorizes every transaction, spots the spending that doesn't match your usual pattern, forecasts where next month is heading, auto-generates a warm Dashboard summary when you reflect on a statement, and lets you ask plain-English questions like *"Where did I overspend in March?"* — answers tied to the same charts you're looking at.

It doesn't shame you. It doesn't moralize. It reflects.

---

## What it does

- **CSV & bank statement ingestion** — drop in a file; the app parses Standard, Huntington, and Bank of America export formats automatically.
- **Automatic categorization** — every transaction sorted into 15 meaningful buckets (rule-based bypass + AI fallback) without manual tagging.
- **Anomaly detection** — Z-score analysis flags unusual spends at upload time.
- **Next-month forecasting** — weighted moving average projects spending by category.
- **Conversational chat interface** — ask questions in plain English (including month-specific queries like *"Where did I overspend in March?"*); the AI answers from your full statement context, streams the reply word-by-word (SSE), and updates live visualizations to match.
- **Multi-statement switching** — upload several statements and **Reflect** on any one; the active statement syncs across Dashboard, Transactions, and Chat via sessionStorage.
- **Transactions analysis view** — folder-tab Spending/Income switcher, date-range filter, donut chart with click-to-filter categories, coloured category pills, and a tab-aware summary sidebar.
- **Live data visualizations** — nine AI-triggerable chart types (pie, bar, drilldown, line, anomalies, forecast, stacked, horizontal, treemap, topN) driven by a structured `chartUpdate` contract.
- **Date-range analysis** — scope the Dashboard and Transactions page to all time, a single month, or a custom range; every figure re-computes for the period you pick.
- **AI Dashboard narration** — when you reflect on a statement, NOSYOR.M.I auto-generates a warm financial summary paragraph (NARRATION tier via OpenRouter); generated once per statement and cached in the database.

---

## Why it exists

Most people don't have a money problem. They have a **visibility** problem.

Statements are walls of numbers. Banking apps show balances but not patterns. Spreadsheets demand effort no one has the energy for at 11pm on a Tuesday.

NOSYOR.M.I exists for the moment after the shock — when you want clarity, not a lecture. It's built to behave like a calm financial therapist: it lays your money out in front of you, points to what's worth noticing, and answers the questions you actually want to ask.

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | .NET 10 Web API (Clean Architecture — 4 projects) |
| Frontend | React 19 + TypeScript (Vite) + Recharts + Urbanist |
| Database | PostgreSQL 16 + pgvector |
| AI Layer | OpenRouter (3-tier model routing) |
| Containers | Docker + Docker Compose |
| Deployment | Minikube (local Kubernetes) |
| Testing | xUnit (unit + integration) + Playwright (E2E) |

---

## Getting started

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org/) (LTS)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [OpenRouter API key](https://openrouter.ai/keys)
- PostgreSQL 16 with `pgvector` (Postgres.app for local dev, or use Docker below)

### 1. Clone and configure environment

```bash
git clone https://github.com/roysond/nosyormi.git
cd nosyormi
cp .env.example .env
```

Edit `.env` with your database connection string, `OPENROUTER_API_KEY`, and model variables. See `.env.example` for all required keys.

### 2. Run with Docker Compose (recommended)

```bash
docker compose --env-file .env.docker up -d
```

Wait ~30 seconds for Postgres health checks, then open **http://localhost:5173**.

| Service | URL / port |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:5034 |
| Postgres | localhost:5433 (user `nosyormi`, db `nosyormi`) |

Copy your real values into `.env.docker` (same keys as `.env`). Never commit `.env` or `.env.docker`.

**Secrets checklist**

| File | Purpose | On GitHub? |
|---|---|---|
| `.env` | Local API / EF | Never |
| `.env.docker` | Docker Compose API keys | Never |
| `k8s/secrets.yaml` | Your real K8s secret (local only) | Never |
| `.env.example`, `k8s/secrets.yaml.example` | Placeholders | Yes (safe) |

Before every push: `./scripts/check-secrets.sh`

### 3. Local development (without Docker for API/frontend)

**Database** — Postgres on port 5432 (Postgres.app) or 5433 (Docker postgres only):

```bash
cd backend
dotnet ef database update --project Nosyormi.Infrastructure --startup-project Nosyormi.Api
dotnet run --project Nosyormi.Api
```

API listens on **http://localhost:5034**.

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Vite dev server: **http://localhost:5173** (proxies or calls API per `VITE_API_BASE_URL`).

### 4. Run tests

```bash
# Backend unit + integration (22 tests)
cd backend && dotnet test

# E2E (app must be running on localhost:5173)
cd frontend && npx playwright test
```

Manual QA cases: see [QA-TEST-CASES.md](./docs/QA-TEST-CASES.md).

---

## Documentation

| Document | Purpose |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, four-layer model, decision log |
| [PROJECT-DOCUMENTATION.md](./PROJECT-DOCUMENTATION.md) | Capstone submission: sprint log, user stories, AI details |
| [DECISIONS.md](./DECISIONS.md) | Key product and technical decisions |
| [docs/QA-TEST-CASES.md](./docs/QA-TEST-CASES.md) | Manual test cases and results |
| [PROJECT-MEMORY.md](./PROJECT-MEMORY.md) | Session context anchor for development |
| [frontend/src/components/NosyormiLogo.tsx](./frontend/src/components/NosyormiLogo.tsx) | Brand logo (inline SVG — teal circle, gold N, coloured arcs) |
| [docs/diagrams/](./docs/diagrams/) | Six architectural PNG diagrams (system, AI flow, schema, API, deployment, user flow) |

---

## Known limitations (summary)

| Limitation | Detail |
|---|---|
| **Not query-time RAG** | Embeddings are stored at upload; chat injects the **full statement** as text context — no pgvector similarity search at chat time. |
| **~750 transaction ceiling** | Full-context chat is architecturally reliable for typical single-statement CSVs (≤ ~750 rows). Beyond that, query-time RAG is required. Not enforced in code. |
| **CSV only** | PDF ingestion deferred. |
| **Per-anomaly / forecast LLM narration** | Dashboard statement summary uses the NARRATION tier; per-anomaly explanations and forecast-specific narratives remain deferred. |
| **`MODEL_NARRATION` env var** | `NarrationService` is wired and active; model is hardcoded to `anthropic/claude-sonnet-4-5`. The env/k8s `MODEL_NARRATION` key is provisioned but not read yet. |
| **Chat streaming (implementation detail)** | OpenRouter streams to the API; the server parses full JSON, then streams the **parsed answer** word-by-word to the client (not raw model tokens). |
| **Chat history** | `sessionStorage` only — cleared on tab close. |

See [PROJECT-DOCUMENTATION.md §8](./PROJECT-DOCUMENTATION.md#8-known-issues--limitations) for the full list.

---

## Project status

**Submission-ready (app + docs + tests)** · AI Integration Capstone · Solo build  
**Target completion:** before 4 June 2026  
**Latest:** Transactions page parity (folder tabs, date-range filter, donut chart, coloured category pills, tab-aware summary sidebar); Dashboard folder-tab Spending/Income switcher; hysteresis sticky header on Transactions  
**Docs last updated:** 10 June 2026  
**Remaining submission artifacts:** PowerPoint deck · product demo video (3–5 min)

See the [project board](https://github.com/users/roysond/projects/2) for live progress.

---

## The name

**NOSYOR.M.I** reads as a name on its own — but held up to a mirror, it reveals: *I.M. ROYSON*.

It's a small piece of the same idea that runs through the product. Hold something at the right angle, and what's hidden reveals itself.

---

## Author

**Royson D'Souza**  
Built as part of the AI Integration Capstone Program · 2026

---

*Documentation last updated: 10 June 2026 — Transactions page UI parity (folder tabs, date filter, donut, category pills), Dashboard folder-tab switcher.*

## License

NOSYOR.M.I is licensed under the **PolyForm Noncommercial License 1.0.0**.

You're welcome to read, run, modify, and learn from this project for **personal, educational, research, and other noncommercial use**. Commercial use of any kind requires a separate license — please reach out.

See [LICENSE](./LICENSE) for the full terms.
