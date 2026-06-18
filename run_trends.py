#!/usr/bin/env python3
"""
Trend Radarı — Orkestratör (run.py'nin kardeşi).

Akış:  RSS topla → trend_items'a yaz (dedup) → ham snapshot → trend inbox üret.
Analizi Claude Code'un 'niche-hunter' skill'i yapar.

Kullanım:
  python3 run_trends.py                # config'deki tüm feed'ler + google news
  python3 run_trends.py --dry-run      # DB'ye yazma, sadece say
  python3 run_trends.py --inbox-only   # scrape yok; sıradaki batch'i inbox'a yaz
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

from collectors import rss
from pipeline import store, extract

ROOT = Path(__file__).resolve().parent
RAW_DIR = ROOT / "data" / "raw"


def load_config():
    with open(ROOT / "config.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="DB'ye yazma")
    ap.add_argument("--inbox-only", action="store_true",
                    help="scrape yok; mevcut is_new öğelerden inbox'ı üret")
    args = ap.parse_args()

    cfg = load_config()
    rcfg = cfg.get("rss", {})
    analysis_max = rcfg.get("trend_analysis_max_items", 80)

    # --inbox-only: hiç RSS çekmeden sıradaki batch'i inbox'a yaz.
    if args.inbox_only:
        store.init_db()
        conn = store.connect()
        items = store.get_new_trend_items(conn, limit=analysis_max)
        conn.close()
        if items:
            inbox = extract.build_trend_inbox(items)
            print(f"📥 Trend inbox hazır ({len(items)} öğe): {inbox}")
        else:
            print("📭 Analiz edilecek yeni trend öğesi yok")
        return

    if not rcfg.get("enabled", True):
        print("rss kaynağı config'de kapalı.")
        return

    print("▶ RSS trend toplama başlıyor...")
    all_items = rss.collect(rcfg)
    print(f"\n📊 Toplam {len(all_items)} haber çekildi")

    # Ham snapshot
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    (RAW_DIR / f"trends_{ts}.json").write_text(
        json.dumps(all_items, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    if args.dry_run:
        from collections import Counter
        dist = Counter(i.get("domain") for i in all_items)
        print("alan dağılımı:", dict(dist))
        for t in all_items[:10]:
            print(f"  ({t.get('domain')}) {t['title'][:75]}")
        return

    # DB'ye yaz (dedup)
    store.init_db()
    conn = store.connect()
    added = 0
    for item in all_items:
        if not item.get("source_id"):
            continue
        added += store.upsert_trend_item(conn, item)
    conn.commit()
    print(f"💾 DB'ye {added} yeni haber eklendi (dedup sonrası)")
    print(f"   Alan dağılımı: {store.trend_stats(conn)}")

    # Trend inbox üret
    new_items = store.get_new_trend_items(conn, limit=analysis_max)
    if new_items:
        inbox = extract.build_trend_inbox(new_items)
        print(f"📥 Trend inbox hazır ({len(new_items)} öğe): {inbox}")
        print(f"   → Şimdi Claude Code'da: 'niche-hunter' skill'ini çalıştır")
    else:
        print("📭 Analiz edilecek yeni trend öğesi yok")
    conn.close()


if __name__ == "__main__":
    sys.exit(main())
