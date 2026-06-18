#!/usr/bin/env python3
"""Canlı web paneli — salt-okunur Flask API + statik servis.

`data/signals.db`'yi YALNIZCA okur (collectors/analiz koduna dokunmaz). Polsia
tarzı React panelini besler. Tek başına çalıştırılabilir:

    python3 web/server.py            # http://localhost:8000

Geliştirmede UI Vite dev server'ında (5173) çalışır ve `/api`'yi buraya proxy'ler.
Üretimde `web/ui/dist` varsa kökten servis edilir.
"""

import json
import os
import re
import sqlite3
import sys
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "signals.db"
DIST = Path(__file__).resolve().parent / "ui" / "dist"

# Toplama kodunu (collectors/, pipeline/) yeniden kullanabilmek için kök yolu ekle.
sys.path.insert(0, str(ROOT))

app = Flask(__name__, static_folder=None)


def db():
    """Salt-okunur bağlantı — okuma uçları hiçbir koşulda DB'ye yazamaz."""
    uri = f"file:{DB_PATH}?mode=ro"
    conn = sqlite3.connect(uri, uri=True, timeout=5)
    conn.row_factory = sqlite3.Row
    return conn


# ---- Canlı RSS toplama (yazma; ayrı thread) -----------------------------
# Kullanıcı "Haber Akışı" sekmesindeyken frontend boştaki collector'ı tetikler;
# burada RSS feed'leri çekilip trend_items'a yazılır (ücretsiz kaynak). Web'in
# salt-okunur bağlantısından bağımsız, store.connect() (yazma) kullanılır.
_collect_lock = threading.Lock()
_collect_state = {
    "running": False,
    "started_at": None,
    "finished_at": None,
    "last_added": 0,        # son turda eklenen yeni haber
    "last_fetched": 0,      # son turda çekilen toplam (dedup öncesi)
    "session_added": 0,     # sunucu açıldığından beri toplam yeni haber
    "runs": 0,
    "error": None,
}


def _run_rss_collection():
    import yaml
    from collectors import rss
    from pipeline import store

    try:
        with open(ROOT / "config.yaml", encoding="utf-8") as f:
            cfg = yaml.safe_load(f)
        rcfg = cfg.get("rss", {})
        items = rss.collect(rcfg)
        added = 0
        store.init_db()
        conn = store.connect()
        try:
            conn.execute("PRAGMA busy_timeout = 5000")
            for item in items:
                if item.get("source_id"):
                    added += store.upsert_trend_item(conn, item)
            conn.commit()
        finally:
            conn.close()
        with _collect_lock:
            _collect_state["last_added"] = added
            _collect_state["last_fetched"] = len(items)
            _collect_state["session_added"] += added
            _collect_state["error"] = None
    except Exception as exc:  # toplama hatası paneli düşürmesin
        with _collect_lock:
            _collect_state["error"] = str(exc)
    finally:
        with _collect_lock:
            _collect_state["running"] = False
            _collect_state["finished_at"] = datetime.now(timezone.utc).isoformat()
            _collect_state["runs"] += 1


def _start_collection():
    """Zaten çalışmıyorsa yeni bir toplama turu başlatır. (running, started) döner."""
    with _collect_lock:
        if _collect_state["running"]:
            return False
        _collect_state["running"] = True
        _collect_state["started_at"] = datetime.now(timezone.utc).isoformat()
    threading.Thread(target=_run_rss_collection, daemon=True).start()
    return True


def rows(conn, sql, params=()):
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


def scalar(conn, sql, params=()):
    r = conn.execute(sql, params).fetchone()
    return r[0] if r else None


@app.get("/api/overview")
def overview():
    with db() as conn:
        data = {
            "signals_total": scalar(conn, "SELECT COUNT(*) FROM signals"),
            "trend_items_total": scalar(conn, "SELECT COUNT(*) FROM trend_items"),
            "niches_total": scalar(conn, "SELECT COUNT(*) FROM niches"),
            "trends_total": scalar(conn, "SELECT COUNT(*) FROM trends"),
            "niches_git": scalar(
                conn, "SELECT COUNT(*) FROM niches WHERE status='git'"
            ),
            "trends_aksiyon": scalar(
                conn, "SELECT COUNT(*) FROM trends WHERE status='aksiyon'"
            ),
            "last_scan_signals": scalar(
                conn, "SELECT MAX(collected_at) FROM signals"
            ),
            "last_scan_trends": scalar(
                conn, "SELECT MAX(collected_at) FROM trend_items"
            ),
            "sources": rows(
                conn,
                "SELECT source, COUNT(*) AS n FROM signals "
                "GROUP BY source ORDER BY n DESC",
            ),
            "domains": rows(
                conn,
                "SELECT domain, COUNT(*) AS n FROM trend_items "
                "WHERE domain IS NOT NULL GROUP BY domain ORDER BY n DESC",
            ),
        }
    return jsonify(data)


# İş Fikri paragrafındaki satır-içi **Etiket:** alanlarını ayıkla.
# Örn: "**Kime:** ... **Hangi acı:** ... **Model:** ... **MVP (1 cümle):** ..."
_NICHE_INLINE_RE = re.compile(r"\*\*(.+?):\*\*\s*(.*?)(?=\s*\*\*[^*]+?:\*\*|$)", re.S)
_NICHE_FIELD_KEY = {
    "kime": "kime",
    "hangi acı": "aci",
    "model": "model",
    "mvp (1 cümle)": "mvp",
    "mvp": "mvp",
}


def _note_raw(kind, slug):
    """Bir notun ham markdown'ını döndürür — önce DB (vault_notes), yoksa dosya.

    Tek yerden okumak deploy'da Obsidian klasörüne bağımlılığı kaldırır; yerelde
    (henüz sync edilmemişken) dosyaya düşerek çalışmaya devam eder."""
    safe = re.sub(r"[^a-z0-9çğıöşü\-_]", "", (slug or "").lower())
    if not safe:
        return None
    try:
        with db() as conn:
            r = conn.execute(
                "SELECT raw_md FROM vault_notes WHERE kind = ? AND slug = ?",
                (kind, safe),
            ).fetchone()
        if r:
            return r["raw_md"]
    except sqlite3.OperationalError:
        pass  # tablo henüz yok → dosyaya düş
    path = _note_path(kind, slug)
    if path and path.exists():
        return path.read_text(encoding="utf-8")
    return None


def _tr_lower(s):
    """Türkçe-güvenli küçük harf — 'İ'.lower() birleşik 'i̇' üretip eşleşmeyi bozar."""
    return (s or "").replace("İ", "i").replace("I", "ı").lower()


def _enrich_niche(slug):
    """Niş notundan kart için zengin alanları (kime/acı/model/mvp/why) parse eder.

    Trend kartıyla aynı 'kurulabilir kama + nasıl başlanır' mantığını niş kartına
    taşır. Not yoksa boş döner (kart sade haliyle çalışır).
    """
    raw = _note_raw("niche", slug)
    if raw is None:
        return {}
    try:
        parsed = _parse_sections(raw)
    except Exception:
        return {}
    out = {}
    for sec in parsed.get("sections", []):
        head = _tr_lower(sec.get("heading"))
        text = " ".join(l.strip() for l in sec.get("lines", []) if l.strip()).strip()
        if head.startswith("iş fikri"):
            for m in _NICHE_INLINE_RE.finditer(text):
                key = _NICHE_FIELD_KEY.get(_tr_lower(m.group(1).strip()))
                if key and key not in out:
                    out[key] = m.group(2).strip()
        elif head.startswith("kök problem") and "why" not in out:
            out["why"] = text
    return out


@app.get("/api/niches")
def niches():
    with db() as conn:
        data = rows(
            conn,
            "SELECT slug, title, status, yatkinlik, problem, para_akisi, "
            "total, summary, updated_at FROM niches "
            "ORDER BY total DESC, updated_at DESC",
        )
    # Her niş için Obsidian notundan kurulabilir-kama alanlarını ekle (salt-okunur).
    for n in data:
        n.update(_enrich_niche(n.get("slug")))
    return jsonify(data)


@app.get("/api/trends")
def trends():
    with db() as conn:
        data = rows(
            conn,
            "SELECT slug, title, domain, momentum, tr_uygunluk, firsat, "
            "total, status, entegrasyon, turkiye_fikri, updated_at "
            "FROM trends ORDER BY total DESC, updated_at DESC",
        )
    return jsonify(data)


def _parse_dt(s):
    """Karışık RSS tarihlerini (ISO veya RFC822) timezone-aware datetime'a çevir."""
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        pass
    try:
        from email.utils import parsedate_to_datetime
        dt = parsedate_to_datetime(s)
        if dt and dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (TypeError, ValueError):
        return None


NEWS_MAX_AGE_DAYS = 30


@app.get("/api/news")
def news():
    """Haber Akışı — yayın tarihine göre güncelden eskiye, 30 günden eskiyi gizler."""
    limit = max(1, min(int(request.args.get("limit", 60)), 200))
    domain = request.args.get("domain")
    # sources: virgülle ayrı kaynak adları (GÖSTERİLECEKLER). Parametre HİÇ yoksa
    # filtre uygulanmaz (hepsi); varsa boş bile olsa o sete kısıtlanır (boş → hiçbiri).
    sources_param = request.args.get("sources")
    with db() as conn:
        clauses: list[str] = []
        params: list = []
        if domain and domain != "all":
            clauses.append("domain = ?")
            params.append(domain)
        if sources_param is not None:
            names = [s for s in sources_param.split(",") if s]
            if names:
                clauses.append(f"source IN ({','.join('?' * len(names))})")
                params.extend(names)
            else:
                clauses.append("1 = 0")  # boş seçim → hiçbir haber
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        items = rows(
            conn,
            "SELECT id, source, title, summary, domain, url, "
            "published_at, collected_at FROM trend_items "
            f"{where}",
            tuple(params),
        )
        counts = rows(
            conn,
            "SELECT domain, COUNT(*) AS n FROM trend_items "
            "WHERE domain IS NOT NULL GROUP BY domain ORDER BY n DESC",
        )
        source_counts = rows(
            conn,
            "SELECT source, COUNT(*) AS n FROM trend_items "
            "WHERE source IS NOT NULL GROUP BY source ORDER BY n DESC",
        )
        total = scalar(conn, "SELECT COUNT(*) FROM trend_items")

    # Python'da parse + sırala + yaş filtresi (published_at karışık formatlı).
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=NEWS_MAX_AGE_DAYS)
    enriched = []
    for it in items:
        dt = _parse_dt(it.get("published_at")) or _parse_dt(it.get("collected_at"))
        if dt and dt < cutoff:
            continue  # 30 günden eski → gizle
        it["published_ts"] = dt.isoformat() if dt else None
        it["_sort"] = dt or datetime.min.replace(tzinfo=timezone.utc)
        enriched.append(it)
    enriched.sort(key=lambda x: x["_sort"], reverse=True)
    for it in enriched:
        it.pop("_sort", None)
    enriched = enriched[:limit]

    with _collect_lock:
        collector = dict(_collect_state)
    return jsonify({"items": enriched, "counts": counts,
                    "source_counts": source_counts, "total": total,
                    "shown": len(enriched), "collector": collector})


@app.post("/api/collect/rss")
def collect_rss():
    """Boştaysa yeni bir RSS toplama turu tetikler (canlı 'çekiliyor' hissi)."""
    started = _start_collection()
    with _collect_lock:
        state = dict(_collect_state)
    return jsonify({"started": started, "collector": state})


@app.get("/api/collect/status")
def collect_status():
    with _collect_lock:
        state = dict(_collect_state)
    return jsonify(state)


# ---- Pro erken erişim e-posta toplama -----------------------------------
# Pro henüz geliştiriliyor; ilgilenen kullanıcının e-postasını toplar.
#   • Üretim (Render): WEB3FORMS_KEY env'i varsa Web3Forms ile operatörün
#     Gmail'ine ANINDA iletir — Render diski geçici olduğu için dosyaya GÜVENİLMEZ.
#   • Yerel/anahtarsız: eski davranış — JSONL dosyasına ekler (tekrarı engeller).
EARLY_ACCESS_PATH = ROOT / "data" / "early_access.jsonl"
WEB3FORMS_URL = "https://api.web3forms.com/submit"
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_ea_lock = threading.Lock()


@app.post("/api/early-access")
def early_access():
    body = request.get_json(silent=True) or {}
    email = str(body.get("email", "")).strip().lower()
    if not _EMAIL_RE.match(email):
        return jsonify({"ok": False, "error": "geçersiz e-posta"}), 400

    key = os.environ.get("WEB3FORMS_KEY", "").strip()
    if key:
        try:
            import requests
            r = requests.post(WEB3FORMS_URL, json={
                "access_key": key,
                "subject": "Niş Avcısı — yeni Pro erken erişim kaydı 🎯",
                "from_name": "Niş Avcısı paneli",
                "email": email,        # ziyaretçinin adresi → yanıtla'da çıkar
                "message": f"Pro erken erişim isteyen: {email}",
            }, timeout=10)
            try:
                data = r.json()
            except ValueError:
                data = {"raw": r.text[:300]}
            if not (r.ok and data.get("success")):
                # GEÇİCİ TEŞHİS: Web3Forms'un asıl cevabını döndür.
                return jsonify({"ok": False, "error": "gönderilemedi",
                                "status": r.status_code, "upstream": data}), 502
        except Exception as exc:
            return jsonify({"ok": False, "error": "gönderilemedi",
                            "exc": str(exc)}), 502
        return jsonify({"ok": True})

    # Anahtar yoksa (yerel geliştirme): dosyaya yaz.
    with _ea_lock:
        # zaten kayıtlıysa idempotent davran
        existing = set()
        if EARLY_ACCESS_PATH.exists():
            for line in EARLY_ACCESS_PATH.read_text(encoding="utf-8").splitlines():
                try:
                    existing.add(json.loads(line).get("email"))
                except (ValueError, AttributeError):
                    continue
        if email not in existing:
            EARLY_ACCESS_PATH.parent.mkdir(parents=True, exist_ok=True)
            rec = {
                "email": email,
                "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "plan": "pro",
            }
            with EARLY_ACCESS_PATH.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return jsonify({"ok": True})


# ---- Fırsat brief'leri (niche-hunter çıktısı) ---------------------------
# Skill'ler brief'leri Obsidian'a .md yazar; sync_vault bunları vault_notes'a
# kopyalar. Panel önce DB'den, yoksa dosyadan okuyup parse eder (aşağıda).
_FIELD_RE = re.compile(r"^\*\*(.+?)\*\*\s*·\s*(.*)$")
_FIELD_KEY = {
    "why now": "why_now", "icp": "icp", "wedge": "wedge",
    "first output (≤7 days)": "first_output", "tr angle": "tr_angle",
    "monetization": "monetization", "risk": "risk", "score": "score_line",
}


def _opp_dir():
    """Trend Radarı/opportunities yolunu config'deki vault'tan türet."""
    try:
        import yaml
        with open(ROOT / "config.yaml", encoding="utf-8") as f:
            vault = yaml.safe_load(f).get("obsidian_vault", "")
        if vault:
            return Path(vault).parent / "Trend Radarı" / "opportunities"
    except Exception:
        pass
    return Path("/Users/sarp/Documents/Obsidian Vault/Trend Radarı/opportunities")


def _parse_brief_text(text, fallback_id):
    """Bir opportunity .md içeriğini frontmatter + gövde alanlarına ayırır.
    Metin kaynağı DB (vault_notes) veya dosya olabilir — parse mantığı aynı."""
    import yaml
    meta, body = {}, text
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) == 3:
            try:
                meta = yaml.safe_load(parts[1]) or {}
            except Exception:
                meta = {}
            body = parts[2]
    fields = {}
    title = meta.get("opportunity_id", fallback_id)
    for line in body.splitlines():
        line = line.strip()
        if line.startswith("# "):
            title = line[2:].strip()
            continue
        m = _FIELD_RE.match(line)
        if m:
            key = _FIELD_KEY.get(m.group(1).strip().lower())
            if key:
                fields[key] = m.group(2).strip()
    return {
        "opportunity_id": meta.get("opportunity_id", fallback_id),
        "title": title,
        "score": meta.get("score"),
        "score_max": 60,
        "confidence": meta.get("confidence"),
        "opportunity_type": meta.get("opportunity_type"),
        "cluster": meta.get("cluster"),
        "status": meta.get("status"),
        "date": str(meta.get("date", "")),
        "tags": meta.get("tags", []),
        "sources": meta.get("sources", []),
        **fields,
    }


@app.get("/api/opportunities")
def opportunities():
    """niche-hunter fırsat brief'leri, skora göre sıralı.

    Önce DB (vault_notes) — deploy edilen ortamda tek kaynak budur. Tablo yoksa
    veya boşsa (henüz sync edilmemiş yerel geliştirme) Obsidian klasörüne düşer."""
    items = []
    try:
        with db() as conn:
            db_rows = conn.execute(
                "SELECT slug, raw_md FROM vault_notes WHERE kind = 'opportunity'"
            ).fetchall()
        for r in db_rows:
            try:
                items.append(_parse_brief_text(r["raw_md"], r["slug"]))
            except Exception:
                continue
    except sqlite3.OperationalError:
        pass  # vault_notes tablosu henüz yok → dosyalara düş
    if not items:
        d = _opp_dir()
        if d.exists():
            for p in d.glob("*.md"):
                try:
                    items.append(_parse_brief_text(
                        p.read_text(encoding="utf-8"), p.stem))
                except Exception:
                    continue
    items.sort(key=lambda x: (x.get("score") or 0), reverse=True)
    return jsonify({"items": items, "total": len(items)})


# ---- Tam not detayı (Obsidian md → bölümler) ---------------------------
# Niş kartları DB'de sadece özet tutar; kart tıklanınca tam detay (JTBD, fermi,
# riskler, kanıt) Obsidian notundan okunur. Salt-okunur dosya erişimi.
def _note_path(kind, slug):
    """kind+slug → Obsidian not dosyası yolu. Yol-gezme (path traversal) engellenir."""
    safe = re.sub(r"[^a-z0-9çğıöşü\-_]", "", (slug or "").lower())
    if not safe:
        return None
    try:
        import yaml
        with open(ROOT / "config.yaml", encoding="utf-8") as f:
            vault = yaml.safe_load(f).get("obsidian_vault", "")
    except Exception:
        vault = ""
    base = Path(vault) if vault else Path(
        "/Users/sarp/Documents/Obsidian Vault/Niş Analizi")
    if kind == "opportunity":
        return base.parent / "Trend Radarı" / "opportunities" / f"{safe}.md"
    return base / "Nişler" / f"{safe}.md"  # varsayılan: niş


def _parse_sections(text):
    """Markdown gövdesini frontmatter + '## ' başlıklı bölümlere ayırır."""
    import yaml
    meta, body = {}, text
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) == 3:
            try:
                meta = yaml.safe_load(parts[1]) or {}
            except Exception:
                meta = {}
            body = parts[2]
    title, sections, cur = None, [], {"heading": "", "lines": []}
    for line in body.splitlines():
        if line.startswith("# ") and title is None:
            title = line[2:].strip()
        elif line.startswith("## "):
            if cur["lines"] or cur["heading"]:
                sections.append(cur)
            cur = {"heading": line[3:].strip(), "lines": []}
        else:
            cur["lines"].append(line)
    if cur["lines"] or cur["heading"]:
        sections.append(cur)
    # baştaki/sondaki boş satırları kırp
    for s in sections:
        while s["lines"] and not s["lines"][0].strip():
            s["lines"].pop(0)
        while s["lines"] and not s["lines"][-1].strip():
            s["lines"].pop()
    return {"title": title, "meta": meta,
            "sections": [s for s in sections if s["lines"] or s["heading"]]}


@app.get("/api/note")
def note():
    """kind=niche|opportunity & slug=... → tam not (bölümlere ayrılmış).

    Önce DB (vault_notes), yoksa yerel Obsidian dosyası. Slug, dosya adıyla
    eşleşsin diye _note_path ile aynı şekilde sadeleştirilir (path-traversal güvenli)."""
    kind = request.args.get("kind", "niche")
    slug = request.args.get("slug", "")
    raw = _note_raw(kind, slug)
    if raw is None:
        return jsonify({"error": "not found", "slug": slug}), 404
    data = _parse_sections(raw)
    data.update({"kind": kind, "slug": slug})
    return jsonify(data)


@app.get("/api/settings")
def settings():
    """Sistem ayarları — config.yaml'ı (sırlar maskeli) panele açar."""
    import yaml
    try:
        with open(ROOT / "config.yaml", encoding="utf-8") as f:
            cfg = yaml.safe_load(f) or {}
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

    src = cfg.get("sources", {})
    ra = src.get("reddit_apify", {})
    hn = src.get("hackernews", {})
    rss_cfg = cfg.get("rss", {})

    def has(v):  # sır var mı (değeri sızdırmadan)
        return bool(v)

    with db() as conn:
        last_trend = scalar(conn, "SELECT MAX(collected_at) FROM trend_items")
        last_signal = scalar(conn, "SELECT MAX(collected_at) FROM signals")
    with _collect_lock:
        collector = dict(_collect_state)

    return jsonify({
        "limits": {
            "signal_threshold": cfg.get("signal_threshold"),
            "max_items_per_source": cfg.get("max_items_per_source"),
            "analysis_max_items": cfg.get("analysis_max_items"),
            "trend_analysis_max_items": rss_cfg.get("trend_analysis_max_items"),
            "max_items_per_feed": rss_cfg.get("max_items_per_feed"),
        },
        "obsidian_vault": cfg.get("obsidian_vault"),
        "reddit": {
            "enabled": ra.get("enabled"),
            "actor": ra.get("actor"),
            "sort": ra.get("sort"),
            "time_filter": ra.get("time_filter"),
            "max_items": ra.get("max_items"),
            "max_wait": ra.get("max_wait"),
            "subreddits": ra.get("subreddits", []),
            "token_set": has(ra.get("token")),  # değer DEĞİL, sadece var/yok
        },
        "hackernews": {
            "enabled": hn.get("enabled"),
            "queries": hn.get("queries", []),
            "min_points": hn.get("min_points"),
            "days_back": hn.get("days_back"),
        },
        "producthunt_enabled": src.get("producthunt", {}).get("enabled"),
        "rss": {
            "enabled": rss_cfg.get("enabled"),
            "feeds": rss_cfg.get("feeds", []),
            "google_news": (rss_cfg.get("google_news", {}) or {}).get("queries", []),
        },
        "cadence": {
            "panel_poll_seconds": 15,         # App.tsx POLL_MS ile uyumlu
            "reddit_time_filter": ra.get("time_filter"),   # haftalık veri
            "hn_days_back": hn.get("days_back"),
            "rss_live": "Haber Akışı sekmesindeyken tetiklenir (ücretsiz)",
            "daily": "daily_run.sh — ücretsiz kaynaklar + analiz (launchd)",
            "weekly": "weekly_run.sh — Reddit/Apify (paralı)",
        },
        "status": {
            "last_trend_scan": last_trend,
            "last_signal_scan": last_signal,
            "collector": collector,
        },
    })


@app.get("/api/feed")
def feed():
    limit = max(1, min(int(request.args.get("limit", 40)), 100))
    kind = request.args.get("kind", "signal")
    with db() as conn:
        if kind == "trend":
            data = rows(
                conn,
                "SELECT title, source, domain, url, collected_at "
                "FROM trend_items ORDER BY collected_at DESC, id DESC LIMIT ?",
                (limit,),
            )
        else:
            data = rows(
                conn,
                "SELECT title, source, signal_score, url, collected_at "
                "FROM signals ORDER BY collected_at DESC, id DESC LIMIT ?",
                (limit,),
            )
    return jsonify(data)


# ---- Statik (üretim) ----------------------------------------------------
@app.get("/")
def index():
    if (DIST / "index.html").exists():
        return send_from_directory(DIST, "index.html")
    return (
        "<h1>Panel build edilmemiş</h1><p>Geliştirme: <code>cd web/ui && "
        "npm run dev</code>. Üretim: <code>cd web/ui && npm run build</code> "
        "sonra bu sunucuyu yeniden başlat.</p>",
        200,
    )


@app.get("/<path:path>")
def static_files(path):
    if DIST.exists() and (DIST / path).exists():
        return send_from_directory(DIST, path)
    # SPA fallback
    if (DIST / "index.html").exists():
        return send_from_directory(DIST, "index.html")
    return jsonify({"error": "not found"}), 404


if __name__ == "__main__":
    if not DB_PATH.exists():
        raise SystemExit(f"DB bulunamadı: {DB_PATH}")
    port = int(os.environ.get("PORT", 8000))
    print(f"\n  🛰️  Niş Avcısı paneli → http://localhost:{port}\n")
    app.run(host="127.0.0.1", port=port, debug=False)
