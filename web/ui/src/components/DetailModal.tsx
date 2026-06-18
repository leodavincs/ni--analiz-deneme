import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, type NoteDetail, type Niche, type Opportunity } from "../api";
import {
  CONFIDENCE,
  NICHE_STATUS,
  OPP_TYPE_LABEL,
  oppTone,
  toneText,
} from "../lib";
import { Badge, ScoreRing } from "./ui";

export type Selection =
  | { type: "niche"; niche: Niche }
  | { type: "opportunity"; opp: Opportunity };

// --- minik markdown render: **kalın**, [metin](url), > alıntı, - madde ---
function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={k++} className="text-ghost">{m[1]}</strong>);
    else
      out.push(
        <a
          key={k++}
          href={m[3]}
          target="_blank"
          rel="noreferrer"
          className="text-mint underline decoration-mint/40 underline-offset-2 hover:decoration-mint"
        >
          {m[2]}
        </a>,
      );
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdownish({ lines }: { lines: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((raw, i) => {
        const line = raw.trim();
        if (!line) return <div key={i} className="h-1" />;
        if (line.startsWith(">"))
          return (
            <blockquote
              key={i}
              className="border-l-2 border-mint/40 pl-3 text-[13px] italic leading-relaxed text-slate"
            >
              {renderInline(line.replace(/^>\s?/, ""))}
            </blockquote>
          );
        if (line.startsWith("- ") || line.startsWith("* "))
          return (
            <div key={i} className="flex gap-2 text-[13px] leading-relaxed text-slate">
              <span className="text-mint">•</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        return (
          <p key={i} className="text-[13px] leading-relaxed text-slate">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

function Field({ label, text }: { label: string; text?: string }) {
  if (!text) return null;
  return (
    <div className="rounded-xl border border-line/70 bg-white/[0.02] p-3.5">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ghost">
        {label}
      </div>
      <p className="text-[13.5px] leading-relaxed text-slate">{renderInline(text)}</p>
    </div>
  );
}

export function DetailModal({
  selection,
  onClose,
}: {
  selection: Selection | null;
  onClose: () => void;
}) {
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setNote(null);
    if (selection?.type !== "niche") return;
    let alive = true;
    setLoading(true);
    api
      .note("niche", selection.niche.slug)
      .then((d) => alive && setNote(d))
      .catch(() => alive && setNote(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [selection]);

  return (
    <AnimatePresence>
      {selection && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative my-auto w-full max-w-2xl rounded-2xl border border-line bg-card shadow-glow"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full border border-line bg-card/80 font-mono text-sm text-slate transition-colors hover:border-slate/60 hover:text-ghost"
              aria-label="Kapat"
            >
              ✕
            </button>
            <div className="max-h-[85vh] overflow-y-auto p-6 sm:p-7">
              {selection.type === "opportunity"
                ? <OppBody opp={selection.opp} />
                : <NicheBody niche={selection.niche} note={note} loading={loading} />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OppBody({ opp }: { opp: Opportunity }) {
  const tone = oppTone(opp.score);
  const conf = opp.confidence ? CONFIDENCE[opp.confidence] : null;
  return (
    <>
      <div className="mb-5 flex items-start gap-4 pr-8">
        <ScoreRing total={opp.score ?? 0} max={opp.score_max} tone={tone} size={64} />
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            {opp.opportunity_type && (
              <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-slate">
                {OPP_TYPE_LABEL[opp.opportunity_type] ?? opp.opportunity_type}
              </span>
            )}
            {conf && <Badge tone={conf.tone}>{conf.label}</Badge>}
          </div>
          <h2 className="text-lg font-bold leading-snug text-white">{opp.title}</h2>
          {opp.cluster && (
            <p className="mt-1 font-mono text-[11px] text-slate">küme: {opp.cluster}</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2.5">
        <Field label="Neden şimdi" text={opp.why_now} />
        <Field label="Kime (ICP)" text={opp.icp} />
        <Field label="Kama (wedge)" text={opp.wedge} />
        <Field label="≤7 günde ilk çıktı (MVP)" text={opp.first_output} />
        <Field label="🇹🇷 Türkiye açısı" text={opp.tr_angle} />
        <Field label="Para kazanma" text={opp.monetization} />
        <Field label="Risk" text={opp.risk} />
      </div>
      {opp.sources?.length > 0 && (
        <div className="mt-4 border-t border-line/70 pt-3">
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ghost">
            Kaynaklar
          </div>
          <div className="flex flex-col gap-1">
            {opp.sources.map((s, i) => (
              <a
                key={i}
                href={s}
                target="_blank"
                rel="noreferrer"
                className="truncate font-mono text-[11px] text-mint/80 hover:text-mint"
              >
                {s}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function NicheBody({
  niche,
  note,
  loading,
}: {
  niche: Niche;
  note: NoteDetail | null;
  loading: boolean;
}) {
  const st = NICHE_STATUS[niche.status] ?? NICHE_STATUS.aday;
  return (
    <>
      <div className="mb-5 flex items-start gap-4 pr-8">
        <ScoreRing total={niche.total} tone={st.tone} size={64} />
        <div className="min-w-0">
          <div className="mb-1.5">
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
          <h2 className="text-lg font-bold leading-snug text-white">
            {note?.title ?? niche.title}
          </h2>
        </div>
      </div>
      {loading && (
        <p className="font-mono text-xs text-slate">Obsidian notu yükleniyor…</p>
      )}
      {!loading && !note && (
        <p className="font-mono text-xs text-slate">
          Detaylı not bulunamadı. Özet: {niche.summary ?? "—"}
        </p>
      )}
      {note && (
        <div className="flex flex-col gap-4">
          {note.sections.map((s, i) => (
            <div key={i}>
              {s.heading && (
                <h3 className={`mb-1.5 text-sm font-semibold ${toneText.go}`}>
                  {s.heading}
                </h3>
              )}
              <Markdownish lines={s.lines} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
