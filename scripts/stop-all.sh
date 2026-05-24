#!/bin/bash
# Stop all TrustCert local processes (macOS).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Stopping TrustCert..."

for p in 3000 3001 4000 8545; do
  if lsof -ti ":$p" >/dev/null 2>&1; then
    lsof -ti ":$p" | xargs kill -9 2>/dev/null || true
    echo "  Freed port $p"
  fi
done

if [ -d "$ROOT/.run" ]; then
  for f in "$ROOT/.run"/*.pid; do
    [ -f "$f" ] || continue
    kill "$(cat "$f")" 2>/dev/null || true
  done
  rm -f "$ROOT/.run"/*.pid
fi

pkill -f "hardhat node" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true
pkill -f "concurrently.*dev:backend" 2>/dev/null || true
pkill -f "Blockchain Certificate/backend/src/index.js" 2>/dev/null || true

echo "Done. Start again with:  npm run start:demo"
