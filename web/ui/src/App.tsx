import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  api,
  type FeedItem,
  type Niche,
  type Opportunity,
  type Overview,
} from "./api";
import { KpiStrip, LiveBar } from "./components/LiveBar";
import { NicheCard } from "./components/NicheCard";
import { OpportunityCard } from "./components/OpportunityCard";
import { FeedRail } from "./components/FeedRail";
import { NewsView } from "./components/NewsView";
import { GlobeView } from "./components/GlobeView";
import { HeroGlobe } from "./components/HeroGlobe";
import { DetailModal, type Selection } from "./components/DetailModal";
import { ProfileMenu } from "./components/ProfileMenu";
import { RadarLogo } from "./components/RadarLogo";
import { SettingsModal } from "./components/SettingsModal";

const POLL_MS = 15_000;
type Tab = "radar" | "news" | "globe";
type RadarView = "niche" | "trend";

function initialTab(): Tab {
  const t = new URLSearchParams(location.search).get("tab");
  return t === "news" || t === "globe" ? t : "radar";
}

export default function App() {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [view, setView] = useState<RadarView>("niche");
  const [ov, setOv] = useState<Overview | null>(null);
  const [niches, setNiches] = useState<Niche[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<Selection | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [o, n, op, f] = await Promise.all([
          api.overview(),
          api.niches(),
          api.opportunities(),
          api.feed(40),
        ]);
        if (!alive) return;
        setOv(o);
        setNiches(n);
        setOpps(op.items);
        setFeed(f);
        setErr(null);
      } catch (e) {
        if (alive) setErr(String(e));
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="app-bg min-h-screen">
      <div className="relative z-10 mx-auto max-w-[1400px]">
        <header className="flex items-start justify-between gap-4 px-5 pt-8 sm:px-8">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <RadarLogo className="h-7 w-7" />
              <h1 className="font-mono text-lg font-bold tracking-tight text-white">
                Niş Avcısı <span className="text-slate">·</span>{" "}
                <span className="text-mint">Canlı Radar</span>
              </h1>
            </div>
            <p className="pl-[38px] font-mono text-xs text-slate">
              sen uyurken sistem fırsat avlar — Reddit · HN · RSS sürekli taranır,
              biz fırsatı okuruz
            </p>
          </div>
          <ProfileMenu
            niches={niches.length}
            opps={opps.length}
            onOpenSettings={() => setSettingsOpen(true)}
            onEarlyAccess={async (email) => {
              const r = await api.earlyAccess(email);
              if (!r.ok) throw new Error(r.error || "gönderilemedi");
            }}
          />
        </header>

        {/* İlk izlenim: canlı küre hero'su — yalnızca landing (radar) sekmesinde.
            Kullanıcıyı tam ekran "Dünya" sekmesine davet eder. */}
        {tab === "radar" && <HeroGlobe onOpen={() => setTab("globe")} />}

        <LiveBar ov={ov} />
        <KpiStrip ov={ov} />

        <nav className="flex gap-2 px-5 sm:px-8">
          <TabBtn active={tab === "radar"} onClick={() => setTab("radar")}>
            ◎ Canlı Radar
          </TabBtn>
          <TabBtn active={tab === "news"} onClick={() => setTab("news")}>
            ⟲ Haber Akışı
          </TabBtn>
          <TabBtn active={tab === "globe"} onClick={() => setTab("globe")}>
            ◍ Dünya
          </TabBtn>
        </nav>

        {err && (
          <div className="mx-5 mb-4 mt-4 rounded-xl border border-amber/30 bg-amber/5 px-4 py-3 font-mono text-xs text-amber sm:mx-8">
            Veri alınamadı: {err} — Flask sunucusu (8000) çalışıyor mu?
          </div>
        )}

        {tab === "radar" ? (
          <main className="grid grid-cols-1 gap-6 px-5 pb-16 pt-6 sm:px-8 xl:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-5">
              <Segmented
                view={view}
                onChange={setView}
                nicheCount={niches.length}
                trendCount={opps.length}
              />

              <AnimatePresence mode="wait">
                {view === "niche" ? (
                  <ViewPane key="niche" note="şikayet → niş · /15, ≥12 GİT">
                    {niches.length === 0 ? (
                      <EmptyNote>
                        Henüz niş kartı yok — nis-analizi çalışınca burada belirir.
                      </EmptyNote>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {niches.map((n, i) => (
                          <NicheCard
                            key={n.slug}
                            n={n}
                            index={i}
                            onOpen={() => setSel({ type: "niche", niche: n })}
                          />
                        ))}
                      </div>
                    )}
                  </ViewPane>
                ) : (
                  <ViewPane
                    key="trend"
                    note="dünya trendi → kurulabilir SaaS · /60, ≥38 brief"
                  >
                    {opps.length === 0 ? (
                      <EmptyNote>
                        Henüz fırsat brief'i yok — niche-hunter çalışınca burada
                        belirir.
                      </EmptyNote>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {opps.map((o, i) => (
                          <OpportunityCard
                            key={o.opportunity_id}
                            o={o}
                            index={i}
                            onOpen={() => setSel({ type: "opportunity", opp: o })}
                          />
                        ))}
                      </div>
                    )}
                  </ViewPane>
                )}
              </AnimatePresence>
            </div>

            <aside className="xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
              <FeedRail items={feed} />
            </aside>
          </main>
        ) : tab === "news" ? (
          <div className="pt-6">
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 sm:px-8">
              <span className="font-mono text-[10px] tracking-[0.25em] text-mint/70">
                03 — CANLI RSS
              </span>
              <h2 className="text-xl font-bold text-white">Haber Akışı</h2>
              <span className="font-mono text-[11px] text-slate">
                sen buradayken sistem sürekli RSS tarar — ücretsiz
              </span>
            </div>
            <NewsView />
          </div>
        ) : (
          <div className="pt-6">
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 sm:px-8">
              <span className="font-mono text-[10px] tracking-[0.25em] text-mint/70">
                04 — CANLI KÜRE
              </span>
              <h2 className="text-xl font-bold text-white">Dünya Haritası</h2>
              <span className="font-mono text-[11px] text-slate">
                anlık haberler ilgili ülkelerin üstünde belirir — sürükle, döndür
              </span>
            </div>
            <GlobeView />
          </div>
        )}

        <footer className="border-t border-line/60 px-5 py-6 font-mono text-[10px] text-slate sm:px-8">
          tek SQLite kaynağından beslenir · salt-okunur · {POLL_MS / 1000}s'de bir
          yenilenir
        </footer>
      </div>

      <DetailModal selection={sel} onClose={() => setSel(null)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-t-lg border-b-2 px-4 py-2.5 font-mono text-xs font-semibold tracking-wide transition-colors ${
        active
          ? "border-mint text-mint"
          : "border-transparent text-slate hover:text-ghost"
      }`}
    >
      {children}
    </button>
  );
}

const SEGMENTS: {
  id: RadarView;
  no: string;
  label: string;
  glyph: string;
}[] = [
  { id: "niche", no: "01", label: "Niş Avcısı", glyph: "◎" },
  { id: "trend", no: "02", label: "Trend Radarı", glyph: "✦" },
];

function Segmented({
  view,
  onChange,
  nicheCount,
  trendCount,
}: {
  view: RadarView;
  onChange: (v: RadarView) => void;
  nicheCount: number;
  trendCount: number;
}) {
  return (
    <div className="flex gap-1.5 rounded-2xl border border-line/70 bg-white/[0.015] p-1.5">
      {SEGMENTS.map((s) => {
        const active = view === s.id;
        const count = s.id === "niche" ? nicheCount : trendCount;
        // Radar kimlik rengi: Niş Avcısı mint, Trend Radarı iris.
        const isNiche = s.id === "niche";
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            className={`relative flex flex-1 items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-left outline-none transition-colors focus-visible:ring-1 ${
              isNiche ? "focus-visible:ring-mint/50" : "focus-visible:ring-iris/50"
            }`}
          >
            {active && (
              <motion.span
                layoutId="seg-pill"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className={`absolute inset-0 rounded-xl border ${
                  isNiche
                    ? "border-mint/30 bg-mint/[0.07] shadow-[inset_0_0_0_1px_rgba(61,245,160,0.12)]"
                    : "border-iris/30 bg-iris/[0.07] shadow-[inset_0_0_0_1px_rgba(139,139,245,0.12)]"
                }`}
              />
            )}
            <span
              className={`relative z-10 text-sm transition-colors ${
                active ? (isNiche ? "text-mint" : "text-iris") : "text-slate"
              }`}
            >
              {s.glyph}
            </span>
            <span className="relative z-10 flex flex-col leading-tight">
              <span
                className={`font-mono text-[9px] tracking-[0.25em] transition-colors ${
                  active ? (isNiche ? "text-mint/70" : "text-iris/70") : "text-slate/60"
                }`}
              >
                {s.no}
              </span>
              <span
                className={`text-sm font-bold transition-colors ${
                  active ? "text-white" : "text-ghost"
                }`}
              >
                {s.label}
              </span>
            </span>
            <span
              className={`relative z-10 ml-1.5 shrink-0 rounded-full border px-2 py-0.5 font-mono text-[11px] tabular-nums transition-colors ${
                active
                  ? isNiche
                    ? "border-mint/30 text-mint"
                    : "border-iris/30 text-iris"
                  : "border-line text-slate"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ViewPane({
  note,
  children,
}: {
  note: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="flex flex-col gap-4"
    >
      <p className="px-0.5 font-mono text-[11px] text-slate">{note}</p>
      {children}
    </motion.section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line/70 bg-white/[0.01] px-5 py-8 text-center font-mono text-xs text-slate">
      {children}
    </div>
  );
}
