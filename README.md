# NOSYOR.M.I — Money Intelligence
> *Your money, reflected.*

You glance at your balance and freeze. The number is smaller than it should be — and you have no idea why. There's a hole somewhere in the month, and you can't see it.

**NOSYOR.M.I reflects the holes you couldn't see.**

Upload a bank statement. The app reads it, categorizes every transaction, spots the spending that doesn't match your usual pattern, forecasts where next month is heading, and lets you ask plain-English questions like *"Where did I overspend in March?"* — answers tied to the same charts you're looking at.

It doesn't shame you. It doesn't moralize. It reflects.

---

## What it does

- **CSV & bank statement ingestion** — drop in a file, the app parses it.
- **Automatic categorization** — every transaction sorted into meaningful buckets without you lifting a finger.
- **Anomaly detection** — spots the unusual spends that quietly drained the account. The holes you couldn't see.
- **Next-month forecasting** — projects where your spending is heading based on the patterns it sees.
- **Conversational chat interface** — ask questions in plain English; the AI answers *and* updates the visualizations to match.
- **Live data visualizations** — charts that respond to the conversation, not static dashboards.

---

## Why it exists

Most people don't have a money problem. They have a **visibility** problem.

Statements are walls of numbers. Banking apps show balances but not patterns. Spreadsheets demand effort no one has the energy for at 11pm on a Tuesday.

NOSYOR.M.I exists for the moment after the shock — when you want clarity, not a lecture. It's built to behave like a calm financial therapist: it lays your money out in front of you, points to what's worth noticing, and answers the questions you actually want to ask.

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | .NET 10 Web API |
| Frontend | React + TypeScript (Vite) |
| Database | PostgreSQL |
| AI Layer | OpenRouter (model selection per task) |
| Containers | Docker + Docker Compose |
| Deployment | Minikube (local Kubernetes) |
| Architecture | Clean Architecture, SOLID principles |

---

## Getting started

> *Note: This project is in active development. Setup instructions will be expanded as the application is built out.*

**Prerequisites**

- .NET 10 SDK
- Node.js (LTS)
- Docker Desktop
- PostgreSQL 16
- A valid OpenRouter API key

**Quick setup**

```bash
git clone https://github.com/roysond/nosyormi.git
cd nosyormi
# Setup instructions coming as the project develops
```

Environment variables go in a local `.env` file — never committed. A `.env.example` file is provided as a template.

---

## Project status

🛠 **In active development** · Capstone project · Solo build · 3-week sprint
**Target completion:** before 4 June 2026

See the [project board](https://github.com/users/roysond/projects/2) for live progress.

---

## The name

**NOSYOR.M.I** reads as a name on its own — but held up to a mirror, it reveals: *I.M. ROYSON*.

It's a small piece of the same idea that runs through the product. Hold something at the right angle, and what's hidden reveals itself.

---

## Author

**Royson D'Souza**
Built as part of the AI Integration Capstone Program · 2026

---

## License

NOSYOR.M.I is licensed under the **PolyForm Noncommercial License 1.0.0**.

You're welcome to read, run, modify, and learn from this project for **personal, educational, research, and other noncommercial use**. Commercial use of any kind requires a separate license — please reach out.

See [LICENSE](./LICENSE) for the full terms.