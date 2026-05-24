#!/bin/bash
# Use Homebrew Node 20 so Hardhat works (Node 25 hangs).
set -e
for P in /usr/local/opt/node@20/bin /opt/homebrew/opt/node@20/bin; do
  if [ -x "$P/node" ]; then
    export PATH="$P:$PATH"
    break
  fi
done
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/contracts"
echo "Starting Hardhat node (Node $(node -v))..."
echo "First start after reboot can take 3–8 minutes on macOS (Node loading Hardhat)."
echo "Leave this terminal open. In another terminal: npm run start:demo"
exec stdbuf -oL -eL ../node_modules/.bin/hardhat node --hostname 127.0.0.1
