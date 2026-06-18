import { useEffect, useMemo, useRef, useState } from "react";
import createGlobe, { type Globe } from "cobe";
import { api, type CollectorState, type NewsItem } from "../api";
import { DOMAIN_LABEL, timeAgo } from "../lib";
import { COUNTRIES, type Country, detectCountry, spreadLocation } from "../geo";

const REFRESH_MS = 5000; // haber listesini tazele
const COOLDOWN_MS = 20000; // collector turları arası min ara (kibar)

// Bir kart = bir haber; ülke sınırı içinde bir noktaya yerleştirilir.
export type Pin = {
  key: string;
  cc: string;
  country: Country;
  item: NewsItem;
  loc: [number, number]; // [lat,lng] — ülke içinde dağıtılmış
  countryTotal: number; // o ülkedeki toplam eşleşen haber (rozet için)
  fresh: boolean;
};

// Parent'a yansıyan canlı sayaçlar — başlık şeridi / hero altyazısı için.
export type GlobeStats = {
  countries: number;
  pins: number;
  total: number;
  running: boolean;
  legend: { cc: string; country: Country; total: number }[];
};

// ---- cobe projeksiyon matematiği (kaynaktan birebir) --------------------
// location [lat,lng] → birim küre üstü 3B vektör
function locToVec3([lat, lng]: [number, number]): [number, number, number] {
  const r = (lat * Math.PI) / 180;
  const a = (lng * Math.PI) / 180 - Math.PI;
  const o = Math.cos(r);
  return [-o * Math.cos(a), Math.sin(r), o * Math.sin(a)];
}

const GLOBE_R = 0.8; // küre yarıçapı (clip)
const MARKER_ELEV = 0.05; // cobe markerElevation varsayılanı

// 3B nokta + (phi,theta) → ekran {x,y∈[0,1], front}
function project(
  loc: [number, number],
  phi: number,
  theta: number,
  aspect: number,
) {
  const v = locToVec3(loc);
  const r = GLOBE_R + MARKER_ELEV;
  const t0 = v[0] * r,
    t1 = v[1] * r,
    t2 = v[2] * r;
  const rc = Math.cos(theta),
    os = Math.sin(theta),
    ac = Math.cos(phi),
    is = Math.sin(phi);
  const c = ac * t0 + is * t2;
  const s = is * os * t0 + rc * t1 - ac * os * t2;
  const frontZ = -is * rc * t0 + os * t1 + ac * rc * t2; // >=0 → ön yüz
  return {
    x: (c / aspect + 1) / 2,
    y: (-s + 1) / 2,
    front: frontZ,
  };
}

export type LiveGlobeProps = {
  /** maksimum küre boyu (px) */
  maxSize?: number;
  /** küre üstünde toplam kart sınırı */
  maxPins?: number;
  /** tek ülkeye düşebilecek en fazla kart */
  perCountry?: number;
  /** otomatik dönüş hızı (rad/frame) */
  spin?: number;
  /** kompakt mod: kartlar küçülür, kullanıcı etkileşimi (sürükle) kapanır */
  compact?: boolean;
  /** canlı sayaçları parent'a bildir */
  onStats?: (s: GlobeStats) => void;
  className?: string;
};

// Canlı haber küresi — cobe + projeksiyonla küre yüzeyine kart yerleştirir.
// Hem tam ekran sekmesinde hem de landing hero'sunda kullanılır.
export function LiveGlobe({
  maxSize = 560,
  maxPins = 26,
  perCountry = 8,
  spin = 0.0018,
  compact = false,
  onStats,
  className,
}: LiveGlobeProps) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [col, setCol] = useState<CollectorState | null>(null);
  const [total, setTotal] = useState(0);

  const seen = useRef<Set<number>>(new Set());
  const fresh = useRef<Set<number>>(new Set());
  const lastTrigger = useRef(0);

  // ---- Canlı haber çekme (NewsView deseni) ----
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await api.news("all", 80);
        if (!alive) return;
        if (seen.current.size === 0) {
          res.items.forEach((it) => seen.current.add(it.id));
        } else {
          const newIds = res.items
            .filter((it) => !seen.current.has(it.id))
            .map((it) => it.id);
          if (newIds.length) {
            newIds.forEach((id) => {
              seen.current.add(id);
              fresh.current.add(id);
            });
            setTimeout(() => {
              if (!alive) return;
              newIds.forEach((id) => fresh.current.delete(id));
              setItems((prev) => [...prev]); // parlamayı söndürmek için re-render
            }, 6000);
          }
        }
        setItems(res.items);
        setTotal(res.total);
        setCol(res.collector);

        const now = Date.now();
        if (!res.collector.running && now - lastTrigger.current > COOLDOWN_MS) {
          lastTrigger.current = now;
          api.collectRss().catch(() => {});
        }
      } catch {
        /* sessiz geç */
      }
    };
    tick();
    const id = setInterval(tick, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // ---- Haber → ülke eşleme; ülke içinde dağıtılmış kartlar (pin) ----
  const pins = useMemo<Pin[]>(() => {
    // 1) Haberleri ülkelere grupla (items yeniden eskiye sıralı)
    const byCC = new Map<string, NewsItem[]>();
    for (const it of items) {
      const cc = detectCountry(`${it.title ?? ""} ${it.summary ?? ""}`);
      if (!cc || !COUNTRIES[cc]) continue;
      const arr = byCC.get(cc);
      if (arr) arr.push(it);
      else byCC.set(cc, [it]);
    }

    // 2) Toplam maxPins'i ülkelere paya göre dağıt (büyük ülkeye daha çok kart,
    //    ama perCountry tavanıyla). Ülkeler haber sayısına göre azalan sırada.
    const ordered = [...byCC.entries()].sort((a, b) => b[1].length - a[1].length);
    const quota = new Map<string, number>();
    let remaining = maxPins;
    // her ülkeye en az 1, sonra round-robin ile kalanları dağıt
    for (const [cc] of ordered) {
      if (remaining <= 0) break;
      quota.set(cc, 1);
      remaining--;
    }
    let progress = true;
    while (remaining > 0 && progress) {
      progress = false;
      for (const [cc, list] of ordered) {
        if (remaining <= 0) break;
        const q = quota.get(cc);
        if (q == null) continue;
        if (q < Math.min(perCountry, list.length)) {
          quota.set(cc, q + 1);
          remaining--;
          progress = true;
        }
      }
    }

    // 3) Her ülke için kota kadar haberi sınır içinde dağıt
    const out: Pin[] = [];
    for (const [cc, list] of ordered) {
      const country = COUNTRIES[cc]!;
      const n = quota.get(cc) ?? 0;
      const countryFresh = list.some((it) => fresh.current.has(it.id));
      for (let i = 0; i < n; i++) {
        const it = list[i];
        out.push({
          key: `${cc}-${it.id}`,
          cc,
          country,
          item: it,
          loc: spreadLocation(cc, i),
          countryTotal: list.length,
          fresh: fresh.current.has(it.id) || (i === 0 && countryFresh),
        });
      }
    }
    return out;
  }, [items, maxPins, perCountry]);

  // ---- canlı sayaçları parent'a bildir ----
  useEffect(() => {
    if (!onStats) return;
    const legend = [...new Map(pins.map((p) => [p.cc, p])).values()]
      .sort((a, b) => b.countryTotal - a.countryTotal)
      .map((p) => ({ cc: p.cc, country: p.country, total: p.countryTotal }));
    onStats({
      countries: new Set(pins.map((p) => p.cc)).size,
      pins: pins.length,
      total,
      running: !!col?.running,
      legend,
    });
  }, [pins, total, col, onStats]);

  // rAF döngüsünün okuduğu güncel veri
  const pinsRef = useRef(pins);
  pinsRef.current = pins;

  // ---- cobe küre + projeksiyon döngüsü ----
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<Globe | null>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const phi = useRef(0);
  const theta = useRef(0.25);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const sizeRef = useRef(maxSize);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let size = Math.min(overlay.clientWidth || maxSize, maxSize);
    sizeRef.current = size;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: size,
      height: size,
      phi: phi.current,
      theta: theta.current,
      dark: 1,
      diffuse: 1.25,
      mapSamples: 16000,
      mapBrightness: 5.2,
      baseColor: [0.16, 0.2, 0.26],
      markerColor: [0.24, 0.96, 0.63], // mint #3df5a0
      glowColor: [0.05, 0.09, 0.08],
      opacity: 0.92,
      markers: [],
    });
    globeRef.current = globe;

    let raf = 0;
    const render = () => {
      if (!drag.current) phi.current += spin; // otomatik dönüş
      globe.update({ phi: phi.current, theta: theta.current });

      const cur = pinsRef.current;
      for (const pin of cur) {
        const node = nodeRefs.current.get(pin.key);
        if (!node) continue;
        const p = project(
          pin.loc,
          phi.current,
          theta.current,
          1, // kare canvas → aspect 1
        );
        const px = p.x * size;
        const py = p.y * size;
        node.style.transform = `translate(${px}px, ${py}px)`;
        // ön yüzde görünür, kenara doğru solar
        const vis = p.front > 0.05 ? 1 : p.front > -0.1 ? 0.25 : 0;
        node.style.opacity = `${vis}`;
        node.style.pointerEvents = !compact && vis > 0.6 ? "auto" : "none";
        node.style.zIndex = `${Math.round((p.front + 1) * 100)}`;
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    // ---- sürükleyerek döndür (kompakt modda kapalı) ----
    const onDown = (e: PointerEvent) => {
      drag.current = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      drag.current = { x: e.clientX, y: e.clientY };
      phi.current += dx * 0.005;
      theta.current = Math.max(-1.1, Math.min(1.1, theta.current + dy * 0.005));
    };
    const onUp = () => {
      drag.current = null;
      canvas.style.cursor = "grab";
    };
    if (!compact) {
      canvas.style.cursor = "grab";
      canvas.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    }

    const onResize = () => {
      const s = Math.min(overlay.clientWidth || maxSize, maxSize);
      if (s === size) return;
      size = s;
      sizeRef.current = s;
      canvas.style.width = `${s}px`;
      canvas.style.height = `${s}px`;
      globe.update({ width: s, height: s });
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      if (!compact) {
        canvas.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      }
      window.removeEventListener("resize", onResize);
      globe.destroy();
      globeRef.current = null;
    };
  }, [compact, maxSize, spin]);

  // pin seti değişince cobe'ye yansıt (küre yüzeyindeki parlayan noktalar)
  useEffect(() => {
    globeRef.current?.update({
      markers: pins.map((p) => ({
        location: p.loc,
        size: p.fresh ? 0.08 : 0.05,
      })),
    });
  }, [pins]);

  return (
    <div
      ref={overlayRef}
      className={`relative ${className ?? ""}`}
      style={{
        width: `min(100%, ${maxSize}px)`,
        height: `min(92vw, ${maxSize}px)`,
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute left-1/2 top-0 -translate-x-1/2 touch-none select-none"
        style={{ contain: "layout paint size" }}
      />
      {/* Haber kartları — projeksiyonla konumlanır */}
      {pins.map((pin) => (
        <div
          key={pin.key}
          ref={(el) => {
            if (el) nodeRefs.current.set(pin.key, el);
            else nodeRefs.current.delete(pin.key);
          }}
          className="absolute left-0 top-0 will-change-transform"
          style={{ opacity: 0 }}
        >
          <MarkerCard pin={pin} compact={compact} />
        </div>
      ))}
    </div>
  );
}

// Küre üstünde yüzen cam haber kartı (bir kart = bir haber).
function MarkerCard({ pin, compact }: { pin: Pin; compact: boolean }) {
  const it = pin.item;

  // Kompakt mod (hero): tıklanamayan, küçük etiket — sadece "canlı" hissi verir.
  if (compact) {
    return (
      <div className="-translate-x-1/2 -translate-y-[140%]">
        <span className="absolute left-1/2 top-[140%] flex -translate-x-1/2 flex-col items-center">
          <span className="h-3 w-px bg-gradient-to-b from-mint/0 to-mint/70" />
          <span className="relative flex h-1.5 w-1.5">
            {pin.fresh && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-mint opacity-50 animate-ping" />
            )}
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_6px_rgba(61,245,160,0.8)]" />
          </span>
        </span>
        <div
          className={`-translate-x-1/2 rounded-md border bg-card/85 px-1.5 py-1 backdrop-blur-md ${
            pin.fresh ? "border-mint/50 shadow-glow" : "border-line/80 shadow-soft"
          }`}
        >
          <div className="flex items-center gap-1">
            <span className="text-[11px] leading-none">{pin.country.flag}</span>
            <span className="max-w-[130px] truncate font-mono text-[9px] font-semibold text-white/90">
              {it.title ?? "(başlıksız)"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-translate-x-1/2 -translate-y-[140%] transition-transform duration-150">
      {/* marker noktası + dikey bağlantı */}
      <span className="absolute left-1/2 top-[140%] flex -translate-x-1/2 flex-col items-center">
        <span className="h-5 w-px bg-gradient-to-b from-mint/0 to-mint/70" />
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-mint opacity-50 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-mint shadow-[0_0_8px_rgba(61,245,160,0.8)]" />
        </span>
      </span>

      <a
        href={it.url ?? undefined}
        target="_blank"
        rel="noreferrer"
        className={`group block w-48 rounded-xl border bg-card/85 p-2.5 backdrop-blur-md transition-all hover:z-50 hover:scale-[1.04] hover:bg-card ${
          pin.fresh
            ? "border-mint/50 shadow-glow"
            : "border-line/80 shadow-soft hover:border-slate/60"
        }`}
      >
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-sm leading-none">{pin.country.flag}</span>
          <span className="font-mono text-[10px] font-semibold tracking-wide text-ghost">
            {pin.country.name.toUpperCase()}
          </span>
          {it.domain && (
            <span className="rounded border border-line px-1 py-px font-mono text-[8px] uppercase tracking-wide text-slate">
              {DOMAIN_LABEL[it.domain] ?? it.domain}
            </span>
          )}
          {pin.fresh && (
            <span className="ml-auto rounded-full border border-mint/50 bg-mint/10 px-1 py-px font-mono text-[8px] font-semibold tracking-wider text-mint">
              YENİ
            </span>
          )}
        </div>
        <h3 className="line-clamp-2 text-[11.5px] font-semibold leading-snug text-white/90 group-hover:text-white">
          {it.title ?? "(başlıksız)"}
        </h3>
        <div className="mt-1 flex items-center justify-between font-mono text-[9px] text-slate">
          <span className="truncate">{it.source}</span>
          <span className="shrink-0">
            {timeAgo(it.published_ts ?? it.collected_at)}
          </span>
        </div>
      </a>
    </div>
  );
}
