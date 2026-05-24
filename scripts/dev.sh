#!/bin/bash
# API + website in one terminal (no concurrently — it was killing processes).
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

cleanup() {
  echo ""
  echo "Stopping API and website..."
  [ -f .run/api.pid ] && kill "$(cat .run/api.pid)" 2>/dev/null || true
  [ -f .run/web.pid ] && kill "$(cat .run/web.pid)" 2>/dev/null || true
  rm -f .run/api.pid .run/web.pid
  exit 0
}
trap cleanup INT TERM

if lsof -ti :4000 >/dev/null 2>&1 || lsof -ti :3000 >/dev/null 2>&1; then
  echo "Ports 3000 or 4000 are busy. Run once:  npm run stop:all"
  echo "Then run:  npm run dev"
  exit 1
fi

echo ""
echo "Prefer one-command setup?  npm run start:demo"
echo ""
echo "Starting API + website (Node $(node -v))..."
echo "Open: http://127.0.0.1:3000"
echo "Press Ctrl+C here to stop both."
echo ""

: > logs/api-dev.log
(stdbuf -oL -eL bash "$ROOT/scripts/run-api.sh" >> "$ROOT/logs/api-dev.log" 2>&1 & echo $! > "$ROOT/.run/api.pid")

api_ok=0
for i in $(seq 1 90); do
  if curl -sf --max-time 2 http://127.0.0.1:4000/health >/dev/null 2>&1; then
    api_ok=1
    break
  fi
  if ! kill -0 "$(cat .run/api.pid 2>/dev/null)" 2>/dev/null; then
    echo "[API] Process exited. Last log lines:"
    tail -15 "$ROOT/logs/api-dev.log" 2>/dev/null || true
    cleanup
    exit 1
  fi
  if [ "$i" -eq 15 ] || [ "$i" -eq 45 ]; then
    echo "[API] still starting (${i}s) — first run on macOS can take up to ~90s…"
    tail -3 "$ROOT/logs/api-dev.log" 2>/dev/null || true
  fi
  sleep 1
done

if [ "$api_ok" -ne 1 ]; then
  echo "[API] Failed to start within 90s. Log:"
  tail -20 "$ROOT/logs/api-dev.log" 2>/dev/null || true
  echo "Check PostgreSQL: /usr/local/opt/postgresql@16/bin/pg_isready -h 127.0.0.1 -p 5432"
  echo "Debug: cd backend && node --import ./src/boot-log.mjs src/index.js"
  cleanup
  exit 1
fi
echo "[API] listening on http://127.0.0.1:4000"

: > logs/web-dev.log
(cd "$ROOT/frontend" && "$ROOT/node_modules/.bin/next" dev -H 127.0.0.1 -p 3000 >> "$ROOT/logs/web-dev.log" 2>&1 & echo $! > "$ROOT/.run/web.pid")

echo "[WEB] starting (first time can take 1–3 min)..."
web_ok=0
for i in $(seq 1 90); do
  if lsof -ti :3000 >/dev/null 2>&1; then
    web_ok=1
    break
  fi
  if ! kill -0 "$(cat .run/web.pid 2>/dev/null)" 2>/dev/null; then
    echo "[WEB] Process exited. Log:"
    tail -20 "$ROOT/logs/web-dev.log" 2>/dev/null || true
    cleanup
    exit 1
  fi
  sleep 2
done
if [ "$web_ok" -eq 1 ]; then
  echo "[WEB] listening on http://127.0.0.1:3000"
  echo ""
  echo "Open http://127.0.0.1:3000 — first page load may take another minute."
  echo "Logs: tail -f logs/web-dev.log"
  echo ""
else
  echo "[WEB] Failed to bind port 3000. See logs/web-dev.log"
  cleanup
  exit 1
fi

tail -f "$ROOT/logs/web-dev.log" &
wait "$(cat .run/web.pid 2>/dev/null)" "$(cat .run/api.pid 2>/dev/null)" 2>/dev/null || true
