#!/bin/bash
# Stop API + website only (keep Hardhat on :8545 running for fast restarts).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Stopping TrustCert API and website (blockchain left running on :8545)..."

for p in 3000 3001 4000; do
  if lsof -ti ":$p" >/dev/null 2>&1; then
    lsof -ti ":$p" | xargs kill -9 2>/dev/null || true
    echo "  Freed port $p"
  fi
done

if [ -d "$ROOT/.run" ]; then
  for f in "$ROOT/.run"/api.pid "$ROOT/.run"/web.pid; do
    [ -f "$f" ] || continue
    kill "$(cat "$f")" 2>/dev/null || true
    rm -f "$f"
  done
fi

pkill -f "next dev" 2>/dev/null || true
pkill -f "Blockchain Certificate/backend/src/index.js" 2>/dev/null || true

echo "Done. Start again with:  npm run start:demo"
echo "To stop blockchain too:  npm run stop:all"
