import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Niche } from "../api";
import { NICHE_STATUS, weakestNiche } from "../lib";
import { Badge, MiniBar, ScoreRing } from "./ui";

export function NicheCard({
  n,
  index,
  onOpen,
}: {
  n: Niche;
  index: number;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const st = NICHE_STATUS[n.status] ?? NICHE_STATUS.aday;
  const go = st.tone === "go";
  const why = n.why || n.summary;
  const weak = weakestNiche(n);
  const hasAngles = Boolean(n.mvp || n.kime);
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.45, ease: "easeOut" }}
      whileHover={{ y: -4 }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className={`group relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-2xl border bg-card/70 p-5 pl-6 shadow-soft outline-none transition-colors focus-visible:border-mint/60 ${
        go
          ? "border-mint/40 hover:border-mint/70 hover:shadow-[0_0_0_1px_rgba(61,245,160,0.35),0_0_28px_-6px_rgba(61,245,160,0.45)]"
          : "border-line hover:border-mint/40"
      }`}
    >
      {/* Niş Avcısı kimlik şeridi — mint (sol kenar) */}
      <span
        className={`pointer-events-none absolute inset-y-0 left-0 w-1 ${
          go ? "bg-mint" : "bg-mint/30"
        }`}
      />
      {go && (
        <span className="pointer-events-none absolute -left-px -top-px h-16 w-16 rounded-tl-2xl bg-gradient-to-br from-mint/25 to-transparent blur-md" />
      )}

      <div className="flex items-start gap-4">
        <ScoreRing total={n.total} tone={st.tone} />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
          <h3 className="text-[15px] font-semibold leading-snug text-white/90">
            {n.title}
          </h3>
        </div>
      </div>

      {why && (
        <p className="line-clamp-2 text-[13px] leading-relaxed text-slate">{why}</p>
      )}

      {/* Asıl kurulabilir kama — nişin en aksiyon alınabilir tarafı (iş modeli) */}
      {n.model && (
        <div className="rounded-xl border border-mint/15 bg-mint/[0.04] p-3">
          <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-mint/70">
            ▸ iş fikri
          </div>
          <p className="line-clamp-2 text-[12.5px] leading-relaxed text-ghost">
            {n.model}
          </p>
        </div>
      )}

      {weak && (
        <span className="-mt-1 inline-flex items-center gap-1.5 self-start rounded-full border border-amber/25 bg-amber/5 px-2.5 py-0.5 font-mono text-[10px] text-amber/90">
          ⚠ en zayıf: {weak.label} {weak.value}/5
        </span>
      )}

      {hasAngles && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className="flex items-center justify-between border-t border-line/70 pt-3 text-left font-mono text-[11px] tracking-wide text-slate transition-colors hover:text-ghost"
          >
            <span>nasıl başlanır — 2 açı</span>
            <span className={`transition-transform ${open ? "rotate-90" : ""}`}>›</span>
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-3 pt-1">
                  {n.mvp && <Angle icon="⚡" label="İlk çıktı (MVP)" text={n.mvp} />}
                  {n.kime && <Angle icon="🎯" label="Kime (ICP)" text={n.kime} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <div
        className={`flex flex-col gap-1.5 ${
          hasAngles ? "pt-1" : "border-t border-line/70 pt-3"
        }`}
      >
        <MiniBar label="yatkınlık" value={n.yatkinlik} />
        <MiniBar label="problem" value={n.problem} />
        <MiniBar label="para akışı" value={n.para_akisi} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line/70 pt-3 font-mono text-[11px] text-slate">
        <span className="truncate">{n.aci ?? "şikayet → niş"}</span>
        <span className="shrink-0 text-mint/80 transition-colors group-hover:text-mint">
          detay →
        </span>
      </div>
    </motion.article>
  );
}

function Angle({ icon, label, text }: { icon: string; label: string; text: string }) {
  return (
    <div className="rounded-xl border border-line/70 bg-white/[0.02] p-3">
      <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-ghost">
        <span>{icon}</span>
        {label}
      </div>
      <p className="text-[13px] leading-relaxed text-slate">{text}</p>
    </div>
  );
}
