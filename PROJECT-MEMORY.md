# PROJECT-MEMORY.md
> Claude's context anchor for NOSYOR.M.I. Read this at the start of every session.
> Last updated: Thursday, 28 May 2026

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
4. Response includes `answer` + optional `chartUpdate` (pie/bar/line/anomalies/forecast/stacked/horizontal/treemap)

**Chart types the AI can trigger:**
- `pie` — spending distribution across categories
- `bar` — category comparison or drilldown within a category
- `line` — spending over time
- `anomalies` — unusual transactions
- `forecast` — next month prediction vs actual average
- `stacked` — monthly spending by category (new May 28)
- `horizontal` — categories ranked by total spend (new May 28)
- `treemap` — spending map by proportion (new May 28)

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

**Category taxonomy (11 categories as of May 28):**
Food & Groceries, Transport & Fuel, Parking & Tolls, Subscriptions, Shopping, Utilities & Bills, Income, Healthcare, Entertainment, Dining & Takeaway, Other

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
| Chat | `/chat` | ✅ Done — chat + 8 chart types: pie, bar, drilldown, line, anomalies, forecast, stacked, horizontal, treemap |
| StatementDetailPage | `/dashboard/:id` | ✅ Done — light theme, Transactions tab + Charts tab |

**Light theme tokens:**
- Page bg: `#F8FAFC` · White surfaces: `#FFFFFF` · Border: `#E2E8F0`
- Primary text: `#1E293B` · Muted: `#64748B` · Hint: `#94A3B8`
- Accent teal: `#00637C` · Income green: `#10B981` · Expense red: `#EF4444` · Anomaly amber: `#F59E0B`

**Key frontend decisions:**
- Upload modal: Statements page only
- All pages: dynamic statement lookup via `GET /api/statements` → take `summaries[0]`
- Chat: sessionStorage persistence for `messages`, `chartUpdate`, `statementId`, `statementFileName`
- Chat: custom event `nosyormi-statement-deleted` triggers auto-clear when statement deleted
- Clear chat button in chat header (shown when messages.length > 0)
- Click anywhere on page resets selected donut slice (document mousedown handler)

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

### Minikube (submission deployment) ✅ COMPLETE
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

---

## 12. MULTI-BANK CSV SUPPORT

**Supported formats:**
- **Standard** — columns: `Date`, `Description`, `Amount`
- **Huntington** — combines Payee Name + Memo into description
- **Bank of America** — scans for header row, skips empty date rows, ignores Running Bal.

---

## 13. UI ARCHITECTURE — CHART EFFECTS (added May 28)

**Two files control all visual styling. Change one, never both.**

### `frontend/src/constants/palette.ts`
Single source of truth for all colours. Change colours here ONLY.
```
APP_COLORS[]              — 11-colour palette for pie/bar charts
FORECAST_ACTUAL_COLOR     — #00637C (teal)
FORECAST_PREDICTED_COLOR  — #f4a623 (amber)
LINE_STROKE_COLOR         — #C9911A
LINE_FILL_COLOR           — rgba(0,99,124,0.28)
ANOMALY_COLOR             — #F59E0B
```

### `frontend/src/components/chartEffects.tsx`
Single source of truth for all visual effects. Change effects here ONLY.
```
JewelBar          — bar chart shape. Radial gradient shimmer from top-left. Used on ALL bar charts.
JewelSlice        — pie/donut slice shape. White shimmer overlay. Used on ALL donut charts.
AnomalyBar        — bar shape that switches to amber for anomalous transactions.
UniversalTooltip  — frosted glass tooltip. Used on ALL charts across all pages.
```

**Effect applied per chart type:**
| Chart | Effect |
|---|---|
| Donut (Dashboard, Chat, StatementDetail) | JewelSlice |
| Category Bar | JewelBar + CRYSTAL_COLORS per cell |
| Drilldown Bar | AnomalyBar (JewelBar + amber for anomalies) |
| Forecast Bar | JewelBar (teal actual, amber forecast) |
| Horizontal Bar | JewelBar + APP_COLORS per cell |
| Stacked Bar | JewelBar per stack segment |
| Line Chart | Gradient fill + gold stroke |
| Treemap | Flat solid fills with tooltip on hover |

---

## 14. KEY ARCHITECTURAL DECISIONS (chronological)

**May 7-11:** Project named NOSYOR.M.I. Stack locked.

**May 11-17:** 56 stories on GitHub Project board. Backend layers built.

**May 18-19:** Frontend built in light theme.

**May 20:** Multi-statement refactor. SHA-256 deduplication. Hard delete with cascade.

**May 21:** Testing complete (46 tests). Docker + Minikube deployment.

**May 22:** Multi-bank CSV support (Huntington + BOA). Chat fixes.

**May 28:** Major UI architecture day.
- Added `Parking & Tolls` category to taxonomy and classifier prompt
- Created `palette.ts` + `chartEffects.tsx` — clean separation of colour vs effect (SOLID principle)
- Removed `CrystalPieCell.tsx` — dead file cleaned up
- Applied JewelBar to all bar charts (category, drilldown, forecast, horizontal, stacked)
- Applied JewelSlice to all donut charts with active lift on click
- Unified `UniversalTooltip` across all pages (was 3 different tooltip components)
- Added 3 new chart types: Treemap, Stacked Bar by Month, Horizontal Bar
- Updated AI system prompt to trigger new chart types
- Fixed chat multi-turn history bug (assistant turns wrapped as JSON)
- Fixed donut animation interruption on Dashboard and Chat
- Fixed click-outside reset on pie slices
- Fixed Treemap ghost root label (depth === 0 guard)
- Removed `isolation: 'isolate'` from Dashboard that was blocking backdrop-filter

---

## 15. KNOWN LIMITATIONS (documented for submission)

1. **"I had trouble reflecting on that"** — Chat handles Q&A only, not write operations. By design.
2. **AI/database anomaly mismatch** — Z-score at upload vs AI conversational context. Intentional.
3. **User anomaly feedback loop** — No "mark as not anomaly". Deferred.
4. **PDF support** — CSV only. Deferred.
5. **Multi-bank filtering** — No per-bank grouping. Architecture supports it.
6. **StatementDetailPage navigation** — Access via "View Details →" in Statements page only.
7. **Chat sessionStorage only** — Not persisted to database.
8. **ChatPage god component** — SRP violation acknowledged. Chart renderers should be extracted into separate components. Accepted tradeoff under deadline.
9. **Tooltip backdrop-filter** — Frosted glass effect visible when tooltip overlaps coloured slices. Appears more opaque over white backgrounds. Browser compositing limitation.

---

## 16. PENDING WORK (as of 28 May 2026)

**SUBMISSION CRITICAL (3 days left):**
- [ ] PowerPoint deck (8+ slides, real screenshots)
- [ ] Project documentation (all 56 user stories, sprint log, AI integration details)
- [ ] Demo video (3-5 minutes, story-driven)

**UI POLISH (remaining):**
- [ ] Draggable divider between chat and chart panels
- [ ] Typing animation — emerald/gold gradient dots on AI thinking bubble
- [ ] Vibrancy Glass on Treemap tiles
- [ ] StatementDetailPage center label fade-in animation
- [ ] Upload pulse animation during CSV processing

---

## 17. GIT COMMIT LOG (recent — most recent first)

```
feat(ui): JewelSlice on all donuts, UniversalTooltip unified, new chart types, animation fixes
feat(charts): add treemap, stacked bar, horizontal bar — palette.ts and chartEffects.tsx architecture
refactor(ui): clean architecture for charts — palette.ts, chartEffects.tsx, JewelBar on all charts
feat(ui): crystal colors on all pie charts, parking & tolls category, click-outside reset, tooltip fix
fix(chat): fix duplicate message in history and wrap assistant turns as JSON for context
feat(ui): Glass Slice donuts, Pill Green bars, Jewel bars, chart effects complete
[earlier commits unchanged from previous session]
```

---

## 18. WORKING PATTERN

- Claude writes precise Cursor prompts → Royson runs in Cursor Agent mode (Cmd+I) → pastes results back → Claude verifies → commit
- Royson responds well to honest pushback — does NOT want sycophancy
- "Sync" = silently load context, continue. "Sync+" = load context + brief summary to verify
- All commits are atomic and individually reversible
- "Why before what" — always explain the reason before the action
- All code changes must follow SOLID principles and clean coding structure
- Python commands for terminal fixes, Cursor prompts for file edits
- Cursor prompts delivered as copyable code blocks

---

## 19. ORCHESTRATION NOTE

> **"The .NET API is the orchestrator."**
> 
> In NOSYOR.M.I, the .NET Web API coordinates:
> - OpenRouter (categorization, chat, narration)
> - pgvector (embedding storage + similarity search)  
> - ZScoreAnomalyDetector (statistical analysis)
> - MovingAverageForecastingService (time-series prediction)
> - PostgreSQL (persistence)
> 
> **This must appear prominently in ARCHITECTURE.md and the System Architecture diagram.**

---

*This file is Claude's memory anchor. Read it before every session. Update it after every session.*
