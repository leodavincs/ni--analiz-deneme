"""
SQLite depolama — sistemin ALTIN KAYNAĞI.

Toplama ve çıktı katmanları bu DB üzerinden konuşur. İleride bir web paneli
(polsia tarzı) eklenirse, aynı DB'yi okuyarak beslenir; toplama kodu değişmez.
"""
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "signals.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS signals (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    source       TEXT    NOT NULL,
    source_id    TEXT    NOT NULL,
    url          TEXT,
    title        TEXT,
    body         TEXT,
    author       TEXT,
    score        INTEGER DEFAULT 0,   -- upvote/puan
    num_comments INTEGER DEFAULT 0,
    signal_score INTEGER DEFAULT 0,   -- şikayet sinyali skoru (0-100)
    theme_hint   TEXT,                -- extract.py'nin kaba tema etiketi
    is_new       INTEGER DEFAULT 1,   -- analiz edilmemiş = 1
    collected_at TEXT    NOT NULL,
    UNIQUE(source, source_id)
);

CREATE TABLE IF NOT EXISTS niches (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT UNIQUE NOT NULL,
    title       TEXT,
    status      TEXT DEFAULT 'aday',   -- aday | git | bekle | ele
    yatkinlik   INTEGER DEFAULT 0,     -- 1-5
    problem     INTEGER DEFAULT 0,     -- 1-5
    para_akisi  INTEGER DEFAULT 0,     -- 1-5
    total       INTEGER DEFAULT 0,     -- /15
    summary     TEXT,
    created_at  TEXT,
    updated_at  TEXT
);

CREATE TABLE IF NOT EXISTS niche_signals (
    niche_id  INTEGER NOT NULL,
    signal_id INTEGER NOT NULL,
    PRIMARY KEY (niche_id, signal_id)
);

CREATE INDEX IF NOT EXISTS idx_signals_new ON signals(is_new);
CREATE INDEX IF NOT EXISTS idx_signals_score ON signals(signal_score);

-- ===== TREND RADARI (RSS) =====
CREATE TABLE IF NOT EXISTS trend_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    source       TEXT NOT NULL,        -- feed adı (örn. TechCrunch)
    source_id    TEXT NOT NULL,        -- guid/link
    url          TEXT,
    title        TEXT,
    summary      TEXT,
    domain       TEXT,                 -- ai | startup | consumer | fintech | ecommerce | emerging
    published_at TEXT,
    image_url    TEXT,                 -- (kullanılmıyor) eski şema uyumu; hep NULL
    content_key  TEXT,                 -- normalize başlık → kaynaklar arası dedup anahtarı
    is_new       INTEGER DEFAULT 1,
    collected_at TEXT NOT NULL,
    UNIQUE(source, source_id)
);

CREATE TABLE IF NOT EXISTS trends (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    slug          TEXT UNIQUE NOT NULL,
    title         TEXT,
    domain        TEXT,
    momentum      INTEGER DEFAULT 0,   -- 1-5
    tr_uygunluk   INTEGER DEFAULT 0,   -- 1-5
    firsat        INTEGER DEFAULT 0,   -- 1-5
    total         INTEGER DEFAULT 0,   -- /15
    status        TEXT DEFAULT 'izle', -- aksiyon | izle | gec
    entegrasyon   TEXT,
    turkiye_fikri TEXT,
    created_at    TEXT,
    updated_at    TEXT
);

CREATE TABLE IF NOT EXISTS trend_sources (
    trend_id INTEGER NOT NULL,
    item_id  INTEGER NOT NULL,
    PRIMARY KEY (trend_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_trenditems_new ON trend_items(is_new);
-- idx_trenditems_ckey (content_key): _migrate içinde, kolon eklendikten sonra kurulur.

-- ===== VAULT MIRROR (deploy taşınabilirliği) =====
-- nis-analizi/niche-hunter skill'lerinin Obsidian'a yazdığı .md notlarının ham
-- kopyası. Web paneli fırsat/niş içeriğini yerel Obsidian klasörü yerine BURADAN
-- okur → deploy edilen tek artefakt signals.db olur, kullanıcı kimsenin Obsidian'ına
-- bağlanmaz. sync_vault() her çalıştırmada notları üzerine yazar (idempotent).
CREATE TABLE IF NOT EXISTS vault_notes (
    kind       TEXT NOT NULL,        -- opportunity | niche
    slug       TEXT NOT NULL,        -- dosya adı (uzantısız)
    raw_md     TEXT NOT NULL,        -- dosyanın tam içeriği
    updated_at TEXT,
    PRIMARY KEY (kind, slug)
);
"""


def content_key(title, url=None):
    """Bir haberi kaynaktan bağımsız tanımlayan normalize anahtar.
    Aynı makale TechCrunch + Google News'te farklı guid'lerle gelse bile aynı
    anahtarı üretir → kaynaklar arası dedup. Başlık esas alınır; sondaki
    " - Yayıncı" / " | Site" eki atılır, noktalama ve boşluk normalize edilir."""
    t = (title or "").lower()
    t = re.sub(r"\s*[-|–—]\s*[^-|–—]+$", "", t)   # " - TechCrunch" / " | Yahoo" ekini at
    t = re.sub(r"[^a-z0-9 ]", "", t)               # noktalama/aksan dışı sadeleştir
    t = re.sub(r"\s+", " ", t).strip()
    return t or (url or "").strip().lower()


def _now():
    return datetime.now(timezone.utc).isoformat()


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = connect()
    conn.executescript(SCHEMA)
    _migrate(conn)
    conn.commit()
    conn.close()


def _migrate(conn):
    """Mevcut DB'leri geriye dönük güncelle (veri kaybı yok)."""
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(trend_items)")}
    if "image_url" not in cols:
        conn.execute("ALTER TABLE trend_items ADD COLUMN image_url TEXT")
    if "content_key" not in cols:
        conn.execute("ALTER TABLE trend_items ADD COLUMN content_key TEXT")

    # content_key'i boş olan satırları doldur (yeni kolon veya eski kayıtlar).
    missing = conn.execute(
        "SELECT id, title, url FROM trend_items "
        "WHERE content_key IS NULL OR content_key = ''"
    ).fetchall()
    for r in missing:
        conn.execute("UPDATE trend_items SET content_key = ? WHERE id = ?",
                     (content_key(r["title"], r["url"]), r["id"]))

    # Mevcut kaynaklar-arası duplicate'leri temizle: her content_key için en eski
    # (en küçük id) satır kalır, diğerleri silinir.
    removed = _dedupe_existing(conn)
    if removed:
        print(f"   [dedup] {removed} mükerrer haber temizlendi (kaynaklar arası)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_trenditems_ckey "
                 "ON trend_items(content_key)")


def _dedupe_existing(conn):
    """Aynı content_key'e sahip satırlardan en eskisini (min id) tutup gerisini sil.
    Silinen sayısını döndürür."""
    dup_keys = conn.execute(
        "SELECT content_key FROM trend_items "
        "WHERE content_key IS NOT NULL AND content_key != '' "
        "GROUP BY content_key HAVING COUNT(*) > 1"
    ).fetchall()
    removed = 0
    for (key,) in dup_keys:
        rows = conn.execute(
            "SELECT id FROM trend_items WHERE content_key = ? ORDER BY id",
            (key,)).fetchall()
        victims = [(r["id"],) for r in rows[1:]]   # ilki (en eski) kalır
        conn.executemany("DELETE FROM trend_items WHERE id = ?", victims)
        removed += len(victims)
    return removed


def upsert_signal(conn, item):
    """
    item: dict — source, source_id, url, title, body, author, score,
                 num_comments, signal_score, theme_hint
    Yeni eklendiyse 1, zaten varsa (dedup) 0 döner.
    """
    cur = conn.execute(
        """
        INSERT INTO signals
            (source, source_id, url, title, body, author, score,
             num_comments, signal_score, theme_hint, is_new, collected_at)
        VALUES
            (:source, :source_id, :url, :title, :body, :author, :score,
             :num_comments, :signal_score, :theme_hint, 1, :collected_at)
        ON CONFLICT(source, source_id) DO NOTHING
        """,
        {
            "source": item["source"],
            "source_id": str(item["source_id"]),
            "url": item.get("url"),
            "title": item.get("title"),
            "body": item.get("body"),
            "author": item.get("author"),
            "score": int(item.get("score") or 0),
            "num_comments": int(item.get("num_comments") or 0),
            "signal_score": int(item.get("signal_score") or 0),
            "theme_hint": item.get("theme_hint"),
            "collected_at": _now(),
        },
    )
    return cur.rowcount  # 1 = eklendi, 0 = zaten vardı


def get_new_signals(conn, min_score=0, limit=None):
    """Henüz analiz edilmemiş (is_new=1) yüksek sinyalli maddeler.
    limit verilirse en yüksek sinyalli ilk N tanesi (maliyet/odak kontrolü)."""
    sql = """
        SELECT * FROM signals
        WHERE is_new = 1 AND signal_score >= ?
        ORDER BY signal_score DESC, score DESC
    """
    params = [min_score]
    if limit:
        sql += " LIMIT ?"
        params.append(limit)
    rows = conn.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def mark_analyzed(conn, signal_ids):
    """Analiz sonrası bu maddeleri is_new=0 yap (tekrar işlenmesin)."""
    if not signal_ids:
        return
    conn.executemany(
        "UPDATE signals SET is_new = 0 WHERE id = ?",
        [(i,) for i in signal_ids],
    )
    conn.commit()


def stats(conn):
    rows = conn.execute(
        "SELECT source, COUNT(*) AS n FROM signals GROUP BY source"
    ).fetchall()
    return {r["source"]: r["n"] for r in rows}


# ===== TREND RADARI fonksiyonları =====

def upsert_trend_item(conn, item):
    """item: source, source_id, url, title, summary, domain, published_at.
    Yeni eklendiyse 1, dedup ise 0 döner. (Sadece düz metin — görsel çekilmez.)

    İki kademeli dedup:
      1) Aynı kaynak+guid → UNIQUE(source, source_id) engeller.
      2) Aynı haber FARKLI kaynaktan (TechCrunch + Google News vb.) → content_key
         eşleşmesi engeller; varsa eklenmez."""
    ckey = content_key(item.get("title"), item.get("url"))

    # 2) Kaynaklar-arası: bu haber başka bir kaynaktan zaten girmiş mi?
    if ckey:
        dup = conn.execute(
            "SELECT 1 FROM trend_items WHERE content_key = ? LIMIT 1",
            (ckey,)).fetchone()
        if dup is not None:
            return 0  # mükerrer, atla

    cur = conn.execute(
        """
        INSERT INTO trend_items
            (source, source_id, url, title, summary, domain,
             published_at, content_key, is_new, collected_at)
        VALUES
            (:source, :source_id, :url, :title, :summary, :domain,
             :published_at, :content_key, 1, :collected_at)
        ON CONFLICT(source, source_id) DO NOTHING
        """,
        {
            "source": item["source"],
            "source_id": str(item["source_id"]),
            "url": item.get("url"),
            "title": item.get("title"),
            "summary": (item.get("summary") or "")[:2000],
            "domain": item.get("domain"),
            "published_at": item.get("published_at"),
            "content_key": ckey,
            "collected_at": _now(),
        },
    )
    return cur.rowcount


def get_new_trend_items(conn, limit=None):
    """Analiz edilmemiş (is_new=1) trend öğeleri, en yeni önce."""
    sql = ("SELECT * FROM trend_items WHERE is_new = 1 "
           "ORDER BY published_at DESC, collected_at DESC")
    params = []
    if limit:
        sql += " LIMIT ?"
        params.append(limit)
    rows = conn.execute(sql, params).fetchall()
    return [dict(r) for r in rows]


def mark_trends_analyzed(conn, item_ids):
    """Trend analizinden sonra öğeleri is_new=0 yap."""
    if not item_ids:
        return
    conn.executemany(
        "UPDATE trend_items SET is_new = 0 WHERE id = ?",
        [(i,) for i in item_ids],
    )
    conn.commit()


def trend_stats(conn):
    rows = conn.execute(
        "SELECT domain, COUNT(*) AS n FROM trend_items GROUP BY domain"
    ).fetchall()
    return {r["domain"]: r["n"] for r in rows}


# ===== VAULT MIRROR =====
def sync_vault(vault_base):
    """Obsidian klasöründeki .md notlarını DB'ye (vault_notes) mirror'lar.

    vault_base: config.yaml > obsidian_vault ('… / Niş Analizi') yolu.
    Niş notları   <base>/Nişler/*.md, fırsat notları <base>/../Trend Radarı/
    opportunities/*.md altında. Idempotent: her dosyayı üzerine yazar, silinen
    dosyaları DB'den kaldırır. Döner: {'opportunity': n, 'niche': m}."""
    base = Path(vault_base)
    dirs = {
        "opportunity": base.parent / "Trend Radarı" / "opportunities",
        "niche": base / "Nişler",
    }
    init_db()
    conn = connect()
    counts = {}
    try:
        for kind, d in dirs.items():
            seen = []
            if d.exists():
                for p in sorted(d.glob("*.md")):
                    try:
                        conn.execute(
                            "INSERT INTO vault_notes (kind, slug, raw_md, updated_at) "
                            "VALUES (?,?,?,?) ON CONFLICT(kind, slug) DO UPDATE SET "
                            "raw_md=excluded.raw_md, updated_at=excluded.updated_at",
                            (kind, p.stem, p.read_text(encoding="utf-8"), _now()),
                        )
                        seen.append(p.stem)
                    except Exception:
                        continue
            # Obsidian'da silinmiş notları DB'den de düş (panel hayalet kart göstermesin).
            if seen:
                ph = ",".join("?" * len(seen))
                conn.execute(
                    f"DELETE FROM vault_notes WHERE kind = ? AND slug NOT IN ({ph})",
                    [kind, *seen],
                )
            else:
                conn.execute("DELETE FROM vault_notes WHERE kind = ?", (kind,))
            counts[kind] = len(seen)
        conn.commit()
    finally:
        conn.close()
    return counts
