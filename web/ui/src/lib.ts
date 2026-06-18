import { useEffect, useRef, useState } from "react";

// "2 saat önce" tarzı göreli zaman (Türkçe).
export function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "az önce";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.floor(h / 24);
  return `${d} gün önce`;
}

// Sayaçları sıfırdan hedefe akıtan count-up hook'u.
export function useCountUp(target: number, duration = 900): number {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export const NICHE_STATUS: Record<
  string,
  { label: string; tone: "go" | "wait" | "mute" }
> = {
  git: { label: "GİT", tone: "go" },
  bekle: { label: "BEKLE", tone: "wait" },
  aday: { label: "ADAY", tone: "wait" },
  ele: { label: "ELE", tone: "mute" },
};

export const TREND_STATUS: Record<
  string,
  { label: string; tone: "go" | "wait" | "mute" }
> = {
  aksiyon: { label: "AKSİYON", tone: "go" },
  izle: { label: "İZLE", tone: "wait" },
  gec: { label: "GEÇ", tone: "mute" },
};

export const toneText: Record<"go" | "wait" | "mute", string> = {
  go: "text-mint",
  wait: "text-amber",
  mute: "text-slate",
};

export const toneRing: Record<"go" | "wait" | "mute", string> = {
  go: "#3df5a0",
  wait: "#f5c451",
  mute: "#6b7686",
};

export const SOURCE_LABEL: Record<string, string> = {
  reddit: "Reddit",
  hackernews: "HN",
  producthunt: "PH",
  indiehackers: "IH",
  reddit_apify: "Reddit",
};

// niche-hunter fırsat tipleri + güven seviyeleri
export const OPP_TYPE_LABEL: Record<string, string> = {
  product: "SaaS / Ürün",
  automation: "Otomasyon",
  service: "Servis",
  content: "İçerik",
  hybrid: "Hibrit",
};

export const OPP_STATUS: Record<
  string,
  { label: string; tone: "go" | "wait" | "mute" }
> = {
  new: { label: "YENİ", tone: "go" },
  promoted: { label: "TERFİ", tone: "go" },
  updated: { label: "GÜNCEL", tone: "wait" },
};

export const CONFIDENCE: Record<
  string,
  { label: string; tone: "go" | "wait" | "mute" }
> = {
  high: { label: "yüksek güven", tone: "go" },
  med: { label: "orta güven", tone: "wait" },
  low: { label: "düşük güven · VERIFY", tone: "mute" },
};

// Fırsat skoru (/60) → tone eşiği: ≥38 git, ≥30 izle, altı geç (skill gate'iyle uyumlu)
export function oppTone(score: number | null): "go" | "wait" | "mute" {
  if (score == null) return "mute";
  if (score >= 38) return "go";
  if (score >= 30) return "wait";
  return "mute";
}

// score_line → "weakest: A, B" kısmını çıkarır (kartta "en zayıf" rozeti için).
// Örn: "52/60 · weakest: Competition headroom, TR arbitrage · confidence: high" → "Competition headroom, TR arbitrage"
export function weakestOf(scoreLine: string | null | undefined): string | null {
  if (!scoreLine) return null;
  const m = scoreLine.match(/weakest:\s*([^·|]+)/i);
  return m ? m[1].trim() : null;
}

// Nişin en zayıf ekseni (/5) → kartta "en zayıf" rozeti için.
// Trend kartındaki weakestOf'un niş karşılığı; 3 eksenin en düşüğünü etiketler.
export function weakestNiche(n: {
  yatkinlik: number;
  problem: number;
  para_akisi: number;
}): { label: string; value: number } | null {
  const axes = [
    { label: "yatkınlık", value: n.yatkinlik },
    { label: "problem", value: n.problem },
    { label: "para akışı", value: n.para_akisi },
  ];
  const min = Math.min(...axes.map((a) => a.value));
  // Yalnızca gerçekten zayıfsa (≤3/5) uyar — güçlü nişte gürültü yapma.
  if (min > 3) return null;
  const hit = axes.find((a) => a.value === min);
  return hit ?? null;
}

export const DOMAIN_LABEL: Record<string, string> = {
  ai: "AI",
  startup: "Startup",
  consumer: "Tüketici",
  fintech: "Fintech",
  ecommerce: "E-ticaret",
  emerging: "Yükselen",
};

// Her kategoriye ayırt edici renk — koyu zeminde okunur (HSL bazlı, dengeli ton).
export const DOMAIN_COLOR: Record<string, string> = {
  ai: "#a78bfa", // mor
  startup: "#34d399", // zümrüt
  consumer: "#38bdf8", // gök
  fintech: "#f5c451", // kehribar
  ecommerce: "#fb7185", // gül
  emerging: "#fb923c", // turuncu
};

// Kategori rengi (yoksa nötr slate). Şeffaflık eki için hex8 kullanılır: `${c}1a`.
export function domainColor(domain: string | null | undefined): string {
  return (domain && DOMAIN_COLOR[domain]) || "#6b7686";
}

// URL'den host çıkar; favicon yedeği için kullanılır.
export function hostOf(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
