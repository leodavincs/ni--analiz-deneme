#!/usr/bin/env python3
"""Obsidian vault → SQLite mirror.

daily_run.sh sonunda çalışır. Skill'lerin Obsidian klasörüne yazdığı fırsat/niş
notlarını signals.db'deki vault_notes tablosuna kopyalar. Böylece web paneli bu
içeriği yerel Obsidian klasörü yerine DB'den okuyabilir → deploy edilen tek şey
signals.db olur, kimse operatörün Obsidian'ına bağlanmaz.

Kullanım:
    python3 -m pipeline.sync_vault
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import yaml

from pipeline import store


def main():
    root = Path(__file__).resolve().parent.parent
    try:
        with open(root / "config.yaml", encoding="utf-8") as f:
            vault = (yaml.safe_load(f) or {}).get("obsidian_vault", "")
    except Exception as exc:
        print(f"[sync_vault] config.yaml okunamadı: {exc}")
        return
    if not vault:
        print("[sync_vault] config.yaml > obsidian_vault boş — atlandı")
        return
    counts = store.sync_vault(vault)
    print(f"[sync_vault] DB'ye yazıldı: fırsat={counts.get('opportunity', 0)} "
          f"niş={counts.get('niche', 0)}")


if __name__ == "__main__":
    main()
