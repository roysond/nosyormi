#!/usr/bin/env bash
# Start NOSYOR.M.I locally: .NET API (:5034) + Vite dev server (:5173).
#
# Both processes run as background jobs so neither blocks the other, and a
# trap tears both down on Ctrl+C so no orphaned process keeps holding a port.
#
# Usage:  ./scripts/start.sh          (from repo root)
#         nosyormi                    (if symlinked onto $PATH — see README note)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_PROJECT="backend/Nosyormi.Api"
WEB_DIR="frontend"
API_URL="http://localhost:5034"
WEB_URL="http://localhost:5173"

API_PID=""
WEB_PID=""

# ── Teardown ─────────────────────────────────────────────────────────────
# Kills children first, then the parent. `dotnet run` launches the built app
# as a child process, so killing only the parent can leave the API alive.
cleanup() {
  trap - INT TERM EXIT
  echo ""
  echo "Shutting down..."
  for pid in "$API_PID" "$WEB_PID"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      pkill -P "$pid" 2>/dev/null || true
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
  echo "Stopped."
}
trap cleanup INT TERM EXIT

# ── Preflight ────────────────────────────────────────────────────────────
# Fail early with a readable message rather than a stack trace 20 seconds in.

if [[ ! -f .env ]]; then
  echo "error: .env not found in $ROOT" >&2
  echo "       Copy .env.example to .env and fill in your values." >&2
  exit 1
fi

if [[ ! -d "$WEB_DIR/node_modules" ]]; then
  echo "error: $WEB_DIR/node_modules not found." >&2
  echo "       Run: (cd $WEB_DIR && npm install)" >&2
  exit 1
fi

for cmd in dotnet npm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: '$cmd' is not on your PATH." >&2
    exit 1
  fi
done

# Pull the Postgres port out of DATABASE_CONNECTION_STRING so we can check the
# DB is actually up. Postgres.app defaults to 5432; the Docker Compose stack
# publishes 5433. Defaults to 5432 if the connection string has no Port=.
DB_PORT="$(grep -m1 '^DATABASE_CONNECTION_STRING=' .env 2>/dev/null \
  | sed -n 's/.*[Pp]ort=\([0-9]\{1,\}\).*/\1/p' || true)"
DB_PORT="${DB_PORT:-5432}"

if command -v nc >/dev/null 2>&1; then
  if ! nc -z localhost "$DB_PORT" 2>/dev/null; then
    echo "error: nothing is listening on localhost:$DB_PORT (PostgreSQL)." >&2
    echo "       Start Postgres.app, or bring up the container:" >&2
    echo "       docker compose --env-file .env.docker up -d postgres" >&2
    exit 1
  fi
fi

# ── Launch ───────────────────────────────────────────────────────────────
echo "NOSYOR.M.I — starting"
echo "  postgres : localhost:$DB_PORT (reachable)"
echo "  api      : $API_URL"
echo "  frontend : $WEB_URL"
echo "  Ctrl+C to stop both."
echo ""

dotnet run --project "$API_PROJECT" &
API_PID=$!

(cd "$WEB_DIR" && npm run dev) &
WEB_PID=$!

# Keep the script in the foreground so Ctrl+C reaches the trap. Without this,
# the script would exit immediately and both background jobs would be orphaned.
wait
