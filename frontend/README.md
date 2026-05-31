# NOSYOR.M.I — Frontend

React 19 + TypeScript single-page app built with Vite. Talks to the .NET API over HTTP; renders financial charts with Recharts and a shared visual system (`palette.ts` + `chartEffects.tsx`).

> **Chat:** `POST /api/chat/{statementId}` returns **Server-Sent Events** (`text/event-stream`). The backend buffers the OpenRouter stream, parses JSON (`answer` + `chartUpdate`), then streams the parsed answer word-by-word. Chart updates arrive in a separate `chart` event. Full statement context is injected server-side (not query-time pgvector RAG; reliable for roughly ≤ 750 transactions).

---

## Pages

| Route | Component | Purpose |
|---|---|---|
| `/` | `DashboardPage` | Stat cards, donut chart, spending/income tabs, date-range filter |
| `/transactions` | `TransactionsPage` | Search, category filter, sort, expandable rows, anomaly badges |
| `/statements` | `StatementsPage` | Upload CSV, list statements, delete with confirmation |
| `/chat` | `ChatPage` | AI chat (SSE) + dynamic chart panel (9 chart types) |

---

## Scripts

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle → dist/
npm run lint
npx playwright test   # E2E — requires app running
```

---

## API base URL

- **Local dev:** `VITE_API_BASE_URL` defaults to `http://localhost:5034` (see `vite.config.ts` / env).
- **Docker Compose:** frontend built with `VITE_API_BASE_URL=http://localhost:5034` (direct API calls from browser).
- **Minikube:** nginx proxies `/api` to the backend service; K8s frontend image uses relative `/api` when built with empty base URL.

---

## Chat SSE contract

The chat endpoint streams events (not a single JSON body):

| Event `type` | Purpose |
|---|---|
| `text` | Parsed answer fragment (`content` — typically one word + space) |
| `chart` | `{ chartUpdate }` — camelCase fields (`highlightTransactionIds`, etc.) |
| `done` | Stream finished |
| `error` | User-friendly fallback message |

Supported `chartUpdate.type` values:

`pie` · `bar` · `line` · `anomalies` · `forecast` · `stacked` · `horizontal` · `treemap` · `topN`

Optional fields: `category` (scopes bar drilldown), `highlightTransactionIds` (for `topN` and anomaly highlights).

Chart colours and effects: `src/constants/palette.ts`, `src/components/chartEffects.tsx`, `chartEffects.css`.

---

## State persistence

- **Chat:** `sessionStorage` keys for messages, chart state, and active statement — survives in-tab navigation, cleared on tab close.
- **Statement delete:** `nosyormi-statement-deleted` custom event clears chat when a statement is removed.

---

## Theme (current)

- Content background: `#F4F7F9` · Cards: `#FFFFFF` with soft shadow
- Sidebar: `#071A1E` · Active nav: `#E8C96A`
- UI chrome accent: `#071A1E` · Line chart stroke: `#C9911A`
- Anomaly highlight: `#D97706` (`ANOMALY_COLOR`) — inner-glow row pulse; expense amounts stay `#EF4444`

---

*Last updated: 30 May 2026*

## Related docs

Repo root: [ARCHITECTURE.md](../ARCHITECTURE.md), [PROJECT-DOCUMENTATION.md](../PROJECT-DOCUMENTATION.md).
