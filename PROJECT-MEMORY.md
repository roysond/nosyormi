# PROJECT-MEMORY.md
> Claude's context anchor for NOSYOR.M.I. Read this at the start of every session.
> Last updated: Thursday, 28 May 2026 (evening — StatementDetailPage removed, Dashboard date-range filter added, docs synced to code)

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

**Three-tier AI model routing (config) — current wiring status:**
- `MODEL_LIGHT` = `openai/gpt-4o-mini` — CSV categorization (cheap, fast, per-transaction) — **wired** (`OpenRouterCategoryClassifier`)
- `MODEL_NARRATION` = `anthropic/claude-sonnet-4-5` — narrative generation — **configured but NOT wired in code.** Defined in `.env`/`.env.docker`/`k8s/configmap.yaml` and reserved for anomaly/forecast narration, but no service reads it in the current build. Dead config, kept as a documented placeholder for the planned narration tier.
- `MODEL_CHAT` = `anthropic/claude-sonnet-4-5` — chat/RAG responses — **wired** (`OpenRouterChatService`, `MaxTokens = 1500`)
- `EMBEDDING_MODEL` = `openai/text-embedding-3-small` — vector embeddings — **wired** (`OpenRouterEmbeddingService`)

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
| Dashboard | `/` | ✅ Done — stat cards, donut chart, spending/income tabs, transaction list, **date-range filter (All Time / month pills / custom range)** |
| Transactions | `/transactions` | ✅ Done — search, filter, sort, expand rows, anomaly badge |
| Statements | `/statements` | ✅ Done — list, upload modal, delete confirmation |
| Chat | `/chat` | ✅ Done — chat + 8 chart types: pie, bar, drilldown, line, anomalies, forecast, stacked, horizontal, treemap |

> **REMOVED (28 May 2026):** `StatementDetailPage` and its `/dashboard/:id` route were deleted from the app entirely, along with the "View Details →" link on the Statements page. There are now **4 frontend pages**.

**Theme tokens (current — light content + deep forest sidebar):**
- Page/content bg: `#F4F7F9` · Card surfaces: `#FFFFFF` (no hard border — soft `boxShadow: 0 4px 6px -1px rgba(0,0,0,0.05)`) · Inner muted surface: `#F8FAFC` · Hairline border (where used): `#E2E8F0`
- Sidebar bg: `#071A1E` (deep forest) · Active nav text + icon: `#E8C96A` (gold glow)
- Primary text: `#1E293B` · Muted: `#64748B` · Hint: `#94A3B8`
- UI accent (buttons, pills, active tabs, send button): `#071A1E` (deep forest) — replaced the earlier honey amber `#C9911A` for most UI chrome
- Line chart stroke: `#C9911A` (amber, retained) · Income green: `#10B981` · Expense red: `#EF4444` · Anomaly amber: `#F59E0B`
- Data/chart palette: `APP_COLORS` (11 colours) from `palette.ts`

**Key frontend decisions:**
- Upload modal: Statements page only
- All pages: dynamic statement lookup via `GET /api/statements` → take `summaries[0]`
- Dashboard date-range filter: pure `availablePeriods` (derives `YYYY-MM` periods) + pure `filterTransactionsByDate` callback; all derived stats (expenses, income, anomalyCount, category totals) computed from the date-filtered set. Custom range stages in local `customFrom`/`customTo` state and only commits on "Apply". Click-outside closes the picker (`[data-datepicker]`).
- Chat: sessionStorage persistence for `messages`, `chartUpdate`, `statementId`, `statementFileName`
- Chat: custom event `nosyormi-statement-deleted` triggers auto-clear when statement deleted
- Clear chat button in chat header (shown when messages.length > 0)
- Click anywhere on page resets selected donut slice (document mousedown handler)
- `useCountUp` hook: snaps to `0` immediately for zero targets (fixes stale stat value when a date range has no data)

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

> **Note (28 May):** `CrystalPieCell.tsx` / `CRYSTAL_COLORS` were removed — all charts now use `APP_COLORS` from `palette.ts`. Only `chartEffects.tsx` + `palette.ts` remain under `components/`.

**Effect applied per chart type:**
| Chart | Effect |
|---|---|
| Donut (Dashboard, Chat) | JewelSlice (active lift on hover/click) |
| Category Bar | JewelBar + APP_COLORS per cell |
| Drilldown Bar | AnomalyBar (JewelBar + amber for anomalies) |
| Forecast Bar | JewelBar (teal actual, amber forecast) |
| Horizontal Bar | JewelBar + APP_COLORS per cell |
| Stacked Bar | JewelBar per stack segment |
| Line Chart | Gradient fill + gold stroke |
| Treemap | Flat solid fills + `UniversalTooltip` on hover |

> All chart tooltips (every page, including the treemap) now route through the single shared `UniversalTooltip`. Donut tooltips on Dashboard use `wrapperStyle={{ background: 'transparent' }}` so the chart-wrapper colour filter does not bleed into the tooltip.

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

**May 28 (evening) — cleanup + Dashboard date filter:**
- Removed `CrystalPieCell.tsx` / `CRYSTAL_COLORS`; all charts standardised on `APP_COLORS`
- Unified the Treemap tooltip onto the shared `UniversalTooltip` (was a separate inline tooltip)
- Set Dashboard/Chat donut `Pie` to `isAnimationActive={false}` + wrapped donut in `chartFadeIn` entry animation
- Donut tooltips: `wrapperStyle` set to transparent so the wrapper colour filter doesn't tint the tooltip
- **Added Dashboard date-range filter** — `availablePeriods` (pure), `filterTransactionsByDate` (pure), All Time / per-month pills / custom range; all derived stats (incl. `anomalyCount`) honour the selected range; custom range applies only on "Apply"
- Fixed `useCountUp` so zero targets snap to `0` immediately (no stale value across date ranges)
- **Removed `StatementDetailPage` entirely** — deleted the file, the `/dashboard/:id` route in `App.tsx`, and the "View Details →" link on the Statements page (and the now-unused `Link` import)
- Confirmed `MODEL_NARRATION` is dead config (referenced only in env/k8s/docs, read by no code)

---

## 15. KNOWN LIMITATIONS (documented for submission)

1. **"I had trouble reflecting on that"** — Chat handles Q&A only, not write operations. By design.
2. **AI/database anomaly mismatch** — Z-score at upload vs AI conversational context. Intentional.
3. **User anomaly feedback loop** — No "mark as not anomaly". Deferred.
4. **PDF support** — CSV only. Deferred.
5. **Multi-bank filtering** — No per-bank grouping. Architecture supports it.
6. **Per-statement deep-dive removed** — `StatementDetailPage` (`/dashboard/:id`) was removed on 28 May. Per-statement charts/transactions are no longer a separate view; the Dashboard (with its date-range filter) and Transactions page cover analysis.
7. **Chat sessionStorage only** — Not persisted to database.
8. **ChatPage god component** — SRP violation acknowledged. Chart renderers should be extracted into separate components. Accepted tradeoff under deadline.
9. **Tooltip backdrop-filter** — Frosted glass effect visible when tooltip overlaps coloured slices (most noticeable on the Treemap, where tiles are fully coloured). Appears cleaner over white/light backgrounds. Browser compositing limitation — accepted.
10. **`MODEL_NARRATION` not wired** — The narration model tier is provisioned in config (`.env`, `.env.docker`, `k8s/configmap.yaml`) but no code reads it. Anomaly/forecast narration is not implemented in the current build; categorization uses `MODEL_LIGHT` and chat uses `MODEL_CHAT`.

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
- [ ] Upload pulse animation during CSV processing

---

## 17. GIT COMMIT LOG (recent — most recent first)

```
chore(cleanup): remove StatementDetailPage + /dashboard/:id route + View Details link
feat(dashboard): date-range filter (All Time / month / custom) + useCountUp zero-snap fix
refactor(charts): remove CrystalPieCell, unify Treemap onto UniversalTooltip, donut tooltip transparency
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
