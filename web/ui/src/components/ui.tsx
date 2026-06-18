import { toneRing, toneText } from "../lib";

type Tone = "go" | "wait" | "mute";

// /15 skoru gösteren dairesel halka (SVG).
export function ScoreRing({
  total,
  max = 15,
  tone,
  size = 56,
}: {
  total: number;
  max?: number;
  tone: Tone;
  size?: number;
}) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, total / max));
  const color = toneRing[tone];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#1c212b"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{
            transition: "stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)",
            filter: `drop-shadow(0 0 5px ${color}66)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-mono text-base font-bold leading-none ${toneText[tone]}`}>
          {total}
        </span>
        <span className="font-mono text-[9px] leading-none text-slate">/{max}</span>
      </div>
    </div>
  );
}

// Dolu segment rengi: yüksek değer mint, orta amber, düşük nötr — sinyali pekiştirir.
const barFill: Record<Tone, string> = {
  go: "bg-mint",
  wait: "bg-amber",
  mute: "bg-slate",
};
function valueTone(value: number, max: number): Tone {
  const r = value / max;
  if (r >= 0.8) return "go";
  if (r >= 0.5) return "wait";
  return "mute";
}

// 1-5 arası etiketli mini ölçüt çubuğu. tone verilmezse değere göre otomatik renklenir.
export function MiniBar({
  label,
  value,
  max = 5,
  tone,
}: {
  label: string;
  value: number;
  max?: number;
  tone?: Tone;
}) {
  const fill = barFill[tone ?? valueTone(value, max)];
  return (
    <div className="flex items-center gap-2">
      <span className="w-[68px] shrink-0 font-mono text-[10px] uppercase tracking-wide text-slate">
        {label}
      </span>
      <div className="flex flex-1 gap-1">
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < value ? fill : "bg-line"}`}
          />
        ))}
      </div>
      <span className="w-4 text-right font-mono text-[10px] text-ghost">{value}</span>
    </div>
  );
}

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const ring =
    tone === "go"
      ? "border-mint/40 text-mint bg-mint/10"
      : tone === "wait"
        ? "border-amber/40 text-amber bg-amber/10"
        : "border-line text-slate bg-white/5";
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider ${ring}`}
    >
      {children}
    </span>
  );
}
