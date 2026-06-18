#!/usr/bin/env python3
"""
Yeniden skorlama & geri kurtarma.

Skorlama mantığı değişince (yeni kalıplar / eşik), data/raw'daki ZATEN ÇEKİLMİŞ
snapshot'ları tekrar değerlendirir ve eşiği geçen YENİ maddeleri DB'ye ekler.
Apify parası HARCANMAZ — veri elimizde. DB'deki mevcut maddelere dokunmaz (dedup).

Kullanım:
  python3 rescore.py            # tüm data/raw/*.json'u yeniden skorla
  python3 rescore.py --latest   # sadece en yeni snapshot
  python3 rescore.py --dry-run  # DB'ye yazma, sadece kaç madde kurtulurdu say
"""
import argparse
import json
from pathlib import Path

import yaml

from collectors import base
from pipeline import store

ROOT = Path(__file__).resolve().parent
RAW_DIR = ROOT / "data" / "raw"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--latest", action="store_true", help="sadece en yeni snapshot")
    ap.add_argument("--dry-run", action="store_true", help="DB'ye yazma, sadece say")
    args = ap.parse_args()

    cfg = yaml.safe_load((ROOT / "config.yaml").read_text(encoding="utf-8"))
    patterns = cfg.get("complaint_patterns", [])
    base.INTENT_PATTERNS = cfg.get("intent_patterns", [])
    threshold = cfg.get("signal_threshold", 20)

    files = sorted(RAW_DIR.glob("*.json"))
    if args.latest and files:
        files = files[-1:]
    print(f"▶ {len(files)} snapshot yeniden skorlanıyor (eşik {threshold})...")

    # (source, source_id) -> en yüksek skorlu madde
    best = {}
    seen_raw = 0
    for f in files:
        try:
            items = json.loads(f.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            continue
        if not isinstance(items, list):
            continue
        for it in items:
            if not isinstance(it, dict) or not it.get("source_id"):
                continue
            seen_raw += 1
            eng = int(it.get("score") or 0) + int(it.get("num_comments") or 0)
            it["signal_score"] = base.signal_score(
                it.get("title"), it.get("body"), patterns, eng
            )
            key = (it.get("source"), str(it.get("source_id")))
            if key not in best or it["signal_score"] > best[key]["signal_score"]:
                best[key] = it

    kept = [it for it in best.values() if it["signal_score"] >= threshold]
    print(f"   Ham kayıt: {seen_raw} | benzersiz: {len(best)} | eşik({threshold})+ : {len(kept)}")

    if args.dry_run:
        print("   (dry-run — DB'ye yazılmadı)")
        return

    store.init_db()
    conn = store.connect()
    added = 0
    for it in kept:
        added += store.upsert_signal(conn, it)
    conn.commit()
    print(f"💾 DB'ye {added} YENİ madde kurtarıldı (mevcutlar dedup'landı)")
    print(f"   Kaynak dağılımı: {store.stats(conn)}")
    conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
