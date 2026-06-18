import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Overview } from "../api";
import { timeAgo, useCountUp } from "../lib";

export function LiveBar({ ov }: { ov: Overview | null }) {
  const scanned = useCountUp(
    (ov?.signals_total ?? 0) + (ov?.trend_items_total ?? 0),
  );
  const last =
    ov &&
    [ov.last_scan_signals, ov.last_scan_trends]
      .filter(Boolean)
      .sort()
      .at(-1);

  return (
    <div className="relative z-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line/70 px-5 py-3 backdrop-blur-md sm:px-8">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-mint opacity-60 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-mint animate-pulseDot" />
        </span>
        <span className="font-mono text-xs font-semibold tracking-[0.2em] text-mint">
          CANLI
        </span>
      </div>

      <span className="font-mono text-xs text-slate">
        son tarama{" "}
        <span className="text-ghost">{timeAgo(last ?? null)}</span>
      </span>

      <span className="hidden h-3 w-px bg-line sm:block" />

      <motion.span
        key={scanned}
        className="font-mono text-xs text-slate"
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
      >
        <span className="font-semibold text-ghost">
          {scanned.toLocaleString("tr-TR")}
        </span>{" "}
        kaynak tarandı
      </motion.span>

      <div className="ml-auto hidden items-center gap-2 overflow-hidden rounded-full border border-line/80 px-3 py-1 md:flex">
        {ov?.sources.map((s) => (
          <span key={s.source} className="font-mono text-[10px] text-slate">
            {s.source}
            <span className="ml-1 text-ghost">{s.n}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Ham sinyal → damıtılmış niş → GİT fırsatı: dört dağınık kutu yerine, ürünün
// iki hattını (Niş Avcısı · Trend Radarı) huni olarak gösteren damıtma şeridi.
export function KpiStrip({ ov }: { ov: Overview | null }) {
  return (
    <div className="relative z-10 grid grid-cols-1 gap-3 px-5 py-4 sm:px-8 lg:grid-cols-2">
      <Funnel
        glyph="◎"
        no="01"
        name="Niş Avcısı"
        raw={{ value: ov?.signals_total ?? 0, label: "ham sinyal" }}
        mid={{ value: ov?.niches_total ?? 0, label: "niş" }}
        payoff={{ value: ov?.niches_git ?? 0, label: "GİT FIRSATI" }}
        delay={0}
      />
      <Funnel
        glyph="✦"
        no="02"
        name="Trend Radarı"
        raw={{ value: ov?.trend_items_total ?? 0, label: "ham trend" }}
        mid={{ value: ov?.trends_total ?? 0, label: "brief" }}
        payoff={{ value: ov?.trends_aksiyon ?? 0, label: "AKSİYON" }}
        delay={0.08}
      />
    </div>
  );
}

type Stage = { value: number; label: string };

function Funnel({
  glyph,
  no,
  name,
  raw,
  mid,
  payoff,
  delay,
}: {
  glyph: string;
  no: string;
  name: string;
  raw: Stage;
  mid: Stage;
  payoff: Stage;
  delay: number;
}) {
  const rawN = useCountUp(raw.value);
  const midN = useCountUp(mid.value);
  const payoffN = useCountUp(payoff.value);
  const conv = raw.value > 0 ? (payoff.value / raw.value) * 100 : 0;
  const convStr = conv >= 10 ? conv.toFixed(0) : conv.toFixed(1);

  // Aşama bazında geçiş oranı: köprülerin parçacık yoğunluğunu bununla sürer.
  const pass1 = raw.value > 0 ? mid.value / raw.value : 0;
  const pass2 = mid.value > 0 ? payoff.value / mid.value : 0;

  // Veri değiştiğinde kısa "yükleniyor" fazı: sayaç akarken parçacıklar
  // hızlanır, sonra sayfanın 1.8s kalp atışına iner.
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    setBooting(true);
    const t = setTimeout(() => setBooting(false), 950);
    return () => clearTimeout(t);
  }, [raw.value, mid.value, payoff.value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-xl border border-line bg-card/70 px-4 py-3 shadow-soft transition-colors duration-300 hover:border-mint/30 hover:shadow-glow"
    >
      <span className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-mint/10 opacity-70 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm text-mint">{glyph}</span>
        <span className="font-mono text-[9px] tracking-[0.25em] text-slate/70">
          {no}
        </span>
        <span className="text-sm font-bold text-white">{name}</span>
        <span className="ml-auto font-mono text-[10px] text-slate">
          <span className="font-semibold text-mint">%{convStr}</span> damıtım
        </span>
      </div>

      <div className="h-px w-full bg-gradient-to-r from-line via-line/60 to-transparent" />

      <div className="mt-2.5 flex items-center gap-1">
        <FunnelStage value={rawN} label={raw.label} />
        <FlowBridge delay={delay} pass={pass1} booting={booting} />
        <FunnelStage value={midN} label={mid.label} dim />
        <FlowBridge delay={delay + 0.45} pass={pass2} booting={booting} bright />
        <Payoff value={payoffN} label={payoff.label} pulseKey={payoff.value} />
      </div>
    </motion.div>
  );
}

function FunnelStage({
  value,
  label,
  dim = false,
}: {
  value: number;
  label: string;
  dim?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-start">
      <span
        className={`font-mono font-bold leading-none tabular-nums ${
          dim ? "text-lg text-ghost/70" : "text-xl text-ghost"
        }`}
      >
        {value.toLocaleString("tr-TR")}
      </span>
      <span className="mt-1 truncate font-mono text-[10px] tracking-wide text-slate">
        {label}
      </span>
    </div>
  );
}

// Aşamalar arası akış köprüsü: damıtmayı parçacıkla anlatır.
// `pass` (0–1) geçiş oranıdır: kaç parçacık karşıya ulaşır, kaçı yolda elenir.
// Track soldan geniş → sağdan dar bir huniye kırpılır; girene çok, çıkana az
// alan kalır. `bright` payoff'a giden son köprüyü daha parlak boyar; `booting`
// yeni veri akarken parçacıkları hızlandırır.
const FLOW_SLOTS = 5;

function FlowBridge({
  delay = 0,
  pass = 1,
  bright = false,
  booting = false,
}: {
  delay?: number;
  pass?: number;
  bright?: boolean;
  booting?: boolean;
}) {
  // Geçen parçacık sayısı orana bağlı (en az 1 görünür akış kalsın).
  const survivors = Math.min(
    FLOW_SLOTS,
    Math.max(1, Math.round(pass * FLOW_SLOTS)),
  );
  const dur = booting ? "0.7s" : "1.8s";

  return (
    <span className="relative h-5 w-9 shrink-0 self-center overflow-hidden">
      {/* daralan huni: sol kenar geniş, sağ kenar dar */}
      <span
        className={`absolute inset-0 bg-gradient-to-r from-line/40 ${
          bright ? "via-mint/20 to-mint/40" : "via-slate/15 to-mint/25"
        }`}
        style={{ clipPath: "polygon(0 8%, 100% 36%, 100% 64%, 0 92%)" }}
      />
      <span
        className={`absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-gradient-to-r from-line ${
          bright ? "via-mint/30 to-mint/60" : "via-slate/25 to-mint/30"
        }`}
      />
      {Array.from({ length: FLOW_SLOTS }).map((_, i) => {
        const survives = i < survivors;
        return (
          <span
            key={i}
            className={`absolute top-1/2 h-[3px] w-[3px] rounded-full shadow-[0_0_6px_rgba(61,245,160,0.85)] motion-reduce:hidden ${
              survives ? "animate-flowDot" : "animate-flowDrop"
            } ${bright ? "bg-mint" : "bg-mint/60"} group-hover:[animation-duration:1.05s]`}
            style={{ animationDelay: `${delay + i * 0.34}s`, animationDuration: dur }}
          />
        );
      })}
      <span className="absolute right-0 top-1/2 -translate-y-1/2 font-mono text-[11px] leading-none text-mint/50">
        ›
      </span>
    </span>
  );
}

function Payoff({
  value,
  label,
  pulseKey,
}: {
  value: number;
  label: string;
  pulseKey: number;
}) {
  return (
    <motion.div
      key={pulseKey}
      initial={{ boxShadow: "0 0 0 0 rgba(61,245,160,0.55)" }}
      animate={{ boxShadow: "0 0 22px 2px rgba(61,245,160,0)" }}
      transition={{ duration: 1.1, ease: "easeOut" }}
      className="relative flex shrink-0 flex-col items-center justify-center rounded-lg border border-mint/30 bg-mint/[0.06] px-3 py-1.5 shadow-[inset_0_0_0_1px_rgba(61,245,160,0.1)] animate-payoffPulse motion-reduce:animate-none"
    >
      <div className="flex items-center gap-1">
        <span className="font-mono text-xl font-bold leading-none tabular-nums text-mint">
          {value.toLocaleString("tr-TR")}
        </span>
        <span className="animate-pulseDot text-xs text-mint/80 motion-reduce:animate-none">
          ◆
        </span>
      </div>
      <span className="mt-1 font-mono text-[9px] font-semibold tracking-[0.12em] text-mint/70">
        {label}
      </span>
    </motion.div>
  );
}
