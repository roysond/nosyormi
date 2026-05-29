# NOSYOR.M.I — Frontend

React 19 + TypeScript single-page app built with Vite. Talks to the .NET API over HTTP; renders financial charts with Recharts and a shared visual system (`palette.ts` + `chartEffects.tsx`).

---

## Pages

| Route | Component | Purpose |
|---|---|---|
| `/` | `DashboardPage` | Stat cards, donut chart, spending/income tabs, date-range filter |
| `/transactions` | `TransactionsPage` | Search, category filter, sort, expandable rows, anomaly badges |
| `/statements` | `StatementsPage` | Upload CSV, list statements, delete with confirmation |
| `/chat` | `ChatPage` | AI chat + dynamic chart panel (9 chart types) |

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
- **Docker / Minikube:** nginx proxies `/api` to the backend service; the built bundle uses relative `/api` paths.

---

## Chat visualization contract

The chat endpoint returns `{ answer, chartUpdate }`. Supported `chartUpdate.type` values:

`pie` · `bar` · `line` · `anomalies` · `forecast` · `stacked` · `horizontal` · `treemap` · `topN`

Optional fields: `category` (scopes bar drilldown), `highlightTransactionIds` (for `topN` and anomaly highlights).

Chart colours and effects: `src/constants/palette.ts`, `src/components/chartEffects.tsx`.

---

## State persistence

- **Chat:** `sessionStorage` keys for messages, chart state, and active statement — survives in-tab navigation, cleared on tab close.
- **Statement delete:** `nosyormi-statement-deleted` custom event clears chat when a statement is removed.

---

## Theme (current)

- Content background: `#F4F7F9` · Cards: `#FFFFFF` with soft shadow
- Sidebar: `#071A1E` · Active nav: `#E8C96A`
- UI chrome accent: `#071A1E` · Line chart stroke: `#C9911A`

---

## Related docs

Repo root: [ARCHITECTURE.md](../ARCHITECTURE.md), [PROJECT-DOCUMENTATION.md](../PROJECT-DOCUMENTATION.md).
