"""
Product Hunt collector — Tier 2, best-effort (token'sız RSS).

RSS: https://www.producthunt.com/feed
Şikayet sinyali zayıf; trend doğrulama içindir. Bozulursa sessiz atlar.
"""
import re
from xml.etree import ElementTree as ET
from .base import polite_get, signal_score

FEED = "https://www.producthunt.com/feed"


def _strip_html(s):
    return re.sub(r"<[^>]+>", "", s or "").strip()


def collect(cfg, patterns, max_items):
    resp = polite_get(FEED)
    if not resp:
        print("   [producthunt] feed alınamadı, atlandı")
        return []
    try:
        root = ET.fromstring(resp.content)
    except ET.ParseError:
        print("   [producthunt] RSS parse hatası, atlandı")
        return []

    items = []
    for entry in root.iter("{http://www.w3.org/2005/Atom}entry"):
        ns = "{http://www.w3.org/2005/Atom}"
        title = (entry.findtext(f"{ns}title") or "")
        body = _strip_html(entry.findtext(f"{ns}content") or "")
        link_el = entry.find(f"{ns}link")
        url = link_el.get("href") if link_el is not None else ""
        sid = entry.findtext(f"{ns}id") or url
        sig = signal_score(title, body, patterns, 0)
        items.append({
            "source": "producthunt",
            "source_id": sid,
            "url": url,
            "title": title,
            "body": body[:1500],
            "author": None,
            "score": 0,
            "num_comments": 0,
            "signal_score": sig,
            "theme_hint": "trend",
        })
        if len(items) >= max_items:
            break
    return items
