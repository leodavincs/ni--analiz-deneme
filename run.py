#!/usr/bin/env python3
"""
Niş Avcısı — Orkestratör.

Akış:  topla (collectors) → DB'ye yaz (dedup) → ham snapshot → inbox üret.
Analiz kısmını Claude Code'un 'nis-analizi' skill'i yapar (bu script değil).

Kullanım:
  python3 run.py                          # config'deki tüm açık kaynaklar
  python3 run.py --source reddit,hackernews
  python3 run.py --dry-run                # DB'ye yazma, sadece say
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

from collectors import base, reddit, reddit_apify, hackernews, producthunt, indiehackers
from pipeline import store, extract

ROOT = Path(__file__).resolve().parent
RAW_DIR = ROOT / "data" / "raw"


def load_dotenv():
    """Proje kökündeki .env'i okuyup ortam değişkenlerine yükler (ek bağımlılık yok).
    Zaten tanımlı değişkenleri EZMEZ; bu yüzden gerçek env önceliklidir."""
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key, val = key.strip(), val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val

COLLECTORS = {
    "reddit": reddit,
    "reddit_apify": reddit_apify,
    "hackernews": hackernews,
    "producthunt": producthunt,
    "indiehackers": indiehackers,
}


def load_config():
    with open(ROOT / "config.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", help="virgülle ayrık kaynak listesi")
    ap.add_argument("--dry-run", action="store_true", help="DB'ye yazma")
    ap.add_argument("--inbox-only", action="store_true",
                    help="collector çalıştırma; mevcut is_new sinyallerden inbox'ı yeniden üret")
    ap.add_argument("--limit", type=int,
                    help="inbox-only batch boyutu (verilmezse config analysis_max_items)")
    ap.add_argument("--reddit-sort", help="reddit_apify sort override (örn: new)")
    ap.add_argument("--reddit-time", help="reddit_apify time_filter override (örn: day)")
    args = ap.parse_args()

    load_dotenv()
    cfg = load_config()
    patterns = cfg.get("complaint_patterns", [])
    # 2. kademe niyet kalıplarını skorlayıcıya tanıt (base.signal_score okur).
    base.INTENT_PATTERNS = cfg.get("intent_patterns", [])
    threshold = cfg.get("signal_threshold", 25)
    max_items = cfg.get("max_items_per_source", 60)
    analysis_max = cfg.get("analysis_max_items", 120)

    # --inbox-only: hiç scrape yapmadan (Apify'a istek YOK), sıradaki batch'i inbox'a yaz.
    # Haftalık analiz döngüsünün çekirdeği: skill 120 maddeyi is_new=0 yapınca tekrar
    # çağrılıp bir sonraki 120'yi hazırlar.
    if args.inbox_only:
        store.init_db()
        conn = store.connect()
        batch = args.limit if args.limit and args.limit > 0 else analysis_max
        new_signals = store.get_new_signals(conn, min_score=threshold, limit=batch)
        conn.close()
        if new_signals:
            inbox = extract.build_inbox(new_signals)
            print(f"📥 Inbox hazır ({len(new_signals)} madde): {inbox}")
        else:
            print("📭 Analiz edilecek yeni madde yok")
        return

    # reddit_apify sort/time override (tek seferlik farklı veri çekişi için;
    # config defaults'unu bozmaz).
    if args.reddit_sort:
        cfg["sources"].setdefault("reddit_apify", {})["sort"] = args.reddit_sort
    if args.reddit_time:
        cfg["sources"].setdefault("reddit_apify", {})["time_filter"] = args.reddit_time

    if args.source:
        wanted = [s.strip() for s in args.source.split(",")]
    else:
        wanted = [k for k, v in cfg["sources"].items() if v.get("enabled")]

    print(f"▶ Kaynaklar: {', '.join(wanted)}")
    all_items = []
    for name in wanted:
        if name not in COLLECTORS:
            print(f"   [uyarı] bilinmeyen kaynak: {name}")
            continue
        scfg = cfg["sources"].get(name, {})
        print(f"\n⤷ {name} toplanıyor...")
        try:
            items = COLLECTORS[name].collect(scfg, patterns, max_items)
        except Exception as e:  # bir collector patlarsa diğerleri çalışsın
            print(f"   [HATA] {name}: {e}")
            items = []
        print(f"   {len(items)} madde geldi")
        all_items.extend(items)

    # Ham snapshot (denetim izi)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    (RAW_DIR / f"{ts}.json").write_text(
        json.dumps(all_items, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # Eşik üstü filtre
    kept = [i for i in all_items if i["signal_score"] >= threshold]
    print(f"\n📊 Toplam {len(all_items)} madde, eşik({threshold})+ {len(kept)} madde")

    if args.dry_run:
        top = sorted(kept, key=lambda x: x["signal_score"], reverse=True)[:10]
        print("\n— En yüksek sinyalli 10 (dry-run) —")
        for t in top:
            print(f"  [{t['signal_score']}] ({t['source']}) {t['title'][:80]}")
        return

    # DB'ye yaz (dedup)
    store.init_db()
    conn = store.connect()
    added = 0
    for item in kept:
        if not item.get("source_id"):
            continue
        added += store.upsert_signal(conn, item)
    conn.commit()
    print(f"💾 DB'ye {added} yeni madde eklendi (dedup sonrası)")
    print(f"   Kaynak dağılımı: {store.stats(conn)}")

    # Inbox üret (Claude'un analiz edeceği yeni maddeler) — en yüksek sinyalli N tane
    new_signals = store.get_new_signals(conn, min_score=threshold, limit=analysis_max)
    if new_signals:
        inbox = extract.build_inbox(new_signals)
        print(f"📥 Inbox hazır: {inbox}")
        print(f"   → Şimdi Claude Code'da: 'nis-analizi' skill'ini çalıştır")
    else:
        print("📭 Analiz edilecek yeni madde yok")
    conn.close()


if __name__ == "__main__":
    sys.exit(main())
