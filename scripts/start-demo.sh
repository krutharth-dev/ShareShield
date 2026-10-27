#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ ! -x .venv/bin/python ]]; then
  echo "Python environment missing. Run bash scripts/setup-macos.sh" >&2; exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm missing. Install Node.js 22+." >&2; exit 1
fi
if [[ ! -d frontend/node_modules ]]; then (cd frontend && npm ci --no-audit --no-fund); fi
(cd frontend && npm run build)
echo "Opening ShareShield at http://127.0.0.1:8000/"
echo "Press Control+C to stop the server."
exec .venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
