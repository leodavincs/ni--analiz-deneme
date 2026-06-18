import { useState } from "react";
import { motion } from "framer-motion";
import { LiveGlobe, type GlobeStats } from "./LiveGlobe";

// Landing hero — kullanıcı ilk geldiğinde gördüğü canlı küre.
// Amaç: "bu canlı mı?" merakı uyandırıp tam ekran "Dünya" sekmesine davet etmek.
export function HeroGlobe({ onOpen }: { onOpen: () => void }) {
  const [stats, setStats] = useState<GlobeStats | null>(null);
  const running = stats?.running;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative mx-5 mt-5 overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-panel/80 via-ink/50 to-ink/80 shadow-soft sm:mx-8"
    >
      {/* üst kenarda kayan ince tarama çizgisi */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
        <div className="hero-scanline h-px w-1/3 bg-gradient-to-r from-transparent via-mint to-transparent" />
      </div>

      {/* arka parıltılar */}
      <div
        className="pointer-events-none absolute -right-20 top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(61,245,160,0.13), transparent 68%)",
        }}
      />
      <div
        className="pointer-events-none absolute -left-32 -top-24 h-[360px] w-[360px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(139,139,245,0.08), transparent 70%)",
        }}
      />

      <div className="relative grid items-center gap-4 px-5 py-7 sm:px-8 lg:grid-cols-[1fr_360px] lg:gap-8">
        {/* Sol: mesaj + canlı sayaç + CTA */}
        <div className="flex flex-col gap-5">
          {/* eyebrow — diğer bölümlerle tutarlı numaralı etiket */}
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              {running && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-mint opacity-60 animate-ping" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  running ? "bg-mint animate-pulseDot" : "bg-slate"
                }`}
              />
            </span>
            <span className="font-mono text-[10px] tracking-[0.3em] text-mint/80">
              CANLI KÜRE
            </span>
            <span
              className={`font-mono text-[10px] tracking-[0.2em] ${
                running ? "text-mint/60" : "text-slate/60"
              }`}
            >
              {running ? "· TARANIYOR…" : "· HAZIR"}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-[26px] font-bold leading-[1.12] tracking-tight text-white sm:text-4xl">
              Şu an dünya genelinde
              <br className="hidden sm:block" />{" "}
              <span className="bg-gradient-to-r from-mint to-[#aeffd9] bg-clip-text text-transparent">
                fırsat avı
              </span>{" "}
              sürüyor.
            </h2>
            <p className="max-w-md font-mono text-[11.5px] leading-relaxed text-slate">
              Reddit · HN · RSS sürekli taranıyor; her yeni haber ilgili ülkenin
              üstünde parlıyor. Sen okurken küre dönmeye devam ediyor.
            </p>
          </div>

          {/* canlı sayaç — KPI kutucukları */}
          <div className="flex flex-wrap gap-2.5">
            <Stat value={stats?.countries ?? 0} label="ülke aktif" pulse={running} />
            <Stat value={stats?.pins ?? 0} label="haber kürede" />
            <Stat value={stats?.total ?? 0} label="toplam sinyal" muted />
          </div>

          <button
            onClick={onOpen}
            className="group mt-0.5 inline-flex w-fit items-center gap-2 rounded-xl border border-mint/40 bg-mint/[0.07] px-4 py-2.5 font-mono text-xs font-semibold text-mint shadow-[0_0_0_0_rgba(61,245,160,0)] transition-all hover:bg-mint/[0.14] hover:shadow-[0_0_24px_-6px_rgba(61,245,160,0.6)]"
          >
            <span className="text-sm leading-none">◍</span>
            Küreyi tam ekran aç
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </button>
        </div>

        {/* Sağ: kompakt küre — konsantrik halka + dönen tarama yayı */}
        <button
          onClick={onOpen}
          aria-label="Küreyi tam ekran aç"
          className="group relative grid h-[300px] place-items-center overflow-visible focus:outline-none sm:h-[340px]"
        >
          {/* statik dış halka */}
          <span className="pointer-events-none absolute aspect-square w-[290px] rounded-full border border-mint/10 sm:w-[330px]" />
          {/* dönen tarama yayı (radar hissi) */}
          <span className="orbit-sweep pointer-events-none absolute aspect-square w-[290px] rounded-full opacity-80 sm:w-[330px]" />
          {/* iç ince halka */}
          <span className="pointer-events-none absolute aspect-square w-[232px] rounded-full border border-line/70 sm:w-[262px]" />
          {/* küre */}
          <LiveGlobe
            maxSize={300}
            maxPins={12}
            perCountry={3}
            spin={0.0026}
            compact
            onStats={setStats}
            className="transition-transform duration-500 group-hover:scale-[1.02]"
          />
        </button>
      </div>
    </motion.section>
  );
}

// Hero KPI kutucuğu — mono rakam + küçük etiket.
function Stat({
  value,
  label,
  pulse,
  muted,
}: {
  value: number;
  label: string;
  pulse?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline gap-2 rounded-xl border px-3 py-2 ${
        muted
          ? "border-line/60 bg-white/[0.012]"
          : "border-line bg-white/[0.02]"
      }`}
    >
      <span
        className={`font-mono text-xl font-bold tabular-nums leading-none ${
          pulse ? "text-mint" : "text-ghost"
        }`}
      >
        {value}
      </span>
      <span className="font-mono text-[10px] leading-none text-slate">
        {label}
      </span>
    </div>
  );
}
