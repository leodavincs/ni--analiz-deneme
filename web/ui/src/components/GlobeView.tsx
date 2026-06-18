import { useState } from "react";
import { LiveGlobe, type GlobeStats } from "./LiveGlobe";

// Tam ekran "Dünya" sekmesi — başlık şeridi + büyük canlı küre + ülke legend'i.
export function GlobeView() {
  const [stats, setStats] = useState<GlobeStats | null>(null);

  return (
    <div className="px-5 pb-16 sm:px-8">
      {/* Başlık şeridi */}
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-line bg-panel/60 px-5 py-4 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {stats?.running && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-mint opacity-60 animate-ping" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                stats?.running ? "bg-mint animate-pulseDot" : "bg-slate"
              }`}
            />
          </span>
          <span className="font-mono text-xs font-semibold tracking-[0.18em] text-mint">
            {stats?.running ? "ÇEKİLİYOR…" : "CANLI KÜRE"}
          </span>
        </div>
        <span className="font-mono text-xs text-slate">
          <span className="font-semibold text-ghost">{stats?.countries ?? 0}</span>{" "}
          ülke ·{" "}
          <span className="font-semibold text-ghost">{stats?.pins ?? 0}</span> haber
          kürede
        </span>
        <span className="ml-auto font-mono text-xs text-slate">
          toplam <span className="font-semibold text-ghost">{stats?.total ?? 0}</span>{" "}
          haber · sürükleyerek döndür
        </span>
      </div>

      {/* Küre sahnesi */}
      <div className="relative grid place-items-center overflow-visible rounded-2xl border border-line bg-gradient-to-b from-panel/40 to-ink/40 py-8 shadow-soft">
        {/* arka parıltı */}
        <div
          className="pointer-events-none absolute h-[420px] w-[420px] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(61,245,160,0.10), transparent 70%)",
          }}
        />
        <LiveGlobe maxSize={560} maxPins={26} onStats={setStats} />

        {stats?.pins === 0 && (
          <p className="absolute bottom-4 font-mono text-xs text-slate">
            haberler ülkelere eşleniyor… (coğrafi ipucu içeren haber bekleniyor)
          </p>
        )}
      </div>

      {/* Alt legend — ülke listesi (haber sayısına göre) */}
      {stats && stats.legend.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {stats.legend.map((l) => (
            <span
              key={l.cc}
              className="flex items-center gap-1.5 rounded-full border border-line bg-card/50 px-2.5 py-1 font-mono text-[11px] text-slate"
            >
              <span>{l.country.flag}</span>
              <span className="text-ghost">{l.country.name}</span>
              <span className="text-slate/70">{l.total}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
