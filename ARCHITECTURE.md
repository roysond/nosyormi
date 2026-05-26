# NOSYOR.M.I — System Architecture

> *Money Intelligence. Your money, reflected.*

This document is the architectural source of truth for NOSYOR.M.I. It describes how the system is organized, why those organizational choices were made, and what principles every line of code is expected to honor. When a decision needs to be made — a new feature designed, a refactor proposed, a tool considered — it is checked against this document.

The document is intentionally written as a **living blueprint**. Sections are added as the architecture they describe is built. What is documented here is committed to; what is not yet documented is not yet binding.

---

## 1. Purpose & Philosophy

NOSYOR.M.I is not an AI app. It is a **finance engine with an AI conversation layer on top.**

That distinction matters. Most student AI projects collapse the entire system into a single LLM and route every user interaction through it. NOSYOR.M.I deliberately resists that pattern. The system is designed so that the parts that must be exact — totals, forecasts, anomaly thresholds — are exact; and the parts that benefit from natural language — explanations, conversation, narrative — are conversational. Each kind of work is given to the tool best suited to it.

The architecture is guided by three principles:

**1. Determinism over probability for numerical work.**
Where there is a single correct answer, deterministic code or statistical models produce it. LLMs are not used as calculators, forecasters, or anomaly detectors.

**2. The right tool for the right job.**
Different problems call for different tools. CSV parsing is a library problem. Forecasting is a statistical problem. Semantic search is an embedding problem. Conversation is an LLM problem. The architecture matches the tool to the problem, not the other way around.

**3. Cost-conscious model routing.**
Where LLMs are used, the cheapest model that can do the job well is used. Premium models are reserved for the moments where reasoning genuinely matters. This is enforced through a tiered model configuration (see Section 3).

These principles are non-negotiable. If a future feature appears to require violating one of them, the feature is redesigned, not the principle.

---

## 2. The Four-Layer Architecture

NOSYOR.M.I is organized into four layers. Each layer handles a distinct kind of work, with a distinct kind of tool. Higher layers build on lower layers; lower layers are independent of higher ones.

### Layer 1 — Deterministic Layer

**Purpose:** All the work that has exactly one correct answer.

This is the foundation of the entire system. It is the largest layer by code volume and the most reliable layer by behavior. It handles file ingestion (CSV and PDF parsing), data validation, database reads and writes, API request/response handling, authentication boundaries, and all user interface rendering.

Layer 1 uses no AI of any kind. Every function in this layer, given the same input, produces the same output every time. This is what allows the rest of the system to be trustworthy.

**Technologies:** .NET 10 Web API, Entity Framework Core, CsvHelper, PdfPig, React, TypeScript, Recharts.

### Layer 2 — Statistical Layer

**Purpose:** Numerical analysis with mathematically-defined answers.

This layer handles all analysis that produces numbers. It detects anomalies through statistical methods (Z-score, interquartile range, rolling averages). It forecasts future spending through time-series models. It calculates trends, identifies recurring transactions, and produces the structured data that Layer 4 will later narrate.

Like Layer 1, Layer 2 uses no LLMs. Its outputs are numerical and explainable — every anomaly comes with a quantitative justification, every forecast comes with a confidence interval. This makes the system auditable: a user can always ask "why?" and receive a mathematical answer, not a probabilistic guess.

**Technologies:** ML.NET (time-series forecasting, anomaly detection), C# math primitives.

### Layer 3 — Semantic Layer

**Purpose:** Understanding meaning and similarity in unstructured text.

Transaction descriptions on a bank statement are messy. "AMZN MKTPLACE 7/14 SEATTLE" and "AMAZON RETAIL PURCHASE" refer to the same thing, but a database doesn't know that. The Semantic Layer solves this by converting text into numerical vectors (embeddings) that capture meaning. Similar transactions land near each other in vector space; dissimilar ones land far apart.

This layer powers semantic search ("find transactions like this one"), retrieval for the chat interface ("pull the relevant transactions before the LLM answers a question"), and assists categorization where rule-based matching falls short.

The Semantic Layer is *not* an LLM. Embedding models are a separate kind of AI — they measure meaning, they do not generate text.

**Technologies:** OpenRouter embedding API (`openai/text-embedding-3-small`, 1536 dimensions), PostgreSQL with the `pgvector` extension.

### Layer 4 — Reasoning Layer

**Purpose:** Natural-language understanding, narration, and conversation.

This is where the system speaks. Layer 4 takes the structured outputs of Layers 1–3 — totals, anomalies, forecasts, retrieved transactions — and translates them into language a person can read. It answers user questions in the chat interface. It generates summaries and explanations. It interprets ambiguous user intent and decides what to query the lower layers for.

Layer 4 does not compute, forecast, or detect on its own. It reasons over what the other layers have already produced. This separation is what allows NOSYOR.M.I to give answers that are both mathematically grounded and conversationally natural.

**Technologies:** OpenRouter LLM API, with model routing across three tiers (see Section 3).

### How the Layers Interact

```mermaid
flowchart TD
    User([User]) --> Frontend[React Frontend<br/>Layer 1]
    Frontend --> API[.NET 10 API<br/>Layer 1]
    API --> Reasoning[Layer 4: Reasoning<br/>LLM Narration & Chat]
    Reasoning --> Semantic[Layer 3: Semantic<br/>Embeddings & Retrieval]
    Semantic --> Statistical[Layer 2: Statistical<br/>Forecasting & Anomalies]
    Statistical --> Deterministic[Layer 1: Deterministic<br/>Parsing & Persistence]
    Deterministic --> DB[(PostgreSQL<br/>+ pgvector)]

    style Reasoning fill:#5a4fcf,stroke:#fff,color:#fff
    style Semantic fill:#3d8bbd,stroke:#fff,color:#fff
    style Statistical fill:#2d8659,stroke:#fff,color:#fff
    style Deterministic fill:#8a6d3b,stroke:#fff,color:#fff
```

A user request enters at the top through the React frontend, travels down through the API, and descends through whichever layers are needed to fulfill it. Most requests don't touch all four layers — a simple "show me my transactions" stops at Layer 1. A request like *"why was March expensive?"* descends through all four. This layered descent is the mental model the rest of the codebase will mirror.

---

## 3. The Tool & Model Matrix

Different features call for different tools. The matrix below documents which tool handles which feature, and at which layer.

### Feature-to-Tool Mapping

| Feature | Primary Layer | Tool | AI? |
|---|---|---|---|
| CSV ingestion | Layer 1 | CsvHelper (.NET) | No |
| PDF ingestion | Layer 1 | PdfPig (.NET) | No |
| Data persistence | Layer 1 | EF Core + PostgreSQL | No |
| Transaction storage | Layer 1 | EF Core entities | No |
| Rule-based categorization | Layer 1 | C# rules engine | No |
| AI-assisted categorization (fallback) | Layer 4 | LLM (light tier) | Yes |
| Semantic similarity search | Layer 3 | pgvector + embeddings | Yes (embeddings) |
| Anomaly detection | Layer 2 | ML.NET / statistical methods | No |
| Time-series forecasting | Layer 2 | ML.NET SSA forecaster | No |
| Anomaly explanation | Layer 4 | LLM (narration tier) | Yes |
| Forecast narration | Layer 4 | LLM (narration tier) | Yes |
| Conversational chat | Layer 4 | LLM (chat tier) | Yes |
| Chat-triggered visualization updates | Layers 1 + 4 | Structured JSON contract | Yes (LLM produces JSON) |

The pattern is consistent: numerical and structural work happens below Layer 4. Layer 4 narrates and converses on top of what the lower layers produce.

### Multi-Model Routing Strategy

When LLM work is required, the system routes between three model tiers. This routing is configured in `.env` and used throughout the codebase by role, not by specific model name.

| Tier | Role | Used For | Optimization |
|---|---|---|---|
| **LIGHT** | High-volume, low-complexity tasks | Categorization fallback, simple labeling, structured tagging | Cost & latency |
| **NARRATION** | Mid-complexity explanation tasks | Anomaly explanations, forecast summaries, monthly narratives | Balance of cost and quality |
| **CHAT** | Premium reasoning tasks | Conversational interface, multi-step reasoning, tool-using agentic flows | Quality |

The roles are decoupled from specific models. The configuration in `.env.example` provides recommended models for each tier (`openai/gpt-4o-mini` for LIGHT and NARRATION, `openai/gpt-4o` for CHAT at the time of writing), but the architecture treats these as swappable. The canonical source of truth for which model is in use is `.env.example`; any change to the model assignment is reflected there first.

This routing approach exists for two reasons. The first is cost: routing every request to a premium model would burn through OpenRouter credits during development and produce a poor cost profile if the application ever scaled. The second is latency: cheaper models respond faster, and for high-volume tasks like categorization, the speed difference is felt by the user.

### Embeddings: A Single Model, Used Consistently

Unlike LLMs, embeddings use a single model across the entire system. This is not a stylistic choice — it is a correctness requirement. Embeddings from different models are not comparable to each other; switching the embedding model after data has been embedded would require re-embedding the entire dataset. The model is therefore fixed early and changed deliberately, with a full re-embedding cycle if it is ever changed.

The selected model is `openai/text-embedding-3-small`, producing 1536-dimensional vectors. The rationale: financial transaction descriptions are short, repetitive, and semantically compact. Larger embedding dimensions (3072 or 4096) offer no meaningful retrieval improvement for this kind of text while adding storage cost, query latency, and indexing overhead.

---

## 6. Clean Code + SOLID Commitment

NOSYOR.M.I is built under explicit commitments to Clean Code and SOLID principles. These are not aspirational tags — they are enforced through architectural choices documented elsewhere in this file. This section captures the principles themselves and the pragmatic tradeoffs that have been made.

### The Commitments

**Single Responsibility (SRP).** Every class has one clear purpose. Controllers handle HTTP only. Services handle business logic. Repositories handle data access. Entities are pure data shapes. When a class begins to take on a second responsibility, it is split.

**Open/Closed (OCP).** New behavior is added by extending existing structures rather than modifying them. New transaction categories, new AI models, and new data sources are accommodated by adding new implementations behind existing interfaces — not by editing core code.

**Liskov Substitution (LSP).** Any class implementing an interface must be fully substitutable for any other implementation of that interface. The CSV parser today is `CsvStatementParser`; tomorrow it could be a PDF parser, and the rest of the system would not notice.

**Interface Segregation (ISP).** Interfaces are kept narrow and purpose-built. There is no `IEverythingService`. Each interface defines exactly what its callers need.

**Dependency Inversion (DIP).** High-level code depends on abstractions, never on concrete implementations. The upload service depends on `ICsvStatementParser`, not on `CsvHelper` directly. This is what makes the codebase testable and the layered architecture enforceable.

### The Pragmatic Tradeoff

Pure Clean Architecture mandates that the Application layer has zero dependencies on framework code. In NOSYOR.M.I, the Application layer references `Microsoft.EntityFrameworkCore` so that services can directly interact with the `DbContext`.

This is a deliberate tradeoff. The textbook-pure alternative (repository pattern with custom interfaces wrapping every DB call) adds 2-3 files per feature and slows development meaningfully. For a 3-week project with a single developer, the cost-benefit favors pragmatism over purity.

**The principle still holds where it matters most:** business logic does not call EF Core directly in patterns that would be hard to test. When testability becomes a concrete requirement (e.g., when unit testing the orchestrators), the repository pattern will be introduced selectively at that boundary.

### The Cursor Architectural Directive

Every significant Cursor coding session begins with the following directive, ensuring generated code aligns with these principles:

> *"Build this following Clean Code principles and SOLID design. Specifically: Single Responsibility — each class/component should have one clear purpose. Use dependency injection for all services; never instantiate dependencies directly inside a class. Separate concerns: Controllers handle HTTP only, Services handle business logic, Repositories handle data access, Models are pure data structures. Favor interfaces over concrete implementations for any service injected elsewhere. Keep methods focused (ideally under 20 lines) and named so they explain themselves. No magic strings or magic numbers — use constants or enums. Throw meaningful exceptions with context; don't swallow errors silently. Write code that a junior developer could read without comments — and where comments are needed, explain WHY, not WHAT."*

## 7. Folder Structure

This section documents the concrete folder layout of the NOSYOR.M.I codebase, mapping each location to the architectural layer it represents.

### Repository Root

```
nosyormi/
├── backend/                     # .NET 10 Web API
├── frontend/                    # React + TypeScript (Vite)
├── sample-data/                 # Test CSVs and fixture data
├── ARCHITECTURE.md              # This document
├── README.md                    # Public-facing project description
├── LICENSE                      # PolyForm Noncommercial 1.0.0
├── .env                         # Local secrets (gitignored)
├── .env.example                 # Template for environment variables
└── .gitignore                   # Excludes secrets, builds, node_modules
```

### Backend — `/backend`

The backend is organized as a single .NET solution (`Nosyormi.slnx`) containing four projects that enforce the four-layer architecture described in Section 2.

```
backend/
├── Nosyormi.slnx                # Solution file (.slnx — .NET 10 default)
├── Nosyormi.Domain/             # Layer 1 (innermost): pure entities
│   └── Entities/
│       ├── Statement.cs
│       ├── Transaction.cs
│       └── Category.cs
├── Nosyormi.Application/        # Layer 1-4 business logic & contracts
│   ├── Csv/
│   │   ├── ICsvStatementParser.cs
│   │   └── ParsedTransactionRow.cs
│   └── Statements/
│       ├── StatementUploadService.cs
│       └── StatementQueryService.cs
├── Nosyormi.Infrastructure/     # External dependencies & implementations
│   ├── Migrations/              # EF Core migration history
│   ├── Parsing/
│   │   └── CsvStatementParser.cs
│   └── Persistence/
│       └── NosyormiDbContext.cs
└── Nosyormi.Api/                # Outermost: HTTP & composition root
    ├── Controllers/
    │   └── StatementsController.cs
    ├── Program.cs               # Service registration, middleware pipeline
    ├── appsettings.json         # Default configuration (no secrets)
    └── Nosyormi.Api.http        # Local request-testing fixtures
```

**Dependency direction (sacred):**

```
Api ──→ Application ──→ Domain
            ↑
Infrastructure
```

This direction is enforced by .NET project references. Domain depends on nothing. Application depends only on Domain. Infrastructure depends on Application (which transitively gives it Domain). Api depends on Application and Infrastructure — the latter exclusively so that the Composition Root in `Program.cs` can wire concrete implementations to their interfaces.

### Frontend — `/frontend`

The frontend is a Vite-scaffolded React + TypeScript single-page application. It is intentionally lightweight at this stage and will grow as design and feature work progresses.

```
frontend/
├── src/
│   ├── App.tsx                  # Top-level component
│   ├── App.css                  # Component-scoped styling
│   ├── main.tsx                 # Entry point — mounts <App /> to #root
│   ├── index.css                # Global resets and base styles
│   └── assets/                  # Static assets bundled by Vite
├── public/                      # Static files served at root path
├── index.html                   # Single HTML shell — Vite injects scripts
├── package.json                 # Dependency manifest
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite build configuration
└── .gitignore                   # Frontend-specific exclusions
```

The frontend communicates with the backend exclusively via HTTP, calling endpoints under `http://localhost:5034/api/*`. CORS is enabled on the backend specifically for the frontend's origin (configured via `FRONTEND_ORIGIN` in `.env`).

### Test Data — `/sample-data`

Holds CSV files used for development and manual testing of the upload pipeline. Not committed to production; pure development fixtures.

---

## 9. Decision Log

A running record of significant architectural and product decisions, with rationale. This log is maintained incrementally throughout the project. Each entry captures *what* was decided, *why*, and the *context* at the time — so future-Royson (or any reviewer) understands the reasoning, not just the outcome.

### 2026-05-11 — Brand and Identity

### 2026-05-11 — Brand and Identity

- **Product name:** NOSYOR.M.I — chosen for the embedded reversal (`I.M. ROYSON`) and as a brand-first identity rather than a feature description. Pronounced as a single word.
- **Product descriptor:** **Money Intelligence**. The `M.I.` carries dual meaning — forward reads as the product category (Money Intelligence, in the spirit of "AI" or "BI"); backward, the letters complete the `I.M. ROYSON` reveal. A single abbreviation doing two jobs.
- **Tagline:** *Your money, reflected.* Three words. The word "reflected" carries the mirror metaphor without naming it — visual reflection (charts), data representation (insight), and contemplation (user behavior) at once.
- **Code namespace:** `Nosyormi` (no dots, PascalCase) — separates brand-facing presentation from compiler-facing identifiers.

### 2026-05-11 — License

- **Chosen:** PolyForm Noncommercial 1.0.0
- **Rationale:** Preserves future commercial rights without sacrificing reviewability. Reviewers, recruiters, and students may freely run and learn from the code. Commercial use requires a separate license. Less restrictive than fully proprietary, more protective than MIT for a project that may become a business.

### 2026-05-12 — Stack Decisions

- **Backend:** .NET 10 Web API (mandated by capstone).
- **Frontend:** React + TypeScript via Vite (over Create React App for speed and modern tooling).
- **Database:** PostgreSQL 16 with `pgvector` 0.8.1 extension.
- **AI Provider:** OpenRouter (single API, multiple model providers — enables multi-model routing).
- **Architecture pattern:** Clean Architecture with four projects (Domain, Application, Infrastructure, Api).

### 2026-05-12 — Multi-Model Routing Over Single-LLM

Adopted a three-tier model routing strategy (`MODEL_LIGHT`, `MODEL_NARRATION`, `MODEL_CHAT`) rather than routing all AI calls through a single model. Rationale: cost discipline, latency optimization, and right-tool-for-the-job alignment with the four-layer architecture. Documented fully in Section 3.

### 2026-05-12 — Embeddings: Single Model, Fixed Dimensions

- **Model:** `openai/text-embedding-3-small`
- **Dimensions:** 1536
- **Rationale:** Embeddings from different models are not comparable; changing the model post-data requires full re-embedding. Selected dimension is the documented sweet spot for short, repetitive financial text — larger dimensions offer no meaningful retrieval gain at this scale.

### 2026-05-12 — Orchestrator Pattern (per Hannan)

When multiple APIs (OpenRouter LIGHT, NARRATION, CHAT, embeddings, statistical models) are involved, a centralized orchestrator owns coordination, retries, fallbacks, and logging. Controllers and services never call external APIs directly — they call orchestrators. To be implemented as `IAIOrchestrator` and `IAnalysisOrchestrator` in the Application layer when AI integration begins.

### 2026-05-12 — Database Stays Outside the Pod (per Hannan)

In production/Minikube deployment, PostgreSQL runs as its own Docker container, *not* as a Kubernetes pod. Rationale: data persistence must not depend on disposable pod lifecycles. Application pods may be recreated; the database remains stable in its own container.

### 2026-05-13 — Local Dev: Postgres.app, Not Docker

For local development, PostgreSQL runs via Postgres.app (already installed with `pgvector` 0.8.1 enabled). Docker deferred to Week 3 deployment phase. Rationale: existing tooling familiarity, faster start, no `pgvector` install friction. Migration risk mitigated by discipline rules: all config in `.env`, all schema via EF Core migrations, identical Postgres major version in deployment, mid-project dry-run deployment scheduled.

### 2026-05-13 — Solution File Format

Solution generated as `.slnx` (XML) rather than legacy `.sln`. Rationale: .NET 10's new default. Cleaner format, fewer Git merge conflicts, better long-term maintainability.

### 2026-05-14 — EF Core in Application Layer (Pragmatic Tradeoff)

Application layer references `Microsoft.EntityFrameworkCore` directly, rather than abstracting all data access behind repository interfaces. Rationale: pure Clean Architecture would add 2-3 files per feature for marginal architectural benefit at a 3-week capstone timeline. The repository pattern will be introduced selectively when testability becomes a concrete need (e.g., orchestrator unit tests). Documented in Section 6.

### 2026-05-15 — Chat Guardrails via System Prompts

The conversational chat interface (`MODEL_CHAT`) will be strictly scoped via a guardrailed system prompt. The chat answers only questions related to the user's uploaded bank statements and financial behavior visible therein. Off-topic queries are deflected gracefully, without preaching. Rationale: brand integrity, cost control, and user trust. Each model tier (`MODEL_LIGHT`, `MODEL_NARRATION`, `MODEL_CHAT`) will receive its own purpose-built system prompt. To be documented in detail in Section 5 when the chat-to-visualization bridge is designed.

### 2026-05-15 — CORS for Frontend ↔ Backend

Backend exposes CORS policy `AllowFrontend`, scoped to the origin in `FRONTEND_ORIGIN` (`http://localhost:5173` for local dev). Rationale: standard fullstack pattern — browser security blocks cross-origin requests by default; the backend must explicitly trust the frontend's origin.

### 2026-05-20 — Multi-Statement Architecture Refactor

- **Decision:** Shifted from a single hardcoded statement ID to a 
  dynamic multi-statement model. The Dashboard, Transactions, and Chat 
  pages now call `GET /api/statements` on mount, take the most recently 
  uploaded statement, and load it dynamically.
- **Rationale:** The hardcoded UUID (`STATEMENT_ID` constant) was a 
  development shortcut that broke the stated product purpose. Forecasting 
  and anomaly detection are only meaningful over accumulated data. A 
  single hardcoded statement ID made the app unable to reflect new 
  uploads without redeploying. The refactor closes that gap and enables 
  genuine multi-statement accumulation.
- **What changed:** `DashboardPage`, `TransactionsPage`, and `ChatPage` 
  all remove their `STATEMENT_ID` constants. All three call 
  `GET /api/statements` first, then load the first (most recent) result.

### 2026-05-20 — Statements Management Page

- **Decision:** Added a dedicated `StatementsPage` at `/statements` for 
  statement provenance and management. Upload, list, view details, and 
  delete all live here. The Dashboard is now a pure analysis view.
- **Rationale:** The Dashboard was violating SRP — it was simultaneously 
  an analysis view and a file management view. Separating concerns gives 
  each page one job: Dashboard = analysis, Statements = management.
- **Upload moved from Dashboard to Statements:** The `+ Upload Statement` 
  button and modal were removed from `DashboardPage` and relocated to 
  `StatementsPage`. This is the architecturally correct home for an action 
  that creates a new resource.

### 2026-05-20 — Statement Uniqueness via SHA-256 Hash

- **Decision:** Statements are deduplicated by SHA-256 hash of the 
  uploaded file bytes. A unique index on `Statement.FileHash` enforces 
  this at the database level. Duplicate uploads return `409 Conflict`.
- **Rationale:** Silent duplicate ingestion would double-count 
  transactions and corrupt forecasting, anomaly baselines, and spending 
  totals. The hash check is cheap, deterministic, and catches accidental 
  re-uploads before any AI processing runs.
- **Implementation:** Hash computed in `StatementUploadService` before 
  CSV parsing. The stream is read into a `MemoryStream` first (to allow 
  both hashing and re-reading for parsing). Migration 
  `20260521031445_AddFileHashToStatement` adds the column and index.

### 2026-05-20 — Hard Delete with Cascade

- **Decision:** Deleting a statement hard-deletes the row and all child 
  transactions via EF Core cascade delete. Embeddings are deleted 
  automatically as they live on the `Transaction` row.
- **Rationale:** Soft delete adds schema complexity and query overhead 
  for no benefit at this stage. A personal finance app where the user 
  manages their own data does not need an audit trail or undo capability 
  in the MVP. Soft delete is noted as a future consideration.
- **Confirmation UX:** A modal displays the filename and transaction 
  count before deletion. The delete button shows "Deleting..." while in 
  flight. This prevents accidental data loss without adding friction for 
  intentional deletes.

### 2026-05-20 — StatementQueryService Moved to Infrastructure

- **Decision:** `StatementQueryService` was moved from 
  `Nosyormi.Application` to `Nosyormi.Infrastructure`. An 
  `IStatementQueryService` interface was created in Application as its 
  contract. The `DeleteAsync` method was added to both.
- **Rationale:** The original placement was a Clean Architecture 
  violation — the class directly injected `DbContext`, an Infrastructure 
  concern, into the Application layer. The fix aligns with the Dependency 
  Inversion Principle: Application defines the interface, Infrastructure 
  provides the implementation.

### 2026-05-20 — Multi-Bank Support Deferred to Post-MVP

- **Decision:** Multi-bank filtering (per-bank statement grouping, bank 
  selector in sidebar) was scoped out of the capstone build.
- **Rationale:** The analytical core — categorization, anomaly detection, 
  forecasting, chat — is bank-agnostic. Multi-bank adds a filter 
  dimension to every page and a piece of app-wide state, both worth 
  building properly rather than rushing. The architecture supports it 
  cleanly: add `BankName` (string) to `Statement`, capture at upload, 
  add optional `?bank=` query parameter to aggregate endpoints, add a 
  selector in the sidebar header.

### 2026-05-21 — Full Test Suite (46 Tests)

- **Decision:** Complete test coverage across four levels before deployment.
- **Unit tests (16):** ZScoreAnomalyDetector (5), MovingAverageForecastingService (5), CsvStatementParser (6)
- **Integration tests (6):** StatementsController API layer
- **QA manual test cases (18):** TC-01 to TC-18 documented in `QA-TEST-CASES.md`
- **E2E tests (6):** Playwright critical path spec (`frontend/e2e/critical-path.spec.ts`)
- **Result:** 46 tests, all passing. Test reports committed to repo.

### 2026-05-21 — Docker Containerization + Minikube Deployment

- **Decision:** Three Docker containers (postgres, api, frontend) orchestrated via Docker Compose for local dev. Minikube used as the Kubernetes deployment target for submission.
- **nginx proxy:** Frontend nginx container proxies `/api` → `http://nosyormi-api:5034` using Kubernetes internal DNS. This means zero hardcoded API URLs in the frontend bundle — the proxy handles routing transparently.
- **Postgres outside the cluster:** PostgreSQL runs in Docker Compose, not as a Kubernetes pod. Consistent with the May 12 decision — database persistence must not depend on disposable pod lifecycles.
- **Startup sequence for Minikube demo:**
  1. `minikube start`
  2. `docker compose --env-file .env.docker up -d postgres`
  3. `minikube service nosyormi-frontend --url`
- **Critical fix:** `EMBEDDING_MODEL` was missing from `.env.docker`, causing 500 errors on first upload. Fixed by adding the variable to `.env.docker`.
- **K8s manifests:** `k8s/api-deployment.yaml`, `k8s/frontend-deployment.yaml`, `k8s/configmap.yaml`. `k8s/secrets.yaml` is gitignored — contains real API keys, applied to cluster manually via `kubectl apply`.

### 2026-05-21 — Multi-Bank CSV Support

- **Decision:** Extended `CsvStatementParser` to detect and handle three distinct CSV formats without user intervention.
- **Formats supported:**
  - Standard: `Date, Description, Amount` — direct mapping
  - Huntington: `Payee Name` + `Memo` columns combined into description
  - Bank of America: 6-row preamble before real header — parser scans for header row, skips empty date rows, ignores `Running Bal.` column
- **Rationale:** Real bank statement testing revealed that Huntington categorized everything as "Other" (description parsing bug) and BOA failed entirely (preamble rows). Multi-bank support is essential for real-world usefulness.

### 2026-05-22 — Chat Robustness Fixes

- **sessionStorage persistence:** Chat message history, chart state, statementId, and statementFileName all stored in sessionStorage. Survives page navigation within the session but not browser/tab close (intentional — no DB persistence for chat history).
- **Conversation context fix:** Full history array now correctly sent to the API on every message, enabling multi-turn coherent responses.
- **Anomaly panel data source:** Fixed to read from the database ground truth (Z-score results), not from AI conversational context.
- **Custom event pattern:** `nosyormi-statement-deleted` custom DOM event triggers automatic chat clear when a statement is deleted from the Statements page. Decouples the Statements page from the Chat page without prop drilling or global state.
- **Clear chat button:** Shown in chat header when `messages.length > 0`. Resets sessionStorage and chat state.

### 2026-05-25 — UI Redesign (Deep Forest + Honey Amber Palette)

- **Decision:** Complete UI palette overhaul from the original light theme to a premium dark-sidebar / tinted-background design.
- **Palette:**
  - Sidebar background: `#071A1E` (deep forest, solid)
  - Main content background: `#CCE8EC` (darkened forest tint)
  - Card surfaces: `#FBF8F2` (champagne)
  - Active nav text: `#E8C96A` (gold glow)
  - Active nav icon: `#34D399` (emerald light glow)
  - Active nav border: `transparent` (glow does the work)
  - UI accent: `#C9911A` (honey amber — buttons, tabs, pills, focus borders)
  - Data/chart color: `#00637C` (crystal teal — unchanged, functional)
- **Typography:** Inter (Google Fonts) applied globally via `index.css`
- **Collapsible sidebar:** Animates between 220px (expanded) and 64px (collapsed). Brand name, StatementPill, and version text hide when collapsed. Toggle button (`‹`/`›`) on sidebar edge.
- **Hover tooltips:** Label pill fades in from the right with slide animation when sidebar is collapsed.
- **Icons:** Replaced emoji nav icons with `@tabler/icons-react` — enables CSS `filter: drop-shadow` for the emerald glow effect on active icons.
- **Rationale:** The original Crystal Teal accent (`#00637C`) became invisible against the new `#CCE8EC` background (same hue family). Honey Amber creates genuine warm-cool tension against the forest tint. The collapsible sidebar matches industry-standard dashboard UX patterns.

---

## Sections Still To Be Added

As the corresponding parts of the system are built, the following sections will be written:

- **Section 4 — Database Schema Design** *(to be added when more entities are designed; current entities documented in Section 7)*
- **Section 5 — The Chat-to-Visualization Bridge** *(to be added before the chat feature is implemented — will also include full system-prompt strategy for all model tiers)*
- **Section 8 — Configuration & Environment** *(to be added when AI integration begins, since the configuration model will expand significantly then)*
- **Section 10 — Out-of-Scope** *(to be added at end of Week 1)*
- **Section 11 — Future Considerations** *(to be added at end of project)*

---

*Last updated: Wednesday, May 20, 2026 — Multi-statement refactor, 
Statements management page, SHA-256 deduplication, cascade delete, 
architectural fixes.*