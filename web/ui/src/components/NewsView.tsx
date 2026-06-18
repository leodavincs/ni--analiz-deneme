import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, type CollectorState, type NewsItem } from "../api";
import { DOMAIN_LABEL, domainColor, timeAgo } from "../lib";

const REFRESH_MS = 4000; // listeyi tazele
const COOLDOWN_MS = 20000; // toplama turları arası min ara (kibar)

// "GoogleNews: fintech startup" → "fintech startup" (kısa, okunur etiket)
function sourceLabel(s: string): string {
  return s.replace(/^GoogleNews:\s*/i, "") || s;
}

export function NewsView() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [counts, setCounts] = useState<{ domain: string; n: number }[]>([]);
  const [sourceCounts, setSourceCounts] = useState<
    { source: string; n: number }[]
  >([]);
  const [total, setTotal] = useState(0);
  const [domain, setDomain] = useState("all");
  // Kapatılan (gizlenen) kaynaklar. Boş = hepsi açık.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [col, setCol] = useState<CollectorState | null>(null);
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());

  // Aktif (gösterilecek) kaynaklar: hiçbiri kapalı değilse undefined → tüm kaynaklar.
  const allSources = sourceCounts.map((c) => c.source);
  const activeSources =
    excluded.size === 0 ? undefined : allSources.filter((s) => !excluded.has(s));
  const excludedKey = [...excluded].sort().join("|");

  const seen = useRef<Set<number>>(new Set());
  const lastTrigger = useRef(0);
  const domainRef = useRef(domain);
  domainRef.current = domain;
  const sourcesRef = useRef(activeSources);
  sourcesRef.current = activeSources;

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const res = await api.news(domainRef.current, 80, sourcesRef.current);
        if (!alive) return;
        // İlk yüklemede mevcut hepsini "görülmüş" say (hepsi yeni parlamasın)
        if (seen.current.size === 0) {
          res.items.forEach((it) => seen.current.add(it.id));
        } else {
          const fresh = res.items
            .filter((it) => !seen.current.has(it.id))
            .map((it) => it.id);
          if (fresh.length) {
            setFreshIds((prev) => new Set([...prev, ...fresh]));
            fresh.forEach((id) => seen.current.add(id));
            // 6 sn sonra parlamayı söndür
            setTimeout(() => {
              if (!alive) return;
              setFreshIds((prev) => {
                const n = new Set(prev);
                fresh.forEach((id) => n.delete(id));
                return n;
              });
            }, 6000);
          }
        }
        setItems(res.items);
        setCounts(res.counts);
        setSourceCounts(res.source_counts);
        setTotal(res.total);
        setCol(res.collector);

        // Kullanıcı buradayken: boştaysa ve cooldown dolduysa yeni tur tetikle
        const now = Date.now();
        if (!res.collector.running && now - lastTrigger.current > COOLDOWN_MS) {
          lastTrigger.current = now;
          api.collectRss().catch(() => {});
        }
      } catch {
        /* sessiz geç — bir sonraki tick dener */
      }
    };

    tick();
    const id = setInterval(tick, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Domain veya kaynak filtresi değişince anında tazele (parlamayı tetikleme).
  useEffect(() => {
    api
      .news(domain, 80, sourcesRef.current)
      .then((res) => {
        res.items.forEach((it) => seen.current.add(it.id));
        setItems(res.items);
        setTotal(res.total);
        setCounts(res.counts);
        setSourceCounts(res.source_counts);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, excludedKey]);

  const running = col?.running ?? false;
  const activeCount = allSources.length - excluded.size;
  const filtered = domain !== "all" || excluded.size > 0;

  const toggleSource = (s: string) =>
    setExcluded((prev) => {
      const n = new Set(prev);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });
  const allOn = () => setExcluded(new Set());
  const allOff = () => setExcluded(new Set(allSources));
  const resetAll = () => {
    setDomain("all");
    setExcluded(new Set());
  };

  return (
    <div className="px-5 pb-16 sm:px-8">
      {/* Toplama durumu */}
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-line bg-panel/60 px-5 py-4 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {running && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-mint opacity-60 animate-ping" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                running ? "bg-mint animate-pulseDot" : "bg-slate"
              }`}
            />
          </span>
          <span className="font-mono text-xs font-semibold tracking-[0.18em] text-mint">
            {running ? "ÇEKİLİYOR…" : "HAZIR"}
          </span>
        </div>

        <span className="font-mono text-xs text-slate">
          son tur{" "}
          <span className="text-ghost">{timeAgo(col?.finished_at ?? null)}</span>
        </span>

        <span className="hidden h-3 w-px bg-line sm:block" />

        <span className="font-mono text-xs text-slate">
          bu oturumda{" "}
          <span className="font-semibold text-mint">
            +{col?.session_added ?? 0}
          </span>{" "}
          haber
        </span>

        <span className="font-mono text-xs text-slate">
          son turda çekildi{" "}
          <span className="text-ghost">{col?.last_fetched ?? 0}</span>
        </span>

        <span className="ml-auto font-mono text-xs text-slate">
          toplam <span className="font-semibold text-ghost">{total}</span> haber
        </span>
      </div>

      {/* Birleşik filtre paneli: kategori + kaynak tek toggle altında */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-line bg-panel/40 shadow-soft">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-panel/70"
        >
          <FunnelIcon active={filtered} />
          <span className="font-mono text-[11px] font-semibold tracking-[0.18em] text-ghost">
            FİLTRELER
          </span>
          <span className="hidden truncate font-mono text-[10px] text-slate sm:block">
            {domain === "all" ? (
              "tüm kategoriler"
            ) : (
              <span style={{ color: domainColor(domain) }}>
                {(DOMAIN_LABEL[domain] ?? domain).toLowerCase()}
              </span>
            )}
            {"  ·  "}
            {activeCount}/{allSources.length} kaynak
          </span>
          {filtered && (
            <span className="rounded-full border border-amber/40 bg-amber/10 px-2 py-px font-mono text-[9px] font-semibold tracking-wider text-amber">
              FİLTRELİ
            </span>
          )}
          <span
            className={`ml-auto text-slate transition-transform duration-300 ${
              showFilters ? "rotate-180" : ""
            }`}
          >
            ▾
          </span>
        </button>

        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="space-y-4 border-t border-line px-4 py-4">
                {/* Kategori (tek seçim) */}
                <section>
                  <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.22em] text-slate/55">
                    Kategori
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Chip
                      active={domain === "all"}
                      label="HEPSİ"
                      n={total}
                      onClick={() => setDomain("all")}
                    />
                    {counts.map((c) => (
                      <Chip
                        key={c.domain}
                        active={domain === c.domain}
                        label={(DOMAIN_LABEL[c.domain] ?? c.domain).toUpperCase()}
                        n={c.n}
                        color={domainColor(c.domain)}
                        onClick={() => setDomain(c.domain)}
                      />
                    ))}
                  </div>
                </section>

                {/* Kaynaklar (çok seçim toggle) */}
                <section>
                  <div className="mb-2 flex items-center gap-2">
                    <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-slate/55">
                      Kaynaklar
                    </p>
                    <span className="font-mono text-[9px] text-slate/45">
                      {activeCount}/{allSources.length}
                    </span>
                    <button
                      onClick={allOn}
                      className="ml-auto rounded-md border border-line px-2 py-0.5 font-mono text-[10px] text-slate transition-colors hover:border-mint/50 hover:text-mint"
                    >
                      tümü
                    </button>
                    <button
                      onClick={allOff}
                      className="rounded-md border border-line px-2 py-0.5 font-mono text-[10px] text-slate transition-colors hover:border-slate/60 hover:text-ghost"
                    >
                      hiçbiri
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sourceCounts.map((c) => (
                      <SourceToggle
                        key={c.source}
                        label={sourceLabel(c.source)}
                        n={c.n}
                        on={!excluded.has(c.source)}
                        onClick={() => toggleSource(c.source)}
                      />
                    ))}
                  </div>
                </section>

                {filtered && (
                  <div className="flex justify-end border-t border-line pt-3">
                    <button
                      onClick={resetAll}
                      className="rounded-md px-2 py-0.5 font-mono text-[10px] text-slate transition-colors hover:text-amber"
                    >
                      ✕ tüm filtreleri sıfırla
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Haber listesi */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <AnimatePresence initial={false}>
          {items.map((it) => (
            <NewsRow key={it.id} it={it} fresh={freshIds.has(it.id)} />
          ))}
        </AnimatePresence>
      </div>

      {items.length === 0 && (
        <p className="py-12 text-center font-mono text-sm text-slate">
          {filtered
            ? "Bu filtreyle eşleşen haber yok — kaynak/kategori seçimini gevşet."
            : "Henüz haber yok — toplama sürüyor…"}
        </p>
      )}
    </div>
  );
}

function FunnelIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={active ? "text-mint" : "text-slate"}
    >
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

function Chip({
  active,
  label,
  n,
  onClick,
  color,
}: {
  active: boolean;
  label: string;
  n: number;
  onClick: () => void;
  color?: string;
}) {
  // Kategori rengi verildiyse: her zaman renkli nokta; aktifken o renge boyan.
  if (color) {
    return (
      <button
        onClick={onClick}
        style={
          active
            ? { color, borderColor: `${color}80`, backgroundColor: `${color}1f` }
            : undefined
        }
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] tracking-wide transition-colors ${
          active ? "" : "border-line text-slate hover:border-slate/60 hover:text-ghost"
        }`}
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color, opacity: active ? 1 : 0.7 }}
        />
        {label}
        <span style={active ? { opacity: 0.7 } : undefined} className={active ? "" : "text-slate/70"}>
          {n}
        </span>
      </button>
    );
  }
  // Renksiz (örn. HEPSİ) → mint vurgulu varsayılan.
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 font-mono text-[11px] tracking-wide transition-colors ${
        active
          ? "border-mint/50 bg-mint/10 text-mint"
          : "border-line text-slate hover:border-slate/60 hover:text-ghost"
      }`}
    >
      {label}
      <span className={`ml-1.5 ${active ? "text-mint/70" : "text-slate/70"}`}>
        {n}
      </span>
    </button>
  );
}

function SourceToggle({
  label,
  n,
  on,
  onClick,
}: {
  label: string;
  n: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      title={on ? "Gizlemek için tıkla" : "Göstermek için tıkla"}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-wide transition-colors ${
        on
          ? "border-mint/40 bg-mint/10 text-mint"
          : "border-line text-slate/60 line-through hover:text-slate"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${on ? "bg-mint" : "bg-slate/40"}`}
      />
      {label}
      <span className={on ? "text-mint/60" : "text-slate/40"}>{n}</span>
    </button>
  );
}

function NewsRow({ it, fresh }: { it: NewsItem; fresh: boolean }) {
  const c = domainColor(it.domain);
  return (
    <motion.a
      href={it.url ?? undefined}
      target="_blank"
      rel="noreferrer"
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{ borderLeftColor: c, borderLeftWidth: 3 }}
      className={`group block rounded-xl border bg-card/60 p-3.5 shadow-soft transition-colors hover:bg-card ${
        fresh ? "border-mint/50 shadow-glow" : "border-line hover:border-slate/60"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          {it.domain && (
            <span
              className="rounded border px-1.5 py-px font-mono text-[9px] uppercase tracking-wide"
              style={{
                color: c,
                borderColor: `${c}55`,
                backgroundColor: `${c}14`,
              }}
            >
              {DOMAIN_LABEL[it.domain] ?? it.domain}
            </span>
          )}
          <span className="truncate font-mono text-[10px] text-slate/80">
            {it.source}
          </span>
          {fresh && (
            <span className="rounded-full border border-mint/50 bg-mint/10 px-1.5 py-px font-mono text-[9px] font-semibold tracking-wider text-mint">
              YENİ
            </span>
          )}
          <span className="ml-auto font-mono text-[9px] text-slate">
            {timeAgo(it.published_ts ?? it.collected_at)}
          </span>
        </div>
        <h3 className="text-[13.5px] font-semibold leading-snug text-white/90 group-hover:text-white">
          {it.title ?? "(başlıksız)"}
        </h3>
        {it.summary && (
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-slate">
            {it.summary}
          </p>
        )}
      </div>
    </motion.a>
  );
}
