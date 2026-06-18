#!/usr/bin/env bash
# Canlı paneli tek komutla aç: UI'ı build et, Flask ile servis et.
#   ./web_run.sh           → http://localhost:8000
#   PORT=9000 ./web_run.sh → farklı port
set -euo pipefail
cd "$(dirname "$0")"

# Homebrew node'u PATH'e ekle (gerekiyorsa)
export PATH="/opt/homebrew/bin:$PATH"

if [ ! -d web/ui/node_modules ]; then
  echo "▶ UI bağımlılıkları kuruluyor (ilk sefer)…"
  (cd web/ui && npm install)
fi

echo "▶ UI build ediliyor…"
(cd web/ui && npm run build)

echo "▶ Panel başlatılıyor → http://localhost:${PORT:-8000}"
exec python3 web/server.py
