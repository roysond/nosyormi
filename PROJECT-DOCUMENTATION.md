# PROJECT-DOCUMENTATION.md
> NOSYOR.M.I — Project Submission Documentation  
> Student: Royson D'Souza · Capstone Project 11 (FinSight)  
> Program: AI Integration Capstone · .NET 10 + React  
> Deadline: Before 4 June 2026  
> Last updated: 14 June 2026 — Interactive architecture HTML aligned with ARCHITECTURE.md §4

---

## 1. Project Brief

### The Brief (Project 11 — FinSight)

Upload bank statements or CSVs. The app categorizes spending, detects
anomalies, forecasts next month, and has a chat interface for questions
like "Where did I overspend in March?" — AI narrative connected to live
data visualizations. The Dashboard also auto-generates a cached statement
summary paragraph (NARRATION tier) when you reflect on an uploaded statement.

Required features: CSV Parsing · Time-Series · Anomaly Detection · 
Data Visualization

### My Interpretation

I took the FinSight brief and built it as a personal finance intelligence
application with a distinct identity — NOSYOR.M.I (Money Intelligence).
Read backwards: I.M.ROYSON — "I'm Royson." Tagline: *Your money,
reflected.*

The brief asked for AI narrative connected to data visualizations. I
interpreted this as a bidirectional connection — the AI doesn't just
describe charts, it *updates* them in real time based on what the user
asks. Ask about anomalies, an anomaly panel appears. Ask about forecasts,
a forecast chart renders. The chat drives the visualization, not just
narrates it.

I also went beyond the brief in the AI architecture. Instead of a single
LLM handling everything, I built a four-layer system where deterministic
code, statistical models, semantic embeddings, and reasoning LLMs each
handle the kind of work they are best suited for.

---

## 2. Sprint Log

### Week 1 (May 7–17) — Plan & Core AI Feature

**Planned:**
- Lock project identity and brand
- Set up .NET 10 Clean Architecture (4 projects)
- Configure PostgreSQL 16 + pgvector
- Build CSV upload pipeline end-to-end
- Wire up OpenRouter with multi-model routing
- Implement AI categorization per transaction
- Implement vector embeddings for RAG
- Implement Z-score anomaly detection
- Set up GitHub project board with all 56 stories

**Completed:**
- ✅ NOSYOR.M.I brand identity locked (name, tagline, mirror metaphor)
- ✅ .NET 10 solution with 4 Clean Architecture projects
- ✅ PostgreSQL 16 + pgvector configured (Postgres.app local)
- ✅ EF Core DbContext with all entities and migrations
- ✅ CsvHelper-based CSV parser (standard format)
- ✅ OpenRouter integration with 3-tier model routing
- ✅ AI categorization via gpt-4o-mini (MODEL_LIGHT)
- ✅ Vector embeddings via text-embedding-3-small stored in pgvector
- ✅ Z-score anomaly detection at upload time
- ✅ Moving average forecasting service
- ✅ All API endpoints: statements, chat, forecast, timeseries, narration
- ✅ GitHub project board: 11 epics, 56 stories

**Deferred:**
- PDF support (PdfPig) — deferred to post-MVP

---

### Week 2 (May 18–22) — Full Feature Build

**Planned:**
- Build React frontend (all 5 pages)
- Connect frontend to all API endpoints
- Build chat-to-visualization bridge
- Handle edge cases: rate limits, duplicates, empty states
- Multi-statement support
- Real bank statement testing

**Completed:**
- ✅ React 19 + TypeScript + Vite frontend scaffolded
- ✅ Dashboard page: stat cards, donut chart, spending/income folder tabs,
  transaction list with summary panel
- ✅ Transactions page: search, sort, expandable rows, anomaly badge
  *(Week 9: folder tabs, date filter, donut, coloured category pills,
  tab-aware summary sidebar)*
- ✅ Statements page: list, upload modal, delete with confirmation
- ✅ Chat page: AI chat interface + dynamic chart panel
  (pie/bar/line/anomaly/forecast; stacked/horizontal/treemap in Week 4;
  topN + highlightTransactionIds in Week 5)
- ✅ StatementDetailPage: per-statement transactions + charts tabs
  *(later removed in Week 4 — superseded by the Dashboard date-range filter)*
- ✅ Chat-to-visualization bridge: `chartUpdate` JSON contract drives
  live chart rendering
- ✅ SHA-256 deduplication: duplicate uploads return 409 Conflict
- ✅ Hard delete with cascade (Statement → Transactions → Embeddings)
- ✅ Multi-statement refactor: removed hardcoded statement IDs
- ✅ Multi-bank CSV support: Huntington + Bank of America formats
- ✅ Chat fixes: sessionStorage persistence, conversation history,
  anomaly panel data source, clear button, auto-clear on delete
- ✅ Real bank statement testing (Huntington + BOA)

**Deferred:**
- Multi-bank filtering UI (per-bank grouping in sidebar)
- Chat history database persistence

---

### Week 3 (May 21–25) — Polish, DevOps & Deploy

**Planned:**
- Complete test suite (all 4 levels)
- Dockerize all 3 services
- Minikube deployment
- UI polish
- Submission documentation

**Completed:**
- ✅ Unit tests: 16 passing (anomaly, forecasting, CSV parser)
- ✅ Integration tests: 6 passing (Statements API)
- ✅ QA manual test cases: 19 passing (TC-01 to TC-19)
- ✅ E2E tests: 6 passing (Playwright critical path); 47 total tests across four levels
- ✅ Docker Compose: 3 containers (postgres, api, frontend)
- ✅ Minikube K8s deployment with nginx API proxy
- ✅ UI redesign: deep forest sidebar, CCE8EC background, honey amber
  accent, emerald icon glow, Inter font, collapsible sidebar
- ✅ ARCHITECTURE.md, DECISIONS.md, LEARNING-LOG.md
- ✅ 6 architectural diagrams in `docs/diagrams/` (regenerated 29 May to match codebase)
- ✅ Interactive architecture HTML at repo root: `NOSYORMI-Architecture-Technical.html` + `NOSYORMI-Architecture-PlainEnglish.html` (14 June 2026 — aligned with §4 of `ARCHITECTURE.md`)
- ✅ PROJECT-DOCUMENTATION.md (this file)

---

### Week 4 (May 26–28) — Visual System & Refinement

**Completed:**
- ✅ Chart styling architecture: `constants/palette.ts` (colour) +
  `components/chartEffects.tsx` (effects) as single sources of truth
- ✅ Custom Recharts effects: `JewelBar` (bars), `JewelSlice` (donut
  slices with active lift), `AnomalyBar` (amber for anomalies)
- ✅ Unified `UniversalTooltip` — one frosted-glass tooltip across every
  chart on every page (replaced three separate tooltip components)
- ✅ Three new AI-triggerable chart types: stacked bar (monthly by
  category), horizontal bar (ranked), treemap (proportional spend map)
- ✅ Theme refinement: content background `#F4F7F9`, white cards with
  soft shadow, deep-forest `#071A1E` UI accent (buttons/pills/tabs)
- ✅ Backend: added `Parking & Tolls` category (11 total); chat
  `MaxTokens` 500 → 1500; assistant turns serialized as JSON for
  multi-turn context; JSON parse-failure logging
- ✅ Dashboard date-range filter (All Time / per-month / custom range) —
  scopes all stats, anomalies, and category totals to the selected period
- ✅ `useCountUp` zero-snap fix (no stale stat value across date ranges)
- ✅ Removed `StatementDetailPage` and its `/dashboard/:id` route —
  superseded by the Dashboard date-range filter
- ✅ Removed interim `CrystalPieCell.tsx` / `CRYSTAL_COLORS`

**Noted (superseded June 2026):**
- ~~`MODEL_NARRATION` unwired~~ — the NARRATION tier is now wired via `NarrationService` and the Dashboard narration card (see Week 8). Per-anomaly and forecast-specific LLM narration remain deferred.

---

### Week 5 (May 29) — Chat Intelligence & topN Charts

**Completed:**
- ✅ Ninth chart type: `topN` — ranked biggest expense transactions with
  `highlightTransactionIds` driving per-transaction bars in the chat panel
- ✅ Chat system prompt expanded: transaction `[ID:uuid]` markers, INCOME/EXPENSE
  direction, merchant→category bar rules, mandatory `topN` for “biggest/top” queries
- ✅ Server-side `topN` fallback in `OpenRouterChatService` when the model omits
  the chart type but the user message matches top-N intent
- ✅ Category-scoped `bar` charts: `chartUpdate.category` drills into individual
  transactions within one category (e.g. Netflix → Subscriptions)

**Clarified (documentation accuracy):**
- Chat injects the **full transaction list** for the active statement into
  each request — not query-time pgvector similarity search. Embeddings are
  generated and stored at upload (semantic layer foundation); live RAG retrieval
  remains deferred (Epic 6 story 26).
- **~750 transaction ceiling:** full-context chat is architecturally reliable
  for typical single-statement CSVs (≤ ~750 transactions). Beyond that, query-time
  RAG becomes necessary. Not enforced in code — documented design limit.

**Completed (continued):**
- ✅ Rule-based categorization bypass expanded: subscriptions, ATM & Cash, transfers,
  Square TST*/SQ*, DoorDash food vs DashPass; taxonomy → 15 categories (Education,
  Government & Fees added 31 May)
- ✅ Chat: pre-computed monthly totals in context; AI reasoning accuracy rules;
  transfer/month comparison prompt fixes
- ✅ Chart UI: draggable chat/chart divider, height/sort polish
- ✅ All 6 architectural diagrams in `docs/diagrams/` regenerated to match codebase
- ✅ Interactive architecture HTML: `NOSYORMI-Architecture-Technical.html` + `NOSYORMI-Architecture-PlainEnglish.html` (14 June 2026)

---

### Week 6 (May 30) — Streaming, QA, CSV & anomaly polish

**Completed:**
- ✅ **SSE chat streaming** — `StreamChatAsync` + `ChatController` (`text/event-stream`); frontend `ReadableStream` reader; word-by-word answer display after full JSON parse
- ✅ **CamelCase SSE payloads** — all chat events serialized with `JsonOptions` (`chartUpdate.highlightTransactionIds`, etc.)
- ✅ **Unified anomaly styling** — amber `#D97706` / `rgba(217,119,6,...)`; inner-glow `chat-anomaly-pulse` on rows (no red borders); `ANOMALY_COLOR` in `palette.ts`
- ✅ **CSV description fallback** — `ParseDescription` uses Memo when Payee Name is empty (e.g. ATM cash deposits)
- ✅ **QA regression** — 47/47 tests documented pass (22 automated + 19 manual + 6 E2E); E2E TC-E2E-04 locator fixed for statement list

**Submission still pending:**
- ⏳ PowerPoint deck (story #60)
- ⏳ Product demo video / Animaker (story #63)

---

### Week 7 (May 31–Jun 1) — Design v1.1, Statement Switching & Month-Specific Chat

**Completed:**
- ✅ **Design v1.1 visual system** — global font switched to **Urbanist**; floating white sidebar with teal active marker; brand tokens in `palette.ts` (`BRAND_TEAL_*`, `BRAND_GOLD`, `BRAND_SIDEBAR_GRADIENT`); app shell background `#ECEEF1`
- ✅ **`NosyormiLogo` component** — inline SVG (teal circle, gold “N” bars, Google-coloured arc segments) + wordmark in sidebar; nav label **“Let's Reflect”** for Chat
- ✅ **macOS glass upload modal** — reusable `MACOS_GLASS_TEXTURE` + `macosGlass()` tint builder in `palette.ts`
- ✅ **Dashboard polish** — teal hero stat card, per-card colour gradients, blue net-worth card; statement date range beside “Spending by Category” when All Time is active
- ✅ **Chat UI Layer 5** — font hierarchy, bubble colour refinement, teal-gold gradient border on chat bubbles (CSS conic-gradient — no RAF lag)
- ✅ **Statement switching (“Reflect”)** — Reflect button on Statements page; explicit statement selection in sessionStorage; sidebar pill shows **only** the user-selected statement (not implicit latest); sync across Dashboard, Transactions, and Chat
- ✅ **Category taxonomy → 15** — added **Education** and **Government & Fees** (USCIS, DMV, IRS); classifier rule bypass expanded; direction-aware wire transfer / Zelle / Axis Bank income rules
- ✅ **CSV parser** — case-insensitive header matching (Wells Fargo `DATE`/`DESCRIPTION`/`AMOUNT` and similar)
- ✅ **Chat performance** — `renderChart` memoized; chat history preserved on navigation (skip sessionStorage overwrite when messages empty on remount)
- ✅ **Month-specific chat routing (backend)** — `DetectTimePeriod()` called once at keyword-detection start; `isMonthSpecific` fires when a month name is detected with no category → `bar` chart with `highlightTransactionIds` filtered to that month's expenses (not all-month stacked)
- ✅ **Assistant history fix** — assistant turns in `BuildMessages` serialize `"chartUpdate": {}` instead of `null` so multi-turn chart context is preserved
- ✅ **Month-specific bar chart (frontend)** — when `category` is null but `highlightTransactionIds` is set, category totals are built from highlighted transactions only; dynamic bar height `Math.max(320, barData.length * 56)` for non-drill-down mode
- ✅ **Chart title polish** — month-aware titles (e.g. “March — Spending Breakdown”); merchant word-dominance threshold 0.7; drill-down capped at 20 transactions; fallback titles “Breakdown” / “Spending Breakdown”
- ✅ **Anomaly filter pill** on Transactions page; unified anomaly legend in chat drill-down bar chart

---

### Week 8 (June 2026) — AI Dashboard Narration (NARRATION Tier)

**Completed:**
- ✅ **`NarrationService`** — OpenRouter NARRATION-tier call (`anthropic/claude-sonnet-4-5`) builds a warm 3–4 sentence statement summary from pre-computed income/expense/category/anomaly figures
- ✅ **`NarrationController`** — `GET /api/narration/{statementId}` returns `{ narration }`
- ✅ **DB caching** — `Statement.Narration` column (migration `AddNarrationToStatement`); narration generated once per statement, subsequent requests return the cached value with no API call
- ✅ **Dashboard narration card** — auto-fetches when the active statement loads; loading pulse then italic summary paragraph between stats row and sub-nav

**Still deferred (not this feature):**
- Per-anomaly LLM explanations and forecast-specific narratives (separate from the Dashboard summary)
- Reading `MODEL_NARRATION` from env in `NarrationService` (model is hardcoded today; env key remains provisioned for future swap)

---

### Week 9 (June 2026) — Transactions Page Parity & Folder-Tab UI

**Completed:**
- ✅ **Folder-tab Spending/Income switcher** — Dashboard underline tabs replaced with rounded folder-tab chrome (white active tab, pseudo-element corner curves, shared panel border); same pattern applied to Transactions page (`nosyormi-tx-tab-*` classes)
- ✅ **Transactions date-range filter** — All Time / per-month quick-select pills / custom from–to range (same `availablePeriods` + `filterTransactionsByDate` pattern as Dashboard); scopes donut, category legend, transaction list, and summary sidebar
- ✅ **Transactions donut chart** — Spending/income category breakdown with `JewelSlice`, click-to-filter category, click-outside to reset; legend with percentages
- ✅ **Coloured category pills** — Transaction rows show category badges tinted from `APP_COLORS` via `categoryColorMap` (15% background, darkened text)
- ✅ **Tab-aware summary sidebar** — Spending tab shows Total Spending (red); Income tab shows Total Income (green); Largest/Average amounts use tab-appropriate colours
- ✅ **Shortened anomaly callout** — Summary sidebar message: “Review Highlighted Transactions” (concise vs prior copy)
- ✅ **Hysteresis sticky header** — Transactions page header compacts on scroll (`scrollTop > 40`) and expands only when `scrollTop < 20` to prevent flicker at the threshold

---

### Week 10 (June 2026) — Panel Background Unification & UI Polish

**Completed:**
- ✅ **Panel colour `#E4E9F0`** — App main content panel (`App.tsx`), Dashboard sticky header, Transactions sticky header, and Statements page background aligned to one surface token (replaces `#F4F7F9` on page-level areas)
- ✅ **Dashboard transparent page wrapper** — `styles.page` → `transparent` so gaps between sticky header and white cards show the panel colour uniformly; card/chart backgrounds unchanged
- ✅ **Dashboard sticky header** — `background: '#E4E9F0'`, `marginBottom: 0`
- ✅ **Statements page** — `styles.page` → `#E4E9F0`
- ✅ **Transactions anomaly-toggle fix** — `data-anomaly-toggle=""` on filter button; document mousedown handler excludes `[data-anomaly-toggle]` so toggling anomalies-only does not reset active donut category selection
- ✅ **Chat layout polish** — left panel header padding `24px 32px 16px`; right panel padding `24px 24px 16px`, height `100%` (was `100vh`); chart title `h3` → fontSize 22, fontWeight 600

---

## 3. All User Stories

Stories are listed by epic. Status reflects the state at submission.

### Epic 1 — Project Setup & Architecture (6 stories)

| # | Story | Tier | Status |
|---|---|---|---|
| 1 | Initialize monorepo structure with backend and frontend folders | Major | ✅ Done |
| 2 | Set up .NET 10 solution with Clean Architecture layers | Major | ✅ Done |
| 3 | Scaffold React + Vite + TypeScript frontend | Major | ✅ Done |
| 4 | Configure environment variables for API keys and DB connection | Major | ✅ Done |
| 5 | Set up Git repository with README, LICENSE, and .gitignore | Minor | ✅ Done |
| 6 | Write ARCHITECTURE.md with system design and principles | Minor | ✅ Done |

### Epic 2 — Data Persistence Layer (5 stories)

| # | Story | Tier | Status |
|---|---|---|---|
| 7 | Configure PostgreSQL 16 with pgvector extension | Major | ✅ Done |
| 8 | Design entity models in Domain layer | Major | ✅ Done |
| 9 | Set up EF Core DbContext with migrations | Major | ✅ Done |
| 10 | Implement pgvector value converter for 1536D embedding storage | Major | ✅ Done |
| 11 | Configure cascade delete from Statement to Transactions | Minor | ✅ Done |

### Epic 3 — CSV Upload & Parsing (5 stories)

| # | Story | Tier | Status |
|---|---|---|---|
| 12 | Build CSV upload endpoint (multipart/form-data) | Major | ✅ Done |
| 13 | Implement CsvHelper-based parser for standard CSV format | Major | ✅ Done |
| 14 | Add SHA-256 duplicate detection with 409 Conflict response | Minor | ✅ Done |
| 15 | Add PDF statement support via PdfPig + AI-assisted extraction | Additive | ❌ Not Started |
| 16 | Support multi-bank CSV formats (Huntington, BOA) | Minor | ✅ Done |

### Epic 4 — AI Categorization (4 stories)

| # | Story | Tier | Status |
|---|---|---|---|
| 17 | Integrate OpenRouter with 3-tier model routing | Major | ✅ Done |
| 18 | Implement per-transaction AI categorization via MODEL_LIGHT | Major | ✅ Done |
| 19 | Build structured JSON output schema for categories | Minor | ✅ Done |
| 20 | Add AI failure handling and graceful fallbacks | Minor | ✅ Done |

### Epic 5 — Anomaly Detection (3 stories)

| # | Story | Tier | Status |
|---|---|---|---|
| 21 | Implement Z-score anomaly detector | Major | ✅ Done |
| 22 | Flag anomalous transactions at upload time | Major | ✅ Done |
| 23 | Surface anomaly badge and visual highlight in UI | Minor | ✅ Done |

### Epic 6 — Semantic Embeddings & RAG (3 stories)

| # | Story | Tier | Status |
|---|---|---|---|
| 24 | Generate vector embeddings per transaction via OpenRouter | Major | ✅ Done |
| 25 | Store embeddings in pgvector with cosine similarity index | Major | ✅ Done |
| 26 | Implement RAG retrieval: embed query → similarity search → context | Major | ⏳ Partial (embeddings at upload ✅; query-time retrieval deferred — required above ~750 txns) |

### Epic 7 — Forecasting & Time-Series (4 stories)

| # | Story | Tier | Status |
|---|---|---|---|
| 27 | Implement weighted moving average forecasting service | Major | ✅ Done |
| 28 | Build forecast API endpoint per statement | Major | ✅ Done |
| 29 | Build time-series spending API endpoint | Minor | ✅ Done |
| 30 | Render forecast chart in chat visualization panel | Minor | ✅ Done |

### Epic 8 — Conversational AI Chat (5 stories)

| # | Story | Tier | Status |
|---|---|---|---|
| 31 | Build chat API endpoint with full-context LLM pipeline | Major | ✅ Done (query-time RAG deferred) |
| 32 | Implement streaming token delivery to frontend | Major | ✅ Done (SSE: OpenRouter stream → parse JSON → word-by-word answer + chart/done events) |
| 33 | Design guardrailed system prompt for financial scope | Major | ✅ Done |
| 34 | Build chartUpdate JSON contract for AI-driven visualizations | Major | ✅ Done |
| 35 | Implement witty on-brand deflections for off-topic queries | Additive | ✅ Done |

### Epic 9 — Frontend Application (14 stories)

| # | Story | Tier | Status |
|---|---|---|---|
| 36 | Build Dashboard page with stat cards and donut chart | Major | ✅ Done |
| 37 | Build Transactions page with search, filter, sort | Major | ✅ Done (folder tabs, date filter, donut, category pills, summary sidebar — Week 9) |
| 38 | Build Statements page with upload modal and list | Major | ✅ Done |
| 39 | Build Chat page with message interface and chart panel | Major | ✅ Done |
| 40 | Build StatementDetailPage with transactions + charts tabs | Minor | ✅ Done → ⛔ Removed (Week 4, superseded by Dashboard date-range filter) |
| 41 | Connect all pages to live API endpoints | Major | ✅ Done |
| 42 | Implement dynamic chart rendering from chartUpdate JSON | Major | ✅ Done |
| 43 | Add spending/income tab switching on Dashboard | Minor | ✅ Done (folder-tab style — Week 9) |
| 44 | Add expandable transaction rows with full details | Minor | ✅ Done |
| 45 | Implement sessionStorage chat persistence across navigation | Minor | ✅ Done |
| 46 | Add clear chat button and auto-clear on statement delete | Minor | ✅ Done |
| 47 | Restyle StatementDetailPage to match light theme | Minor | ⛔ Dropped — page removed in Week 4 |
| 48 | Dashboard cards — surface change vs last month and sparklines | Additive | ❌ Not Started |
| 49 | Persistent last uploaded statement pill across navigation | Additive | ✅ Done |

### Epic 10 — Testing & QA (5 stories)

| # | Story | Tier | Status |
|---|---|---|---|
| 50 | Write unit tests for Domain and Application layers | Major | ✅ Done |
| 51 | Write integration tests for API and AI layer endpoints | Major | ✅ Done |
| 52 | Document QA manual test cases with pass/fail outcomes | Major | ✅ Done |
| 53 | Implement end-to-end tests for full user flow | Major | ✅ Done |
| 54 | Generate test coverage reports for submission | Minor | ✅ Done |

### Epic 11 — Deployment & Submission (10 stories)

| # | Story | Tier | Status |
|---|---|---|---|
| 55 | Dockerize .NET API with multi-stage build | Major | ✅ Done |
| 56 | Dockerize React frontend with nginx | Major | ✅ Done |
| 57 | Configure Docker Compose for all 3 services | Major | ✅ Done |
| 58 | Deploy to Minikube with K8s manifests | Major | ✅ Done |
| 59 | Configure nginx API proxy for Kubernetes internal routing | Minor | ✅ Done |
| 60 | Prepare PowerPoint deck with real screenshots | Major | ⏳ In Progress |
| 61 | Create 6 architectural diagrams | Major | ✅ Done |
| 62 | Complete project documentation for submission | Major | ✅ Done |
| 63 | Request Animaker access for demo video production | Additive | ⏳ In Progress |
| 64 | Document creativity expansions beyond the original brief | Additive | ✅ Done |

---

## 4. AI Integration Details

### Architecture documentation (submission artifacts)

| Format | File | Audience |
|---|---|---|
| Markdown source of truth | `ARCHITECTURE.md` §4 | Developers — prose + decision log |
| Technical HTML | `../NOSYORMI-Architecture-Technical.html` | Developers — 6 interactive sections, API table, deployment |
| Plain English HTML | `../NOSYORMI-Architecture-PlainEnglish.html` | Everyone — analogies, 7-step journey, light tech hints |
| PNG diagrams | `docs/diagrams/` | Submission — six PNGs matching HTML sections |

The six sections are identical across all formats: **System Architecture · AI Integration Flow · Database Schema · API Endpoint Map · Deployment · User Flow**.

### Model Strategy

NOSYOR.M.I uses three AI model tiers, all routed through OpenRouter:

| Tier | Model | Used For |
|---|---|---|
| MODEL_LIGHT | openai/gpt-4o-mini | Per-transaction categorization at upload |
| MODEL_NARRATION | anthropic/claude-sonnet-4-5 | Dashboard statement narration (`NarrationService`; cached in `Statement.Narration`) |
| MODEL_CHAT | anthropic/claude-sonnet-4-5 | Conversational chat (full statement context injection) |
| EMBEDDING_MODEL | openai/text-embedding-3-small | 1536D vector embeddings for RAG |

> All three LLM tiers are wired in the current build. **NARRATION** executes via `NarrationService` + `NarrationController` when the Dashboard loads a statement. The model is hardcoded in code (matches the default `MODEL_NARRATION` in `.env.example`); the env var itself is not read yet — a one-line follow-up when env-driven routing is desired. Per-anomaly and forecast-specific LLM narration remain deferred.

### System Prompt Strategy

The chat endpoint uses a guardrailed system prompt that:
- Scopes the AI strictly to the user's uploaded financial data
- Instructs the AI to return structured `chartUpdate` JSON when relevant
- Defines the brand voice: calm, precise, gently witty — a financial
  mirror, not a search engine
- Deflects off-topic queries gracefully without preaching

### Prompt Engineering

**Categorization prompt (MODEL_LIGHT):**
Each transaction description is sent with a structured prompt requesting
a JSON response with a single `category` field from a predefined list.
Structured output enforces valid category names and prevents hallucinated
categories.

**Chat prompt (MODEL_CHAT):**
The prompt includes:
1. System context (scope, brand voice, chartUpdate contract, chart-selection rules)
2. Pre-computed monthly category totals (model must cite these figures exactly)
3. Full transaction list for the active statement (each line prefixed with
   `[ID:uuid]`, INCOME/EXPENSE direction, category, amount, anomaly flag)
4. Full conversation history (multi-turn coherence; assistant turns serialized as JSON with `"chartUpdate": {}` placeholder — not `null`)
5. User message

> **Note:** Embeddings are stored in pgvector at upload, but chat does not yet
> run query-time similarity search. Context is the complete statement dataset.
> This full-context approach is reliable for roughly **≤ 750 transactions**;
> beyond that, query-time RAG (story 26) is architecturally required.

The `chartUpdate` contract is defined in the system prompt:
```json
{
  "answer": "narrative text",
  "chartUpdate": {
    "type": "pie|bar|line|anomalies|forecast|stacked|horizontal|treemap|topN",
    "category": "optional category name",
    "highlightTransactionIds": ["optional", "transaction", "uuids"]
  }
}
```
The model returns this shape inside its JSON response (not markdown-wrapped).
After the OpenRouter stream completes, the API parses `answer` and `chartUpdate`,
then delivers them to the browser over **Server-Sent Events**:

| Event `type` | Payload | Purpose |
|---|---|---|
| `text` | `{ content: "word " }` | Parsed answer streamed word-by-word (~18ms delay) |
| `chart` | `{ chartUpdate: {...} }` | Chart panel update (camelCase via `JsonOptions`) |
| `done` | — | Stream complete |
| `error` | `{ message: "..." }` | Graceful fallback |

The frontend renders `chartUpdate` in the chart panel. Types grew from five (MVP) to
nine (`topN` added Week 5). A server-side fallback forces `topN` with
computed `highlightTransactionIds` when the user asks for biggest/top
transactions but the model omits the chart.

### Agentic Patterns

**Upload pipeline (multi-step agentic):**
The upload endpoint orchestrates a sequential multi-step pipeline:
categorization (rule bypass + MODEL_LIGHT) → anomaly detection → embedding → persistence. Each step
is a discrete AI or statistical operation. The .NET API is the
orchestrator — the browser never calls AI services directly.

**Chat context (current build):**
Before every chat response, the service loads all transactions for the
active statement and injects them as structured text context. This grounds
responses in real data without hallucinating amounts.

**RAG (planned — partial today):**
At upload, each transaction is embedded and stored in pgvector. Query-time
retrieval (embed question → cosine similarity → top-k context) is designed
but not wired in `OpenRouterChatService` yet. Chat today uses **full context
injection** — every transaction line plus pre-computed monthly totals.

**Why RAG matters at scale:** Full context works for typical bank CSVs
(roughly ≤ 750 transactions). Above that ceiling, prompt size, latency, cost,
and answer quality degrade; retrieval becomes necessary. The limit is
documented, not enforced in code.

### Failure Handling

- **Rate limits:** OpenRouter errors are caught; chat emits an SSE `error`
  event with a user-friendly message
- **Hallucination guardrails:** The system prompt explicitly instructs
  the AI not to invent transaction data. RAG retrieval provides the
  factual grounding
- **Empty states:** All pages handle the no-statement state with clear
  messaging directing users to upload via the Statements page
- **Duplicate uploads:** SHA-256 hash check prevents re-processing

---

## 5. Technical Decisions

See `DECISIONS.md` for the full decision log. Key decisions:

| Decision | Choice | Rationale |
|---|---|---|
| Architecture | Clean Architecture (4 projects) | Enforced separation, testability |
| Database | PostgreSQL 16 + pgvector | One DB for relational + vector data |
| AI routing | OpenRouter (3 tiers) | Cost control + right model for each task |
| Anomaly detection | Z-score (statistical) | Deterministic, auditable, no AI hallucination risk |
| Forecasting | Weighted moving average | Deterministic, predictable |
| Deduplication | SHA-256 hash | Prevents double-counting before AI runs |
| Deployment | Minikube (K8s) | Submission requirement |
| Frontend state | sessionStorage | Right tradeoff for MVP |

---

## 6. Testing Documentation

### Test Results Summary

| Level | Count | Status |
|---|---|---|
| Unit — Anomaly Detection | 5 | ✅ All passing |
| Unit — Forecasting | 5 | ✅ All passing |
| Unit — CSV Parser | 6 | ✅ All passing |
| Integration — Statements API | 6 | ✅ All passing |
| QA Manual Test Cases | 19 | ✅ All passing (TC-01 to TC-19) |
| E2E — Playwright Critical Path | 6 | ✅ All passing |
| **TOTAL** | **47** | **✅ All passing** |

### Test Locations

- Unit + Integration: `backend/Nosyormi.Tests/`
- QA Manual Cases: `docs/QA-TEST-CASES.md`
- E2E spec: `frontend/e2e/critical-path.spec.ts`
- Playwright config: `frontend/playwright.config.ts`

### Running Tests

```bash
# Unit + Integration
cd backend
dotnet test

# E2E (requires app running on localhost:5173)
cd frontend
npx playwright test
```

---

## 7. Deployment Record

### Docker Compose (Local Development)

Three containers: `nosyormi-postgres` (port 5433), `nosyormi-api`
(port 5034), `nosyormi-frontend` nginx (port 5173).

```bash
cd "/Users/roysondsouza/AI Projects/NOSYORMI/nosyormi"
docker compose --env-file .env.docker up -d
# Access: http://localhost:5173
```

### Minikube (Submission Deployment)

API + frontend pods in Minikube. Postgres in Docker Compose outside
the cluster.

```bash
minikube start
docker compose --env-file .env.docker up -d postgres
minikube service nosyormi-frontend --url
# Use the URL provided — keep terminal open
```

### Environment Configuration

All sensitive values (API keys, DB credentials) are stored in gitignored
env files. The Docker image reads from environment variables injected at
runtime, never from hardcoded values.

- `.env` — local development (gitignored)
- `.env.docker` — Docker Compose (gitignored)
- `k8s/secrets.yaml` — Kubernetes secrets (gitignored)
- `.env.example` — template committed to repo

---

## 8. Known Issues & Limitations

| # | Issue | Type | Notes |
|---|---|---|---|
| 1 | Chat returns "I had trouble reflecting on that" for action requests | By design | Chat is Q&A only, not write operations |
| 2 | AI and database anomaly counts may differ | By design | DB shows Z-score truth; AI shows conversational context |
| 3 | No "mark as not anomaly" user feedback | Deferred | Would require new endpoint + UI |
| 4 | PDF upload not supported | Deferred | CSV covers real bank exports; PdfPig integration deferred |
| 5 | No per-bank statement filtering | Deferred | Architecture supports it; not needed for MVP |
| 6 | No per-statement deep-dive page | Changed | `StatementDetailPage` removed in Week 4; Dashboard date-range filter + Transactions page cover analysis |
| 7 | Chat history lost on browser close | By design | sessionStorage only; DB persistence deferred |
| 8 | Sparklines + change vs last month not implemented | Deferred | Additive tier story; deferred for submission timeline |
| 9 | Per-anomaly / forecast LLM narration | Deferred | Dashboard statement summary uses NARRATION tier; per-anomaly explanations and forecast-specific narratives not implemented |
| 10 | `MODEL_NARRATION` env var not read | Known | `NarrationService` is wired; model hardcoded to `anthropic/claude-sonnet-4-5`. Env/k8s key provisioned but not consumed yet |
| 11 | Tooltip frosted-glass tints over dense colour | Known | `UniversalTooltip` is translucent; over fully-coloured Treemap tiles it picks up tile colour. Browser compositing limitation; accepted |
| 12 | Query-time RAG not wired in chat | Deferred | Embeddings stored at upload; chat uses full statement context today |
| 13 | ~750 transaction ceiling (architectural) | By design | Full context reliable ≤ ~750 txns; RAG required beyond; not enforced in code |
| 14 | Chat streaming model | By design | OpenRouter streams to API; client receives parsed answer word-by-word via SSE (not raw JSON tokens) |
| 15 | Early docs labelled chat as "RAG" | Corrected 29 May | Upload-half done; retrieval-half not implemented; diagrams updated |
| 16 | Logo not a standalone asset file | Known | Brand mark is inline SVG in `NosyormiLogo.tsx`; `favicon.svg` is a separate icon |

---

## 9. Creativity & Expansion Points

Beyond the base FinSight brief, NOSYOR.M.I includes:

**Novel AI Pattern (+High)**
- Four-layer AI architecture (deterministic → statistical → semantic
  → reasoning) rather than a single LLM handling everything
- Chat-to-visualization bridge: AI returns structured `chartUpdate`
  JSON that drives live chart rendering — the chat IS the dashboard
- Server-side keyword routing (`isMonthSpecific`, `topN` fallback) when
  the model picks the wrong chart for time-period or ranked-expense queries

**UX That Surprises (+Medium)**
- Design v1.1: floating white sidebar, Urbanist typography, teal-gold brand
  system, `NosyormiLogo` with hidden I.M.ROYSON wordmark
- macOS glass upload modal; teal-gold animated chat bubble borders
- NOSYOR.M.I brand identity with hidden name reversal (I.M.ROYSON)
- **Reflect** workflow — switch active statement across the whole app with one click

**Feature Expansion (+Medium)**
- Multi-bank CSV support (Standard, Huntington, Bank of America, Wells Fargo-style headers)
  with automatic format detection — no user configuration required
- Nine AI-triggerable chart types (pie, bar, drilldown, line, anomalies,
  forecast, stacked, horizontal, treemap, topN) driven by the `chartUpdate`
  contract, including `highlightTransactionIds` for ranked expenses **and**
  month-scoped category breakdowns (null category + highlight IDs)
- Dashboard and Transactions date-range filters (All Time / per-month / custom)
  scoping stats, donuts, and category totals to the chosen period
- **Unified panel chrome (`#E4E9F0`)** — App main panel, sticky headers, and
  page wrappers aligned so content areas read as one surface between white cards
- **AI Dashboard narration** — NARRATION-tier statement summary auto-generated
  on Reflect, cached in `Statement.Narration` (one OpenRouter call per statement)
- Custom chart visual system (`JewelBar`, `JewelSlice`, unified
  `UniversalTooltip`) centralised in `palette.ts` + `chartEffects.tsx`
- 15-category taxonomy including Education and Government & Fees

**Production-Grade Engineering (+Medium)**
- SHA-256 deduplication enforced at DB level with unique index
- nginx reverse proxy for zero hardcoded API URLs in K8s deployment
- Four-level test suite: unit, integration, QA manual, E2E Playwright

**Completely Original Idea (+High)**
- NOSYOR.M.I is not FinSight. It is a personal finance mirror with a
  distinct brand identity, a four-layer AI architecture that goes well
  beyond the brief, and a product vision grounded in the metaphor of
  reflection — your money, reflected back to you with clarity.

---

*Last updated: 14 June 2026 — Interactive architecture HTML (Technical + Plain English) aligned with ARCHITECTURE.md §4.*