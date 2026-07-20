// SANDBOX ONLY — signpost specimen variants. Delete with the route before the PR.
//
// Every variant is token-only colour (no literal hex) so the theme toggle proves
// it flips. The live ModeBandBlock does NOT satisfy that: its MODE_STYLE map
// hardcodes "#4a8fff" / "#c8963e" / "#8fe3a0" and .mode-band carries an
// rgba(255,255,255,0.012) wash, so today's band cannot re-theme. A0 below
// reproduces the live look faithfully (hardcoded values included) as the
// baseline; A1+ are the token-clean candidates.

import type { CSSProperties } from "react";

// ── mode vocabulary ───────────────────────────────────────────────────
// orient = read, do = hands on, check = verify. The check channel is the
// "Prove it" family.
export type Mode = "orient" | "do" | "check";

export const MODE_VAR: Record<Mode, string> = {
  orient: "var(--color-signal-blue)",
  do: "var(--color-command-gold)",
  check: "var(--color-status-green)",
};

export const MODE_TEXT: Record<Mode, string> = {
  orient: "text-signal-blue",
  do: "text-command-gold",
  check: "text-status-green",
};

export function ModeIcon({ mode, className = "h-3.5 w-3.5 shrink-0" }: { mode: Mode; className?: string }) {
  const p = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (mode === "orient")
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    );
  if (mode === "check")
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="8" />
        <path d="m8.5 12 2.4 2.4 4.6-5.2" />
      </svg>
    );
  return (
    <svg {...p} fill="currentColor" stroke="none">
      <path d="M8 5.5v13l10.5-6.5z" />
    </svg>
  );
}

// Minimal inline renderer for the specimens: **bold** and [[term]] only, so the
// real lesson copy reads correctly without pulling the glossary island in.
export function T({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\[[^\]]+\]\])/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return (
            <strong key={i} className="font-semibold text-text">
              {p.slice(2, -2)}
            </strong>
          );
        if (p.startsWith("[[") && p.endsWith("]]"))
          return (
            <span key={i} className="border-b border-dotted border-command-gold/60 text-command-gold">
              {p.slice(2, -2)}
            </span>
          );
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

const BODY = "font-serif text-[15px] leading-relaxed text-muted";

export interface BandProps {
  mode: Mode;
  /** Where the learner's hands are: "in KiCad", "at the bench", "in your browser". Empty for orient/check. */
  venue?: string;
  title: string;
  body: string;
  /** Sequence position within the stage, for the variants that number bands. */
  ord?: number;
}

// ══ ROUND A — the mode band (orient / do / "Prove it") ═════════════════

// A0 · LIVE BASELINE. Reproduces ModeBandBlock + .mode-band exactly, including
// the venue leaking into the Bebas title (the parser puts parts.slice(2) there)
// and the hardcoded hexes. This is what ships today.
export function A0({ mode, venue, title, body }: BandProps) {
  const hex = { orient: "#4a8fff", do: "#c8963e", check: "#8fe3a0" }[mode];
  return (
    <div className="mode-band" style={{ "--mode": hex } as CSSProperties}>
      <span className={`flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] ${MODE_TEXT[mode]}`}>
        <ModeIcon mode={mode} />
        {mode}
      </span>
      <h2 className="mt-1.5 font-display text-2xl leading-none tracking-wide text-title">
        {venue ? `${venue} · ${title}` : title}
      </h2>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </div>
  );
}

// A1 · MASTHEAD RULE. No box at all: a 2px mode-coloured top rule (the sanctioned
// "gold top-rule masthead"), eyebrow left, venue as a mono chip pinned right.
export function A1({ mode, venue, title, body }: BandProps) {
  return (
    <section className="pt-3" style={{ borderTop: `2px solid ${MODE_VAR[mode]}` }}>
      <div className="flex items-center gap-3">
        <span className={`flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] ${MODE_TEXT[mode]}`}>
          <ModeIcon mode={mode} />
          {mode}
        </span>
        <span aria-hidden className="h-px flex-1" style={{ background: `color-mix(in srgb, ${MODE_VAR[mode]} 25%, transparent)` }} />
        {venue ? (
          <span className="shrink-0 border border-panel-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
            {venue}
          </span>
        ) : null}
      </div>
      <h2 className="mt-2 font-display text-3xl leading-none tracking-wide text-title">{title}</h2>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// A2 · BRACKET RULES. Top + bottom hairlines in the mode colour close the band
// as a document section; nothing is filled.
export function A2({ mode, venue, title, body }: BandProps) {
  const rule = { borderColor: `color-mix(in srgb, ${MODE_VAR[mode]} 45%, transparent)` };
  return (
    <section className="border-y py-4" style={rule}>
      <span className={`flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] ${MODE_TEXT[mode]}`}>
        <ModeIcon mode={mode} />
        {mode}
        {venue ? <span className="text-muted">· {venue}</span> : null}
      </span>
      <h2 className="mt-2 font-display text-3xl leading-none tracking-wide text-title">{title}</h2>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// A3 · SPINE ONLY. Keeps the live left spine, drops the box, the glow and the
// white wash — the instrument-on-the-field reading of the same idea.
export function A3({ mode, venue, title, body }: BandProps) {
  return (
    <section className="border-l-2 pl-4" style={{ borderColor: MODE_VAR[mode] }}>
      <span className={`flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] ${MODE_TEXT[mode]}`}>
        <ModeIcon mode={mode} />
        {mode}
        {venue ? <span className="text-muted">· {venue}</span> : null}
      </span>
      <h2 className="mt-1.5 font-display text-3xl leading-none tracking-wide text-title">{title}</h2>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// A4 · REGISTRATION SLATE. A hairline frame in the mode colour (no fill) with a
// square mode badge at the right — the mono registration-tag look.
export function A4({ mode, venue, title, body }: BandProps) {
  return (
    <section
      className="border px-4 py-3.5"
      style={{ borderColor: `color-mix(in srgb, ${MODE_VAR[mode]} 35%, transparent)`, borderRadius: "6px" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className={`flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] ${MODE_TEXT[mode]}`}>
            <ModeIcon mode={mode} />
            {venue ?? "this stage"}
          </span>
          <h2 className="mt-1.5 font-display text-3xl leading-none tracking-wide text-title">{title}</h2>
        </div>
        <span
          className={`shrink-0 border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] ${MODE_TEXT[mode]}`}
          style={{ borderColor: `color-mix(in srgb, ${MODE_VAR[mode]} 50%, transparent)` }}
        >
          {mode}
        </span>
      </div>
      <p className={`mt-2.5 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// A5 · NUMBERED INSTRUMENT. A Saira ordinal makes the bands a countable spine
// ("you are on band 3 of 6 in this stage"), tying them to the section numbers.
export function A5({ mode, venue, title, body, ord = 1 }: BandProps) {
  return (
    <section className="border-t pt-3.5" style={{ borderColor: `color-mix(in srgb, ${MODE_VAR[mode]} 40%, transparent)` }}>
      <div className="flex items-baseline gap-4">
        <span className={`font-numeral text-4xl leading-none tabular-nums ${MODE_TEXT[mode]}`}>
          {String(ord).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <span className={`flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] ${MODE_TEXT[mode]}`}>
            <ModeIcon mode={mode} />
            {mode}
            {venue ? <span className="text-muted">· {venue}</span> : null}
          </span>
          <h2 className="mt-1 font-display text-2xl leading-none tracking-wide text-title">{title}</h2>
        </div>
      </div>
      <p className={`mt-2.5 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// A6 · MINIMAL CHANGE. The live band, decontaminated: token colours, no white
// wash, and the venue pulled OUT of the Bebas title into the eyebrow (the fix
// the code comment already intended). Lowest-risk option.
export function A6({ mode, venue, title, body }: BandProps) {
  return (
    <div
      className="relative overflow-hidden py-3.5 pl-5 pr-4"
      style={{
        borderRadius: "0.55rem",
        border: `1px solid color-mix(in srgb, ${MODE_VAR[mode]} 26%, transparent)`,
        background: `radial-gradient(130% 150% at 0% 0%, color-mix(in srgb, ${MODE_VAR[mode]} 13%, transparent), transparent 52%)`,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: `linear-gradient(to bottom, ${MODE_VAR[mode]}, color-mix(in srgb, ${MODE_VAR[mode]} 15%, transparent))` }}
      />
      <span className={`flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] ${MODE_TEXT[mode]}`}>
        <ModeIcon mode={mode} />
        {mode}
        {venue ? <span className="text-muted">· {venue}</span> : null}
      </span>
      <h2 className="mt-1.5 font-display text-2xl leading-none tracking-wide text-title">{title}</h2>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </div>
  );
}

// ══ ROUND B — the Do ladder (big band vs small kicker) ════════════════
// Each variant renders the SAME real sequence so the two tiers are judged in
// relation: band → section header → small Do → steps.

export interface DoProps {
  title: string;
  body: string;
  steps: string[];
  n?: number;
}

// B0 · LIVE BASELINE — ActionCalloutBlock. Note it renders `label.split("·").pop()`,
// so a three-part label silently loses its middle ("Draw it · do one with me ·
// the USB differential pair" ships as just "the USB differential pair").
export function B0({ title, body, steps }: DoProps) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-command-gold">
          Do · {title}
        </span>
        <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-command-gold/30 to-transparent" />
      </div>
      <p className={`mt-1.5 ${BODY}`}>
        <T text={body} />
      </p>
      <ol className="ml-6 mt-2 list-decimal space-y-1 font-serif text-[15px] leading-relaxed text-muted">
        {steps.map((s, i) => (
          <li key={i}>
            <T text={s} />
          </li>
        ))}
      </ol>
    </div>
  );
}

// B1 · GUTTER COLUMN. A do-block becomes a visible column: gold left gutter rule
// + hanging mono label, so "hands on the keyboard" is spatially obvious and a
// scanning learner can find every Do without reading.
export function B1({ title, body, steps }: DoProps) {
  return (
    <div className="border-l-2 border-command-gold/70 pl-4">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-command-gold">Do · {title}</span>
      <p className={`mt-1.5 ${BODY}`}>
        <T text={body} />
      </p>
      <ol className="ml-5 mt-2 list-decimal space-y-1 font-serif text-[15px] leading-relaxed text-muted">
        {steps.map((s, i) => (
          <li key={i}>
            <T text={s} />
          </li>
        ))}
      </ol>
    </div>
  );
}

// B2 · NUMBERED DO. A Saira step ordinal counts the Dos within the band, so the
// small Do inherits the band's authority instead of competing with it.
export function B2({ title, body, steps, n = 1 }: DoProps) {
  return (
    <div className="flex gap-4">
      <span className="mt-0.5 shrink-0 font-numeral text-2xl leading-none tabular-nums text-command-gold">
        {String(n).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-command-gold">Do · {title}</span>
        <p className={`mt-1.5 ${BODY}`}>
          <T text={body} />
        </p>
        <ol className="ml-5 mt-2 list-decimal space-y-1 font-serif text-[15px] leading-relaxed text-muted">
          {steps.map((s, i) => (
            <li key={i}>
              <T text={s} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// B3 · ONE COMPONENT, TWO WEIGHTS. The small Do is literally the band's language
// at a smaller scale (same icon, same eyebrow grammar, Bebas title one rung
// down) so band and kicker are visibly the same object, not two inventions.
export function B3({ title, body, steps }: DoProps) {
  return (
    <div className="border-l-2 border-command-gold/50 pl-4">
      <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-command-gold">
        <ModeIcon mode="do" className="h-3 w-3 shrink-0" />
        do
      </span>
      <h3 className="mt-1 font-display text-xl leading-none tracking-wide text-title">{title}</h3>
      <p className={`mt-1.5 ${BODY}`}>
        <T text={body} />
      </p>
      <ol className="ml-5 mt-2 list-decimal space-y-1 font-serif text-[15px] leading-relaxed text-muted">
        {steps.map((s, i) => (
          <li key={i}>
            <T text={s} />
          </li>
        ))}
      </ol>
    </div>
  );
}

// B4 · TICKABLE DO. The steps become a do-list with square registration boxes —
// the same "tick what you own" language as The Bench, applied to actions.
export function B4({ title, body, steps }: DoProps) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-command-gold">
          Do · {title}
        </span>
        <span aria-hidden className="h-px flex-1 bg-command-gold/25" />
      </div>
      <p className={`mt-1.5 ${BODY}`}>
        <T text={body} />
      </p>
      <ul className="mt-2.5 space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span aria-hidden className="mt-[5px] h-3 w-3 shrink-0 border border-command-gold/60" />
            <span className="font-serif text-[15px] leading-relaxed text-muted">
              <T text={s} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ══ ROUND C — Gotcha ══════════════════════════════════════════════════
// Today: 4 bare `Gotcha` warn boxes (all in SCHEMATIC), plus ~6 unnamed warn
// callouts doing the same job under a headline. Every variant takes a headline,
// because a Gotcha with no headline can't be scanned.

export interface GotchaProps {
  headline: string;
  body: string;
}

// C0 · LIVE BASELINE — the generic .callout warn box with a bare "Gotcha" label.
export function C0({ body }: GotchaProps) {
  return (
    <div className="callout warn">
      <span className="callout-label">Gotcha</span>
      <p className="font-serif">
        <T text={body} />
      </p>
    </div>
  );
}

// C1 · NAMED WARN BOX. Minimal change: keep the box, make the label carry the
// headline so it scans. Matches the shape the un-named warn callouts already use.
export function C1({ headline, body }: GotchaProps) {
  return (
    <div className="callout warn">
      <span className="callout-label">Gotcha · {headline}</span>
      <p className="font-serif">
        <T text={body} />
      </p>
    </div>
  );
}

// C2 · HAZARD SPINE. Box removed, gold spine kept, headline set in Lora bold as
// the thing you actually read. Matches the hairline-not-card law.
export function C2({ headline, body }: GotchaProps) {
  return (
    <section className="border-l-2 border-command-gold pl-4">
      <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-command-gold">
        <HazardGlyph />
        Gotcha
      </span>
      <p className="mt-1 font-serif text-base font-semibold leading-snug text-title">{headline}</p>
      <p className={`mt-1.5 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// C3 · TAGGED RULE. A square mono tag sitting on a gold hairline; the headline
// runs inline with the tag so the whole thing is one scannable line.
export function C3({ headline, body }: GotchaProps) {
  return (
    <section>
      <div className="flex items-center gap-3 border-b border-command-gold/40 pb-1.5">
        <span className="shrink-0 border border-command-gold/60 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-command-gold">
          Gotcha
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-title">{headline}</span>
      </div>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// C4 · CONSEQUENCE LEDGER. Splits the gotcha into the trap and what it costs —
// the two things a learner needs and the current bare box never separates.
export function C4({ headline, body }: GotchaProps) {
  const cut = body.indexOf(". ");
  const trap = cut > 0 ? body.slice(0, cut + 1) : body;
  const cost = cut > 0 ? body.slice(cut + 2) : "";
  return (
    <section className="border-l-2 border-command-gold pl-4">
      <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-command-gold">
        <HazardGlyph />
        Gotcha · {headline}
      </span>
      <p className={`mt-1.5 ${BODY}`}>
        <T text={trap} />
      </p>
      {cost ? (
        <p className="mt-2 flex gap-2.5 font-serif text-[15px] leading-relaxed text-muted">
          <span aria-hidden className="mt-0.5 shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
            then
          </span>
          <span>
            <T text={cost} />
          </span>
        </p>
      ) : null}
    </section>
  );
}

function HazardGlyph() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3.5 22 20H2z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ══ ROUND D — the verify family ("Prove it") ══════════════════════════
// The SCHEMATIC orient band literally teaches the vocabulary: "**Do ·** = do it
// in KiCad, **Check** = a quick gut-check, **Eyeball it** = verify by eye."
// Today only Do and Check have components; "Eyeball it" falls through to the
// generic grey box. Each variant renders the whole Prove-it block at once.

export interface EyeballProps {
  headline: string;
  body: string;
  /** The numbered things to trace by eye, split out of the body prose. */
  items: string[];
}

// D0 · LIVE BASELINE — generic warn box, numbered items buried in the paragraph.
export function D0({ headline, body }: EyeballProps) {
  return (
    <div className="callout warn">
      <span className="callout-label">Eyeball it · {headline}</span>
      <p className="font-serif">
        <T text={body} />
      </p>
    </div>
  );
}

// D1 · GREEN CHANNEL SPINE. Eyeball it joins the check/Prove-it colour channel
// (status-green) instead of borrowing warn-gold, so verify reads as one family.
export function D1({ headline, body, items }: EyeballProps) {
  return (
    <section className="border-l-2 border-status-green pl-4">
      <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-status-green">
        <EyeGlyph />
        Eyeball it · {headline}
      </span>
      <p className={`mt-1.5 ${BODY}`}>
        <T text={body} />
      </p>
      <ol className="ml-5 mt-2 list-decimal space-y-1 font-serif text-[15px] leading-relaxed text-muted">
        {items.map((s, i) => (
          <li key={i}>
            <T text={s} />
          </li>
        ))}
      </ol>
    </section>
  );
}

// D2 · TRACE CHECKLIST. The items become tickable trace targets — an instrument,
// not prose. Matches how the stage gate actually asks the learner to attest.
export function D2({ headline, body, items }: EyeballProps) {
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-status-green">
          <EyeGlyph />
          Eyeball it
        </span>
        <span aria-hidden className="h-px flex-1 bg-status-green/25" />
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
          <span className="font-numeral tabular-nums">{items.length}</span> to trace
        </span>
      </div>
      <p className="mt-1.5 font-serif text-base font-semibold leading-snug text-title">{headline}</p>
      <p className={`mt-1.5 ${BODY}`}>
        <T text={body} />
      </p>
      <ul className="mt-3 border-t border-panel-border/60">
        {items.map((s, i) => (
          <li key={i} className="flex gap-3 border-b border-panel-border/60 py-2.5">
            <span aria-hidden className="mt-[5px] h-3 w-3 shrink-0 border border-status-green/70" />
            <span className="font-serif text-[15px] leading-relaxed text-muted">
              <T text={s} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// D3 · ANSWER-KEY COLUMNS. Each trace target states what you should SEE and what
// it means if you don't — the failure mode the current paragraph hides.
export function D3({ headline, items }: EyeballProps) {
  return (
    <section className="border-t border-status-green/40 pt-3">
      <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-status-green">
        <EyeGlyph />
        Eyeball it · {headline}
      </span>
      <ul className="mt-3 border-t border-panel-border/60">
        {items.map((s, i) => (
          <li key={i} className="grid grid-cols-[auto_1fr] gap-x-3 border-b border-panel-border/60 py-2.5">
            <span className="font-numeral text-lg leading-none tabular-nums text-status-green">{i + 1}</span>
            <span className="font-serif text-[15px] leading-relaxed text-muted">
              <T text={s} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EyeGlyph() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

// ══ ROUND E — the aside family (Setup · / keys / Alternative · / Route it ·) ══
// Four different labels doing three different jobs, all rendering as the same
// grey box today. The `Verb ·` prefix is a real convention applied ~half the time.

export interface AsideProps {
  verb: string;
  headline: string;
  body: string;
}

// E0 · LIVE BASELINE — generic info box; the verb is just text in the label.
export function E0({ verb, headline, body }: AsideProps) {
  return (
    <div className="callout info">
      <span className="callout-label">
        {verb} · {headline}
      </span>
      <p className="font-serif">
        <T text={body} />
      </p>
    </div>
  );
}

// E1 · MARGIN NOTE. The verb becomes a real margin label in its own column, so
// an aside is visibly subordinate to the spine instead of a same-weight box.
export function E1({ verb, headline, body }: AsideProps) {
  return (
    <section className="grid gap-x-5 gap-y-1 border-l border-panel-border pl-4 sm:grid-cols-[7rem_1fr] sm:border-l-0 sm:pl-0">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted sm:pt-0.5 sm:text-right">
        {verb}
      </span>
      <div>
        <p className="font-serif text-base font-semibold leading-snug text-title">{headline}</p>
        <p className={`mt-1 ${BODY}`}>
          <T text={body} />
        </p>
      </div>
    </section>
  );
}

// E2 · QUIET RULE. A hairline above, verb + headline on one mono line, body
// beneath — the lowest-authority signpost in the system, which is the point.
export function E2({ verb, headline, body }: AsideProps) {
  return (
    <section className="border-t border-panel-border/60 pt-2.5">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
        {verb} <span className="text-title">· {headline}</span>
      </p>
      <p className={`mt-1.5 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// ══ ROUND F — section header carrying severity ════════════════════════
// LAYOUT 02 and 04 are authored `warn`, ASSEMBLY 01 is `critical`, and
// SectionHeaderBlock throws all three away. The author's flag never renders.

export interface SectionProps {
  num: string;
  title: string;
  body: string;
  severity: "info" | "warn" | "critical";
}

// F0 · LIVE BASELINE — severity ignored entirely.
export function F0({ num, title, body }: SectionProps) {
  return (
    <div className="border-t border-panel-border/60 pt-5">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-sm font-bold tabular-nums text-command-gold">{num}</span>
        <h3 className="font-mono text-sm font-bold uppercase tracking-[0.12em] text-title">{title}</h3>
      </div>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </div>
  );
}

const SEV_TEXT = { info: "text-command-gold", warn: "text-command-gold", critical: "text-alert-red" } as const;
const SEV_VAR = {
  info: "var(--color-panel-border)",
  warn: "var(--color-command-gold)",
  critical: "var(--color-alert-red)",
} as const;
const SEV_TAG = { info: null, warn: "read first", critical: "safety" } as const;

// F1 · SEVERITY RULE. The section's own top hairline takes the severity colour;
// nothing else changes. Quietest possible expression of the flag.
export function F1({ num, title, body, severity }: SectionProps) {
  return (
    <div className="pt-5" style={{ borderTop: `1px solid ${SEV_VAR[severity]}` }}>
      <div className="flex items-baseline gap-3">
        <span className={`font-mono text-sm font-bold tabular-nums ${SEV_TEXT[severity]}`}>{num}</span>
        <h3 className="font-mono text-sm font-bold uppercase tracking-[0.12em] text-title">{title}</h3>
      </div>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </div>
  );
}

// F2 · SEVERITY TAG. A square mono badge names WHY the section is flagged, so
// the flag carries meaning rather than just colour.
export function F2({ num, title, body, severity }: SectionProps) {
  const tag = SEV_TAG[severity];
  return (
    <div className="border-t border-panel-border/60 pt-5">
      <div className="flex items-baseline gap-3">
        <span className={`font-mono text-sm font-bold tabular-nums ${SEV_TEXT[severity]}`}>{num}</span>
        <h3 className="font-mono text-sm font-bold uppercase tracking-[0.12em] text-title">{title}</h3>
        {tag ? (
          <span
            className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] ${SEV_TEXT[severity]}`}
            style={{ borderColor: `color-mix(in srgb, ${SEV_VAR[severity]} 55%, transparent)` }}
          >
            {tag}
          </span>
        ) : null}
      </div>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </div>
  );
}

// F3 · FLAGGED SPINE. A flagged section gets a severity-coloured left spine for
// its whole run, so the flag scopes the SECTION, not just its heading row.
export function F3({ num, title, body, severity }: SectionProps) {
  const flagged = severity !== "info";
  return (
    <div
      className={flagged ? "border-l-2 pl-4" : "border-t border-panel-border/60 pt-5"}
      style={flagged ? { borderColor: SEV_VAR[severity] } : undefined}
    >
      <div className="flex items-baseline gap-3">
        <span className={`font-mono text-sm font-bold tabular-nums ${SEV_TEXT[severity]}`}>{num}</span>
        <h3 className="font-mono text-sm font-bold uppercase tracking-[0.12em] text-title">{title}</h3>
      </div>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </div>
  );
}
