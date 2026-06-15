# PROJECT-MEMORY.md
> Claude's context anchor for NOSYOR.M.I. Read this at the start of every session.
> Last updated: 14 June 2026 — Interactive architecture HTML aligned with ARCHITECTURE.md §4

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

Upload bank statements or CSVs. The app categorizes spending, detects anomalies, forecasts next month, auto-generates a cached Dashboard statement summary (NARRATION tier), and has a chat interface for questions like "Where did I overspend in March?" — AI narrative connected to live data visualizations.

**Required features:** CSV Parsing · Time-Series · Anomaly Detection · Data Visualization  
**Stack required:** .NET 10 + React + OpenRouter + Docker + Cloud/Minikube  
**Submission includes:** Working app + deployed URL + PowerPoint deck + project documentation + 6 architectural diagrams + demo video (3-5 min) + test results + QA report  
**Trainer:** Hannan  
**Key Hannan quote on orchestration:** "One person sitting in the middle, responsible for moving everyone in the right direction. Have that mentality between your APIs."

---

## 3. TECHNICAL STACK

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite + react-router-dom + Recharts |
| Backend | .NET 10 Web API — Clean Architecture (4 projects) |
| Database | PostgreSQL 16 + pgvector (embeddings stored at upload; query-time RAG not wired) |
| AI | OpenRouter — 3-tier model routing |
| Embeddings | `openai/text-embedding-3-small` via OpenRouter |
| Containerization | Docker Compose (local dev) + Minikube (submission deployment) |
| Testing | xUnit (unit + integration) + Playwright (E2E) |

**Three-tier AI model routing (config) — current wiring status:**
- `MODEL_LIGHT` = `openai/gpt-4o-mini` — CSV categorization (cheap, fast, per-transaction) — **wired** (`OpenRouterCategoryClassifier`)
- `MODEL_NARRATION` = `anthropic/claude-sonnet-4-5` — Dashboard statement narration — **wired** (`NarrationService`, cached in `Statement.Narration`). Env var provisioned in `.env`/`.env.docker`/`k8s/configmap.yaml` but **not read by code yet** (model hardcoded in service).
- `MODEL_CHAT` = `anthropic/claude-sonnet-4-5` — conversational chat (full context injection, not query-time RAG) — **wired** (`OpenRouterChatService`, `MaxTokens = 1500`)
- `EMBEDDING_MODEL` = `openai/text-embedding-3-small` — vector embeddings — **wired** (`OpenRouterEmbeddingService`)

---

## 4. CLEAN ARCHITECTURE — 4 LAYERS

```
Nosyormi.Domain          — Entities: Statement (incl. Narration cache), Transaction, Category. No external deps.
Nosyormi.Application     — Interfaces + services: IStatementQueryService, StatementUploadService, ICsvStatementParser, IAnomalyDetector, IForecastingService, IChatService
Nosyormi.Infrastructure  — Implementations: DbContext, parsers, classifiers, embeddings, anomaly, forecasting, OpenRouterChatService, NarrationService, StatementQueryService
Nosyormi.Api             — Controllers: StatementsController, ForecastController, TimeSeriesController, ChatController, NarrationController. Program.cs.
```

**Known technical debt:** `StatementUploadService` is in Application but still injects `DbContext` directly. Accepted and documented.

---

## 5. AI PIPELINE (Orchestration)

The .NET API is the **orchestrator** — all browser requests go through it, and it coordinates all downstream services. This is what Hannan specifically asked for.

**Upload pipeline (per CSV):**
1. SHA-256 hash → duplicate check → reject 409 if exists
2. CSV parsed → `ParsedTransactionRow[]`
3. Each transaction → rule bypass OR `MODEL_LIGHT` (OpenRouter) → category assigned
4. All transactions → `ZScoreAnomalyDetector` → `isAnomaly` flag set
5. Each transaction → `openai/text-embedding-3-small` → vector embedding stored in pgvector
6. Everything saved to PostgreSQL

**Chat pipeline (full context injection — NOT query-time RAG):**
1. Load **all** transactions for `statementId` from PostgreSQL
2. Build structured context: pre-computed monthly category totals + every transaction line (`[ID:uuid]`, date, INCOME/EXPENSE, description, category, amount, anomaly flag)
3. Full conversation history + context + user message → `MODEL_CHAT` (claude-sonnet-4-5) with `stream: true`
4. Accumulate OpenRouter SSE deltas → `ParseChatResponse` → `answer` + optional `chartUpdate`
5. Emit SSE to browser: `text` (answer word-by-word), `chart`, `done` (camelCase via `JsonOptions`)
6. If user asked for top/biggest expenses but model omitted `topN`, server computes top-N expense IDs and forces `chartUpdate.type = "topN"`
7. **Keyword routing in `ParseChatResponse`:** `DetectTimePeriod()` runs once before bool flags; `isMonthSpecific` (month name + no category + not forecast/anomalies/topN) → `bar` with `highlightTransactionIds` for that month's expenses; category drill-down reuses same `fromDate`/`toDate`
8. **Multi-turn history:** assistant turns serialized as JSON with `"chartUpdate": {}` (not `null`) in `BuildMessages` to preserve chart context

> **Not RAG today:** embeddings are written at upload into pgvector, but chat never embeds the user's question or runs similarity search. Query-time retrieval (Epic 6 story 26) is deferred.

**Narration pipeline (Dashboard — NARRATION tier):**
1. Dashboard loads active statement → `GET /api/narration/{statementId}`
2. If `Statement.Narration` is cached → return immediately (no OpenRouter call)
3. Else load transactions with categories → `NarrationService.GenerateNarrationAsync` (pre-computed summary → OpenRouter `anthropic/claude-sonnet-4-5`)
4. Save paragraph to `Statement.Narration` → return to Dashboard narration card

**~750 transaction architectural ceiling:** Full context injection works reliably for typical single-statement CSVs (roughly up to **~750 transactions**). Beyond that, prompt size, latency, cost, and answer quality degrade — **query-time RAG becomes necessary**. There is no hard cap in code; this is a documented architectural limit.

**Chart types the AI can trigger:**
- `pie` — spending distribution across categories
- `bar` — category comparison or drilldown within a category
- `line` — spending over time
- `anomalies` — unusual transactions
- `forecast` — next month prediction vs actual average
- `stacked` — monthly spending by category (new May 28)
- `horizontal` — categories ranked by total spend (new May 28)
- `treemap` — spending map by proportion (new May 28)
- `topN` — biggest expense transactions ranked; uses `highlightTransactionIds` (new May 29)

**ChartUpdate fields:** `type`, optional `category` (bar drilldown within category), optional `highlightTransactionIds` (topN / month-specific / highlights)

**Month-specific queries:** User asks e.g. "spending in March" → backend sets `type: "bar"`, `category: null`, `highlightTransactionIds: [ids in March]` → frontend filters expenses to those IDs before `buildCategoryTotals` → category breakdown for that month only. Chart title uses month name from last user message ("March — Spending Breakdown").

**4 conceptual layers:**
- Layer 1: Deterministic — CSV parsing, HTTP, persistence
- Layer 2: Statistical — Z-score anomaly detection, weighted moving average forecasting
- Layer 3: Semantic — pgvector embeddings at upload (**retrieval at chat time not wired**)
- Layer 4: Reasoning — LLMs via OpenRouter (3 model tiers)

---

## 6. DATABASE SCHEMA

**Statements** — `Id` (GUID), `FileName`, `FileHash` (SHA-256, unique index), `UploadedAt`  
**Transactions** — `Id`, `StatementId` (FK cascade), `TransactionDate`, `Description`, `Amount`, `CategoryId` (nullable FK), `IsAnomaly`, `Embedding` (vector 1536), `CreatedAt`  
**Categories** — `Id`, `Name`, `IconKey` (optional)  

> `TransactionCount` on API list responses is computed at query time (`COUNT`) — not a DB column.

**Migrations applied (in order):**
1. `InitialCreate`
2. `AddCategoryAndTransaction`
3. `AddEmbeddingToTransaction`
4. `20260521031445_AddFileHashToStatement`
5. `AddNarrationToStatement` — nullable `Statement.Narration` for cached AI Dashboard summary

**Category taxonomy (15 categories — `CategoryTaxonomy.All`, synced with classifier prompt):**
Groceries, Dining & Takeaway, Transport, Subscriptions, Shopping, Health & Pharmacy, Entertainment, Utilities, Travel, ATM & Cash, Transfers & Payments, Parking & Tolls, Education, Government & Fees, Other

**Rule-based categorization bypass (before MODEL_LIGHT):** Square terminal (`TST*`, `SQ *`) → Dining & Takeaway; DoorDash food orders (not DashPass) → Dining & Takeaway; subscription keywords → Subscriptions; ATM/cash keywords → ATM & Cash; Zelle/Payment ID → Transfers & Payments; education keywords → Education; government/USCIS/DMV/IRS → Government & Fees; direction-aware wire transfer rules (Axis Bank income vs transfer split).

---

## 7. API ENDPOINTS

```
POST   /api/statements              — upload CSV (multipart/form-data) → 200 Statement | 409 Conflict
GET    /api/statements              — list all statements (by UploadedAt DESC)
DELETE /api/statements/{id}         — hard delete statement + cascade transactions → 204
POST   /api/chat/stream/{id}        — chat SSE stream (body: { message, history[] })
GET    /api/narration/{id}          — AI Dashboard summary (cached in Statement.Narration)
GET    /api/forecast/{id}           — moving average forecast by category
GET    /api/timeseries/{id}         — monthly spending totals
GET    /health                      — health check
```

> See `ARCHITECTURE.md` §4.4 and `NOSYORMI-Architecture-Technical.html` §04 for full request/response shapes and SSE event schema.

---

## 8. FRONTEND PAGES

| Page | Route | Status |
|---|---|---|
| Dashboard | `/` | ✅ Done — stat cards, **AI narration card** (NARRATION tier, DB-cached), donut chart, **folder-tab** spending/income switcher, transaction list, **date-range filter**; transparent page wrapper + `#E4E9F0` sticky header |
| Transactions | `/transactions` | ✅ Done — **folder-tab** spending/income, **date-range filter**, **donut chart** (click-to-filter category), search, sort, expand rows, **coloured category pills**, anomaly toggle (`data-anomaly-toggle` click-outside exclusion), **tab-aware summary sidebar**, hysteresis sticky header, `#E4E9F0` sticky header |
| Statements | `/statements` | ✅ Done — list, upload modal, delete confirmation; `#E4E9F0` page background |
| Chat | `/chat` | ✅ Done — chat + 9 chart types; SSE streaming; month-aware titles; bar highlight filtering; draggable divider; split layout padding polish; right panel `height: 100%` |

> **REMOVED (28 May 2026):** `StatementDetailPage` and its `/dashboard/:id` route were deleted from the app entirely, along with the "View Details →" link on the Statements page. There are now **4 frontend pages**.

**Brand / logo:**
- `frontend/src/components/NosyormiLogo.tsx` — inline SVG (teal `#124346` circle, gold `#D4A843` N bars, Google-coloured arc segments) + optional wordmark **NOSYOR.M.I**
- No standalone logo PNG/SVG in repo; `frontend/public/favicon.svg` is a separate purple icon (not the brand mark)

**Theme tokens (Design v1.1 — current):**
- App shell: `#FFFFFF` outer · Main content panel (`App.tsx` `styles.main`): `#E4E9F0`
- **Page wrappers:** Dashboard and Transactions use `background: 'transparent'` so the panel colour shows through between sticky headers and white cards; Statements page uses `#E4E9F0` on `styles.page`
- **Sticky page headers:** Dashboard and Transactions — `#E4E9F0`, `position: sticky`, `marginBottom: 0` (Dashboard)
- **Floating sidebar:** `#E4E9F0`, `borderRadius: 16px`, soft shadow; collapsible 220px ↔ 64px
- Brand teal: `BRAND_TEAL_BASE` `#124346`, `BRAND_TEAL_EDGE` `#0A2E30`, `BRAND_GOLD` `#D4A843`
- Active nav: teal marker + `#124346` text (Urbanist 800 for logo wordmark)
- Typography: **Urbanist** (global, via `index.css`) — replaced Inter
- Card surfaces: `#FFFFFF` with soft shadow · Primary text: `#1E293B` · Muted: `#64748B`
- Line chart stroke: `#00897B` (teal) · Income green: `#10B981` · Expense red: `#EF4444` · Anomaly amber: `#D97706`
- Data/chart palette: `APP_COLORS` (15 colours) from `palette.ts`
- macOS glass: `MACOS_GLASS_TEXTURE` + `macosGlass(rgb, opacity)` for upload modal overlay

**Key frontend decisions:**
- Upload modal: Statements page only — macOS glass texture
- **Reflect / statement switching:** Statements page **Reflect** button sets active statement in sessionStorage; sidebar `StatementPill` shows **explicitly selected** statement only (not auto-latest); syncs Dashboard, Transactions, Chat
- All pages: load active statement from sessionStorage selection or `GET /api/statements` fallback
- Dashboard date-range filter: pure `availablePeriods` (derives `YYYY-MM` periods) + pure `filterTransactionsByDate` callback; all derived stats (expenses, income, anomalyCount, category totals) computed from the date-filtered set. Custom range stages in local `customFrom`/`customTo` state and only commits on "Apply". Click-outside closes the picker (`[data-datepicker]`).
- Transactions page (Week 9): folder-tab spending/income (`nosyormi-tx-tab-*`); same date-range filter pattern; donut + legend with click-to-filter; `categoryColorMap` coloured pills on rows; summary sidebar rows conditional by tab (Total Spending red / Total Income green); anomaly callout “Review Highlighted Transactions”; hysteresis sticky header (compact when scrollTop > 40, expand when < 20).
- Transactions click-outside (13 Jun): document mousedown handler clears active donut slice unless click is on pie slice **or** `[data-anomaly-toggle]` — anomaly filter toggle no longer resets category selection.
- Chat: sessionStorage persistence for `messages`, `chartUpdate`, `statementId`, `statementFileName`, **selected statement**
- Chat layout (13 Jun): left panel header padding `24px 32px 16px`; right panel padding `24px 24px 16px`, height `100%` (not `100vh`); chart title `h3` fontSize 22 / fontWeight 600
- Chat: preserve history on navigation — do not overwrite sessionStorage when remounting with empty messages if stored data exists
- Chat bar chart: when `category` null + `highlightTransactionIds` → filter expenses to highlights before category totals; non-drill-down height `Math.max(320, barData.length * 56)`; drill-down capped at 20 rows
- Chat: `getChartTitle()` month-aware from last user message; merchant word threshold 0.7 for auto-titles
- Chat: custom event `nosyormi-statement-deleted` triggers auto-clear when statement deleted
- Clear chat button in chat header (shown when messages.length > 0)
- Click anywhere on page resets selected donut slice (document mousedown handler) — **except** clicks on `[data-anomaly-toggle]` (Transactions)
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
| QA Manual Test Cases | 19 | ✅ All passing (TC-01 to TC-19) |
| E2E — Playwright Critical Path | 6 | ✅ All passing |
| **TOTAL** | **47** | **✅ All passing** |

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
APP_COLORS[]              — 15-colour palette for pie/bar charts (15 categories)
FORECAST_ACTUAL_COLOR     — #00637C (teal)
FORECAST_PREDICTED_COLOR  — #f4a623 (amber)
LINE_STROKE_COLOR         — #00897B (teal)
LINE_FILL_COLOR           — rgba(0,137,123,0.08)
ANOMALY_COLOR             — #D97706
BRAND_TEAL_BASE           — #124346
BRAND_TEAL_EDGE           — #0A2E30
BRAND_GOLD                — #D4A843
MACOS_GLASS_TEXTURE       — reusable glass material for modals
macosGlass(rgb, opacity)  — tint builder for glass overlays
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
- Confirmed `MODEL_NARRATION` was unwired (May 2026); **wired June 2026** via `NarrationService` + DB cache on `Statement.Narration`

**May 29 — chat intelligence:**
- Added `topN` chart type + `highlightTransactionIds` in `chartUpdate` contract (frontend + backend)
- Expanded `OpenRouterChatService` system prompt (chart rules, IDs, merchant→category bar, mandatory topN phrases)
- Server-side fallback: keyword match on user message → force `topN` with DB-sorted expense IDs
- Transaction context lines: `[ID:uuid]`, `[INCOME]` / `[EXPENSE]`
- Pre-computed monthly category totals injected at top of chat context (model must cite these figures, not self-sum)
- AI reasoning accuracy rules + transfer/month comparison fixes in system prompt
- Documentation corrected: chat = full context injection, **not** query-time pgvector RAG
- QA: TC-19 (topN chart) added → **47** total tests (22 + 19 + 6)

**May 29 — categorization & charts:**
- Added categories: `Transfers & Payments`, `ATM & Cash` (taxonomy → 13)
- Rule-based pre-classification: subscriptions, ATM/cash, Zelle/transfers, Square TST*/SQ* → Dining, DoorDash food vs DashPass split
- Chart UI: draggable chat/chart divider, chart height/sort/tooltip polish; anomaly colour later unified to `#D97706` (30 May)
- All **6 architectural diagrams** in `docs/diagrams/` regenerated to match current codebase (React 19, upload order, full-context chat, API shapes, deployment tags)
- Documented **~750 transaction ceiling** — full context works below this; RAG required beyond it

**May 30 — Jun 1 — Design v1.1 + chat polish:**
- Urbanist font globally; floating white sidebar; brand teal/gold tokens; `NosyormiLogo` in sidebar; Chat nav → "Let's Reflect"
- macOS glass upload modal; Dashboard hero teal card + stat gradients; chat bubble teal-gold border (CSS, no RAF)
- Reflect button + explicit statement selection across pages; pill shows selected statement only
- Education + Government & Fees categories (15 total); case-insensitive CSV headers; direction-aware transfer rules
- Chat: `renderChart` memoized; history preserved on navigation; anomaly filter pill on Transactions
- Month-specific routing: `isMonthSpecific` → bar + highlight IDs; frontend bar filters by highlights; month chart titles
- Assistant history: `"chartUpdate": {}` in BuildMessages; single `DetectTimePeriod()` call in ParseChatResponse
- Bar drill-down `.slice(0, 20)`; merchant title threshold 0.7; dynamic non-drill-down bar height

**June 2026 — AI Dashboard narration (NARRATION tier):**
- `NarrationService` + `NarrationController` (`GET /api/narration/{statementId}`)
- `Statement.Narration` DB cache (migration `AddNarrationToStatement`) — one generation per statement
- Dashboard narration card (auto-fetch on statement load)

**June 2026 — Transactions page parity + folder-tab UI (Week 9):**
- Dashboard Spending/Income: underline tabs → folder-tab chrome (`nosyormi-tab-*` pseudo-element curves)
- Transactions: same folder tabs (`nosyormi-tx-tab-*`), date-range filter, donut chart, coloured category pills, tab-aware summary sidebar, hysteresis sticky header

**June 2026 — Panel background unification + Chat/Transactions polish (Week 10):**
- **Panel colour `#E4E9F0`** — App main panel, Dashboard sticky header, Transactions sticky header, Statements page background aligned to one surface colour (replaces `#F4F7F9` on page-level areas)
- **Dashboard** — `styles.page` → `transparent`; `styles.header` → `#E4E9F0`, `marginBottom: 0`; white card backgrounds unchanged
- **Statements** — `styles.page` → `#E4E9F0`
- **Transactions anomaly toggle** — `data-anomaly-toggle=""` on filter button; mousedown handler skips reset when click target is inside that control
- **Chat** — left header padding `24px 32px 16px`; right panel `padding: 24px 24px 16px`, `height: 100%`; chart title typography 22px / weight 600

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
10. **Per-anomaly / forecast LLM narration** — Dashboard statement summary uses NARRATION tier (`NarrationService`). Per-anomaly explanations and forecast-specific LLM narratives remain deferred.
11. **`MODEL_NARRATION` env var not read** — `NarrationService` is wired; model hardcoded to `anthropic/claude-sonnet-4-5`. Env/k8s key provisioned but not consumed yet.
12. **Query-time RAG not wired** — Embeddings stored at upload; chat loads the **entire** statement as text context. No embed-query → pgvector search → top-K retrieval step exists in `OpenRouterChatService`.
13. **~750 transaction ceiling (architectural, not enforced)** — Full context injection is reliable for typical single-statement CSVs (~750 transactions or fewer). Beyond that, prompt size, latency, cost, and answer quality degrade; query-time RAG (story 26) becomes necessary. No upload or chat rejection at 750 — this is a documented design limit, not runtime validation.
14. **Chat streaming** — SSE implemented: server buffers OpenRouter stream, parses JSON, streams parsed answer word-by-word (not raw model tokens).
15. **Misleading “RAG” labelling in early docs/diagrams** — Corrected 29 May 2026. Upload half of RAG (embed + store) is done; retrieval half is not.
16. **Logo asset** — Brand SVG only in `NosyormiLogo.tsx`; no downloadable logo file in repo. `favicon.svg` is unrelated.

---

## 16. PENDING WORK (as of 13 June 2026)

**SUBMISSION CRITICAL:**
- [ ] PowerPoint deck (8+ slides, real screenshots) — story #60
- [ ] Product demo video (3–5 min, story-driven) — story #63 / Animaker optional

**COMPLETE (submission app + docs):**
- [x] Project documentation (`PROJECT-DOCUMENTATION.md`, diagrams, creativity notes)
- [x] SSE chat streaming (story #32)
- [x] QA suite documented — 47/47 pass (`QA-TEST-CASES.md`, last run 30 May)
- [x] Docker + Minikube deployment
- [x] Core FinSight features + nine chart types
- [x] AI Dashboard narration (NARRATION tier, DB-cached)

**OPTIONAL / DEFERRED:**
- [ ] Query-time RAG in chat (story #26 — partial; embeddings at upload only)
- [ ] PDF upload (story #15, additive)
- [ ] Dashboard sparklines / vs last month (story #48, additive)
- [ ] Typing animation on AI thinking bubble
- [ ] Vibrancy Glass on Treemap tiles
- [ ] Upload pulse animation during CSV processing

---

## 17. GIT COMMIT LOG (recent — most recent first)

```
fix(ui): panel background unification #E4E9F0, Chat layout polish, anomaly-toggle click-outside fix
feat(ui): colored category pills, hysteresis scroll fix on Transactions page
feat(ui): conditional summary sidebar rows by tab, shorten anomaly message, fix income summary colors
feat(ui): add spending/income folder tabs, date range filter, and donut chart to Transactions page
feat(ui): replace underline tabs with folder-tab style on Dashboard Spending/Income switcher
design: font size bump, stat card color gradients, blue net card
fix(statements): pill only shows explicitly selected statement, brand teal pill colors
design(v1.1): teal gradient on Upload Statement button
design(v1.1): NosyormiLogo component, logo in sidebar, Let's Reflect nav label, sidebar spacing
design(v1.1): Layer 5 polish — font hierarchy, bubble colors, teal-gold chat border
design(v1.1): macOS glass texture on upload modal
design(v1.1): teal hero stat card on dashboard
design(v1.1): floating light sidebar with teal active marker
design(v1.1): switch global font to Urbanist
fix(chat): merchant detection, time-period filtering, anomaly legend; brand teal tokens + macosGlass
feat(categorization): Education, Government & Fees categories; direction-aware wire rules
feat(statements): Reflect button for statement switching — sessionStorage sync
docs: update all 6 architectural diagrams to match current application state
feat(chat): topN chart type, highlightTransactionIds, server-side topN fallback
[earlier commits unchanged]
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
> - pgvector (embedding storage at upload; query-time similarity search **not wired in chat**)  
> - ZScoreAnomalyDetector (statistical analysis)
> - MovingAverageForecastingService (time-series prediction)
> - PostgreSQL (persistence)
> 
> **This must appear prominently in ARCHITECTURE.md §4.1 and the System Architecture diagram.**

## 20. ARCHITECTURE DOCUMENTATION (HTML)

| File | Location | Purpose |
|---|---|---|
| `NOSYORMI-Architecture-Technical.html` | Repo root | Developer edition — 6 sections, API table, SSE schema, deployment |
| `NOSYORMI-Architecture-PlainEnglish.html` | Repo root | Plain English — bank-branch analogy, 7-step user journey |
| `ARCHITECTURE.md` §4 | `nosyormi/` | Markdown source of truth aligned with both HTML files |
| PNG diagrams | `docs/diagrams/` | Six submission PNGs matching HTML sections |

**Presentation:** 14 June 2026 · Royson D'Souza · Capstone Project 11 · 47 tests passing

---

*This file is Claude's memory anchor. Read it before every session. Update it after every session.*

*Last updated: 14 June 2026 — Interactive architecture HTML aligned with ARCHITECTURE.md §4.*
