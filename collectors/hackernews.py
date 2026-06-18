"""
Hacker News collector — ÜCRETSİZ Algolia API (anahtar gerekmez).

Endpoint:
  http://hn.algolia.com/api/v1/search_by_date?query=...&tags=story&numericFilters=...
"""
import time
from .base import polite_get, signal_score

API = "http://hn.algolia.com/api/v1/search_by_date"


def collect(cfg, patterns, max_items):
    queries = cfg.get("queries", [])
    min_points = cfg.get("min_points", 5)
    days_back = cfg.get("days_back", 7)
    since = int(time.time()) - days_back * 86400
    per_query = max(5, max_items // max(len(queries), 1))

    items = []
    for q in queries:
        resp = polite_get(API, params={
            "query": q,
            "tags": "story",
            "numericFilters": f"created_at_i>{since},points>={min_points}",
            "hitsPerPage": per_query,
        })
        if not resp:
            print(f"   [hn] '{q}' atlandı")
            continue
        try:
            hits = resp.json().get("hits", [])
        except ValueError:
            continue

        for h in hits:
            title = h.get("title") or h.get("story_title") or ""
            body = h.get("story_text") or h.get("comment_text") or ""
            points = h.get("points") or 0
            ncom = h.get("num_comments") or 0
            sig = signal_score(title, body, patterns, points + ncom)
            oid = h.get("objectID")
            items.append({
                "source": "hackernews",
                "source_id": oid,
                "url": h.get("url") or f"https://news.ycombinator.com/item?id={oid}",
                "title": title,
                "body": body[:2000],
                "author": h.get("author"),
                "score": points,
                "num_comments": ncom,
                "signal_score": sig,
                "theme_hint": "hn",
            })
    return items
