#!/usr/bin/env bash
# ShareShield's temporary, password-protected Cloudflare Quick Tunnel preview.
# Use ONLY fictional files. A separate Terminal must first run cloudflared.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$#" -ne 1 ]]; then
  echo "Usage: bash scripts/start-cloudflare-demo.sh https://your-generated-host.trycloudflare.com" >&2
  exit 2
fi

host="${1#https://}"
host="${host%/}"
if [[ ! "$host" =~ ^[a-z0-9-]+\.trycloudflare\.com$ ]]; then
  echo "Expected the exact host Cloudflare printed, e.g. https://abc.trycloudflare.com" >&2
  exit 2
fi
if [[ ! -x ".venv/bin/python" ]]; then
  echo "Install local Python dependencies first: bash scripts/setup-macos.sh" >&2
  exit 1
fi

printf "Choose a random 20+ character DEMO password (never paste it into chat/GitHub): "
IFS= read -r -s demo_password
printf "\n"
if [[ "${#demo_password}" -lt 20 ]]; then
  echo "Password must be at least 20 characters; server not started." >&2
  exit 2
fi

export SHARESHIELD_DEPLOYMENT_MODE="protected-demo"
export SHARESHIELD_DEMO_USER="demo"
export SHARESHIELD_DEMO_PASSWORD="$demo_password"
export SHARESHIELD_PUBLIC_HOSTNAME="$host"
unset demo_password

printf "ShareShield protected demo will accept only %s plus localhost.\n" "$host"
printf "Use HTTPS with demo user and your private password.\n"
printf "Local HTTP is also password gated while this process runs.\n"
printf "Only fictional data. Press Control+C in both Terminals to stop.\n"

exec bash scripts/start-demo.sh
