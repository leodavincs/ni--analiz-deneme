# 🎯 Niş Avcısı — Pazar Açığı & Şikayet Radarı

Reddit, Hacker News, Product Hunt ve IndieHackers'tan insanların **gerçekten şikayet
ettiği** konuları otomatik toplar; Claude Code + [thinking-skills](https://github.com/tjboudreaux/cc-thinking-skills)
ile analiz eder; kursun rubriğine göre (**yatkınlık + problem + para akışı = /15, ≥12 → GİT**)
skorlanmış niş kartlarını **Obsidian vault**'a yazar.

> [polsia.com/live](https://polsia.com/live) felsefesi: sen uyurken sistem fırsat avlar.

## Mimari

```
Kaynaklar → collectors/ (Python) → SQLite (data/signals.db)  ← ALTIN KAYNAK
                                          ↓
                          Claude Code (nis-analizi skill)
                          Sonnet 4.6: kümeleme + thinking-skills + taslak skor
                          Opus 4.8:  nihai iş fikri + skor + seçim
                                          ↓
                          Obsidian Vault (Dashboard, Nişler/, Günlük/)
                                          ↓
                          sync_vault → SQLite (vault_notes)
```

**Kritik tasarım:** Veri (SQLite) ile çıktı (Obsidian) ayrık. polsia tarzı **canlı web
paneli** (`web/`) aynı DB'yi salt-okunur okuyarak besleniyor — toplama/analiz kodu değişmez.

**Obsidian sadece operatörün (senin) yazım/inceleme katmanı; son kullanıcı ona bağlanmaz.**
Skill'ler notları Obsidian'a `.md` yazar, `pipeline/sync_vault.py` (daily_run sonunda) bu
notları `signals.db > vault_notes` tablosuna kopyalar. Panel fırsat/niş içeriğini önce
DB'den okur (Obsidian klasörü yoksa da çalışır). Böylece **deploy edilen tek artefakt
`signals.db` + `web/`**: web panelini bir sunucuya koyup herkese açabilirsin, kimsenin
Obsidian'a ya da senin diskine erişmesi gerekmez.

## Kurulum

```bash
pip3 install -r requirements.txt
```

thinking-skills eklentisi (bir kez):
```bash
claude plugin marketplace add tjboudreaux/cc-thinking-skills
claude plugin install thinking-skills@thinking-skills-marketplace
```

### Reddit erişimi (önemli)
Reddit, sunucu/datacenter IP'lerinden anahtarsız erişimi **403 ile blokluyor**.
İki seçenek:
- **Kendi Mac'inde çalıştır** → public JSON genelde çalışır (ek kurulum yok).
- **OAuth (en sağlam)** → 2 dk: https://www.reddit.com/prefs/apps adresinden "script"
  tipi ücretsiz app aç, `client_id` ve `client_secret`'i `config.yaml`'a veya ortam
  değişkenine (`REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`) yaz.

> Hacker News tamamen ücretsiz/anahtarsız, her yerde çalışır.

## Kullanım

```bash
# Toplama (config'deki açık tüm kaynaklar)
python3 run.py

# Sadece belirli kaynak
python3 run.py --source reddit,hackernews

# Test (DB'ye yazmadan)
python3 run.py --dry-run
```

Toplama bitince `data/inbox/<tarih>.md` oluşur. Sonra Claude Code'da:
```
nis-analizi skill'ini çalıştır
```
Bu, sinyalleri analiz edip Obsidian vault'una niş kartlarını yazar.

## Yapılandırma — `config.yaml`
- `obsidian_vault` — çıktı klasörü
- `sources.*.enabled` — kaynak aç/kapa
- `signal_threshold` — DB'ye yazılma eşiği (0-100)
- `complaint_patterns` — şikayet sinyali kalıpları
- subreddit listesi, HN sorguları vb.

## Çıktı (Obsidian)
- `Niş Analizi/Dashboard.md` — skor sıralı liderlik tablosu
- `Niş Analizi/Nişler/<slug>.md` — niş başına kalıcı not (skor, JTBD, fermi, riskler, kanıt)
- `Niş Analizi/Günlük/<tarih>.md` — günlük digest

## Maliyet
- Toplama: ücretsiz (Reddit/HN public).
- Analiz: Claude Code; LLM'siz heuristik ön-eleme sadece yüksek-sinyalli az maddeyi
  modele gönderir. Sonnet hacimli işi, Opus sadece nihai sentezi yapar.

## Canlı Web Paneli (`web/`)
polsia.com/live tarzı koyu temalı canlı radar — iki radar tek ekranda, 15 sn'de bir yenilenir.
```bash
pip3 install -r requirements.txt
./web_run.sh            # → http://localhost:8000
```
Detay: [`web/README.md`](web/README.md).

## Yol Haritası
- [x] Faz 1: toplama + Claude analiz + Obsidian çıktı + günlük zamanlama
- [x] Faz 2: polsia tarzı canlı web paneli (aynı SQLite'tan beslenir)
