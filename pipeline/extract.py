"""
Toplanan maddelerden Claude'un okuyacağı günlük 'inbox' markdown'ını üretir.

Bu dosya LLM içermez; sadece yeni & yüksek-sinyalli maddeleri kaynağa göre
gruplayıp Claude Code'un analiz edeceği temiz bir brief'e çevirir.
"""
from datetime import date
from pathlib import Path

INBOX_DIR = Path(__file__).resolve().parent.parent / "data" / "inbox"
TREND_INBOX_DIR = Path(__file__).resolve().parent.parent / "data" / "inbox_trends"

DOMAIN_LABEL = {
    "ai": "Yapay Zeka / LLM",
    "startup": "SaaS / Startup",
    "consumer": "Tüketici Tech & No-code/Creator",
    "fintech": "Fintech / Kripto",
    "ecommerce": "E-ticaret",
    "emerging": "Gelişmekte Olan Pazarlar",
    "genel": "Genel",
}

SOURCE_LABEL = {
    "reddit": "Reddit",
    "hackernews": "Hacker News",
    "producthunt": "Product Hunt",
    "indiehackers": "IndieHackers",
}


def build_inbox(signals):
    """signals: get_new_signals çıktısı (dict listesi). Inbox dosya yolunu döner."""
    INBOX_DIR.mkdir(parents=True, exist_ok=True)
    today = date.today().isoformat()
    path = INBOX_DIR / f"{today}.md"

    by_source = {}
    for s in signals:
        by_source.setdefault(s["source"], []).append(s)

    lines = [
        f"# Niş Avcısı — Sinyal Inbox'ı ({today})",
        "",
        f"Toplam **{len(signals)}** yeni yüksek-sinyalli madde. "
        "Claude bunları temalara kümeleyip niş kartlarına çevirecek.",
        "",
    ]
    for source, rows in by_source.items():
        lines.append(f"## {SOURCE_LABEL.get(source, source)} ({len(rows)})")
        lines.append("")
        for r in rows:
            lines.append(
                f"- **[{r['signal_score']}]** [{r['title']}]({r['url']}) "
                f"— ⬆{r['score']} 💬{r['num_comments']} `{r.get('theme_hint','')}` "
                f"(id:{r['id']})"
            )
            body = (r.get("body") or "").strip().replace("\n", " ")
            if body:
                lines.append(f"  > {body[:280]}")
        lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def build_trend_inbox(items):
    """items: get_new_trend_items çıktısı. Trend inbox yolunu döner.
    Alan'a göre gruplar; Claude bunları trendlere kümeleyecek."""
    TREND_INBOX_DIR.mkdir(parents=True, exist_ok=True)
    today = date.today().isoformat()
    path = TREND_INBOX_DIR / f"{today}.md"

    by_domain = {}
    for it in items:
        by_domain.setdefault(it.get("domain") or "genel", []).append(it)

    lines = [
        f"# Trend Radarı — Haber Inbox'ı ({today})",
        "",
        f"Toplam **{len(items)}** yeni haber. Claude bunları (çok kaynakta çıkan = "
        "yüksek momentum) trendlere kümeleyip 2 açıdan değerlendirecek: "
        "kendi entegrasyonumuz + Türkiye'ye uyarlama.",
        "",
    ]
    for domain, rows in by_domain.items():
        lines.append(f"## {DOMAIN_LABEL.get(domain, domain)} ({len(rows)})")
        lines.append("")
        for r in rows:
            lines.append(
                f"- [{r['title']}]({r['url']}) "
                f"— `{r['source']}` (id:{r['id']})"
            )
            summ = (r.get("summary") or "").strip().replace("\n", " ")
            if summ:
                lines.append(f"  > {summ[:240]}")
        lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")
    return path
