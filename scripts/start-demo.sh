#!/bin/bash
# One command: blockchain + API + website (no slow production build).
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

PG_ISREADY="/usr/local/opt/postgresql@16/bin/pg_isready"
PG_CTL="/usr/local/opt/postgresql@16/bin/pg_ctl"
PG_DATA="/usr/local/var/postgresql@16"

echo ""
echo "=== TrustCert — starting everything ==="
echo "Using Node $(node -v)"
echo ""

# Keep Hardhat running between demos — only restart API + website (much faster).
bash "$ROOT/scripts/stop-apps.sh" 2>/dev/null || true
sleep 1

if [ -x "$PG_ISREADY" ]; then
  if ! "$PG_ISREADY" -h 127.0.0.1 -p 5432 -q 2>/dev/null; then
    "$PG_CTL" -D "$PG_DATA" start 2>/dev/null || true
    sleep 2
  fi
  "$PG_ISREADY" -h 127.0.0.1 -p 5432 -q 2>/dev/null && echo "PostgreSQL: OK"
fi

wait_for_url() {
  local url="$1"
  local label="$2"
  local max="${3:-60}"
  local pid_file="${4:-}"
  local i=1
  while [ "$i" -le "$max" ]; do
    if curl -sf --max-time 2 "$url" >/dev/null 2>&1; then
      echo "  $label ready"
      return 0
    fi
    if [ -n "$pid_file" ] && [ -f "$pid_file" ] && ! kill -0 "$(cat "$pid_file")" 2>/dev/null; then
      echo "  FAILED: $label process exited. Log:"
      tail -20 "$ROOT/logs/api.log" 2>/dev/null || true
      return 1
    fi
    sleep 1
    i=$((i + 1))
  done
  echo "  FAILED: $label — see logs/api.log"
  tail -15 "$ROOT/logs/api.log" 2>/dev/null || true
  return 1
}

wait_for_port() {
  local port="$1"
  local label="$2"
  local max="${3:-90}"
  local i=1
  while [ "$i" -le "$max" ]; do
    if lsof -ti ":$port" >/dev/null 2>&1; then
      echo "  $label listening on port $port"
      return 0
    fi
    if [ $((i % 10)) -eq 0 ]; then
      echo "  … still waiting for $label ($((i * 2))s)"
    fi
    sleep 2
    i=$((i + 1))
  done
  echo "  FAILED: $label did not bind port $port — see logs/web.log"
  return 1
}

echo "[1/4] Blockchain..."
bash "$ROOT/scripts/ensure-chain.sh"

echo "[2/4] Smart contract..."
node "$ROOT/scripts/deploy-local-fast.mjs" >> logs/deploy.log 2>&1 && echo "  Contract ready" || {
  echo "  Deploy failed — see logs/deploy.log"
  tail -15 logs/deploy.log 2>/dev/null || true
  exit 1
}

echo "[3/4] API..."
if curl -sf --max-time 2 http://127.0.0.1:4000/health >/dev/null 2>&1; then
  echo "  API already running"
else
  : > logs/api.log
  (nohup stdbuf -oL -eL bash "$ROOT/scripts/run-api.sh" >> "$ROOT/logs/api.log" 2>&1 & echo $! > "$ROOT/.run/api.pid")
  wait_for_url "http://127.0.0.1:4000/health" "API" 15 "$ROOT/.run/api.pid"
fi

echo "[4/4] Website (starting in background)..."
: > logs/web.log
(cd "$ROOT/frontend" && nohup stdbuf -oL -eL "$ROOT/node_modules/.bin/next" dev -H 127.0.0.1 -p 3000 >> "$ROOT/logs/web.log" 2>&1 & echo $! > "$ROOT/.run/web.pid")

web_ok=0
for i in $(seq 1 180); do
  if lsof -ti :3000 >/dev/null 2>&1; then
    web_ok=1
    break
  fi
  if [ -f "$ROOT/.run/web.pid" ] && ! kill -0 "$(cat "$ROOT/.run/web.pid")" 2>/dev/null; then
    echo "  Website process exited — see logs/web.log"
    tail -15 "$ROOT/logs/web.log" 2>/dev/null || true
    exit 1
  fi
  if [ $((i % 15)) -eq 0 ]; then
    echo "  … website compiling (${i}s)"
    tail -1 "$ROOT/logs/web.log" 2>/dev/null | strings | head -1 || true
  fi
  sleep 2
done
if [ "$web_ok" -eq 1 ]; then
  echo "  Website ready on port 3000"
else
  echo "  Website still compiling — open http://127.0.0.1:3000 in 2–5 min (see logs/web.log)"
fi

echo ""
echo "=========================================="
echo "  READY — open in Chrome:"
echo "  http://127.0.0.1:3000"
echo ""
echo "  Admin: admin@msu.edu / Admin@123"
echo "  Stop: npm run stop:all"
echo "=========================================="
echo ""
echo "Keep this terminal open. Logs: logs/web.log logs/api.log"
echo ""

# Stay alive so user sees the message; tail web log
tail -f "$ROOT/logs/web.log" 2>/dev/null || wait "$(cat "$ROOT/.run/web.pid" 2>/dev/null)" 2>/dev/null || sleep infinity
