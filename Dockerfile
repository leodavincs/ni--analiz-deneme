# Niş Avcısı paneli — tek imaj. UI'ı Node ile build eder, Python/gunicorn ile servis eder.
# Render'da "Docker" runtime ile çalışır; veri pipeline'ı (collectors + claude -p) BURADA YOK,
# o operatörün makinesinde kalır. Bu imaj sadece signals.db'yi salt-okuyup paneli sunar.

# ---- Stage 1: React UI build ----
FROM node:20-slim AS ui
WORKDIR /ui
COPY web/ui/package*.json ./
RUN npm ci
COPY web/ui/ ./
RUN npm run build           # → /ui/dist

# ---- Stage 2: Python runtime ----
FROM python:3.11-slim
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama kodu + veri (signals.db) + config
COPY . .
# Taze UI build'ini yerleştir (yereldeki dist'e güvenme)
COPY --from=ui /ui/dist ./web/ui/dist

# Render $PORT'u enjekte eder; gunicorn onu dinler (shell form → ${PORT} genişler).
EXPOSE 8000
CMD gunicorn --chdir web --bind 0.0.0.0:${PORT:-8000} \
    --workers 2 --threads 4 --timeout 120 server:app
