#!/usr/bin/env bash
# Production deployment for the Vue 3 frontend.
# Requires explicit user authorization and valid Cloudflare credentials.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-6799c67ce94928e7fc4136842327a18f}"
export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-/tmp/xdg-cache}"
mkdir -p "$XDG_CACHE_HOME"

cd "$ROOT"
npm ci
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "CLOUDFLARE_API_TOKEN is required for production deployment." >&2
  echo "Run the preview deployment and obtain explicit production authorization first." >&2
  exit 2
fi

echo "Deploying Vue frontend production build from $ROOT/dist ..."
npx --yes wrangler@4.86.0 pages deploy "$ROOT/dist" \
  --project-name cn-math-taxonomy \
  --branch main \
  --commit-dirty=true
