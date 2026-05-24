#!/bin/bash
set -e
for P in /usr/local/opt/node@20/bin /opt/homebrew/opt/node@20/bin; do
  if [ -x "$P/node" ]; then
    export PATH="$P:$PATH"
    break
  fi
done
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node "$ROOT/scripts/deploy-local-fast.mjs"
