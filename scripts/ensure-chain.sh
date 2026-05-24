#!/bin/bash
# Start Hardhat only if :8545 is not already healthy.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p logs .run

for P in /usr/local/opt/node@20/bin /opt/homebrew/opt/node@20/bin; do
  if [ -x "$P/node" ]; then
    export PATH="$P:$PATH"
    break
  fi
done

rpc_ok() {
  curl -sf --max-time 2 -X POST http://127.0.0.1:8545 \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' 2>/dev/null | grep -q '"result"'
}

if rpc_ok; then
  echo "  Blockchain already running on :8545 (reusing — no restart)"
  exit 0
fi

# Stale listener without working RPC
if lsof -ti :8545 >/dev/null 2>&1; then
  echo "  Clearing stale process on port 8545..."
  lsof -ti :8545 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

ARTIFACT="$ROOT/contracts/artifacts/src/CertificateRegistry.sol/CertificateRegistry.json"
if [ ! -f "$ARTIFACT" ]; then
  echo "  Compiling contracts (one-time, may take a few minutes)..."
  (cd "$ROOT/contracts" && stdbuf -oL -eL ../node_modules/.bin/hardhat compile) 2>&1 | tee "$ROOT/logs/compile.log"
fi

echo "  Starting Hardhat node..."
echo "  (First launch after reboot can take 3–8 min on macOS while Node loads Hardhat — please wait)"
: > "$ROOT/logs/hardhat.log"
echo "$(date -Iseconds) launching hardhat node…" >> "$ROOT/logs/hardhat.log"

(
  cd "$ROOT/contracts"
  export PATH
  stdbuf -oL -eL ../node_modules/.bin/hardhat node --hostname 127.0.0.1 >> "$ROOT/logs/hardhat.log" 2>&1 &
  echo $! > "$ROOT/.run/hardhat.pid"
)

max=300
i=1
while [ "$i" -le "$max" ]; do
  if rpc_ok; then
    echo "  Blockchain ready (port 8545)"
    exit 0
  fi
  if [ -f "$ROOT/.run/hardhat.pid" ] && ! kill -0 "$(cat "$ROOT/.run/hardhat.pid")" 2>/dev/null; then
    echo "  FAILED: Hardhat process exited. Last log lines:"
    tail -25 "$ROOT/logs/hardhat.log" 2>/dev/null || true
    exit 1
  fi
  if [ $((i % 15)) -eq 0 ]; then
    echo "  … still starting blockchain ($((i * 2))s) — see logs/hardhat.log"
    tail -2 "$ROOT/logs/hardhat.log" 2>/dev/null || true
  fi
  sleep 2
  i=$((i + 1))
done

echo "  FAILED: Hardhat did not respond in $((max * 2))s."
echo "  Run in a separate terminal and leave it open:  npm run chain:local"
echo "  Then run:  npm run start:demo"
tail -30 "$ROOT/logs/hardhat.log" 2>/dev/null || true
exit 1
