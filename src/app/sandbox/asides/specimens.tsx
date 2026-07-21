// SANDBOX ONLY — candidate treatments for the two callout roles the signpost
// system left unreformed. Deleted before the PR.
//
// Every option below obeys the house bans: no filled/tinted box, no gradient
// accent, restrained radius, gold primary with blue kept out of the accent slot,
// and every colour through a token so it flips under [data-theme="light"].

import type { ReactNode } from "react";

/** Stand-in for the guide's real `Inline` (glossary popovers, bold, code). */
export function T({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\[[^\]]+\]\])/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-semibold text-text">{p.slice(2, -2)}</strong>;
        if (p.startsWith("[[") && p.endsWith("]]")) {
          const t = p.slice(2, -2).split("|").pop()!;
          return <span key={i} className="border-b border-dotted border-command-gold/70 text-text">{t}</span>;
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

export interface AsideProps {
  label: string;
  body: string;
}

const BODY = "whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-muted";

// ── G0: the LIVE baseline. A tinted, full-border, 8px-radius tile. ───────────
// Ban #1 (content surfaces group with hairlines, never a filled card) and the
// blue tint puts signal-blue in the primary-accent slot on 25 blocks.
export function G0({ label, body }: AsideProps) {
  return (
    <div className="callout info">
      <span className="callout-label">{label}</span>
      <p className="whitespace-pre-wrap font-serif">
        <T text={body} />
      </p>
    </div>
  );
}

// ── G1: bracket rules. Top + bottom hairline, no side walls. ─────────────────
// The sanctioned "box-less framing" from the design skill. Reads as a held-open
// parenthesis in the page, which is what an aside IS.
export function G1({ label, body }: AsideProps) {
  return (
    <section className="my-6 border-y border-panel-border/70 py-4">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-command-gold">
        {label}
      </p>
      <p className={`mt-2 ${BODY}`}><T text={body} /></p>
    </section>
  );
}

// ── G2: gold left-accent bar. ───────────────────────────────────────────────
// Same spine vocabulary as the alert ladder and the Do block, so the whole page
// speaks one language; weight comes from the label colour, not a fill.
export function G2({ label, body }: AsideProps) {
  return (
    <section className="my-6 border-l-2 border-command-gold/50 pl-4">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-command-gold">
        {label}
      </p>
      <p className={`mt-1.5 ${BODY}`}><T text={body} /></p>
    </section>
  );
}

// ── G3: margin note. Label in the gutter, body in the column. ───────────────
// Editorial marginalia: the aside physically leaves the teaching column, so it
// cannot be mistaken for the spine. Collapses to stacked below xl (measured:
// the guide column is 848px centred, so the gutter only clears at 1232px).
export function G3({ label, body }: AsideProps) {
  return (
    <section className="my-6">
      <div className="mb-2 border-l-2 border-panel-border/70 pl-3 xl:float-left xl:-ml-48 xl:mb-0 xl:w-44 xl:border-l-0 xl:border-r xl:border-panel-border/70 xl:pl-0 xl:pr-3 xl:text-right">
        <p className="font-mono text-[10px] font-bold uppercase leading-relaxed tracking-[0.18em] text-command-gold">
          {label}
        </p>
      </div>
      <p className={BODY}><T text={body} /></p>
    </section>
  );
}

// ── G4: label in a break in the hairline. ───────────────────────────────────
// The E6d1 aside's move, widened for a 300-character body: the rule runs the
// full width and the label interrupts it, so the block reads as a seam in the
// page rather than an object on it.
export function G4({ label, body }: AsideProps) {
  return (
    <section className="my-6">
      <div className="flex items-center gap-3">
        <p className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-command-gold">
          {label}
        </p>
        <span aria-hidden className="h-px flex-1 bg-panel-border/70" />
      </div>
      <p className={`mt-2 ${BODY}`}><T text={body} /></p>
    </section>
  );
}

// ── G5: the question set in the display face. ───────────────────────────────
// Four of the seventeen are literally questions ("Lead-free or leaded?", "Power
// symbol or net label?"). Setting the question in Bebas and the answer in Lora
// turns the block into the Q-and-A it already is.
export function G5({ label, body }: AsideProps) {
  return (
    <section className="my-7">
      <h4 className="font-display text-2xl leading-none tracking-wide text-title">{label}</h4>
      <div className="mt-2 flex gap-3">
        <span aria-hidden className="mt-1 w-8 shrink-0 self-start border-t border-command-gold/60" />
        <p className={BODY}><T text={body} /></p>
      </div>
    </section>
  );
}

// ── G6: quiet indent. No rule at all. ───────────────────────────────────────
// The most restrained option: an aside should RECEDE from the teaching spine,
// and the strongest way to say "this is optional context" is to give it less
// furniture, not different furniture.
export function G6({ label, body }: AsideProps) {
  return (
    <section className="my-6 pl-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">{label}</p>
      <p className={`mt-1.5 ${BODY}`}><T text={body} /></p>
    </section>
  );
}

// ═══ "Exit this stage" — the closing handoff, one per stage ═════════════════

export interface ExitProps {
  body: string;
  /** Stage position, for the options that show progress. */
  ord: number;
  of: number;
  next: string;
}

// ── H0: the live baseline. Identical blue tile to every other aside, so the ──
// end of a 128-block card looks exactly like a mid-card footnote.
export function H0({ body }: ExitProps) {
  return (
    <div className="callout info">
      <span className="callout-label">Exit this stage</span>
      <p className="whitespace-pre-wrap font-serif"><T text={body} /></p>
    </div>
  );
}

// ── H1: gold masthead rule. A document-close, not a note. ───────────────────
export function H1({ body }: ExitProps) {
  return (
    <section className="mt-10 border-t-2 border-command-gold/70 pt-4">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-command-gold">
        ▸ Exit this stage
      </p>
      <p className={`mt-2 ${BODY}`}><T text={body} /></p>
    </section>
  );
}

// ── H2: the stage readout. The page's numeral moment. ───────────────────────
// The design skill's progress recipe verbatim: Saira tabular numerals, `·` as
// the separator, mono for the label.
export function H2({ body, ord, of, next }: ExitProps) {
  return (
    <section className="mt-10 border-t-2 border-command-gold/70 pt-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-command-gold">
          Stage
        </p>
        <p className="font-numeral text-2xl leading-none tabular-nums text-command-gold">
          {ord}
          <span className="mx-1 text-muted">/</span>
          <span className="text-muted">{of}</span>
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          · next {next}
        </p>
      </div>
      <p className={`mt-3 ${BODY}`}><T text={body} /></p>
    </section>
  );
}

// ── H3: bracket close. Rules above AND below, so the card visibly ends. ─────
export function H3({ body, next }: ExitProps) {
  return (
    <section className="mt-10 border-y border-command-gold/50 py-4">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-command-gold">
        Exit this stage
      </p>
      <p className={`mt-2 ${BODY}`}><T text={body} /></p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        Next · {next}
      </p>
    </section>
  );
}

// ── H4: display-face sign-off. The heaviest option. ─────────────────────────
// Bebas + a rule, matching how a stage card OPENS, so the card is bracketed by
// the same voice at both ends.
export function H4({ body, next }: ExitProps) {
  return (
    <section className="mt-10">
      <div className="flex items-center gap-3">
        <h4 className="shrink-0 font-display text-2xl leading-none tracking-wide text-title">
          Exit this stage
        </h4>
        <span aria-hidden className="h-px flex-1 bg-command-gold/50" />
      </div>
      <p className={`mt-2 ${BODY}`}><T text={body} /></p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
        Next · {next}
      </p>
    </section>
  );
}
