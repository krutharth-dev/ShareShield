#!/usr/bin/env bash
# ShareShield macOS bootstrap. Does not alter Git branches or use sudo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ "$(uname -s)" != "Darwin" ]]; then echo "This setup targets macOS; see docs/DEPLOYMENT.md" >&2; exit 1; fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "Missing Python. Install a version compatible with macOS from https://www.python.org/downloads/macos/" >&2
  exit 1
fi
python3 - <<'PY'
import sys
if sys.version_info < (3, 10):
    sys.exit("Python 3.10+ required. Run python3 --version.")
print("Python", sys.version.split()[0])
PY
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Missing Node/npm. Get a compatible Node.js 22 release at https://nodejs.org/en/download" >&2; exit 1
fi
node -e 'if(Number(process.versions.node.split(".")[0])<22){console.error("Node.js 22+ required");process.exit(1)}'
if [[ ! -d .venv ]]; then python3 -m venv .venv; fi
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python -m pip install pytest httpx
(cd frontend && npm ci --no-audit --no-fund)
if ! command -v tesseract >/dev/null 2>&1; then
  echo "WARNING: System Tesseract not installed. Images and scanned PDFs cannot be scanned automatically."
  echo "Where Homebrew supports your macOS: brew install tesseract"
else
  tesseract --version 2>&1 | head -1
fi
echo "Setup complete. Next: bash scripts/check-ready.sh && bash scripts/start-demo.sh"
