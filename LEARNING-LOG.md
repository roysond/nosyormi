# LEARNING-LOG.md
> NOSYOR.M.I — What I Learned Building This  
> Student: Royson D'Souza · Capstone Project 11 (FinSight)  
> Background: No prior IT or coding experience before this program  
> **Last updated:** 14 June 2026 — Interactive architecture HTML aligned with ARCHITECTURE.md §4

This document captures the real learning that happened during the build —
the errors encountered, how they were fixed, and what the fix taught me.
Written in plain English, not technical jargon.

---

## Week 1 — Architecture & Backend (May 7–17)

### What is Clean Architecture and why does it matter?

Before this project I had never heard of Clean Architecture. The idea
is simple once you see it: you split your code into layers, and each
layer only talks to the one below it. The innermost layer (Domain) has
no dependencies on anything. The outermost layer (Api) can depend on
everything.

Why does this matter? Because when I needed to move `StatementQueryService`
from the Application layer to the Infrastructure layer (May 20), I could
do it without breaking anything else. The rest of the system depended on
the *interface* (`IStatementQueryService`), not the concrete class. So
I moved the class, updated the interface location, and everything still
worked. That's what Dependency Inversion actually means in practice.

### What is pgvector and why PostgreSQL?

I chose PostgreSQL with the pgvector extension because it lets me store
two completely different kinds of data in one database:
- Regular relational data (statements, transactions, categories)
- Vector embeddings (1536-dimensional number arrays for semantic search)

Before this project I didn't know what an embedding was. An embedding is
a way of converting text into numbers so that similar text produces
similar numbers. "Whole Foods" and "Walmart Groceries" will produce
similar vectors because they are both grocery stores — even though the
words are completely different.

### Why does the embedding model never change?

I learned this the hard way in planning: if you embed your data with
model A and then switch to model B, the old embeddings and new embeddings
are incompatible. They live in different "spaces". You would have to
re-embed every single transaction from scratch.

This is why the embedding model (`openai/text-embedding-3-small`) is
fixed as a constant. Changing it is a deliberate migration, not a
casual config swap.

---

## Week 2 — Frontend & AI Integration (May 18–22)

### Why I reversed the dark/light theme decision

I originally planned a dark theme for the entire app. During Week 2 I
switched to a light theme for the main content pages. The reason was
practical: I use red for expenses and green for income throughout the
app. On a dark background, both colors look similar in brightness and
the distinction becomes harder to read at a glance. On a light
background, the contrast between red and green is immediately clear.

This is a UX principle called contrast ratio — the background you
choose affects how well your data colors communicate.

### The hardcoded statement ID problem

In early development I hardcoded a specific statement UUID into three
different page files so I could test quickly. This was fine for one
statement but broke completely when I uploaded a second one — the
pages still showed the first statement's data.

The fix was to remove all hardcoded IDs and instead call
`GET /api/statements` on every page load, take the first result, and
use that ID for all subsequent calls. This taught me why configuration
should never live inside code — it should come from data.

### What RAG actually means (and what NOSYOR.M.I does today)

RAG stands for Retrieval-Augmented Generation. The full pattern is:
1. Embed the user's question
2. Search stored embeddings for similar transactions
3. Send only the top matches as context to the LLM

**What ships today:** At upload, every transaction gets an embedding stored
in pgvector. In chat, the API sends the **entire statement** as structured
text (with `[ID:uuid]` on each line) — not similarity search. That still
grounds answers in real data, but it is not query-time RAG yet.

Why both? Embeddings are the foundation for semantic search later. For
MVP-sized statements (roughly **≤ 750 transactions**), full context is
simpler and avoids retrieval bugs. **Above ~750 transactions**, query-time
RAG becomes necessary — prompt size, latency, cost, and answer quality
degrade when every row is injected. The ceiling is architectural, not
enforced in code (no upload or chat rejection at 750).

### The EMBEDDING_MODEL missing from .env.docker

When I containerized the app with Docker and ran it for the first time,
every CSV upload returned a 500 Internal Server Error. The API logs
showed a null reference exception in the embedding service.

The cause: I had `EMBEDDING_MODEL` defined in my local `.env` file but
had forgotten to add it to `.env.docker`. The Docker container
environment is completely separate from the local environment — it only
sees what you explicitly give it.

Fix: added `EMBEDDING_MODEL=openai/text-embedding-3-small` to
`.env.docker`. Lesson: every environment variable in `.env` must be
manually mirrored in `.env.docker`. They do not share.

### Why the Huntington CSV showed everything as "Other"

When I tested with a real Huntington Bank statement, every single
transaction was categorized as "Other". I initially thought this was
an AI problem.

It wasn't. The Huntington CSV format has a `Payee Name` column and a
`Memo` column instead of a single `Description` column. My parser was
only reading `Description`, which was empty in Huntington files. The AI
was receiving blank descriptions and correctly categorizing blanks as
"Other".

Fix: detect the Huntington format by checking for the `Payee Name`
header, then combine `Payee Name` + ` - ` + `Memo` into a single
description string before sending to the AI. Lesson: always test with
real data as early as possible.

### Why the Bank of America CSV failed completely

BOA CSV files have a 6-row summary block at the top before the actual
transaction data begins. My parser expected the first row to be the
header and crashed when it found account information instead.

Fix: scan through the rows until a row is found that contains the word
"Date" — that's the real header. Start parsing from there. Also skip
any rows where the Date column is empty (BOA includes blank rows as
separators). Lesson: real-world data is messier than sample data.
Always handle it defensively.

### The DotNetEnv overwrite problem

`Program.cs` calls `Env.Load()` which loads `.env` and overwrites any
existing shell environment variables. This caused problems when running
EF Core migrations against the Docker Postgres instance (port 5433)
because `Env.Load()` was replacing the connection string with the local
one (port 5432).

Fix: always use the `--connection` flag when running EF migrations
against Docker:
```bash
dotnet ef database update \
  --project Nosyormi.Infrastructure \
  --startup-project Nosyormi.Api \
  --connection "Host=localhost;Port=5433;Database=nosyormi;Username=nosyormi;Password=nosyormi_password"
```

---

## Week 3 — Testing, Deployment & Polish (May 21–25)

### What the four levels of testing actually mean

Before this project "testing" meant running the app and clicking around.
Now I understand there are four distinct levels:

**Unit tests** — test one class in complete isolation. No database, no
network, no other classes. Fast and precise. I wrote unit tests for
`ZScoreAnomalyDetector`, `MovingAverageForecastingService`, and
`CsvStatementParser`.

**Integration tests** — test how multiple parts work together. My
integration tests call the actual API controller with a real test
database. They verify that a CSV upload actually creates statement and
transaction records in the database.

**QA manual tests** — a documented list of test cases a human runs
through. Captures scenarios that are hard to automate, like "what
happens if I upload the same file twice?" (Answer: 409 Conflict.)

**E2E tests** — automated tests that control a real browser (Playwright)
and simulate a complete user journey. My E2E tests upload a file,
navigate to the Dashboard, verify data appears, and navigate to Chat.

### What Docker actually does

Docker packages your application and all its dependencies into a
container — a self-contained unit that runs the same way on any machine.
Before Docker, "it works on my machine" was a real problem. With Docker,
the container IS the machine.

I have three containers:
- `nosyormi-postgres` — the database
- `nosyormi-api` — the .NET API
- `nosyormi-frontend` — nginx serving the React build

They communicate with each other over a Docker network. The frontend
doesn't call the API directly by IP — it calls `/api` and nginx proxies
the request to the API container internally.

### What Kubernetes and Minikube are

Docker runs containers. Kubernetes runs and manages containers at scale —
restarting them if they crash, scaling them up if traffic increases,
routing traffic between them.

Minikube is Kubernetes that runs on your laptop. It's the same thing,
just smaller. For this submission, the API and frontend run as Kubernetes
pods inside Minikube, while the database runs in Docker Compose outside
the cluster (by design — database persistence must not depend on pod
lifecycles).

### Why nginx is needed in Kubernetes

In Docker Compose, the frontend container talks to the API container
directly because they share a network. In Kubernetes, the frontend pod
is isolated. To avoid hardcoding the API's IP address into the React
bundle (which would change every deployment), nginx is configured to
proxy any request to `/api/*` to the API service by Kubernetes DNS name
(`http://nosyormi-api:5034`).

This means the frontend bundle never contains any API URL. The proxy
handles it transparently regardless of where the API pod ends up.

### The sessionStorage pattern for chat state

The Chat page uses `sessionStorage` to persist:
- The full message history
- The current chart update state
- The active statement ID and filename

`sessionStorage` survives page navigation within the same browser tab
but is cleared when the tab is closed. This was a deliberate choice —
full database persistence for chat history would require a new schema
table, a new API endpoint, and authentication to prevent one user
seeing another user's history. For a single-user personal finance app
in an MVP, `sessionStorage` provides the right tradeoff.

### What I learned about color theory for data visualization

When redesigning the UI in Week 3, I learned that background color
affects how data colors are perceived. The original Crystal Teal accent
(`#00637C`) became nearly invisible against the new tinted background
(`#CCE8EC`) because they share the same hue — blue-green. Two colors
from the same family don't create contrast.

The solution was Honey Amber (`#C9911A`) — a warm color against a cool
background. Warm and cool colors sit opposite each other on the color
wheel, creating genuine contrast. This is called complementary color
theory.

I also learned that CSS `filter: drop-shadow` only works on SVG-based
icons, not on emoji. This is why I replaced emoji navigation icons with
Tabler Icons (an SVG icon library) — emoji are raster images that ignore
CSS filters, while SVG icons respond to them.

---

## Week 4 — Visual System & Refinement (May 26–28)

### Separating "what colour" from "what effect"

When I started adding fancy chart effects (gradient bars, shimmering
donut slices), the colour values and the effect code were getting tangled
together inside each page. Changing one colour meant hunting through three
different files, and the same tooltip was copy-pasted three times with
slightly different styling.

I split it into two files with one job each:
- `constants/palette.ts` — *only* colours (`APP_COLORS` and named
  constants). This is the single place I change a colour.
- `components/chartEffects.tsx` — *only* effects (`JewelBar`,
  `JewelSlice`, `AnomalyBar`, and one shared `UniversalTooltip`).

This is the Single Responsibility Principle in plain terms: each file has
one reason to change. Now adding a colour or a new chart effect is a
one-file edit, and every chart on every page shares the exact same
tooltip instead of three near-duplicates. Less code, fewer bugs, and the
charts finally look consistent.

### Why the same tooltip looked different on different charts

After unifying the tooltip, I noticed the donut tooltip looked subtly
different from the treemap tooltip even though they were now the *same*
component. The cause taught me something about CSS: the tooltip uses a
translucent "frosted glass" background, so it shows whatever is behind it.
On the treemap (which is packed wall-to-wall with colour) the tooltip
picked up the tile colour; on the donut (mostly white space) it stayed
clean. Same component — different backdrop. A CSS `filter` on the chart
wrapper was also bleeding onto the tooltip, which I fixed by making the
tooltip wrapper transparent. Lesson: translucency and CSS filters affect
everything behind/inside them, not just the element you think you styled.

### Deleting a feature is also progress

I built a whole `StatementDetailPage` (a per-statement deep-dive with its
own charts and tabs) in Week 2. In Week 4 I deleted it. Once the Dashboard
had a date-range filter, the detail page was just duplicating the same
analysis with extra code to maintain. Removing it — the page, its route,
and the link that pointed to it — made the app simpler without losing any
real capability. I learned that taking code *out* can be as valuable as
putting it in, and that "I built it" is not a reason to keep something.

### Dead config is worth finding — and worth wiring when the time comes

While reviewing the app I checked whether `MODEL_NARRATION` (one of my
three AI model tiers) was actually used anywhere. In May 2026 it wasn't — it sat in
my `.env`, Docker, and Kubernetes config but no code read it. The
narration feature it was meant for was not wired up yet. Rather than quietly
pretend it works, I documented it honestly as a known limitation. Lesson:
configuration that nothing reads is a trap for the next person (or
future-me) — name it out loud.

In June 2026 I wired the NARRATION tier: `NarrationService` generates a
Dashboard statement summary via OpenRouter, `NarrationController` exposes
`GET /api/narration/{statementId}`, and the result is cached in
`Statement.Narration` so each statement is narrated once. The env var
`MODEL_NARRATION` is still not read (the model is hardcoded today) — a
smaller leftover, but the tier itself is live.

---

## Week 5 — Chat Intelligence (May 29)

### When the model picks the wrong chart, fix it in code

Users asking for "my top 10 expenses" need individual transactions ranked
by amount — not a category bar chart. The LLM sometimes returned `bar`
anyway. I added two layers of defence:

1. **Prompt rules** — the system prompt lists mandatory phrases that must
   trigger `type: "topN"` and `highlightTransactionIds`.
2. **Server fallback** — if the user message still looks like a top-N query,
   `OpenRouterChatService` sorts expense transactions by absolute amount,
   takes the top N IDs, and overwrites the chart type before returning JSON.

Lesson: prompts guide behaviour; deterministic code guarantees critical UX.

### Transaction IDs in context

Each transaction line in the chat context now starts with `[ID:uuid]`. The
model uses those UUIDs in `highlightTransactionIds`. Without IDs, the model
might use dates or descriptions — which do not match database keys. Making
the contract explicit in the data format reduced highlight mismatches.

### Full context vs RAG (honest scope)

I originally documented "RAG chat" in submission materials. The code stores
embeddings but chat loads all rows. Updating the docs to match reality was
important — reviewers and future-me need to know what is implemented vs planned.

**What is actually wired:**
- **Upload:** embed every transaction → store in pgvector ✅
- **Chat:** load all transactions + monthly summary → send to LLM ✅
- **Chat:** embed question → pgvector search → top-K retrieval ❌

**The ~750 transaction limit:** Because chat sends the entire statement as
text context (plus system prompt and history), the architecture has a practical
ceiling of about **750 transactions**. Below that, full context is accurate
and simpler. Beyond that, you need query-time RAG — otherwise the prompt is
too large, slow, expensive, and the model starts missing or contradicting data.
Nothing in the app blocks you at 750; it is a design constraint we document
honestly after reviewing the architecture with Claude.

**Diagrams corrected (29 May):** All six PNGs in `docs/diagrams/` were
regenerated so submission materials no longer imply pgvector retrieval is active.

### SSE streaming (30 May)

The capstone required streaming so the chat does not feel frozen. The model
returns a **JSON object** (`answer` + `chartUpdate`), not plain sentences.
Streaming raw tokens to the browser would have shown `{` and `"answer"` on screen.

The fix: let OpenRouter stream into a `StringBuilder` on the server, parse the
complete JSON with the existing `ParseChatResponse` logic, then send the
**parsed answer** to the frontend one word at a time over Server-Sent Events.
The chart update arrives in a separate `chart` event after the words finish.

Lesson: “streaming” in a product can mean streaming *parsed output*, not
necessarily streaming the model’s raw bytes.

---

## Week 6 — Design v1.1 & Statement Switching (May 31 – Jun 1)

### Why the sidebar went from dark forest to floating white

The deep-forest sidebar looked premium but fought the light content area.
Design v1.1 moved to a **floating white card** sidebar on a grey shell
(`#ECEEF1`) with teal active markers that match the logo (`#124346`).
The logo itself became a real component (`NosyormiLogo.tsx`) — teal circle,
gold “N” bars, coloured arcs — so the brand mark and UI tokens share the
same palette.

### Reflect is not just branding — it is state management

When I added multiple statements, “always show the latest upload” was wrong
for anyone comparing months across files. The **Reflect** button writes the
chosen statement ID to sessionStorage; every page reads that selection.
The sidebar pill now shows **only** what the user explicitly selected —
not an implicit default that changes under them.

### Month questions need server *and* client agreement

“Asking about March” used to show a stacked chart of **all months** or
unfiltered category totals. The fix was two-sided:

1. **Backend:** detect the month once (`DetectTimePeriod`), set
   `isMonthSpecific`, return `bar` with `highlightTransactionIds` for
   that month’s expenses only.
2. **Frontend:** when `category` is null but highlight IDs exist, filter
   expenses before `buildCategoryTotals`.

Neither layer alone is enough — the contract has to match on both sides.

### Assistant history lost chart context because of `null`

Multi-turn chat rebuilt assistant messages as JSON with
`"chartUpdate": null`. The model treated that as “no chart ever happened.”
Replacing `null` with `{}` preserves structure without re-sending the
full chart payload. Small string change; big coherence improvement.

---

## The Most Important Thing I Learned

**Working software is built incrementally, not all at once.**

Every major feature in NOSYOR.M.I was built in this order:
1. Make it work (don't care about quality yet)
2. Make it correct (handle edge cases, real data)
3. Make it clean (refactor, document, test)

I used to think good developers wrote perfect code on the first attempt.
They don't. They write working code, then improve it. The hardcoded
statement ID, the missing EMBEDDING_MODEL, the Huntington parsing bug —
these weren't failures. They were steps in the process.

The other thing: AI tools (Cursor, Claude) don't replace understanding.
They amplify it. When I didn't understand Clean Architecture, the AI
could generate code that followed it — but I couldn't verify if it was
right or debug it when it went wrong. Once I understood the concept,
I could use the AI to implement it faster AND catch its mistakes. The
learning came first. The speed came after.

---

## Week 8 — AI Dashboard Narration (June 2026)

### Generate once, cache forever

Calling OpenRouter on every Dashboard visit would be slow and expensive.
The narration card only needs one paragraph per statement — it does not
change unless the underlying data changes. Caching the result in
`Statement.Narration` means the first visit pays the API cost; every
reload after that is instant.

The NARRATION tier was provisioned in config for months before any code
read it. Wiring `NarrationService` closed that gap — and documenting the
remaining env-var follow-up (`MODEL_NARRATION` not read yet) keeps the
docs honest about what is fully dynamic vs hardcoded.

---

## Week 9 — Transactions Parity & Folder Tabs (June 2026)

### Folder tabs are CSS, not a component library

The Spending/Income switcher on Dashboard and Transactions uses the same trick:
rounded top corners on the active tab, a white content panel below, and
`::before` / `::after` pseudo-elements with `box-shadow` to fake smooth
outer curves where the tab meets the panel. No extra dependency — just
positioned elements and z-index.

### Hysteresis stops scroll jitter

A sticky header that shrinks at `scrollTop > 0` and grows at `scrollTop === 0`
flickers when you scroll slowly around the top. Using **different thresholds**
(compact above 40px, expand only below 20px) creates a dead band so the
header does not oscillate. Small UX detail; noticeable when testing on a
trackpad.

### Parity reduces cognitive load

Once Dashboard had a date filter and donut, Transactions felt incomplete with
only a flat list. Porting the same `availablePeriods` + `filterTransactionsByDate`
helpers and donut interaction means users learn one pattern for “scope by
period and drill into a category” on both analysis pages.

### Category pills tie list to chart

Colouring each row’s category badge from the same `APP_COLORS` index as the
donut legend makes the table and chart feel like one view. The pill uses a
light tint (`hexToRgba` at 15% opacity) and a darkened text colour so it
stays readable on white rows.

---

## Week 10 — Panel Unification & Interaction Fixes (June 2026)

### One panel colour beats two page backgrounds

After Design v1.1, page wrappers still used `#F4F7F9` while the App main
panel (`App.tsx`) used `#E4E9F0`. That created a subtle banding effect
between the sticky header strip and the gaps around white cards. The fix was
layered:

1. **Dashboard** — set `styles.page` to `transparent` and the sticky header
   to `#E4E9F0` so the panel colour shows uniformly between header and cards.
2. **Statements** — set `styles.page` to `#E4E9F0` directly.
3. **Transactions** — same transparent page + `#E4E9F0` sticky header pattern
   as Dashboard.

White card surfaces were left unchanged — only page-level wrappers and headers
were adjusted. Lesson: background hierarchy matters; the shell colour should
come from one place, not compete with per-page tints.

### Click-outside handlers need an exclusion list

The Transactions page resets the active donut slice on any document mousedown
outside a pie slice. Toggling “Anomalies only” lived outside the chart but
still triggered that reset — so users lost their category filter when
filtering anomalies.

The fix: add `data-anomaly-toggle=""` on the button and check
`target.closest('[data-anomaly-toggle]')` in the handler before calling
`setActiveCategoryIndex(null)`. Same pattern as the date picker’s
`[data-datepicker]` guard on Dashboard. Lesson: global dismiss handlers must
enumerate interactive islands that should not dismiss.

### `100vh` inside a flex panel causes double scroll

Chat’s right panel used `height: '100vh'`. Inside `App.tsx`’s main area
(already `calc(100vh - 20px)` with its own scroll), `100vh` made the chart
column taller than its parent and introduced unwanted overflow. Switching to
`height: '100%'` lets the panel fill the flex parent instead of the viewport.
Lesson: in nested layouts, percentage height respects the container;
viewport height ignores it.

---

---

## Week 11 — Architecture Documentation (June 2026)

### Two editions of the same architecture

For capstone submission I produced architecture documentation in three
parallel formats:

1. **`ARCHITECTURE.md` §4** — markdown source of truth for developers
2. **`NOSYORMI-Architecture-Technical.html`** — interactive technical edition
   (Urbanist + JetBrains Mono, code blocks, API table, deployment manifests)
3. **`NOSYORMI-Architecture-PlainEnglish.html`** — same six sections in plain
   English with analogies (bank branch, filing cabinet, seven communication
   doors) and small technical hints

All three mirror the six PNG diagrams in `docs/diagrams/`. The Plain English
edition answers “what does this do?” for reviewers without an IT background.
The Technical edition answers “how is it wired?” for developers. Keeping them
in sync forces me to know the system well enough to explain it twice.

### The orchestrator principle in documentation

Hannan’s orchestration quote — one coordinator responsible for moving
everyone in the right direction — is now explicit in every architecture
artifact: the browser never calls OpenRouter or PostgreSQL directly. Every
action goes through the .NET API. Documenting that rule in HTML, markdown,
and diagrams makes it harder to accidentally violate it in future features.

---

*Last updated: 14 June 2026 — Interactive architecture HTML aligned with ARCHITECTURE.md §4.*