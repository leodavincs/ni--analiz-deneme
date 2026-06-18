# 🛰️ Canlı Web Paneli (polsia.com/live tarzı)

`data/signals.db`'yi **salt-okunur** okuyan koyu temalı canlı radar paneli. Collector
ve analiz koduna dokunmaz — yalnızca aynı SQLite kaynağını okur ("altın kaynak ayrımı").

```
data/signals.db ──(read-only)──► web/server.py (Flask JSON API) ──► web/ui (React/Vite)
```

## Hızlı başlangıç (üretim — tek komut)

```bash
pip3 install -r requirements.txt   # Flask (bir kez)
./web_run.sh                       # UI build + sunucu → http://localhost:8000
```

> Node yoksa: `brew install node`. `web_run.sh` ilk seferde `npm install`'ı kendi yapar.

## Geliştirme (canlı reload)

İki terminal:

```bash
# 1) API
python3 web/server.py            # :8000

# 2) UI (Vite, /api'yi 8000'e proxy'ler)
cd web/ui && npm run dev         # :5173 → tarayıcıda burayı aç
```

## API uçları (hepsi salt-okunur JSON)

| Uç | Döndürdüğü |
|----|-----------|
| `GET /api/overview` | sayaçlar, son tarama zamanı, kaynak/domain dağılımı |
| `GET /api/niches` | niş kartları (skor /15, status, yatkınlık/problem/para) |
| `GET /api/trends` | trend kartları (+ 🔧 entegrasyon, 🇹🇷 Türkiye fikri) |
| `GET /api/feed?limit=40` | son toplanan ham sinyaller (canlı akış). `?kind=trend` haber akışı |
| `GET /api/news?domain=&limit=` | **Haber Akışı** sayfası: ham RSS haberleri (en yeni önce) + domain sayıları + collector durumu |
| `POST /api/collect/rss` | boştaysa yeni bir RSS toplama turu tetikler (ücretsiz, arka plan thread) |
| `GET /api/collect/status` | canlı toplama durumu (running / son turda eklenen / oturum toplamı) |

### Haber Akışı sekmesi (`?tab=news`)
İkinci sekme = **canlı RSS akışı**. Kullanıcı bu sekmedeyken frontend boştaki collector'ı
~20 sn'de bir tetikler → `collectors/rss.py` feed'leri çeker, yeni haberler `trend_items`'a
yazılır ve listeye **YENİ** rozetiyle akarak girer. Üst barda `● ÇEKİLİYOR…` göstergesi,
"bu oturumda +N haber" sayacı ve domain filtre çipleri var. RSS ücretsiz olduğundan sürekli
çekmenin para maliyeti yok. Toplama ayrı yazma bağlantısı kullanır; okuma uçları salt-okunur kalır.

**Sıralama & yaş:** Haberler `published_at`'e göre **güncelden eskiye** sıralanır (karışık
ISO/RFC822 tarihler `_parse_dt` ile parse edilir) ve **30 günden eski** öğeler web görünümünde
gizlenir (`NEWS_MAX_AGE_DAYS`); DB'den silinmez. Böylece Google News'in döndürdüğü evergreen
eski makaleler üste çıkmaz.

**Görseller:** `collectors/rss.py` her habere görsel çıkarır (media:content/thumbnail,
enclosure, `content:encoded`/atom content içi ilk `<img>`) → `trend_items.image_url`. Dedup
edilen eski satırlara da geriye dönük doldurulur (`upsert_trend_item`, yeni-insert sayımını
bozmadan). UI'da her haber kartının solunda **küçük kare görsel**: gerçek görsel → yoksa
kaynağın **favicon**'u → o da olmazsa harf placeholder (kademeli `onError` düşüşü).

## Tasarım

- Koyu zemin (`#070809`) + radyal parıltı + ince ızgara doku, monospace aksan (JetBrains Mono).
- Tek vurgu rengi: mint `#3df5a0` = GİT/AKSİYON; amber = bekle/izle; gri = ele/geç.
- "Canlı his": yanıp sönen LIVE noktası, count-up KPI'lar, 15 sn'de bir poll, framer-motion
  giriş/akış animasyonları. (Gerçek real-time değil; batch toplama + animasyon ile algı.)

## Dosyalar

- `web/server.py` — Flask API + üretim statiği (`web/ui/dist`).
- `web/ui/` — Vite + React + TS + Tailwind v3 + framer-motion.
  - `src/api.ts` tipler+fetch · `src/lib.ts` yardımcılar · `src/components/` görsel parçalar.
