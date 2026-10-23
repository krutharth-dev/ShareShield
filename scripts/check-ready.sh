#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
errors=0
echo "ShareShield readiness"
echo "--------------------"
if command -v git >/dev/null 2>&1; then
  git --version; git branch --show-current
else echo "FAIL: Git missing"; errors=$((errors+1)); fi
if [[ -x .venv/bin/python ]]; then
  .venv/bin/python --version
  if .venv/bin/python -c 'import fastapi,fitz,PIL,pytesseract,docx,pptx,openpyxl,pillow_heif' 2>/dev/null; then
    echo "Backend dependencies: OK"
  else echo "FAIL: Backend packages missing. Run scripts/setup-macos.sh"; errors=$((errors+1)); fi
else echo "FAIL: .venv missing. Run scripts/setup-macos.sh"; errors=$((errors+1)); fi
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  node --version; npm --version
  if ! node -e 'process.exit(Number(process.versions.node.split(".")[0])>=22?0:1)'; then
    echo "FAIL: Node.js 22+ required"; errors=$((errors+1))
  fi
else echo "FAIL: Node/npm missing"; errors=$((errors+1)); fi
if command -v tesseract >/dev/null 2>&1; then
  tesseract --version 2>&1 | head -1
else echo "WARNING: OCR unavailable; install Tesseract for scanned PDFs/images."; fi
if [[ -d frontend/node_modules ]]; then
  echo "React node_modules: installed"
else echo "INFO: install frontend packages using scripts/setup-macos.sh"; fi
if [[ -f frontend/dist/index.html ]]; then
  echo "React production build: present"
else echo "INFO: scripts/start-demo.sh will build the frontend"; fi
if [[ $errors -ne 0 ]]; then echo "$errors prerequisite check(s) failed"; exit 1; fi
echo "Ready for local tests; launch with scripts/start-demo.sh"
