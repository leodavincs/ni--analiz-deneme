"""
Reddit collector — Apify üzerinden (IP engelini aşar).

İstek api.apify.com'a gider; asıl scrape'i Apify kendi proxy havuzundan yapar.
Bu yüzden datacenter/cloud IP'lerinden bile çalışır (anahtarsız public JSON'un
aksine). Token gerekir: config.yaml > sources.reddit_apify.token  veya
ortam değişkeni APIFY_TOKEN.

Actor ve girdi şeması config'den ayarlanabilir (farklı actor'lar farklı şema
kullandığı için). Varsayılan: trudax/reddit-scraper.
"""
import os
import time
import requests
from .base import signal_score, USER_AGENT

RUN_URL = "https://api.apify.com/v2/acts/{actor}/runs"
RUN_STATUS = "https://api.apify.com/v2/actor-runs/{run_id}"
DATASET = "https://api.apify.com/v2/datasets/{ds_id}/items"


def _run_actor(actor, token, payload, max_wait=600, poll=8):
    """Actor'ı async başlat, bitene kadar poll et, dataset maddelerini döndür.
    Senkron endpoint'in 300sn limitini aşmak için bu yol kullanılır."""
    try:
        start = requests.post(
            RUN_URL.format(actor=actor),
            params={"token": token},
            json=payload,
            headers={"User-Agent": USER_AGENT},
            timeout=30,
        )
        start.raise_for_status()
        run = start.json()["data"]
    except (requests.RequestException, KeyError, ValueError) as e:
        print(f"   [reddit_apify] başlatma hatası: {e}")
        return []

    run_id = run["id"]
    ds_id = run.get("defaultDatasetId")
    waited = 0
    while waited < max_wait:
        time.sleep(poll)
        waited += poll
        try:
            st = requests.get(
                RUN_STATUS.format(run_id=run_id),
                params={"token": token}, timeout=30,
            ).json()["data"]
        except (requests.RequestException, KeyError, ValueError):
            continue
        status = st.get("status")
        ds_id = st.get("defaultDatasetId", ds_id)
        if status not in ("RUNNING", "READY"):
            print(f"   [reddit_apify] actor durumu: {status} ({waited}sn)")
            break
    else:
        print(f"   [reddit_apify] {max_wait}sn aşıldı, kısmi sonuç denenecek")

    if not ds_id:
        return []
    try:
        items = requests.get(
            DATASET.format(ds_id=ds_id),
            params={"token": token}, timeout=60,
        ).json()
        return items if isinstance(items, list) else []
    except (requests.RequestException, ValueError) as e:
        print(f"   [reddit_apify] dataset çekme hatası: {e}")
        return []


def _first(d, *keys, default=None):
    """Birden fazla olası anahtardan ilk dolu olanı döndür (actor şema farkı için)."""
    for k in keys:
        v = d.get(k)
        if v not in (None, "", []):
            return v
    return default


def collect(cfg, patterns, max_items):
    token = cfg.get("token") or os.environ.get("APIFY_TOKEN")
    if not token:
        print("   [reddit_apify] APIFY_TOKEN yok, atlandı")
        return []

    actor = cfg.get("actor", "trudax/reddit-scraper").replace("/", "~")
    subs = cfg.get("subreddits", [])
    sort = cfg.get("sort", "top")
    time_filter = cfg.get("time_filter", "week")
    # Kaynağa özel maliyet tavanı (config: sources.reddit_apify.max_items) global
    # max_items_per_source'u ezer. Apify $2/1.000 sonuç ücretlendirir.
    # ÖNEMLİ: bu actor maxItems<=100 zorunlu kılıyor; aşılırsa 400 döner → sert tavan.
    max_items = min(cfg.get("max_items", max_items), 100)

    # Temiz subreddit URL'leri; sort/time ayrı alanlarda gönderilir (doğru hedefleme).
    start_urls = [{"url": f"https://www.reddit.com/r/{s}/"} for s in subs]

    # Çoğu reddit actor'ının kabul ettiği genel girdi. Gerekirse config'deki
    # 'extra_input' ile üzerine yazılır/eklenir.
    # practicaltools/apify-reddit-api şemasına uygun minimal payload.
    # (Bilinmeyen alanlar async /runs endpoint'inde 400 verir.)
    # Farklı actor kullanırsan config'deki 'extra_input' ile alanları ekle/değiştir.
    payload = {
        "startUrls": start_urls,
        "maxItems": max_items,
        "skipComments": True,
        "skipCommunity": True,        # community/about sayfasını atla (hız)
        "sort": sort,
        "time": time_filter,
    }
    payload.update(cfg.get("extra_input", {}))

    max_wait = cfg.get("max_wait", 600)
    data = _run_actor(actor, token, payload, max_wait=max_wait)

    items = []
    for d in data:
        if not isinstance(d, dict):
            continue
        # 'comment' tipi kayıtları atla (sadece post istiyoruz).
        dtype = (d.get("dataType") or d.get("type") or "").lower()
        if dtype and "comment" in dtype:
            continue

        title = _first(d, "title", "postTitle", default="")
        body = _first(d, "body", "text", "selftext", "content", default="")
        sid = _first(d, "id", "parsedId", "postId", default=None)
        link = _first(d, "url", "link", "postUrl",
                      default=f"https://www.reddit.com/comments/{sid}" if sid else "")
        score = _first(d, "upVotes", "score", "ups", "upvotes", default=0) or 0
        ncom = _first(d, "numberOfComments", "numComments", "num_comments",
                      "commentsCount", default=0) or 0
        author = _first(d, "username", "author", default=None)
        community = _first(d, "communityName", "subreddit", "community", default="")

        if not sid:
            continue
        engagement = int(score) + int(ncom)
        sig = signal_score(title, str(body), patterns, engagement)
        items.append({
            "source": "reddit",          # reddit.py ile aynı kaynak adı (birleşik havuz)
            "source_id": str(sid),
            "url": link,
            "title": title,
            "body": str(body)[:2000],
            "author": author,
            "score": int(score),
            "num_comments": int(ncom),
            "signal_score": sig,
            "theme_hint": str(community) or "reddit",
        })
    return items
