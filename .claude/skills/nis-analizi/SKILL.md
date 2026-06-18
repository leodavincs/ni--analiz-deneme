---
name: nis-analizi
description: Toplanan gerçek kullanıcı şikayetlerini (data/inbox + signals.db) temalara kümeleyip, thinking-skills ile derinleştirir ve kurs rubriğine göre (yatkınlık+problem+para akışı=/15, ≥12 GİT) skorlanmış niş kartlarını Obsidian vault'a yazar. İki kademeli model: Sonnet hacimli analiz, Opus nihai iş fikri sentezi.
---

# Niş Analizi Skill'i

Bu skill, `run.py` çalıştıktan sonra üretilen sinyalleri okuyup pazar açığı / niş
fırsatlarına çevirir. Amaç: kursun 1.1 görevini (en az 3 niş, rubrik skoru, ≥12 seç)
gerçek veriyle ve düşünme modelleriyle otomatik üretmek.

## Girdi
- `data/inbox/<bugün>.md` — o günün yeni yüksek-sinyalli şikayetleri
- `data/signals.db` — tam veritabanı (gerekirse `sqlite3` ile sorgula)

## İki Kademeli Model Stratejisi (maliyet için ZORUNLU)

Token maliyetini düşürmek için işi `Agent` tool'u ile iki sub-agent'a böl:

### KADEME 1 — Sonnet 4.6 (hacimli, ucuz iş)
`Agent` tool, `subagent_type: "claude"`, `model: "sonnet"` ile çağır. Görevi:
1. Inbox'taki tüm şikayetleri oku.
2. Aynı acıyı paylaşanları **temalara kümele** (her tema = 1 niş adayı). En az 3-6 küme çıkar.
3. Her kümeye şu thinking-skills'i uygula (kısa, öz):
   - `thinking-jobs-to-be-done` — kullanıcı aslında neyi "işe alıyor"?
   - `thinking-first-principles` — problemin temel kökü ne?
   - `thinking-fermi-estimation` — kaba pazar/talep büyüklüğü tahmini
   - `thinking-red-team` — bu niş neden batar? (riskler)
4. Her küme için **TASLAK skor** ver (kanıta dayalı):
   - Yatkınlık (1-5), Problem Gözlemi/Şiddeti (1-5), Para Akışı/Ödeme İsteği (1-5)
5. Çıktı: her küme için { başlık, JTBD, kök problem, fermi, riskler, taslak skorlar,
   2-4 gerçek alıntı + kaynak link + signal id'leri } şeklinde yapılandırılmış özet döndür.

### KADEME 2 — Opus 4.8 (az, kritik iş)
Kademe 1'in çıktısını al; SADECE taslak toplamı en yüksek 3-5 adayı `Agent` tool,
`model: "opus"` ile işle. Görevi:
1. `thinking-opportunity-cost` ile "en az eforla en çok kazanç" süzgecinden geçir.
2. Her aday için **nihai iş fikri**ni netleştir: kime, hangi acı için, hangi hizmet/ürün modeli.
3. Skorları kesinleştir; toplam **/15** hesapla; **≥12 → status="git" (🟢)**, 9-11 → "bekle", <9 → "ele".
4. Nihai niş kartlarını üret (aşağıdaki Obsidian formatında).

## Çıktı — Obsidian Vault'a Yaz

Hedef klasör config.yaml'daki `obsidian_vault` (vars: `/Users/sarp/Documents/Obsidian Vault/Niş Analizi`).
Alt klasörleri gerekirse oluştur: `Nişler/`, `Günlük/`.

### Görsel kurallar (Obsidian render'ı için ZORUNLU)
- **Karar callout'u:** status'a göre Obsidian callout tipi kullan — `git → [!success]`,
  `bekle → [!warning]`, `ele → [!danger]`. Başlıkta emoji + skor: `🟢 GİT · 13/15`.
- **ASCII skor çubuğu:** her alt-skoru `█` (dolu) ve `░` (boş) ile 5 bloka çiz.
  Eşleme: 1→`█░░░░`, 2→`██░░░`, 3→`███░░`, 4→`████░`, 5→`█████`. Backtick içinde ver.

### 1. Niş notu — `Nişler/<niş-slug>.md` (varsa GÜNCELLE, kopya açma)
```markdown
---
tags: [nis]
status: git            # git | bekle | ele
yatkinlik: 5
problem: 4
para_akisi: 4
score: 13
kaynak: [reddit, hackernews]
updated: 2026-06-17
---

# <Niş Başlığı>

> [!success] 🟢 GİT · 13/15
> **yatkınlık** `█████` 5/5 · **problem** `████░` 4/5 · **para akışı** `████░` 4/5

## İş Fikri (Opus sentezi)
<kime, hangi acı, hangi model>

## Jobs-to-be-Done
...
## Kök Problem (first-principles)
...
## Pazar Büyüklüğü (fermi)
...
## Riskler (red-team)
...
## Kanıt — Gerçek Şikayetler
- > "<alıntı>" — [kaynak](url)
- > "<alıntı>" — [kaynak](url)
```

### 2. Dashboard — `Dashboard.md` (her çalışmada güncelle)
Skor sıralı liderlik tablosu + en üstte öneri callout'u. Örnek:
```markdown
# 🎯 Niş Avcısı — Dashboard
> Son güncelleme: 2026-06-17 | <N> sinyal analiz edildi

> [!tip] 🏆 İlk hamle önerisi
> **[[Nişler/<slug>]]** — <tek cümlelik gerekçe>

| Niş | Skor | Durum | Yatkınlık | Problem | Para Akışı | Sinyal |
|-----|------|-------|-----------|---------|------------|--------|
| [[Nişler/<slug>]] | 13/15 | 🟢 git | `████░` 4 | `█████` 5 | `███░░` 3 | 5+ |
```

### 3. Günlük digest — `Günlük/<tarih>.md`
O gün kaç sinyal işlendi, hangi yeni nişler/güncellemeler çıktı (kısa).

## Son adım — DB'yi güncelle
Analiz edilen signal id'leri için `is_new=0` yap ve `niches` tablosunu güncelle:
```bash
sqlite3 data/signals.db "UPDATE signals SET is_new=0 WHERE id IN (...);"
```
Niş kayıtlarını `niches` tablosuna upsert et (slug, skorlar, total, status, summary).
Böylece bir sonraki çalışmada sadece yeni sinyaller analiz edilir ve web paneli
(gelecek) aynı tablodan beslenebilir.

## Kurallar
- **Uydurma yok:** Her niş kanıta (gerçek alıntı + link) dayanmalı.
- **İdempotent:** Var olan niş notunu güncelle, kopyalama.
- **Türkçe** yaz (kullanıcı tercihi), teknik terimler İngilizce kalabilir.
