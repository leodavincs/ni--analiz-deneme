import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Opportunity } from "../api";
import { CONFIDENCE, OPP_STATUS, OPP_TYPE_LABEL, oppTone, weakestOf } from "../lib";
import { Badge, ScoreRing } from "./ui";

export function OpportunityCard({
  o,
  index,
  onOpen,
}: {
  o: Opportunity;
  index: number;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const tone = oppTone(o.score);
  const go = tone === "go";
  const conf = o.confidence ? CONFIDENCE[o.confidence] : null;
  const st = o.status ? OPP_STATUS[o.status] : null;
  const weakest = weakestOf(o.score_line);
  const hasAngles = Boolean(o.tr_angle || o.first_output);
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
      className={`group relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-2xl border bg-card/70 p-5 pl-6 shadow-soft outline-none transition-colors focus-visible:border-iris/60 ${
        go
          ? "border-iris/40 hover:border-iris/70 hover:shadow-[0_0_0_1px_rgba(139,139,245,0.35),0_0_28px_-6px_rgba(139,139,245,0.45)]"
          : "border-line hover:border-iris/40"
      }`}
    >
      {/* Trend Radarı kimlik şeridi — iris (sol kenar) */}
      <span
        className={`pointer-events-none absolute inset-y-0 left-0 w-1 ${
          go ? "bg-iris" : "bg-iris/30"
        }`}
      />
      {go && (
        <span className="pointer-events-none absolute -left-px -top-px h-16 w-16 rounded-tl-2xl bg-gradient-to-br from-iris/25 to-transparent blur-md" />
      )}

      <div className="flex items-start gap-4">
        <ScoreRing total={o.score ?? 0} max={o.score_max} tone={tone} />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            {o.opportunity_type && (
              <span className="rounded-full border border-iris/30 bg-iris/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-iris">
                {OPP_TYPE_LABEL[o.opportunity_type] ?? o.opportunity_type}
              </span>
            )}
            {conf && <Badge tone={conf.tone}>{conf.label}</Badge>}
            {st && st.tone === "go" && (
              <span className="font-mono text-[10px] font-semibold tracking-wider text-mint">
                {st.label}
              </span>
            )}
          </div>
          <h3 className="text-[15px] font-semibold leading-snug text-white/90">
            {o.title}
          </h3>
        </div>
      </div>

      {o.why_now && (
        <p className="line-clamp-2 text-[13px] leading-relaxed text-slate">
          {o.why_now}
        </p>
      )}

      {/* Asıl kurulabilir kama — fırsatın en aksiyon alınabilir tarafı */}
      {o.wedge && (
        <div className="rounded-xl border border-iris/15 bg-iris/[0.04] p-3">
          <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-iris/70">
            ▸ kama
          </div>
          <p className="line-clamp-2 text-[12.5px] leading-relaxed text-ghost">
            {o.wedge}
          </p>
        </div>
      )}

      {weakest && (
        <span className="-mt-1 inline-flex items-center gap-1.5 self-start rounded-full border border-amber/25 bg-amber/5 px-2.5 py-0.5 font-mono text-[10px] text-amber/90">
          ⚠ en zayıf: {weakest}
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
                  {o.first_output && (
                    <Angle icon="⚡" label="İlk çıktı" text={o.first_output} />
                  )}
                  {o.tr_angle && (
                    <Angle icon="🇹🇷" label="Türkiye açısı" text={o.tr_angle} />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <div
        className={`mt-auto flex items-center justify-between gap-3 font-mono text-[11px] text-slate ${
          hasAngles ? "" : "border-t border-line/70 pt-3"
        }`}
      >
        <span className="truncate">{o.monetization ?? o.cluster ?? "—"}</span>
        <span className="shrink-0 text-iris/80 transition-colors group-hover:text-iris">
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
