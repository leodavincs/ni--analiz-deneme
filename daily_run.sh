#!/bin/bash
# Niş Avcısı — GÜNLÜK çalıştırıcı.
# 1) Ücretsiz kaynakları topla (HN + ProductHunt). Reddit BURADA YOK (haftalık → weekly_run.sh).
# 2) Backlog'u PARÇA PARÇA erit: her gün TEK batch (en yüksek sinyalli ~120 madde) analiz.
#    Böylece reddit haftalık çekilir ama analiz güne yayılır (her gün 120).
set -e
cd "$(dirname "$0")"

# Obsidian vault'ları proje dışında — claude -p oturumuna açıkça erişim ver,
# yoksa launchd'dan çalışınca izin duvarına takılıp analiz YARIM kalır.
VAULT_BASE="/Users/sarp/Documents/Obsidian Vault"

echo "[$(date)] Günlük toplama başlıyor (hackernews + producthunt, ücretsiz)..."
python3 run.py --source hackernews,producthunt

# Eşiği config'den oku (sabitleme yok — config değişirse senkron kalır).
THR=$(python3 -c "import yaml;print(yaml.safe_load(open('config.yaml')).get('signal_threshold',20))")
N=$(sqlite3 data/signals.db "SELECT COUNT(*) FROM signals WHERE is_new=1 AND signal_score>=$THR")

# DİNAMİK batch: backlog'u haftanın KALAN günlerine böl (sabit 120 yok).
# Haftalık reddit scrape Pazartesi (date +%u: 1=Pzt..7=Paz). Kalan gün = 8-gün:
# Pzt→7, Sal→6, ... Paz→1 (son gün kalan her şeyi al → hafta sonunda tükenir).
# Örn. 860 madde, Pzt: ceil(860/7)=123; ertesi gün yeniden hesaplanır (kendini düzeltir).
DOW=$(date +%u)
REMAIN=$((8 - DOW)); [ "$REMAIN" -lt 1 ] && REMAIN=1
BATCH=$(( (N + REMAIN - 1) / REMAIN ))   # tavana yuvarla (ceil)
echo "[$(date)] Analiz bekleyen (eşik $THR+): $N | kalan gün: $REMAIN | bugünkü batch: $BATCH"

if [ "$N" -gt 0 ]; then
  echo "[$(date)] Günlük analiz: $BATCH madde (haftalık birikim güne yayılıyor)..."
  python3 run.py --inbox-only --limit "$BATCH"
  claude -p "nis-analizi skill'ini çalıştır: data/inbox'taki en güncel dosyayı analiz et ve Obsidian vault'a niş kartlarını yaz." \
    --permission-mode acceptEdits --add-dir "$VAULT_BASE/Niş Analizi"
else
  echo "[$(date)] Analiz edilecek yeni madde yok."
fi

# --- TREND RADARI (RSS, ücretsiz) ---
echo "[$(date)] Trend toplama başlıyor (RSS, ücretsiz)..."
python3 run_trends.py

TN=$(sqlite3 data/signals.db "SELECT COUNT(*) FROM trend_items WHERE is_new=1")
echo "[$(date)] Analiz bekleyen trend haberi: $TN"
if [ "$TN" -gt 0 ]; then
  echo "[$(date)] Trend analizi (en yeni batch)..."
  python3 run_trends.py --inbox-only
  claude -p "niche-hunter skill'ini çalıştır: data/inbox_trends'teki en güncel batch'i analiz et; önce geçmiş state'i (opportunities/ + daily) oku, tekrarları bastır, gate'i geçenler için fırsat notlarını ve günlük index'i Obsidian 'Trend Radarı' altına yaz." \
    --permission-mode acceptEdits --add-dir "$VAULT_BASE/Trend Radarı"
else
  echo "[$(date)] Analiz edilecek yeni trend yok."
fi

# --- Vault → DB mirror: web paneli içeriği Obsidian klasöründen değil DB'den
#     okusun (deploy taşınabilirliği; kimse operatörün Obsidian'ına bağlanmaz). ---
echo "[$(date)] Obsidian notları DB'ye senkronlanıyor..."
python3 -m pipeline.sync_vault

echo "[$(date)] Günlük çalışma bitti."
