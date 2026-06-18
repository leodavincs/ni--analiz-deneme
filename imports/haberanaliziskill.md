---
name: niche-hunter
description: Turn a daily batch of collected tech/startup news into decision-grade, de-duplicated business-opportunity intelligence for a solo content/automation/AI operator. Use this skill WHENEVER the analysis stage of the news pipeline runs — when raw feed items (TechCrunch, The Verge, HN, VentureBeat AI, Product Hunt, Rest of World, Google News RSS, etc.) must become scored opportunities, trend clusters, or Obsidian opportunity notes. Trigger it even if the user just says "analyze today's batch", "what's worth building", "niş çıkar", "fırsat analizi", or pipes items into the analysis step. This is a STATEFUL daily job: always reconcile against prior days' notes so the same trend is not re-emitted. Do NOT summarize the news — extract actionable wedges, not a newsletter.
---

# Niche Hunter — Opportunity Analysis Layer

The *brain* of the pipeline, not the plumbing. Collection (collectors/, store.py), storage, and
Obsidian output already exist. Your job is the reasoning step between a raw batch and a useful,
non-duplicated opportunity note. Summarizing news is the failure mode — output must help the operator
decide **what to build, make content about, or arbitrage next.**

This runs **every day on overlapping news**, so the hardest job is not finding signal — it is *not
re-saying yesterday's signal*. Statefulness (Step 0 + Step 4) is the difference between a useful
system and a duplicate-spam generator. Treat it as load-bearing.

## Operator profile  ← EDIT THIS BLOCK as the situation changes; it drives every judgment

The analysis is FOR one specific person, not a generic VC. Currently:

- **Solo operator**, portfolio mindset, ships fast, no team yet, limited capital, time is the scarce input.
- Unfair advantages: (1) content production (YouTube gardening channel, X/Twitter, short-form),
  (2) automation / n8n / API glue, (3) hands-on AI tooling (Claude Code, local LLMs, image/video gen),
  (4) **Turkish-market arbitrage** — can localize a Western trend into TR before competitors exist.
- Prefers things shippable in **days-to-weeks**, monetizable via content, SaaS, affiliate, or service.

An opportunity only counts if THIS operator can plausibly act on it. A $2B robotics raise is noise; a
localizable AI-tool wedge or a content angle riding a fresh trend is signal. Keep this block current —
it is the single highest-leverage thing to maintain.

## Input

A batch of items from the store: title, source, url, published_at, summary/body. RSS bodies are often
truncated — reason from title + summary + source reputation; **never invent funding numbers, dates, or
quotes not present in the item.** Flag thin evidence rather than papering over it (see confidence).

## Model tiering (cost control — this runs daily)

- **Step 1 triage** → cheap/fast tier (Haiku/Sonnet). High volume, low reasoning.
- **Steps 2–4 reasoning + briefs** → strong tier (Opus) on the ~5–10 survivors only.
- Never run the expensive tier over all 50 raw items. Triage first, reason on the shortlist.

## Workflow — six steps, in order. Do not skip to the brief.

### Step 0 — Load prior state (do this FIRST)

Read the last ~14 days of opportunity notes and the current watch list from the vault
(`opportunities/` and the latest `daily/*-index.md`). Build an index of existing `opportunity_id`s,
their scores, and how many days each watch-list item has recurred. Everything downstream reconciles
against this. If no prior state exists (first run), note that and proceed.

### Step 1 — Signal extraction (cheap tier, per item)

Classify each item; drop pure noise here:

- **signal_type**: `funding` | `launch` | `regulation` | `behavior_shift` | `tech_capability` |
  `failure/teardown` | `meta_trend` | `noise`
- **what_changed**: one concrete line — "X now possible / cheaper / legal / popular."
- **underlying_pain**: the human/business problem (the pain, not the product).
- **who_feels_it**: the segment (SMB owners, creators, devs, parents, TR consumers…).

Discard `noise` immediately (PR fluff, version bumps, funding-only with no capability/behavior change).
Be ruthless — 50 items usually yield 5–10 real signals.

### Step 2 — Trend clustering (with cross-day accumulation)

Group surviving signals into clusters. A cluster is **heating up** when it shows 2+ of:
- repeated across multiple *independent* sources in this batch;
- **recurs across prior days** (from Step 0) — this is the strongest heat signal and only state can see it;
- funding **and** a shipped capability (not one alone);
- a behavior shift confirmed by a non-tech source (Rest of World, mainstream press).

Rank clusters by heat, not by how interesting they sound. Explicitly separate **durable trend** from
**news-cycle spike** — one viral launch is not a trend; the same theme on day 3 with growing evidence is.

### Step 3 — Score each promising cluster (anchored, with confidence)

Score 1–5 per axis using the anchors, then weight. Anchors exist to kill run-to-run variance — use them.

| Axis | W | 1 | 3 | 5 |
|---|---|---|---|---|
| Demand signal | ×3 | speculative, appears once | repeated pain, one source | named pain, repeated across sources |
| Operator fit | ×3 | needs team/capital/hardware | doable but stretches time/skill | squarely content/automation/AI, solo, days |
| TR arbitrage | ×2 | saturated in TR, or global-only | exists in TR but beatable | nothing in TR yet, clear first-mover gap |
| Time-to-first-output | ×2 | months | 2–4 weeks | days |
| Monetization | ×1 | unclear | plausible but indirect | obvious direct path |
| Competition headroom | ×1 | crowded | some players, room for an angle | early / thin |

Weighted max = 60. **Full brief only for score ≥ 38.** Below that → one-line watch item.
This gate is what stops the output from being mush — respect it.

**Confidence** (report per opportunity): `high` = multiple independent sources + concrete
capability/behavior change; `med` = single strong source or moderate inference; `low` = mostly inferred
from thin titles. If an item would pass the gate on `low` confidence, mark it **VERIFY** rather than
shipping it as settled.

**Optional verification (recommended for the top 1–2 only):** if you have web access, do one quick
check — does this already exist in TR / is the space saturated? — before committing the TR-arbitrage and
competition scores. RSS alone cannot tell you this; without a check, those two axes are estimates, so
keep confidence honest.

### Step 4 — Reconcile against prior state (the anti-duplication gate)

For each gate-passer, match it to existing `opportunity_id`s from Step 0 and pick ONE action:

- **NEW** — not seen before → create a fresh note.
- **UPDATE** — matches an existing note AND has materially new evidence → append a dated `Update:` line,
  re-score, and adjust the note. Do **not** create a second note.
- **SKIP** — matches an existing note with nothing materially new → emit nothing (just count it).
- **PROMOTE** — was on the watch list and now crosses the gate (often because evidence accumulated over
  several days) → write a full brief and tag it `promoted after N days`.

Duplicate suppression is mandatory. Re-emitting yesterday's opportunity is a bug, not a feature.

### Step 5 — Briefs + output

For each NEW / UPDATE / PROMOTE opportunity, write a tight brief — every field earns its place:

- **opportunity_id**: stable concept slug (e.g. `tr-ai-voice-dubbing-smb`), date-independent, for matching.
- **opportunity_type**: `content` | `product` | `service` | `automation` | `hybrid` — this drives the MVP.
- **Title**: the wedge in one punchy line.
- **Why now**: the specific signal(s) from this batch (cite item titles/sources) that opened the window.
- **ICP**: who it's for, one specific sentence.
- **Wedge**: the narrow first thing to build/publish — not the grand vision.
- **First output (≤7 days)**: concrete and matched to `opportunity_type` — a video/thread for `content`,
  a landing+MVP for `product`, an n8n flow for `automation`, an offer for `service`.
- **TR angle**: name the localization/arbitrage move, or state "global only".
- **Monetization**: how money eventually shows up.
- **Risk / why it might be nothing**: the honest counter-case. Always present.
- **Score + confidence**: weighted total, the two weakest axes, and confidence (+ VERIFY if applicable).

## Output format (Obsidian)

One note per opportunity at `opportunities/{opportunity_id}.md` (UPDATE edits the existing file), plus a
daily index at `daily/{batch_date}-index.md`. The existing Obsidian-output step persists what you emit;
produce it in exactly this shape.

```markdown
---
opportunity_id: tr-ai-voice-dubbing-smb
date: {{batch_date}}
type: opportunity
opportunity_type: product
score: {{weighted_total}}
confidence: high
cluster: {{cluster_name}}
status: new   # new | updated | promoted
tags: [niche-hunter, {{opportunity_type}}, {{tr|global}}]
sources: [{{urls}}]
---

# {{Title}}

**Why now** · ...
**ICP** · ...
**Wedge** · ...
**First output (≤7 days)** · ...
**TR angle** · ...
**Monetization** · ...
**Risk** · ...
**Score** · {{total}}/60 · weakest: {{axis}}, {{axis}} · confidence: {{level}}
```

Daily index note, in this order:
1. Ranked table of today's briefs: title · score · type · TR? · status · `[[wikilink]]`.
2. **Watch list** — sub-threshold one-liners, each with its recurrence count (`seen 2d`) so promotion is visible.
3. One line: `Skipped as already-covered: N` and `Discarded as noise: N` (counts only).

## Quality bar / anti-patterns

- ❌ Summarizing the news. ✅ Extracting what to *do*.
- ❌ Re-emitting a trend already covered. ✅ Reconcile in Step 4 — UPDATE or SKIP, never duplicate.
- ❌ "AI is growing fast" abstractions. ✅ "X capability shipped → Y segment can now Z → build/film W."
- ❌ Inventing numbers or fleshing out thin RSS. ✅ Reason from what's there; mark low confidence.
- ❌ 20 mediocre ideas. ✅ 3–6 gate-passers, anchored scores, risk stated.
- ❌ Recommending things he can't ship solo. ✅ Every brief is solo-actionable in days-to-weeks.
- A batch with zero gate-passers is a valid result — say so, show the watch list, stop.

## Tuning notes (keep here so calibration stays version-controlled)

- Weights, the ≥38 gate, and the 14-day lookback are starting points. After ~1 week of real batches,
  adjust if output is too sparse or too noisy.
- Promotion sensitivity: if good ideas languish on the watch list, lower the gate or raise the weight on
  cross-day recurrence in Step 2.
- When full-text fetch replaces RSS summaries, Step 1 extraction sharpens a lot and confidence rises;
  until then, lean on source reputation and title specificity.
