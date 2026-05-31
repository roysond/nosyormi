# DECISIONS.md
> NOSYOR.M.I — Key Architectural & Product Decisions  
> Student: Royson D'Souza · Capstone Project 11 (FinSight)

This document summarises the most significant decisions made during the 
build. Full rationale for each is in ARCHITECTURE.md Section 9.

---

## Stack Decisions

| Decision | Choice | Why |
|---|---|---|
| Backend | .NET 10 Web API | Capstone requirement |
| Frontend | React 19 + TypeScript + Vite | Modern tooling, fast HMR |
| Database | PostgreSQL 16 + pgvector | Relational + vector in one DB |
| AI Provider | OpenRouter | Single API, multiple model providers |
| Containers | Docker Compose + Minikube | Local dev + K8s submission |
| Testing | xUnit + Playwright | .NET standard + E2E coverage |
| Architecture | Clean Architecture (4 projects) | Separation of concerns |

---

## AI Decisions

| Decision | Choice | Why |
|---|---|---|
| Categorization model | `openai/gpt-4o-mini` (LIGHT) | Cheap, fast, per-transaction — **wired** |
| Chat model | `anthropic/claude-sonnet-4-5` (CHAT) | Best reasoning for conversation — **wired** (`MaxTokens` 1500, full statement context) |
| Chat context | Full transaction list per statement | Grounds answers in real data; query-time RAG deferred |
| ~750 txn ceiling | Full context injection below ~750 rows | Above this, prompt size/latency/cost degrade — RAG retrieval required; not enforced in code |
| topN chart fallback | Server-side in `OpenRouterChatService` | Forces ranked expenses when model misses `topN` intent |
| Narration model | `anthropic/claude-sonnet-4-5` (NARRATION) | Reserved for anomaly/forecast narration — **configured but not wired in current build** |
| Embedding model | `openai/text-embedding-3-small` | 1536D, fixed — never changed post-data — **wired** |
| Anomaly detection | Z-score (statistical, not AI) | Deterministic, auditable, exact |
| Forecasting | Weighted moving average (not AI) | Deterministic, no hallucination risk |
| Orchestrator | .NET API | Browser never calls AI directly |

---

## Product Decisions

| Decision | Choice | Why |
|---|---|---|
| Upload location | Statements page only | Dashboard = analysis, Statements = management |
| Deduplication | SHA-256 file hash | Prevents double-counting before AI runs |
| Delete strategy | Hard delete + cascade | No audit trail needed in MVP |
| Chat persistence | sessionStorage only | Survives navigation, not browser close |
| PDF support | Deferred | Not in MVP scope, documented as known limitation |
| Multi-bank filtering | Deferred | Architecture supports it, not needed for submission |

---

## Deployment Decisions

| Decision | Choice | Why |
|---|---|---|
| Postgres location | Docker Compose (outside K8s pod) | Pod lifecycle must not affect data |
| API URL in frontend | nginx proxy (`/api` → internal DNS) | Zero hardcoded URLs in bundle |
| Secrets management | `.env.docker` gitignored, `k8s/secrets.yaml` gitignored | Keys never committed |
| Minikube startup | 3-step sequence (minikube → postgres → tunnel) | Documented in ARCHITECTURE.md |

---

## Tradeoffs Accepted

| Tradeoff | What was sacrificed | Why accepted |
|---|---|---|
| EF Core in Application layer | Pure Clean Architecture | 3-week timeline — repository pattern adds files with no MVP benefit |
| sessionStorage chat history | Persistence across browser close | DB chat persistence adds schema complexity, deferred |
| Single statement view | Per-bank filtering | Multi-bank grouping adds app-wide state, deferred |
| CSV only | PDF upload | PdfPig integration deferred — CSV covers real bank exports |
| ChatPage as one large component | Extracted chart components | Chart renderers belong in their own modules; deferred under deadline |
| `MODEL_NARRATION` left as dead config | Implemented narration tier | Routing abstraction makes wiring it later additive; not needed for MVP |

---

## Week 4 Decisions (28 May 2026)

| Decision | Choice | Why |
|---|---|---|
| Chart styling architecture | `palette.ts` (colour) + `chartEffects.tsx` (effects) | Single source of truth each — SRP/OCP; tweak colour or effect in one place |
| Shared tooltip | One `UniversalTooltip` for all charts | Replaced three duplicated tooltip components; consistency + DRY |
| Chart types | Added `stacked`, `horizontal`, `treemap` (5 → 8), then `topN` (→ 9) | Richer intent-matched answers; `highlightTransactionIds` for ranked expenses |
| Category taxonomy | Added `Parking & Tolls` (11 total) | Real statements needed it; taxonomy + classifier prompt kept in sync |
| Chat robustness | `MaxTokens` 500 → 1500; assistant turns serialized as JSON | Stop mid-response truncation; coherent multi-turn context |
| Theme | Content `#F4F7F9`, white cards + soft shadow, deep-forest `#071A1E` accent | Higher contrast for dense tables/charts; unified chrome |
| Dashboard date filter | All Time / per-month / custom range | Scopes all stats to a period; replaces the removed per-statement view |
| `StatementDetailPage` | Removed (page + `/dashboard/:id` route + View Details link) | Duplicated Dashboard/Transactions analysis; superseded by date filter |

---

## Week 5 Decisions (29 May 2026)

| Decision | Choice | Why |
|---|---|---|
| `topN` chart type | Ranked expense bars via `highlightTransactionIds` | “Biggest/top” questions need individual transactions, not category totals |
| Server-side topN fallback | Keyword detection + DB sort by abs(amount) | Model sometimes returns `bar` instead of `topN`; deterministic correction |
| Transaction IDs in chat context | `[ID:uuid]` on every line | Enables highlights and auditability; avoids date-as-ID mistakes |
| Merchant questions | `bar` + `category` for the merchant's bucket | Shows all transactions in that category as separate bars |
| Query-time RAG | Deferred | Embeddings stored at upload; full context sufficient for MVP statement sizes (≤ ~750 txns) |
| Chat delivery (SSE) | Stream → parse JSON → word-by-word `text` events | Meets capstone “no frozen spinner”; keeps valid `chartUpdate` parsing |
| Architectural diagrams | Regenerated in `docs/diagrams/` | Corrected to match codebase: React 19, upload order, full-context chat, API response shapes |
| Categorization rules | Rule bypass before MODEL_LIGHT | Subscriptions, ATM/cash, transfers, Square TST*, DoorDash food — reduces LLM calls and mislabels |
| Category taxonomy | 13 categories | Added Transfers & Payments, ATM & Cash for real bank statement patterns |

---

## Week 6 Decisions (30 May 2026)

| Decision | Choice | Why |
|---|---|---|
| SSE chat streaming | `StreamChatAsync` + `ReadableStream` on frontend | Capstone streaming requirement; progressive answer display |
| Stream parsing order | Buffer OpenRouter → `ParseChatResponse` → emit words | Model returns JSON object, not plain text — avoids showing raw JSON in UI |
| SSE serialization | `JsonOptions` (camelCase) on all events | Frontend expects `highlightTransactionIds`, not PascalCase |
| Anomaly colour | `#D97706` + inner-glow pulse | Unified amber highlight; expense amounts stay `#EF4444` |
| CSV Payee/Memo | Memo used when Payee Name empty | Real bank exports (ATM deposits) had blank payee |

---

*Last updated: 30 May 2026 — SSE streaming, anomaly styling, CSV memo fallback, docs aligned*