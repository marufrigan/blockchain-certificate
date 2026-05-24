#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for P in /usr/local/opt/node@20/bin /opt/homebrew/opt/node@20/bin; do
  if [ -x "$P/node" ]; then export PATH="$P:$PATH"; break; fi
done
export TRUSTCERT_ROOT="$ROOT"
export TRUSTCERT_CONFIG_DIR="$ROOT/backend/src/config"
cd "$ROOT/backend"
exec node src/server.mjs
