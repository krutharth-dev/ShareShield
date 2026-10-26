#!/usr/bin/env bash
# Retired: protected-demo authentication was removed from this application.
# Fail closed; never substitute anonymous public-demo for a protected tunnel.
set -euo pipefail
printf '%s\n' 'Cloudflare protected-demo launcher is retired: this version has no password gate.' 'Use bash scripts/start-demo.sh for localhost only. See docs/DEPLOYMENT.md.' >&2
exit 2
