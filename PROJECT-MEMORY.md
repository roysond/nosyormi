# PROJECT-MEMORY.md
> Claude's context anchor for NOSYOR.M.I. Read this at the start of every session.
> Last updated: Friday, 22 May 2026

---

## 1. PROJECT IDENTITY

**Name:** NOSYOR.M.I  
**Expansion:** Money Intelligence  
**Hidden reveal:** Read backwards = I.M.ROYSON ("I'm Royson")  
**Tagline:** *Your money, reflected.*  
**Brand metaphor:** A mirror held at the right angle  
**Student:** Royson D'Souza  
**Background:** No IT/coding background — learning while building  
**Hardware:** MacBook Air M3, 8GB RAM  
**Tools:** Cursor IDE (Agent mode, Cmd+I), GitHub Desktop, Postgres.app, DBeaver  
**Repo:** `github.com/roysond/nosyormi` (private)  
**Deadline:** Before 4 June 2026 (late penalties: 1 June minor, 2 June moderate, 3 June heavy, 4 June not accepted)

---

## 2. CAPSTONE BRIEF (Project 11 — FinSight)

Upload bank statements or CSVs. The app categorizes spending, detects anomalies, forecasts next month, and has a chat interface for questions like "Where did I overspend in March?" — AI narrative connected to live data visualizations.

**Required features:** CSV Parsing · Time-Series · Anomaly Detection · Data Visualization  
**Stack required:** .NET 10 + React + OpenRouter + Docker + Cloud/Minikube  
**Submission includes:** Working app + deployed URL + PowerPoint deck + project documentation + 6 architectural diagrams + demo video (3-5 min) + test results + QA report  
**Trainer:** Hannan  
**Key Hannan quote on orchestration:** "One person sitting in the middle, responsible for moving everyone in the right direction. Have that mentality between your APIs."

---

## 3. TECHNICAL STACK

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite + react-router-dom + Recharts |
| Backend | .NET 10 Web API — Clean Architecture (4 projects) |
| Database | PostgreSQL 16 + pgvector (vector embeddings for RAG) |
| AI | OpenRouter — 3-tier model routing |
| Embeddings | `openai/text-embedding-3-small` via OpenRouter |
| Containerization | Docker Compose (local dev) + Minikube (submission deployment) |
| Testing | xUnit (unit + integration) + Playwright (E2E) |

**Three-tier AI model routing:**
- `MODEL_LIGHT` = `openai/gpt-4o-mini` — CSV categorization (cheap, fast, per-transaction)
- `MODEL_NARRATION` = `anthropic/claude-sonnet-4-5` — narrative generation
- `MODEL_CHAT` = `anthropic/claude-sonnet-4-5` — chat/RAG responses
- `EMBEDDING_MODEL` = `openai/text-embedding-3-small` — vector embeddings

---

## 4. CLEAN ARCHITECTURE — 4 LAYERS

```
Nosyormi.Domain          — Entities: Statement, Transaction, Category. No external deps.
Nosyormi.Application     — Interfaces + services: IStatementQueryService, StatementUploadService, ICsvStatementParser, IAnomalyDetector, IForecastingService, IChatService
Nosyormi.Infrastructure  — Implementations: DbContext, parsers, classifiers, embeddings, anomaly, forecasting, StatementQueryService
Nosyormi.Api             — Controllers: StatementsController, ForecastController, TimeSeriesController, ChatController. Program.cs.
```

**Known technical debt:** `StatementUploadService` is in Application but still injects `DbContext` directly. Accepted and documented.

---

## 5. AI PIPELINE (Orchestration)

The .NET API is the **orchestrator** — all browser requests go through it, and it coordinates all downstream services. This is what Hannan specifically asked for.

**Upload pipeline (per CSV):**
1. SHA-256 hash → duplicate check → reject 409 if exists
2. CSV parsed → `ParsedTransactionRow[]`
3. Each transaction → `MODEL_LIGHT` (OpenRouter) → category assigned
4. Each transaction → `openai/text-embedding-3-small` → vector embedding stored in pgvector
5. All transactions → `ZScoreAnomalyDetector` → `isAnomaly` flag set
6. Everything saved to PostgreSQL

**Chat pipeline (RAG):**
1. User message → semantic search against pgvector embeddings
2. Relevant transactions retrieved
3. Full conversation history + transaction context → `MODEL_CHAT` (claude-sonnet-4-5)
4. Response includes `answer` + optional `chartUpdate` (pie/bar/line/anomalies/forecast)

**4 conceptual layers:**
- Layer 1: Deterministic — CSV parsing, HTTP, persistence
- Layer 2: Statistical — Z-score anomaly detection, weighted moving average forecasting
- Layer 3: Semantic — pgvector embeddings, RAG retrieval
- Layer 4: Reasoning — LLMs via OpenRouter (3 model tiers)

---

## 6. DATABASE SCHEMA

**Statements** — `Id` (GUID), `FileName`, `FileHash` (SHA-256, unique index), `UploadedAt`, `TransactionCount`  
**Transactions** — `Id`, `StatementId` (FK cascade), `TransactionDate`, `Description`, `Amount`, `Category`, `CategoryId` (FK), `IsAnomaly`, `Embedding` (vector), `CreatedAt`  
**Categories** — `Id`, `Name`

**Migrations applied (in order):**
1. `InitialCreate`
2. `AddCategoryAndTransaction`
3. `AddEmbeddingToTransaction`
4. `20260521031445_AddFileHashToStatement`

---

## 7. API ENDPOINTS

```
GET    /api/statements              — list all statements (summary)
GET    /api/statements/{id}         — get statement with transactions
POST   /api/statements/upload       — upload CSV (multipart/form-data, field: "file")
DELETE /api/statements/{id}         — hard delete statement + cascade transactions
POST   /api/chat/{statementId}      — chat (body: { message, history[] })
GET    /api/forecast/{statementId}  — moving average forecast by category
GET    /api/timeseries/{statementId}— spending over time
GET    /health                       — health check
```

---

## 8. FRONTEND PAGES

| Page | Route | Status |
|---|---|---|
| Dashboard | `/` | ✅ Done — stat cards, donut chart, spending/income tabs, transaction list |
| Transactions | `/transactions` | ✅ Done — search, filter, sort, expand rows, anomaly badge |
| Statements | `/statements` | ✅ Done — list, upload modal, delete confirmation, View Details |
| Chat | `/chat` | ✅ Done — chat interface + dynamic chart panel (pie/bar/line/anomaly/forecast) |
| StatementDetailPage | `/dashboard/:id` | ✅ Done — light theme, Transactions tab + Charts tab |

**Light theme tokens:**
- Page bg: `#F8FAFC` · White surfaces: `#FFFFFF` · Border: `#E2E8F0`
- Primary text: `#1E293B` · Muted: `#64748B` · Hint: `#94A3B8`
- Accent teal: `#00637C` · Income green: `#10B981` · Expense red: `#EF4444` · Anomaly amber: `#F59E0B`

**Key frontend decisions:**
- Upload modal: Statements page only (moved from Dashboard — Dashboard is pure analysis view)
- All pages: dynamic statement lookup via `GET /api/statements` → take `summaries[0]`
- Chat: sessionStorage persistence for `messages`, `chartUpdate`, `statementId`, `statementFileName`
- Chat: custom event `nosyormi-statement-deleted` triggers auto-clear when statement deleted
- Clear chat button in chat header (shown when messages.length > 0)
- Empty state text: "No statements uploaded yet. Upload a CSV from the Statements page."

---

## 9. DEPLOYMENT

### Docker Compose (local dev + testing)
Three containers: `nosyormi-postgres` (pgvector/pg16, port 5433), `nosyormi-api` (port 5034), `nosyormi-frontend` (nginx, port 5173)

**Startup sequence:**
```bash
cd "/Users/roysondsouza/AI Projects/NOSYORMI/nosyormi"
docker compose --env-file .env.docker up -d
# Wait 30 seconds, then access: http://localhost:5173
```

**Shutdown:**
```bash
docker compose --env-file .env.docker down
```

### Minikube (submission deployment)
API + frontend pods inside Minikube. Postgres runs in Docker Compose outside cluster (shared on port 5433).

**Startup sequence:**
```bash
minikube start
cd "/Users/roysondsouza/AI Projects/NOSYORMI/nosyormi"
docker compose --env-file .env.docker up -d postgres
minikube service nosyormi-frontend --url
# Keep that terminal open. Use the URL it gives (127.0.0.1:XXXXX)
```

**K8s manifests:** `k8s/api-deployment.yaml`, `k8s/frontend-deployment.yaml`, `k8s/configmap.yaml`  
**`k8s/secrets.yaml` is gitignored** — contains real OpenRouter API key. Applied to cluster via `kubectl apply`.

**nginx proxy:** Frontend nginx proxies `/api` → `http://nosyormi-api:5034` (internal Kubernetes DNS). This is why no hardcoded API URL in frontend bundle.

---

## 10. ENVIRONMENT VARIABLES

**`.env` (local dev, gitignored):** `DATABASE_CONNECTION_STRING`, `OPENROUTER_API_KEY`, `MODEL_LIGHT`, `MODEL_NARRATION`, `MODEL_CHAT`, `EMBEDDING_MODEL`, `FRONTEND_ORIGIN`

**`.env.docker` (Docker Compose, gitignored):**
```
MODEL_LIGHT=openai/gpt-4o-mini
MODEL_NARRATION=anthropic/claude-sonnet-4-5
MODEL_CHAT=anthropic/claude-sonnet-4-5
OPENROUTER_API_KEY=sk-or-v1-...
EMBEDDING_MODEL=openai/text-embedding-3-small
```

**CRITICAL GOTCHA — DotNetEnv overwrite issue:**  
`Program.cs` calls `Env.Load()` which **overwrites** shell env vars. When running `dotnet ef` commands against Docker Postgres (port 5433), always use `--connection` flag:
```bash
dotnet ef database update --project Nosyormi.Infrastructure --startup-project Nosyormi.Api \
  --connection "Host=localhost;Port=5433;Database=nosyormi;Username=nosyormi;Password=nosyormi_password"
```

---

## 11. TESTING STATUS

| Level | Tests | Status |
|---|---|---|
| Unit — Anomaly Detection | 5 | ✅ All passing |
| Unit — Forecasting | 5 | ✅ All passing |
| Unit — CSV Parser | 6 | ✅ All passing |
| Integration — Statements API | 6 | ✅ All passing |
| QA Manual Test Cases | 18 | ✅ All passing (TC-01 to TC-18) |
| E2E — Playwright Critical Path | 6 | ✅ All passing |
| **TOTAL** | **46** | **✅ All passing** |

**QA file:** `QA-TEST-CASES.md` in repo root  
**Test project:** `backend/Nosyormi.Tests/`  
**E2E spec:** `frontend/e2e/critical-path.spec.ts`  
**Playwright config:** `frontend/playwright.config.ts` (single Chromium worker, baseURL `http://localhost:5173`)

---

## 12. MULTI-BANK CSV SUPPORT

**Supported formats:**
- **Standard** — columns: `Date`, `Description`, `Amount` (sample_statement.csv format)
- **Huntington** — columns: `Date`, `Reference Number`, `Payee Name`, `Memo`, `Amount`, `Category Name`, `Transaction Number` — parser combines Payee Name + Memo into description
- **Bank of America** — has 6-row summary block before real header; real header at row 7 with `Date`, `Description`, `Amount`, `Running Bal.`; parser scans for header row, skips empty date rows, ignores Running Bal.

**Parser:** `backend/Nosyormi.Infrastructure/Parsing/CsvStatementParser.cs`

---

## 13. KEY ARCHITECTURAL DECISIONS (chronological)

**May 7-11:** Project named NOSYOR.M.I — "I'm Royson" hidden backwards. Tagline "Your money, reflected." Stack locked: .NET 10 + React + PostgreSQL + Docker + Minikube + OpenRouter.

**May 11-17:** 11 epics, 56 stories created on GitHub Project board. All backend layers built. Clean Architecture established with known EF Core placement pragmatism.

**May 18-19:** Frontend built in light theme (reversed from original dark theme exploration after discussing tradeoffs — expense/income colors need red/green distinction).

**May 20:** Multi-statement refactor — removed hardcoded `STATEMENT_ID` constants from all 3 pages. Added `StatementsPage`. `StatementQueryService` moved Application→Infrastructure (Clean Architecture fix). SHA-256 file hash deduplication. Hard delete with cascade. Multi-bank deferred to post-MVP.

**May 21:** Epic 10 testing complete (46 tests). Epic 11 deployment: Dockerized all 3 services. Minikube deployment. `EMBEDDING_MODEL` was missing from `.env.docker` — caused 500 on first upload attempt. Fixed. nginx API proxy added for Kubernetes internal routing.

**May 22:** Real bank statement testing. Huntington CSV — all "Other" category initially (description parsing bug). Fixed by combining `Payee Name` + `Memo` columns. BOA CSV — failed on empty date rows and summary preamble. Fixed with header scanning + row skipping. Chat fixes: history persistence (sessionStorage), conversation context fix (history sent correctly), anomaly panel data source fix, chart state persistence, clear chat button, auto-clear on statement delete (custom event `nosyormi-statement-deleted`). Empty state copy corrected.

---

## 14. KNOWN LIMITATIONS (documented for submission)

1. **"I had trouble reflecting on that"** — Chat returns this on action requests (e.g., "remove this anomaly"). The chat endpoint handles question-answering only, not write operations. By design.
2. **AI/database anomaly mismatch** — Z-score detection at upload time may differ from what AI identifies conversationally. The visual panel shows database ground truth; AI shows conversational context. Intentional behavior.
3. **User anomaly feedback loop** — No "mark as not anomaly" feature. Would require a new API endpoint and UI. Deferred as future enhancement.
4. **PDF support** — Deferred. App accepts CSV only. PDF parsing was discussed (PdfPig + LIGHT model AI parsing) but not implemented. Documented as known limitation.
5. **Multi-bank filtering** — No per-bank statement grouping in sidebar. Deferred. Architecture supports it: add `BankName` to Statement entity, add `?bank=` query param to API.
6. **StatementDetailPage navigation** — Page exists at `/dashboard/:id` but is not linked from primary navigation. Access via "View Details →" in Statements page only.
7. **Chat sessionStorage only** — Chat history survives navigation but not browser/tab close. Not persisted to database.

---

## 15. PENDING WORK (as of 22 May 2026)

**CRITICAL for submission (9 days left):**
- [ ] `PROJECT-MEMORY.md` — this file — **DONE TODAY**
- [ ] `LEARNING-LOG.md` — errors, fixes, concepts in plain English
- [ ] `DECISIONS.md` — update with all decisions (May 20-22)
- [ ] `ARCHITECTURE.md` — add orchestration note, update with May 21-22 decisions
- [ ] 6 architectural diagrams (Excalidraw):
  1. System Architecture — React → .NET API (orchestrator) → Postgres/OpenRouter/Embeddings/Forecasting
  2. AI Integration Flow — user request → embeddings → RAG → AI → chartUpdate response
  3. Database Schema — Statements, Transactions, Categories with fields
  4. API Endpoint Map — all routes, methods, request/response shapes
  5. Deployment Diagram — Docker Compose + Minikube topology
  6. User Flow Diagram — primary journey: upload → dashboard → chat
- [ ] PowerPoint deck (8+ slides, real screenshots)
- [ ] Project documentation (all 56 user stories, sprint log, AI integration details, known issues)
- [ ] Demo video (3-5 minutes, story-driven, not a screen recording)

**POLISH (optional, post-docs):**
- [ ] Upload pulse animation (breathing during processing)
- [ ] Stat card count-up (~800ms roll on first load)
- [ ] Transactions header compression on scroll
- [ ] Dashboard "4th stat card" clipped off-screen issue (Anomalies card)

---

## 16. GIT COMMIT LOG (recent — most recent first)

```
b1a5426 — fix(docker): remove test project from backend Dockerfile build stage
78e9609 — chore(security): remove secrets.yaml from tracking, add to gitignore
f3f4c7f — feat(deploy): add Minikube k8s manifests and nginx API proxy
8eed111 — fix(deploy): add missing EMBEDDING_MODEL env var to docker-compose
[current session commits]
  — fix(ui): correct empty state message to point to Statements page
  — feat(chat): add clear chat button, auto-clear on statement delete via custom event
  — fix(chat): persist chartUpdate state via sessionStorage across navigation
  — fix(chat): persist history, fix conversation context, fix anomaly panel data source
  — fix(parser): add BOA CSV format support
  — fix(parser): add multi-bank CSV format support for Huntington
32ae82e — test(e2e): add Playwright critical path E2E tests — 6 passing
74fd0b8 — docs(qa): add manual QA test cases — 18 cases all passing
a15432f — test(integration): add StatementsController integration tests
260fa8c — test(unit): add CsvStatementParser unit tests
a6be831 — test(unit): add MovingAverageForecastingService unit tests
b400ee0 — test(unit): add ZScoreAnomalyDetector unit tests
1fa0d21 — feat(statements): move upload to StatementsPage, add View Details, remove from Dashboard
dc2073f — feat(statements): add StatementsPage with delete confirmation and sidebar nav
7c81479 — feat(dashboard): replace hardcoded statement ID with dynamic lookup
b6b8032 — feat(api): add DELETE /api/statements/{id} with cascade delete
5a7a9b8 — feat(upload): add SHA-256 duplicate detection with 409 Conflict
ced90df — feat(domain): add FileHash to Statement entity with unique index migration
b29e1d1 — refactor: move StatementQueryService to Infrastructure, add interface
7814139 — chore(cleanup): remove dead UploadPage and App.css
```

---

## 17. WORKING PATTERN (how Royson and Claude work together)

- Claude writes precise Cursor prompts → Royson runs in Cursor Agent mode (Cmd+I) → pastes results back → Claude verifies → commit
- Royson responds well to honest pushback — does NOT want sycophancy
- "Sync" = silently load context, continue. "Sync+" = load context + brief summary to verify
- All commits are atomic and individually reversible
- Explanations in plain English before technical steps
- "Why before what" — always explain the reason before the action
- When Royson gives context corrections (like MINT Mobile being phone carrier not wifi), note them but don't overfit

---

## 18. ORCHESTRATION NOTE (for ARCHITECTURE.md and diagrams)

> **"The .NET API is the orchestrator."**
> 
> Hannan specifically mentioned: "When working with multiple APIs, make sure orchestration happens well. One person sitting in the middle, responsible for moving everyone in the right direction."
> 
> In NOSYOR.M.I, the .NET Web API is that person. The browser never talks directly to OpenRouter, pgvector, or the forecasting service. Everything flows through the API, which coordinates:
> - OpenRouter (categorization, chat, narration)
> - pgvector (embedding storage + similarity search)  
> - ZScoreAnomalyDetector (statistical analysis)
> - MovingAverageForecastingService (time-series prediction)
> - PostgreSQL (persistence)
> 
> **This must appear prominently in ARCHITECTURE.md and the System Architecture diagram.**

---

*This file is Claude's memory anchor. Read it before every session. Update it after every session.*
