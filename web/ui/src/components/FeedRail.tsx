import { AnimatePresence, motion } from "framer-motion";
import type { FeedItem } from "../api";
import { SOURCE_LABEL, timeAgo } from "../lib";

export function FeedRail({ items }: { items: FeedItem[] }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-panel/60 shadow-soft">
      <div className="flex items-center gap-2 border-b border-line/70 px-4 py-3">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-mint opacity-60 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-mint" />
        </span>
        <span className="font-mono text-[11px] font-semibold tracking-[0.18em] text-ghost">
          CANLI AKIŞ
        </span>
        <span className="ml-auto font-mono text-[10px] text-slate">
          son toplananlar
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        <AnimatePresence initial={false}>
          {items.map((it) => (
            <motion.a
              key={`${it.source}-${it.collected_at}-${it.title}`}
              href={it.url ?? undefined}
              target="_blank"
              rel="noreferrer"
              layout
              initial={{ opacity: 0, x: -12, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="block rounded-lg px-2.5 py-2 transition-colors hover:bg-white/[0.03]"
            >
              <div className="mb-0.5 flex items-center gap-2">
                <span className="rounded border border-line px-1.5 py-px font-mono text-[9px] uppercase tracking-wide text-slate">
                  {SOURCE_LABEL[it.source] ?? it.source}
                </span>
                {typeof it.signal_score === "number" && (
                  <span className="font-mono text-[10px] text-mint/80">
                    ◆ {it.signal_score}
                  </span>
                )}
                <span className="ml-auto font-mono text-[9px] text-slate">
                  {timeAgo(it.collected_at)}
                </span>
              </div>
              <p className="line-clamp-2 text-[12px] leading-snug text-ghost/90">
                {it.title ?? "(başlıksız)"}
              </p>
            </motion.a>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
