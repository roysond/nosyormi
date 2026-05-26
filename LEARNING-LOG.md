# LEARNING-LOG.md
> NOSYOR.M.I — What I Learned Building This  
> Student: Royson D'Souza · Capstone Project 11 (FinSight)  
> Background: No prior IT or coding experience before this program

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

### What RAG actually means

RAG stands for Retrieval-Augmented Generation. Before implementing it
I thought AI chat was just: send message → get response.

What actually happens in NOSYOR.M.I:
1. Convert the user's question into a vector embedding
2. Search the database for transactions whose embeddings are similar
3. Send those transactions *as context* to the AI along with the question
4. The AI answers based on real data, not guesswork

Without RAG, if I asked "how much did I spend at Starbucks in March?"
the AI would have to guess or make something up. With RAG, it receives
the actual Starbucks transactions and can give an exact answer.

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

*Last updated: 25 May 2026*