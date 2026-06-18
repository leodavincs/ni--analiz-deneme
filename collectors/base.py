"""
Ortak collector altyapısı: nazik HTTP (User-Agent + rate-limit + retry)
ve LLM'siz şikayet sinyali skorlaması.
"""
import time
import requests

# Reddit gibi servisler User-Agent ister; tanımlı ve dürüst bir tane kullanıyoruz.
USER_AGENT = "nis-avcisi/0.1 (market-research; personal use)"

_last_request = {"t": 0.0}
MIN_INTERVAL = 1.1  # saniye — saygılı rate-limit (~1 req/sn)


def polite_get(url, params=None, timeout=20, retries=3):
    """Rate-limitli, retry'lı GET. Başarısızsa None döner (sistemi çökertmez)."""
    for attempt in range(retries):
        # global rate-limit
        elapsed = time.time() - _last_request["t"]
        if elapsed < MIN_INTERVAL:
            time.sleep(MIN_INTERVAL - elapsed)
        try:
            resp = requests.get(
                url,
                params=params,
                headers={"User-Agent": USER_AGENT},
                timeout=timeout,
            )
            _last_request["t"] = time.time()
            if resp.status_code == 429:
                wait = 2 ** (attempt + 2)  # 4, 8, 16 sn backoff
                print(f"   [rate-limit 429] {wait}sn bekleniyor...")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp
        except requests.RequestException as e:
            print(f"   [istek hatası dene {attempt + 1}/{retries}] {e}")
            time.sleep(2 ** attempt)
    return None


# 2. kademe "niyet/yardım" kalıpları — gerçek şikayet kadar güçlü değil ama
# problem sinyali taşır ("how do i", "need help" vb.). DÜŞÜK ağırlık (+6).
# run.py (veya rescore scripti) config'den okuyup burayı doldurur.
INTENT_PATTERNS = []


def signal_score(title, body, patterns, engagement=0):
    """
    Şikayet sinyali skoru (0-100). LLM'siz ön-eleme — token tasarrufu.
    - Eşleşen şikayet kalıbı sayısı (her biri +12, max 60)
    - Eşleşen niyet/yardım kalıbı (INTENT_PATTERNS, her biri +6, max 24)
    - Soru işareti / yardım arayışı (+8)
    - Etkileşim (upvote+yorum) log-ölçekli katkı (max 32)
    """
    import math

    text = f"{title or ''} {body or ''}".lower()
    matches = sum(1 for p in patterns if p.lower() in text)
    score = min(matches * 12, 60)

    if INTENT_PATTERNS:
        imatches = sum(1 for p in INTENT_PATTERNS if p.lower() in text)
        score += min(imatches * 6, 24)

    if "?" in (title or ""):
        score += 8

    if engagement > 0:
        score += min(int(math.log10(engagement + 1) * 16), 32)

    return min(score, 100)
