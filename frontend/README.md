# NOSYOR.M.I — Frontend

React 19 + TypeScript single-page app built with Vite. Talks to the .NET API over HTTP; renders financial charts with Recharts and a shared visual system (`palette.ts` + `chartEffects.tsx`).

> **Chat:** `POST /api/chat/{statementId}` returns **Server-Sent Events** (`text/event-stream`). The backend buffers the OpenRouter stream, parses JSON (`answer` + `chartUpdate`), then streams the parsed answer word-by-word. Chart updates arrive in a separate `chart` event. Full statement context is injected server-side (not query-time pgvector RAG; reliable for roughly ≤ 750 transactions).
>
> **Narration:** `GET /api/narration/{statementId}` returns a cached statement summary paragraph for the Dashboard (`Statement.Narration` in the DB; one OpenRouter call per statement on first load).

---

## Pages

| Route | Component | Purpose |
|---|---|---|
| `/` | `DashboardPage` | Stat cards (teal hero + gradients), AI narration card (NARRATION tier, cached), donut chart, spending/income tabs, date-range filter |
| `/transactions` | `TransactionsPage` | Search, category filter, anomaly pill toggle, sort, expandable rows |
| `/statements` | `StatementsPage` | Upload CSV (macOS glass modal), list statements, **Reflect** to switch active statement, delete |
| `/chat` | `ChatPage` | AI chat (SSE) + dynamic chart panel (9 chart types); “Let's Reflect” in sidebar nav |

---

## Brand & layout (Design v1.1)

- **Font:** Urbanist (global)
- **Shell:** `#ECEEF1` background; floating white sidebar (`App.tsx`)
- **Logo:** `src/components/NosyormiLogo.tsx` — inline SVG (teal circle, gold N, coloured arcs) + wordmark; no separate logo file in repo
- **Brand tokens:** `BRAND_TEAL_BASE`, `BRAND_TEAL_EDGE`, `BRAND_GOLD` in `palette.ts`
- **Glass modal:** `MACOS_GLASS_TEXTURE` + `macosGlass(rgb, opacity)` on Statements upload overlay

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

Optional fields:

- `category` — scopes bar drilldown to one category’s transactions
- `highlightTransactionIds` — for `topN`, anomaly highlights, **and month-specific category breakdowns** (`category` null + IDs = filter before totals)

### Bar chart behaviour (`ChatPage`)

| Mode | When | Data |
|---|---|---|
| Category drill-down | `chartUpdate.category` set | Up to 20 transactions in that category (optionally filtered by highlight IDs) |
| Month-specific | `category` null + `highlightTransactionIds` | Category totals built from highlighted transactions only |
| Default | Neither | All expense category totals |

Non-drill-down bar height: `Math.max(320, barData.length * 56)`.

Chart titles: month-aware when user message contains a month name (e.g. “March — Spending Breakdown”).

Chart colours and effects: `src/constants/palette.ts`, `src/components/chartEffects.tsx`, `chartEffects.css`.

---

## State persistence

- **Chat:** `sessionStorage` keys for messages, chart state, and active statement — survives in-tab navigation; preserved on remount when stored data exists.
- **Statement selection:** Reflect button on Statements page; sidebar `StatementPill` shows explicitly selected statement.
- **Statement delete:** `nosyormi-statement-deleted` custom event clears chat when a statement is removed.

---

## Theme (Design v1.1)

- App shell: `#ECEEF1` · Content: `#F4F7F9` · Cards: `#FFFFFF` with soft shadow
- Sidebar: floating white card, teal active marker `#124346`
- Line chart stroke: `#00897B` · Anomaly highlight: `#D97706` (`ANOMALY_COLOR`)
- Chart palette: 15 colours in `APP_COLORS` (15 categories including Education, Government & Fees)

---

*Last updated: 8 June 2026 — AI Dashboard narration card, NARRATION API, Design v1.1*

## Related docs

Repo root: [ARCHITECTURE.md](../ARCHITECTURE.md), [PROJECT-DOCUMENTATION.md](../PROJECT-DOCUMENTATION.md).
