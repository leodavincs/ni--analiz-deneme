#!/usr/bin/env python3
"""Mevcut niş notlarını yeni görsel formata yükseltir (idempotent).
Sadece '**Karar:** ...' satırını status callout + ASCII skor çubuğu bloğuyla değiştirir;
gövdedeki prozaya DOKUNMAZ. Frontmatter skorlarını kaynak alır.
Tekrar çalıştırılabilir: zaten callout varsa o notu atlar.
"""
import re
import sys
from pathlib import Path

VAULT = Path("/Users/sarp/Documents/Obsidian Vault/Niş Analizi/Nişler")

CALLOUT = {  # status -> (callout tipi, emoji, etiket)
    "git": ("success", "🟢", "GİT"),
    "bekle": ("warning", "🟡", "BEKLE"),
    "aday": ("warning", "🟡", "ADAY"),
    "ele": ("danger", "🔴", "ELE"),
}


def bar(v: int, mx: int = 5) -> str:
    v = max(0, min(mx, int(v)))
    return "█" * v + "░" * (mx - v)


def fm_int(fm: str, key: str, default: int = 0) -> int:
    m = re.search(rf"^{key}:\s*(\d+)", fm, re.MULTILINE)
    return int(m.group(1)) if m else default


def fm_str(fm: str, key: str, default: str = "") -> str:
    m = re.search(rf"^{key}:\s*(\S+)", fm, re.MULTILINE)
    return m.group(1).strip() if m else default


def upgrade(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    if not m:
        return False
    fm = m.group(1)
    status = fm_str(fm, "status", "aday")
    score = fm_int(fm, "score")
    yat, prob, para = fm_int(fm, "yatkinlik"), fm_int(fm, "problem"), fm_int(fm, "para_akisi")
    tip, emoji, label = CALLOUT.get(status, CALLOUT["aday"])

    block = (
        f"> [!{tip}] {emoji} {label} · {score}/15\n"
        f"> **yatkınlık** `{bar(yat)}` {yat}/5 · "
        f"**problem** `{bar(prob)}` {prob}/5 · "
        f"**para akışı** `{bar(para)}` {para}/5"
    )

    # Zaten yükseltilmişse atla.
    if "> [!success]" in text or "> [!warning]" in text or "> [!danger]" in text:
        return False

    # '**Karar:** ...' satırını (varsa) callout bloğuyla değiştir.
    new_text, n = re.subn(r"^\*\*Karar:\*\*.*$", block, text, count=1, flags=re.MULTILINE)
    if n == 0:
        # Karar satırı yoksa H1'den sonra ekle.
        new_text = re.sub(r"^(# .+)$", r"\1\n\n" + block, text, count=1, flags=re.MULTILINE)

    path.write_text(new_text, encoding="utf-8")
    return True


def main() -> None:
    if not VAULT.exists():
        print(f"Klasör yok: {VAULT}", file=sys.stderr)
        sys.exit(1)
    changed = 0
    for p in sorted(VAULT.glob("*.md")):
        if upgrade(p):
            changed += 1
            print(f"✓ {p.name}")
    print(f"\n{changed} not yükseltildi.")


if __name__ == "__main__":
    main()
