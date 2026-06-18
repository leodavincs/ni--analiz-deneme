#!/bin/bash
# Niş Avcısı — HAFTALIK çalıştırıcı.
# SADECE reddit'i Apify ile çek (paralı; config max_items: 60 → 10 sub × 60 = 600 sonuç ≈ $1.20).
# ANALİZ BURADA YOK: analiz günlük parça parça yapılır (daily_run.sh, her gün ~120).
# Yani reddit haftada bir çekilir, biriken postlar güne yayılarak analiz edilir.
set -e
cd "$(dirname "$0")"

echo "[$(date)] Haftalık reddit toplama başlıyor (Apify, ~\$1.20 tavan)..."
python3 run.py --source reddit_apify

echo "[$(date)] Haftalık scrape bitti. Analiz günlük çalışır (daily_run.sh → her gün ~120)."
