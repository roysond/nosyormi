#!/usr/bin/env bash
# Run before git push — fails if a real OpenRouter key appears in tracked/staged files.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PATTERN='sk-or-v1-[a-zA-Z0-9]{8,}'
FILTER='\.env\.example:|secrets\.yaml\.example:|your_openrouter'

filter_hits() {
  local hits="$1"
  if [[ -z "$hits" ]]; then
    return 0
  fi
  local bad
  bad=$(echo "$hits" | grep -Ev "$FILTER" || true)
  if [[ -n "$bad" ]]; then
    echo "$bad" >&2
    return 1
  fi
  return 0
}

failed=0

tracked=$(git grep -E "$PATTERN" -- $(git ls-files) 2>/dev/null || true)
if ! filter_hits "$tracked"; then
  echo "error: OpenRouter API key found in tracked files." >&2
  failed=1
fi

staged_files=$(git diff --cached --name-only 2>/dev/null || true)
if [[ -n "$staged_files" ]]; then
  staged=$(git grep -E "$PATTERN" -- $staged_files 2>/dev/null || true)
  if ! filter_hits "$staged"; then
    echo "error: OpenRouter API key found in staged changes." >&2
    failed=1
  fi
fi

if [[ "$failed" -ne 0 ]]; then
  echo "Revoke at https://openrouter.ai/keys; store new keys only in .env / .env.docker." >&2
  exit 1
fi

echo "OK: no sk-or-v1-* keys in tracked or staged files."
