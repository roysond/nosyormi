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
| Frontend | React 18 + TypeScript + Vite | Modern tooling, fast HMR |
| Database | PostgreSQL 16 + pgvector | Relational + vector in one DB |
| AI Provider | OpenRouter | Single API, multiple model providers |
| Containers | Docker Compose + Minikube | Local dev + K8s submission |
| Testing | xUnit + Playwright | .NET standard + E2E coverage |
| Architecture | Clean Architecture (4 projects) | Separation of concerns |

---

## AI Decisions

| Decision | Choice | Why |
|---|---|---|
| Categorization model | `openai/gpt-4o-mini` (LIGHT) | Cheap, fast, per-transaction |
| Chat + RAG model | `anthropic/claude-sonnet-4-5` (CHAT) | Best reasoning for conversation |
| Embedding model | `openai/text-embedding-3-small` | 1536D, fixed — never changed post-data |
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

---

*Last updated: 25 May 2026*