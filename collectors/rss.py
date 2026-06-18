"""
Genel RSS/Atom collector — Trend Radarı için (tamamen ücretsiz).

Hem RSS (<item>) hem Atom (<entry>) formatını parse eder. Config'deki feed
listesini ve Google News sorgularını gezer. base.polite_get yeniden kullanılır.
"""
import re
import urllib.parse
from xml.etree import ElementTree as ET
from .base import polite_get

ATOM = "{http://www.w3.org/2005/Atom}"
CONTENT = "{http://purl.org/rss/1.0/modules/content/}"  # content:encoded (metin fallback)


def _strip_html(s):
    return re.sub(r"<[^>]+>", "", s or "").strip()


# config['rss']['exclude_patterns'] derlenince buraya doldurulur (collect içinde set edilir).
_EXCLUDE_RE = None


def _is_excluded(title, url):
    """Kupon/indirim/reklam gürültüsü mü? Başlık veya URL kalıba uyarsa True."""
    if _EXCLUDE_RE is None:
        return False
    return bool(_EXCLUDE_RE.search(title or "") or _EXCLUDE_RE.search(url or ""))


def _text(el):
    return el.text.strip() if (el is not None and el.text) else ""


def _parse(content, source, domain, max_items):
    """Bir feed'in ham içeriğini parse edip öğe listesi döndürür."""
    try:
        root = ET.fromstring(content)
    except ET.ParseError:
        print(f"   [rss] {source} parse hatası, atlandı")
        return []

    items = []

    # --- RSS: channel/item ---
    for it in root.iter("item"):
        title = _text(it.find("title"))
        link = _text(it.find("link"))
        raw_desc = _text(it.find("description"))
        raw_content = _text(it.find(f"{CONTENT}encoded"))  # tam HTML (metin fallback)
        desc = _strip_html(raw_desc or raw_content)
        guid = _text(it.find("guid")) or link
        pub = _text(it.find("pubDate"))
        if title and _is_excluded(title, link):
            continue
        if title:
            items.append({
                "source": source, "source_id": guid, "url": link,
                "title": title, "summary": desc[:1500],
                "domain": domain, "published_at": pub,
            })
        if len(items) >= max_items:
            return items

    # --- Atom: entry ---
    for en in root.iter(f"{ATOM}entry"):
        title = _text(en.find(f"{ATOM}title"))
        link_el = en.find(f"{ATOM}link")
        link = link_el.get("href") if link_el is not None else ""
        raw_summary = _text(en.find(f"{ATOM}summary"))
        raw_content = _text(en.find(f"{ATOM}content"))  # metin fallback
        summ = _strip_html(raw_summary or raw_content)
        gid = _text(en.find(f"{ATOM}id")) or link
        pub = _text(en.find(f"{ATOM}updated")) or _text(en.find(f"{ATOM}published"))
        if title and _is_excluded(title, link):
            continue
        if title:
            items.append({
                "source": source, "source_id": gid, "url": link,
                "title": title, "summary": summ[:1500],
                "domain": domain, "published_at": pub,
            })
        if len(items) >= max_items:
            break

    return items


def collect(cfg):
    """cfg = config['rss']. Tüm feed'leri + Google News sorgularını toplar."""
    max_items = cfg.get("max_items_per_feed", 25)
    all_items = []

    # Kupon/indirim filtresini derle (varsa). Tek bir birleşik regex → hızlı.
    global _EXCLUDE_RE
    patterns = cfg.get("exclude_patterns") or []
    _EXCLUDE_RE = re.compile("|".join(patterns), re.I) if patterns else None

    # Sabit feed'ler
    for feed in cfg.get("feeds", []):
        resp = polite_get(feed["url"])
        if not resp:
            print(f"   [rss] {feed['name']} alınamadı, atlandı")
            continue
        got = _parse(resp.content, feed["name"], feed.get("domain", "genel"), max_items)
        print(f"   [rss] {feed['name']}: {len(got)} öğe")
        all_items.extend(got)

    # Google News sorguları
    gn = cfg.get("google_news", {})
    template = gn.get("template", "")
    for q in gn.get("queries", []):
        if not template:
            break
        url = template.replace("{SORGU}", urllib.parse.quote(q["q"]))
        resp = polite_get(url)
        if not resp:
            print(f"   [rss] GoogleNews '{q['q']}' alınamadı, atlandı")
            continue
        src = f"GoogleNews: {q['q']}"
        got = _parse(resp.content, src, q.get("domain", "genel"), max_items)
        print(f"   [rss] {src}: {len(got)} öğe")
        all_items.extend(got)

    return all_items
