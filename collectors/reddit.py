"""
Reddit collector — iki mod:

1) OAuth (ÖNERİLEN, sağlam):  application-only (client_credentials) ile token alır,
   oauth.reddit.com'a gider. 60 istek/dk. Kimlik config.yaml veya ortam değişkeninden:
       REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET
   Ücretsiz uygulama kaydı: https://www.reddit.com/prefs/apps ("script" tipi).

2) Public JSON (fallback): www.reddit.com/r/{sub}/{listing}.json
   Anahtar gerekmez ama datacenter IP'lerinde 403 yer; ev internetinde genelde çalışır.
"""
import os
import requests
from .base import polite_get, signal_score, USER_AGENT

PUBLIC = "https://www.reddit.com"
OAUTH = "https://oauth.reddit.com"
TOKEN_URL = "https://www.reddit.com/api/v1/access_token"


def _get_token(client_id, client_secret):
    """Application-only OAuth (kullanıcı adı/şifre gerekmez)."""
    try:
        resp = requests.post(
            TOKEN_URL,
            auth=requests.auth.HTTPBasicAuth(client_id, client_secret),
            data={"grant_type": "client_credentials"},
            headers={"User-Agent": USER_AGENT},
            timeout=20,
        )
        resp.raise_for_status()
        return resp.json().get("access_token")
    except requests.RequestException as e:
        print(f"   [reddit] OAuth token alınamadı: {e}")
        return None


def _fetch(url, params, token):
    if token:
        # oauth.reddit.com için Authorization başlığı ile manuel istek
        from .base import _last_request, MIN_INTERVAL
        import time
        elapsed = time.time() - _last_request["t"]
        if elapsed < MIN_INTERVAL:
            time.sleep(MIN_INTERVAL - elapsed)
        try:
            r = requests.get(
                url,
                params=params,
                headers={"User-Agent": USER_AGENT,
                         "Authorization": f"bearer {token}"},
                timeout=20,
            )
            _last_request["t"] = time.time()
            r.raise_for_status()
            return r
        except requests.RequestException as e:
            print(f"   [reddit] {url} hata: {e}")
            return None
    return polite_get(url, params=params)


def collect(cfg, patterns, max_items):
    subs = cfg.get("subreddits", [])
    listings = cfg.get("listings", ["top"])
    time_filter = cfg.get("time_filter", "week")
    per_sub = max(5, max_items // max(len(subs), 1))

    client_id = cfg.get("client_id") or os.environ.get("REDDIT_CLIENT_ID")
    client_secret = cfg.get("client_secret") or os.environ.get("REDDIT_CLIENT_SECRET")
    token = None
    if client_id and client_secret:
        token = _get_token(client_id, client_secret)
        if token:
            print("   [reddit] OAuth modu aktif")
    base = OAUTH if token else PUBLIC
    if not token:
        print("   [reddit] public JSON modu (kimlik yok)")

    items = []
    for sub in subs:
        for listing in listings:
            url = f"{base}/r/{sub}/{listing}.json"
            resp = _fetch(url, {"t": time_filter, "limit": per_sub}, token)
            if not resp:
                print(f"   [reddit] r/{sub}/{listing} atlandı")
                continue
            try:
                children = resp.json()["data"]["children"]
            except (KeyError, ValueError):
                continue

            for ch in children:
                d = ch.get("data", {})
                if d.get("stickied"):
                    continue
                title = d.get("title", "")
                body = d.get("selftext", "")
                engagement = (d.get("score") or 0) + (d.get("num_comments") or 0)
                sig = signal_score(title, body, patterns, engagement)
                items.append({
                    "source": "reddit",
                    "source_id": d.get("id"),
                    "url": PUBLIC + d.get("permalink", ""),
                    "title": title,
                    "body": body[:2000],
                    "author": d.get("author"),
                    "score": d.get("score") or 0,
                    "num_comments": d.get("num_comments") or 0,
                    "signal_score": sig,
                    "theme_hint": f"r/{sub}",
                })
    return items
