import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/** Plan kademeleri — yarın ödeme entegrasyonu eklendiğinde tek kaynak burası.
 *  Free kapasiteler bilinçli düşük tutuldu ki yükseltme isteği doğal doğsun. */
type PlanTier = "free" | "pro";

const PLAN: Record<
  PlanTier,
  { label: string; tag: string; dot: string; ring: string; text: string }
> = {
  free: {
    label: "Ücretsiz",
    tag: "FREE",
    dot: "bg-slate",
    ring: "border-mint/40 bg-mint/10 text-mint",
    text: "text-slate",
  },
  pro: {
    label: "Pro",
    tag: "PRO",
    dot: "bg-amber",
    ring: "border-amber/50 bg-amber/10 text-amber",
    text: "text-amber",
  },
};

// Free kademe kotaları — meter'lar bunlara göre dolar.
const FREE_CAPS = { niches: 10, opps: 5 };

const PRO_PERKS = [
  "Sınırsız niş & fırsat kartı",
  "Saatlik tarama + anlık uyarı",
  "Tüm sinyaller ham veriyle dışa aktarım",
];

/** Fiyatlandırma — Pro henüz GELİŞTİRİLİYOR; bunlar tahmini lansman fiyatları.
 *  Tutarlar sayısal; gösterim ve tasarruf yüzdesi otomatik türetilir. */
type Cadence = "annual" | "monthly";
const CURRENCY = "₺";
const PRICE = { monthly: 199, annualPerMo: 133 }; // yıllıkta aylık eşdeğer

const fmt = (n: number) => CURRENCY + n.toLocaleString("tr-TR");
const SAVE_PCT = Math.round((1 - PRICE.annualPerMo / PRICE.monthly) * 100);

const PRICING: Record<Cadence, { perMo: string; billed: string; save?: string }> = {
  annual: {
    perMo: fmt(PRICE.annualPerMo),
    billed: `${fmt(PRICE.annualPerMo * 12)} yıllık faturalanır`,
    save: `%${SAVE_PCT}`,
  },
  monthly: { perMo: fmt(PRICE.monthly), billed: "aylık faturalanır" },
};

// Kalıcı tercih anahtarları (localStorage)
const LS_CADENCE = "nis.profile.cadence";
const LS_EMAIL = "nis.profile.ea_email"; // erken erişim e-postası (dolu = katıldı)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const lsGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* özel sekme vb. — sessiz geç */
  }
};

/** İsimden baş harf(ler) üret — avatar için. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((w) => w[0]?.toUpperCase() ?? "").join("") || "O";
}

export function ProfileMenu({
  niches,
  opps,
  onOpenSettings,
  plan = "free",
  name = "Operatör",
  email,
  onEarlyAccess,
  onSignOut,
}: {
  niches: number;
  opps: number;
  onOpenSettings: () => void;
  plan?: PlanTier;
  name?: string;
  /** Hesap e-postası (başlıkta gösterilir). */
  email?: string;
  /** Erken erişim formu — e-postayı backend/forma iletir. Yoksa yerel kaydedilir. */
  onEarlyAccess?: (email: string) => void | Promise<void>;
  onSignOut?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [cadence, setCadence] = useState<Cadence>(
    () => (lsGet(LS_CADENCE) as Cadence) || "annual",
  );
  // Erken erişim akışı
  const [joinedEmail, setJoinedEmail] = useState<string | null>(() => lsGet(LS_EMAIL));
  const [formOpen, setFormOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const p = PLAN[plan];
  const isPro = plan === "pro";
  const joined = !!joinedEmail;
  // Free kotası dolduğunda yükseltme dürtüsünü görünür kıl.
  const quotaFull = !isPro && (niches >= FREE_CAPS.niches || opps >= FREE_CAPS.opps);

  useEffect(() => lsSet(LS_CADENCE, cadence), [cadence]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onEsc);
    };
  }, []);

  // Menü açılınca odağı içeri taşı — klavye kullanıcısı doğrudan gezinir.
  useEffect(() => {
    if (open) menuRef.current?.focus();
  }, [open]);

  // Ok tuşlarıyla menü içi gezinme (roving focus).
  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const els = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, a[href]',
      ) ?? [],
    );
    if (!els.length) return;
    e.preventDefault();
    const i = els.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "ArrowDown"
        ? els[(i + 1) % els.length]
        : els[(i - 1 + els.length) % els.length];
    next?.focus();
  };

  const submitEarlyAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = emailInput.trim();
    if (!EMAIL_RE.test(value)) {
      setEmailErr("Geçerli bir e-posta gir");
      return;
    }
    setEmailErr(null);
    setSubmitting(true);
    try {
      await onEarlyAccess?.(value); // forma/back-end'e ilet
      lsSet(LS_EMAIL, value);
      setJoinedEmail(value);
      setFormOpen(false);
    } catch {
      setEmailErr("Gönderilemedi — tekrar dene");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex items-center" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Profil"
        aria-label={`Profil menüsü — ${p.label} plan`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="group flex items-center gap-2 rounded-full border border-line bg-card/60 py-1 pl-1 pr-2.5 outline-none transition-colors hover:border-mint/50 focus-visible:ring-2 focus-visible:ring-mint/50"
      >
        <span className="relative grid h-8 w-8 place-items-center">
          {/* Plan halkası — Pro'da altın, Free'de mint */}
          <span
            className={`grid h-8 w-8 place-items-center rounded-full border font-mono text-sm font-bold ${p.ring}`}
          >
            {initials(name)}
          </span>
          {/* Köşe plan noktası */}
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${p.dot}`}
          />
        </span>
        <span className="hidden flex-col items-start leading-none sm:flex">
          <span className="text-xs font-semibold text-white">{name}</span>
          <span className={`font-mono text-[9px] tracking-wide ${p.text}`}>
            {p.tag}
          </span>
        </span>
        <svg
          viewBox="0 0 12 12"
          className={`h-3 w-3 text-slate transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 4.5 6 7.5 9 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            role="menu"
            aria-label="Profil ve abonelik"
            tabIndex={-1}
            onKeyDown={onMenuKeyDown}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute right-0 top-12 z-[300] w-72 overflow-hidden rounded-2xl border border-line bg-card shadow-soft outline-none"
          >
            {/* ── Kimlik başlığı ── */}
            <div className="flex items-center gap-3 border-b border-line/70 bg-white/[0.015] px-4 py-3.5">
              <div className="relative">
                <div
                  className={`grid h-11 w-11 place-items-center rounded-full border font-mono text-lg font-bold ${p.ring}`}
                >
                  {initials(name)}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${p.dot}`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-white">
                    {name}
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wide ${p.ring}`}
                  >
                    {p.tag}
                  </span>
                </div>
                <div className="truncate font-mono text-[10px] text-slate">
                  {email ?? "solo · niş + trend radarı"}
                </div>
              </div>
            </div>

            {/* ── Kullanım kotaları (Free kademe) ── */}
            <div className="flex flex-col gap-2.5 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate">
                  {isPro ? "Kullanım" : "Free kotası"}
                </span>
                <span className="font-mono text-[9px] text-slate">bu döngü</span>
              </div>
              <Meter
                label="niş kartı"
                used={niches}
                cap={FREE_CAPS.niches}
                unlimited={isPro}
                accent="mint"
              />
              <Meter
                label="fırsat brief"
                used={opps}
                cap={FREE_CAPS.opps}
                unlimited={isPro}
                accent="iris"
              />
            </div>

            {/* ── Pro erken erişim kartı (yalnızca Free'de) ── */}
            {!isPro && (
              <div className="px-3 pb-3">
                <div className="relative overflow-hidden rounded-xl border border-amber/25 bg-gradient-to-br from-amber/[0.12] via-amber/[0.04] to-transparent p-3.5">
                  {/* üstten geçen ışık parıltısı — hareket azaltmada kapalı */}
                  {!reduce && (
                    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-amber/10 to-transparent animate-sweep" />
                  )}

                  {joined ? (
                    /* ── Erken erişim onayı ── */
                    <div className="relative flex items-center gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-amber/40 bg-amber/10 text-amber">
                        ✓
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white">
                          Erken erişim listesindesin
                        </div>
                        <div className="truncate font-mono text-[10px] text-slate">
                          {joinedEmail} · Pro çıkınca ilk sen haber alırsın
                        </div>
                      </div>
                    </div>
                  ) : formOpen ? (
                    /* ── E-posta toplama formu ── */
                    <form onSubmit={submitEarlyAccess} className="relative">
                      <div className="mb-2 flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-bold tracking-wide text-amber">
                          ★ PRO
                        </span>
                        <span className="font-mono text-[10px] text-slate">
                          erken erişim — sıraya gir
                        </span>
                      </div>
                      <label className="sr-only" htmlFor="ea-email">
                        E-posta adresi
                      </label>
                      <input
                        id="ea-email"
                        type="email"
                        autoFocus
                        value={emailInput}
                        onChange={(e) => {
                          setEmailInput(e.target.value);
                          if (emailErr) setEmailErr(null);
                        }}
                        placeholder="e-posta adresin"
                        aria-invalid={!!emailErr}
                        className={`w-full rounded-lg border bg-ink/50 px-3 py-2 text-xs text-white outline-none transition-colors placeholder:text-slate/60 focus:border-amber/60 ${
                          emailErr ? "border-amber/60" : "border-line"
                        }`}
                      />
                      {emailErr && (
                        <div className="mt-1 font-mono text-[10px] text-amber">
                          {emailErr}
                        </div>
                      )}
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFormOpen(false);
                            setEmailErr(null);
                          }}
                          className="rounded-lg border border-line px-3 py-2 font-mono text-[11px] text-slate outline-none transition-colors hover:text-ghost focus-visible:ring-1 focus-visible:ring-line"
                        >
                          Vazgeç
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="group flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber px-3 py-2 text-xs font-bold text-ink shadow-[0_8px_24px_-8px_rgba(245,196,81,0.6)] outline-none transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                        >
                          {submitting ? "Gönderiliyor…" : "Gönder"}
                          {!submitting && (
                            <span className="transition-transform group-hover:translate-x-0.5">
                              →
                            </span>
                          )}
                        </button>
                      </div>
                      <div className="mt-1.5 text-center font-mono text-[9px] text-slate">
                        yalnızca lansman haberi · spam yok
                      </div>
                    </form>
                  ) : (
                    /* ── Tanıtım + erken erişim çağrısı ── */
                    <div className="relative">
                      {quotaFull && (
                        <div className="mb-2.5 flex items-center gap-1.5 rounded-lg border border-amber/30 bg-amber/[0.07] px-2 py-1.5 font-mono text-[10px] text-amber">
                          <span>⚠</span> Free kotan doldu — yenileri Pro ile gelir
                        </div>
                      )}
                      <div className="mb-2.5 flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-bold tracking-wide text-amber">
                          ★ PRO
                        </span>
                        {/* Pro henüz geliştiriliyor */}
                        <span className="rounded-full border border-amber/40 bg-amber/10 px-2 py-0.5 font-mono text-[9px] font-bold tracking-wide text-amber">
                          YAKINDA
                        </span>
                      </div>
                      <ul className="mb-3 flex flex-col gap-1">
                        {PRO_PERKS.map((perk) => (
                          <li
                            key={perk}
                            className="flex items-start gap-1.5 text-[11px] leading-snug text-ghost"
                          >
                            <span className="mt-0.5 text-amber">→</span>
                            {perk}
                          </li>
                        ))}
                      </ul>

                      {/* Tahmini lansman fiyatı — kademe değişince yumuşak geçiş */}
                      <div className="mb-0.5 flex items-center gap-1.5">
                        <span className="font-mono text-[9px] uppercase tracking-wide text-slate">
                          tahmini lansman fiyatı
                        </span>
                        <CadenceToggle value={cadence} onChange={setCadence} />
                      </div>
                      <div className="mb-0.5 flex items-baseline gap-1.5">
                        <AnimatePresence mode="popLayout">
                          <motion.span
                            key={cadence}
                            initial={reduce ? {} : { opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="text-2xl font-bold tabular-nums text-white"
                          >
                            {PRICING[cadence].perMo}
                          </motion.span>
                        </AnimatePresence>
                        <span className="font-mono text-[10px] text-slate">/ay</span>
                        {PRICING[cadence].save && (
                          <span className="ml-auto rounded-full border border-amber/40 bg-amber/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber">
                            {PRICING[cadence].save} tasarruf
                          </span>
                        )}
                      </div>
                      <div className="mb-2.5 font-mono text-[10px] text-slate">
                        {PRICING[cadence].billed}
                      </div>

                      <button
                        onClick={() => setFormOpen(true)}
                        className="group flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber px-3 py-2 text-xs font-bold text-ink shadow-[0_8px_24px_-8px_rgba(245,196,81,0.6)] outline-none transition-transform hover:scale-[1.02] active:scale-95 focus-visible:ring-2 focus-visible:ring-amber/50"
                      >
                        Erken erişim iste
                        <span className="transition-transform group-hover:translate-x-0.5">
                          →
                        </span>
                      </button>
                      <div className="mt-1.5 text-center font-mono text-[9px] text-slate">
                        e-postanı bırak · lansmanda öncelik + indirim
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Aksiyonlar ── */}
            <div className="border-t border-line/70 p-1.5">
              {isPro && (
                <MenuItem icon="◆" onClick={() => setOpen(false)}>
                  Abonelik & Fatura
                </MenuItem>
              )}
              <MenuItem
                icon="⚙"
                onClick={() => {
                  setOpen(false);
                  onOpenSettings();
                }}
              >
                Ayarlar & Sistem
              </MenuItem>
              {onSignOut && (
                <MenuItem
                  icon="⏻"
                  danger
                  onClick={() => {
                    setOpen(false);
                    onSignOut();
                  }}
                >
                  Çıkış yap
                </MenuItem>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CadenceToggle({
  value,
  onChange,
}: {
  value: Cadence;
  onChange: (c: Cadence) => void;
}) {
  return (
    <div className="ml-auto flex items-center rounded-full border border-amber/25 bg-ink/40 p-0.5">
      {(["annual", "monthly"] as Cadence[]).map((c) => {
        const active = value === c;
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            aria-pressed={active}
            className="relative rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wide outline-none focus-visible:ring-1 focus-visible:ring-amber/50"
          >
            {active && (
              <motion.span
                layoutId="cadence-pill"
                transition={{ type: "spring", stiffness: 480, damping: 36 }}
                className="absolute inset-0 rounded-full bg-amber"
              />
            )}
            <span className={`relative z-10 ${active ? "text-ink" : "text-slate"}`}>
              {c === "annual" ? "Yıllık" : "Aylık"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Meter({
  label,
  used,
  cap,
  unlimited,
  accent,
}: {
  label: string;
  used: number;
  cap: number;
  unlimited: boolean;
  accent: "mint" | "iris";
}) {
  const pct = unlimited ? 30 : Math.min(100, Math.round((used / cap) * 100));
  const full = !unlimited && used >= cap;
  const barColor = unlimited
    ? "bg-amber"
    : full
      ? "bg-amber"
      : accent === "mint"
        ? "bg-mint"
        : "bg-iris";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-mono text-[10px]">
        <span className="text-ghost">{label}</span>
        <span className={full ? "text-amber" : "text-slate"}>
          {unlimited ? (
            <span className="text-amber">∞ sınırsız</span>
          ) : (
            <>
              <span className="tabular-nums text-white">{used}</span>
              <span className="text-slate"> / {cap}</span>
            </>
          )}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  onClick,
  children,
  danger,
}: {
  icon: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-mono text-xs outline-none transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.03] focus-visible:ring-1 ${
        danger
          ? "text-slate hover:text-amber focus-visible:text-amber focus-visible:ring-amber/40"
          : "text-ghost hover:text-mint focus-visible:text-mint focus-visible:ring-mint/40"
      }`}
    >
      <span className="text-sm">{icon}</span>
      {children}
    </button>
  );
}
