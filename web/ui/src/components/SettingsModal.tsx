import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, type Settings } from "../api";
import { DOMAIN_LABEL, hostOf, timeAgo } from "../lib";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="font-mono text-[11px] text-slate">{k}</span>
      <span className="text-right font-mono text-[12px] text-ghost">{v}</span>
    </div>
  );
}

function Card({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-xl border border-line/70 bg-white/[0.02]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span
          className={`grid h-5 w-5 shrink-0 place-items-center rounded border border-line font-mono text-[11px] text-mint transition-transform ${
            open ? "rotate-90" : ""
          }`}
        >
          ›
        </span>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {hint && <span className="font-mono text-[10px] text-slate">{hint}</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [s, setS] = useState<Settings | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setErr(null);
    api
      .settings()
      .then((d) => alive && setS(d))
      .catch((e) => alive && setErr(String(e)));
    return () => {
      alive = false;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative my-auto w-full max-w-2xl rounded-2xl border border-line bg-card shadow-glow"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line/70 px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="text-mint">⚙</span>
                <h2 className="text-base font-bold text-white">Ayarlar & Sistem</h2>
              </div>
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full border border-line bg-card/80 font-mono text-sm text-slate transition-colors hover:border-slate/60 hover:text-ghost"
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[80vh] space-y-3 overflow-y-auto p-5">
              {err && (
                <p className="font-mono text-xs text-amber">Ayar alınamadı: {err}</p>
              )}
              {!s && !err && (
                <p className="font-mono text-xs text-slate">Yükleniyor…</p>
              )}

              {s && (
                <>
                  {/* Toplama ritmi & durum */}
                  <Card title="Toplama Ritmi & Durum" defaultOpen>
                    <Row k="panel yenileme" v={`${s.cadence.panel_poll_seconds} sn`} />
                    <Row k="canlı RSS" v={String(s.cadence.rss_live)} />
                    <Row k="günlük iş" v={String(s.cadence.daily)} />
                    <Row k="haftalık iş" v={String(s.cadence.weekly)} />
                    <div className="my-2 border-t border-line/60" />
                    <Row
                      k="son trend taraması"
                      v={timeAgo(s.status.last_trend_scan)}
                    />
                    <Row
                      k="son sinyal taraması"
                      v={timeAgo(s.status.last_signal_scan)}
                    />
                    <Row
                      k="collector"
                      v={
                        s.status.collector.running ? (
                          <span className="text-mint">çalışıyor…</span>
                        ) : (
                          `bu oturumda +${s.status.collector.session_added} haber`
                        )
                      }
                    />
                  </Card>

                  {/* RSS kaynakları */}
                  <Card
                    title="RSS Kaynakları"
                    hint={`${s.rss.feeds.length} feed · feed başına ${s.limits.max_items_per_feed} öğe`}
                  >
                    <div className="flex flex-col divide-y divide-line/50">
                      {s.rss.feeds.map((f) => (
                        <div
                          key={f.url}
                          className="flex items-center justify-between gap-3 py-1.5"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-[12.5px] text-ghost">
                              {f.name}
                            </div>
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate font-mono text-[10px] text-slate hover:text-mint"
                            >
                              {hostOf(f.url)}
                            </a>
                          </div>
                          <span className="shrink-0 rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase text-slate">
                            {DOMAIN_LABEL[f.domain] ?? f.domain}
                          </span>
                        </div>
                      ))}
                    </div>
                    {s.rss.google_news.length > 0 && (
                      <div className="mt-3 border-t border-line/60 pt-2">
                        <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-slate">
                          Google News sorguları
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {s.rss.google_news.map((q, i) => (
                            <span
                              key={i}
                              className="rounded-md border border-line bg-white/[0.02] px-2 py-0.5 font-mono text-[10px] text-ghost"
                            >
                              {q.q}
                              <span className="text-slate"> · {q.domain}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>

                  {/* Reddit */}
                  <Card title="Reddit (Apify)" hint={s.reddit.enabled ? "açık" : "kapalı"}>
                    <Row k="actor" v={s.reddit.actor ?? "—"} />
                    <Row
                      k="sıralama / zaman"
                      v={`${s.reddit.sort ?? "—"} · ${s.reddit.time_filter ?? "—"}`}
                    />
                    <Row
                      k="çekim limiti"
                      v={`${s.reddit.max_items ?? "—"} / subreddit`}
                    />
                    <Row
                      k="token"
                      v={
                        s.reddit.token_set ? (
                          "config'de"
                        ) : (
                          <span className="text-slate">ortam değişkeni (APIFY_TOKEN)</span>
                        )
                      }
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.reddit.subreddits.map((r) => (
                        <span
                          key={r}
                          className="rounded-md border border-line bg-white/[0.02] px-2 py-0.5 font-mono text-[10px] text-ghost"
                        >
                          r/{r}
                        </span>
                      ))}
                    </div>
                  </Card>

                  {/* Hacker News */}
                  <Card
                    title="Hacker News"
                    hint={s.hackernews.enabled ? "açık · ücretsiz" : "kapalı"}
                  >
                    <Row
                      k="zaman aralığı"
                      v={`son ${s.hackernews.days_back ?? "—"} gün`}
                    />
                    <Row k="min. puan" v={s.hackernews.min_points ?? "—"} />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.hackernews.queries.map((q) => (
                        <span
                          key={q}
                          className="rounded-md border border-line bg-white/[0.02] px-2 py-0.5 font-mono text-[10px] text-ghost"
                        >
                          "{q}"
                        </span>
                      ))}
                    </div>
                  </Card>

                  {/* Limitler */}
                  <Card title="Eşikler & Limitler">
                    <Row k="sinyal eşiği" v={`${s.limits.signal_threshold}/100`} />
                    <Row
                      k="kaynak başına çekim"
                      v={s.limits.max_items_per_source}
                    />
                    <Row k="niş analiz batch" v={s.limits.analysis_max_items} />
                    <Row
                      k="trend analiz batch"
                      v={s.limits.trend_analysis_max_items}
                    />
                  </Card>

                  {/* Çıktı */}
                  <Card title="Çıktı (Obsidian)">
                    <p className="break-all font-mono text-[11px] text-slate">
                      {s.obsidian_vault ?? "—"}
                    </p>
                  </Card>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
