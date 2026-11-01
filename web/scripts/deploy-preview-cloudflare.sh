#!/usr/bin/env bash
# Build and deploy the Vue 3 frontend to a Cloudflare Pages preview branch.
# This script never deploys automatically to the production domain.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-6799c67ce94928e7fc4136842327a18f}"
export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-/tmp/xdg-cache}"
BRANCH="${CLOUDFLARE_PAGES_BRANCH:-vue-migration-preview}"
mkdir -p "$XDG_CACHE_HOME"

cd "$ROOT"
npm ci
npm run lint
npm run typecheck
npm run test
npm run build

echo "Deploying $ROOT/dist to Cloudflare Pages branch: $BRANCH"
npx --yes wrangler@4.86.0 pages deploy "$ROOT/dist" \
  --project-name cn-math-taxonomy \
  --branch "$BRANCH" \
  --commit-dirty=true
