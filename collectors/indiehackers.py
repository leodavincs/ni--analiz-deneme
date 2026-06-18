"""
IndieHackers collector — Tier 2, KIRILGAN best-effort.

IndieHackers'ın resmi API'si yok ve Cloudflare/JS-ağır. Public JSON ucu
zaman zaman çalışır; çalışmazsa sessizce boş döner, sistem etkilenmez.
Varsayılan olarak config'de KAPALI.
"""
from .base import polite_get, signal_score

# Best-effort: IndieHackers'ın eski public JSON ucu (kırılabilir).
URL = "https://www.indiehackers.com/forum.json"


def collect(cfg, patterns, max_items):
    resp = polite_get(URL)
    if not resp:
        print("   [indiehackers] erişilemedi, atlandı (beklenen olabilir)")
        return []
    try:
        data = resp.json()
    except ValueError:
        print("   [indiehackers] JSON değil (muhtemelen Cloudflare), atlandı")
        return []

    # Şema değişebilir; savunmacı gez.
    posts = data if isinstance(data, list) else data.get("posts", [])
    items = []
    for p in posts[:max_items]:
        if not isinstance(p, dict):
            continue
        title = p.get("title") or p.get("name") or ""
        body = p.get("body") or p.get("text") or ""
        sid = p.get("id") or p.get("slug") or title
        sig = signal_score(title, body, patterns, p.get("upvotes", 0))
        items.append({
            "source": "indiehackers",
            "source_id": str(sid),
            "url": p.get("url", "https://www.indiehackers.com"),
            "title": title,
            "body": str(body)[:2000],
            "author": p.get("author"),
            "score": p.get("upvotes", 0) or 0,
            "num_comments": p.get("commentsCount", 0) or 0,
            "signal_score": sig,
            "theme_hint": "indiehackers",
        })
    return items
