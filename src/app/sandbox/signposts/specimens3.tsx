// SANDBOX ONLY — round 3, convergence. Variations on the shortlisted options.
// Delete with the route before the PR.
//
// Two constraints carried through every variant here:
//   • Colour is never the only channel. The live band, the live callout and the
//     live section header all encode meaning in colour alone; a learner with a
//     colour-vision deficiency reads them as identical. Where a variant adds a
//     glyph, a word or an ordinal, that is the reason, not decoration.
//   • Reverse type stays SHORT and LARGE (Degani recs. 13/14). The A9 family
//     tests where the plate stops being an exception and starts being a habit.

import {
  MODE_VAR,
  MODE_TEXT,
  ModeIcon,
  T,
  type BandProps,
  type DoProps,
  type SectionProps,
} from "./specimens";
import { type LedgerProps, type TraceProps } from "./specimens2";
import { Tick, TickReveal, TickTriage } from "./interactive";

const BODY = "font-serif text-[15px] leading-relaxed text-muted";

// ══ A9 family — the reversed plate ════════════════════════════════════

// A9a · HALF PLATE. The bar shrinks to its content, so it reads as a tab on the
// field rather than a full-width band. Reverse stays, volume drops.
export function A9a({ mode, venue, title, body }: BandProps) {
  return (
    <section>
      <span
        className="inline-flex items-center gap-2 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-deep-space"
        style={{ background: MODE_VAR[mode] }}
      >
        <ModeIcon mode={mode} />
        {mode}
        {venue ? <span className="font-normal opacity-70">· {venue}</span> : null}
      </span>
      <h2 className="mt-2 font-display text-3xl leading-none tracking-wide text-title">{title}</h2>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// A9b · TITLE INSIDE THE PLATE. The title is knocked out too, which is the case
// NASA actually sanctions: short, large, sans. Loudest of the family, and the
// only one where the band cannot be skimmed past.
export function A9b({ mode, venue, title, body }: BandProps) {
  return (
    <section>
      <div className="px-3.5 py-2.5" style={{ background: MODE_VAR[mode] }}>
        <span className="flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-deep-space/80">
          <ModeIcon mode={mode} className="h-3 w-3 shrink-0" />
          {mode}
          {venue ? <span className="font-normal">· {venue}</span> : null}
        </span>
        <h2 className="mt-1 font-display text-3xl leading-none tracking-wide text-deep-space">{title}</h2>
      </div>
      <p className={`mt-2.5 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// A9c · PLATE TO RULE. Solid at the left, fading to a hairline across the
// column: a dimension line that starts at a tag. Keeps the reverse moment tiny.
export function A9c({ mode, venue, title, body }: BandProps) {
  return (
    <section>
      <div className="flex items-stretch">
        <span
          className="flex shrink-0 items-center gap-2 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-deep-space"
          style={{ background: MODE_VAR[mode] }}
        >
          <ModeIcon mode={mode} />
          {mode}
        </span>
        <span
          aria-hidden
          className="h-full flex-1 self-center"
          style={{
            height: "1px",
            background: `linear-gradient(to right, ${MODE_VAR[mode]}, transparent)`,
          }}
        />
        {venue ? (
          <span className="shrink-0 self-center pl-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
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

// A9d · REVERSE MEANS "HANDS ON". The plate is spent on DO only; orient and
// check take a plain rule. Reverse now carries information instead of being the
// house style for all three, which is the Degani exception read strictly.
export function A9d({ mode, venue, title, body }: BandProps) {
  if (mode === "do") return <A9a mode={mode} venue={venue} title={title} body={body} />;
  return (
    <section className="border-t pt-2.5" style={{ borderColor: `color-mix(in srgb, ${MODE_VAR[mode]} 50%, transparent)` }}>
      <span className={`flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] ${MODE_TEXT[mode]}`}>
        <ModeIcon mode={mode} />
        {mode}
      </span>
      <h2 className="mt-1.5 font-display text-3xl leading-none tracking-wide text-title">{title}</h2>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// ══ A12 family — the gate tag ═════════════════════════════════════════

// A12a · ONE LINE. Tag and title share the row, rule closes it. The most compact
// band in the whole sandbox: a mode change costs one line, not four.
export function A12a({ mode, venue, title }: BandProps) {
  return (
    <section className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className={`shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.2em] ${MODE_TEXT[mode]}`}>
        [ {mode} ]
      </span>
      <h2 className="font-display text-2xl leading-none tracking-wide text-title">{title}</h2>
      {venue ? <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">{venue}</span> : null}
      <span aria-hidden className="h-px flex-1" style={{ background: `color-mix(in srgb, ${MODE_VAR[mode]} 35%, transparent)` }} />
    </section>
  );
}

// A12b · TAG CARRIES THE ORDINAL. `[ DO 02 ]` makes bands countable without a
// separate numeral column, so "how much of this stage is left" is answerable.
export function A12b({ mode, venue, title, body, ord = 1 }: BandProps) {
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className={`shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.2em] ${MODE_TEXT[mode]}`}>
          [ {mode} <span className="font-numeral text-sm tabular-nums">{String(ord).padStart(2, "0")}</span> ]
        </span>
        {venue ? <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">{venue}</span> : null}
        <span aria-hidden className="h-px flex-1" style={{ background: `color-mix(in srgb, ${MODE_VAR[mode]} 40%, transparent)` }} />
      </div>
      <h2 className="mt-2 font-display text-3xl leading-none tracking-wide text-title">{title}</h2>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// A12c · REGISTRATION CORNERS. The brackets become real corner ticks around the
// mode word, matching the registration-mark motif the rest of the system uses.
export function A12c({ mode, venue, title, body }: BandProps) {
  const c = MODE_VAR[mode];
  return (
    <section>
      <div className="flex items-center gap-3">
        <span
          className={`relative shrink-0 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.24em] ${MODE_TEXT[mode]}`}
        >
          <span aria-hidden className="absolute left-0 top-0 h-2 w-2 border-l border-t" style={{ borderColor: c }} />
          <span aria-hidden className="absolute right-0 top-0 h-2 w-2 border-r border-t" style={{ borderColor: c }} />
          <span aria-hidden className="absolute bottom-0 left-0 h-2 w-2 border-b border-l" style={{ borderColor: c }} />
          <span aria-hidden className="absolute bottom-0 right-0 h-2 w-2 border-b border-r" style={{ borderColor: c }} />
          {mode}
        </span>
        {venue ? <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">{venue}</span> : null}
        <span aria-hidden className="h-px flex-1" style={{ background: `color-mix(in srgb, ${c} 35%, transparent)` }} />
      </div>
      <h2 className="mt-2.5 font-display text-3xl leading-none tracking-wide text-title">{title}</h2>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// A12d · DIMENSION LINE. Tag left, venue right, rule spanning between them. The
// rule now measures something instead of just trailing off.
export function A12d({ mode, venue, title, body }: BandProps) {
  const c = MODE_VAR[mode];
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className={`shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.2em] ${MODE_TEXT[mode]}`}>
          [ {mode} ]
        </span>
        <span aria-hidden className="relative h-px flex-1" style={{ background: `color-mix(in srgb, ${c} 40%, transparent)` }}>
          <span aria-hidden className="absolute -top-1 left-0 h-2 w-px" style={{ background: c }} />
          <span aria-hidden className="absolute -top-1 right-0 h-2 w-px" style={{ background: c }} />
        </span>
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
          {venue ?? "no tools"}
        </span>
      </div>
      <h2 className="mt-2.5 font-display text-3xl leading-none tracking-wide text-title">{title}</h2>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// ══ B9 family — the Do step that proves itself ════════════════════════

export interface ProofDoProps extends DoProps {
  proofs: string[];
}

// B9a · PROOF ON THE ROW. Right-aligned mono, so the step and its evidence sit
// on one line and the list stays as short as the plain version.
export function B9a({ title, body, steps, proofs }: ProofDoProps) {
  return (
    <div className="border-l-2 border-command-gold/70 pl-4">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-command-gold">Do · {title}</span>
      <p className={`mt-1.5 ${BODY}`}>
        <T text={body} />
      </p>
      <ul className="mt-3 border-t border-panel-border/60">
        {steps.map((s, i) => (
          <li key={i} className="grid gap-x-4 border-b border-panel-border/60 py-2.5 lg:grid-cols-[1fr_15rem]">
            <Tick>
              <T text={s} />
            </Tick>
            <span className="mt-1 pl-[26px] font-mono text-[10px] uppercase leading-relaxed tracking-[0.1em] text-gray-3 lg:mt-0 lg:pl-0 lg:text-right">
              {proofs[i]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// B9b · PROOF ON TICK. The evidence appears only after you claim the step, so it
// confirms rather than pre-empts. Ticking becomes a question with an answer.
export function B9b({ title, body, steps, proofs }: ProofDoProps) {
  return (
    <div>
      <p className={`mb-3 ${BODY}`}>
        <T text={body} />
      </p>
      <TickReveal
        tone="gold"
        revealLabel="you should see"
        label={`Do · ${title}`}
        items={steps.map((text, i) => ({ text, why: proofs[i] ?? "" }))}
      />
    </div>
  );
}

// B9c · DO THEN CONFIRM. Two boxes per step: one for the action, a smaller one
// for its proof. Makes the verify habit part of every step instead of a separate
// Eyeball it block at the end of the stage.
export function B9c({ title, body, steps, proofs }: ProofDoProps) {
  return (
    <div className="border-l-2 border-command-gold/70 pl-4">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-command-gold">Do · {title}</span>
      <p className={`mt-1.5 ${BODY}`}>
        <T text={body} />
      </p>
      <ul className="mt-3 space-y-4">
        {steps.map((s, i) => (
          <li key={i}>
            <Tick>
              <T text={s} />
            </Tick>
            <div className="mt-1.5 pl-[26px]">
              <Tick tone="green">
                <span className="text-[14px] text-gray-3">{proofs[i]}</span>
              </Tick>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// B9d · LEDGER WITH COLUMN HEADS. Names the two columns once at the top, so the
// pattern is explicit and every later Do in the lesson inherits the contract.
export function B9d({ title, body, steps, proofs }: ProofDoProps) {
  return (
    <div>
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-command-gold">Do · {title}</span>
      <p className={`mt-1.5 ${BODY}`}>
        <T text={body} />
      </p>
      <div className="mt-3.5 grid gap-x-4 border-b border-panel-border pb-1.5 lg:grid-cols-[1fr_15rem]">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">Step</span>
        <span className="hidden font-mono text-[9px] uppercase tracking-[0.2em] text-status-green lg:block lg:text-right">
          You should see
        </span>
      </div>
      <ul>
        {steps.map((s, i) => (
          <li key={i} className="grid gap-x-4 border-b border-panel-border/60 py-2.5 lg:grid-cols-[1fr_15rem]">
            <Tick>
              <T text={s} />
            </Tick>
            <span className="mt-1 pl-[26px] font-serif text-[14px] leading-relaxed text-gray-3 lg:mt-0 lg:pl-0 lg:text-right">
              {proofs[i]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ══ C9 family — the alert ladder ══════════════════════════════════════

type Rung = "note" | "caution" | "warning";

const RUNG_META: Record<Rung, { word: string; accent: string; var: string; ord: number }> = {
  note: { word: "Note", accent: "text-muted", var: "var(--color-panel-border)", ord: 1 },
  caution: { word: "Gotcha", accent: "text-command-gold", var: "var(--color-command-gold)", ord: 2 },
  warning: { word: "Warning", accent: "text-alert-red", var: "var(--color-alert-red)", ord: 3 },
};

// A distinct SHAPE per rung, so severity survives greyscale and colour-blindness:
// a dot for note, a triangle for gotcha, an octagon for warning.
function RungGlyph({ rung }: { rung: Rung }) {
  const p = {
    className: "h-3.5 w-3.5 shrink-0",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (rung === "note")
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="7.5" />
        <path d="M12 8.5v.01M12 11.5v4.5" />
      </svg>
    );
  if (rung === "warning")
    return (
      <svg {...p}>
        <path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2z" />
        <path d="M12 8v4.5" />
        <circle cx="12" cy="16.2" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    );
  return (
    <svg {...p}>
      <path d="M12 3.5 22 20H2z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export interface RungProps extends LedgerProps {
  rung: Rung;
}

// C9a · SHAPE PER RUNG. Colour is no longer the only channel; the glyph reads in
// greyscale, in print, and to a colour-blind learner.
export function C9a({ headline, trap, cost, rung }: RungProps) {
  const R = RUNG_META[rung];
  return (
    <section className="border-l-2 pl-4" style={{ borderColor: R.var }}>
      <span className={`flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] ${R.accent}`}>
        <RungGlyph rung={rung} />
        {R.word} · {headline}
      </span>
      <p className={`mt-1.5 ${BODY}`}>
        <T text={trap} />
      </p>
      <p className="mt-1.5 flex gap-2.5">
        <span aria-hidden className={`shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] ${R.accent}`}>
          then
        </span>
        <span className="font-serif text-[15px] leading-relaxed text-muted">
          <T text={cost} />
        </span>
      </p>
    </section>
  );
}

// C9b · NO BOX, EVEN FOR WARNING. Tests whether the boxed top rung is needed at
// all once the word and the shape carry the weight. Strictest reading of the
// hairline-not-card law.
export function C9b({ headline, trap, cost, rung }: RungProps) {
  const R = RUNG_META[rung];
  const weight = rung === "warning" ? "border-l-[3px]" : "border-l-2";
  return (
    <section className={`${weight} pl-4`} style={{ borderColor: R.var }}>
      <span className={`flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] ${R.accent}`}>
        <RungGlyph rung={rung} />
        {R.word}
      </span>
      <p className="mt-1 font-serif text-base font-semibold leading-snug text-title">{headline}</p>
      <p className={`mt-1.5 ${BODY}`}>
        <T text={trap} /> <T text={cost} />
      </p>
    </section>
  );
}

// C9c · ORDERED LADDER. A Saira rung index makes the three levels explicitly
// ranked, so "is this worse than the last one" has an answer.
export function C9c({ headline, trap, cost, rung }: RungProps) {
  const R = RUNG_META[rung];
  return (
    <section className="flex gap-4">
      <div className="flex shrink-0 flex-col items-center">
        <span className="font-numeral text-2xl leading-none tabular-nums" style={{ color: R.var }}>
          {R.ord}
        </span>
        <span aria-hidden className="mt-1 w-px flex-1" style={{ background: R.var }} />
      </div>
      <div className="min-w-0 flex-1">
        <span className={`flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] ${R.accent}`}>
          <RungGlyph rung={rung} />
          {R.word} · {headline}
        </span>
        <p className={`mt-1.5 ${BODY}`}>
          <T text={trap} /> <T text={cost} />
        </p>
      </div>
    </section>
  );
}

// C9d · TAG RIGHT, HEADLINE LEADS. The reading face gets the first word; the
// severity is a registration tag at the end of the rule, the way a drawing
// stamps its revision.
export function C9d({ headline, trap, cost, rung }: RungProps) {
  const R = RUNG_META[rung];
  return (
    <section>
      <div className="flex items-center gap-3 border-b pb-1.5" style={{ borderColor: `color-mix(in srgb, ${R.var} 45%, transparent)` }}>
        <span className="font-serif text-base font-semibold leading-snug text-title">{headline}</span>
        <span aria-hidden className="h-px flex-1" />
        <span
          className={`flex shrink-0 items-center gap-1.5 border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] ${R.accent}`}
          style={{ borderColor: `color-mix(in srgb, ${R.var} 60%, transparent)` }}
        >
          <RungGlyph rung={rung} />
          {R.word}
        </span>
      </div>
      <p className={`mt-2 ${BODY}`}>
        <T text={trap} /> <T text={cost} />
      </p>
    </section>
  );
}

// ══ D4 family — the trace target with an answer key ═══════════════════

// D4a · KEY ON THE ROW. Mirrors B9a exactly, so a Do row and a trace row are the
// same object in two colours. One layout to learn, not two.
export function D4a({ headline, items, proofs = [] }: TraceProps) {
  return (
    <section className="border-l-2 border-status-green pl-4">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-status-green">
        Eyeball it · {headline}
      </span>
      <ul className="mt-2.5 border-t border-panel-border/60">
        {items.map((s, i) => (
          <li key={i} className="grid gap-x-4 border-b border-panel-border/60 py-2.5 lg:grid-cols-[1fr_15rem]">
            <Tick tone="green">
              <T text={s} />
            </Tick>
            <span className="mt-1 pl-[26px] font-mono text-[10px] uppercase leading-relaxed tracking-[0.1em] text-gray-3 lg:mt-0 lg:pl-0 lg:text-right">
              {proofs[i]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// D4b · KEY PLUS FAILURE. States what right looks like AND what wrong looks
// like. The current paragraph hides the failure mode, which is the half a
// learner actually needs when the board is dead.
export function D4b({ headline, items, proofs = [], whys = [] }: TraceProps) {
  return (
    <section className="border-l-2 border-status-green pl-4">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-status-green">
        Eyeball it · {headline}
      </span>
      <ul className="mt-2.5 border-t border-panel-border/60">
        {items.map((s, i) => (
          <li key={i} className="border-b border-panel-border/60 py-2.5">
            <Tick tone="green">
              <T text={s} />
            </Tick>
            <div className="mt-1.5 space-y-1 pl-[26px]">
              <p className="flex gap-2.5">
                <span aria-hidden className="w-14 shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-status-green">
                  right
                </span>
                <span className="font-serif text-[14px] leading-relaxed text-gray-3">{proofs[i]}</span>
              </p>
              <p className="flex gap-2.5">
                <span aria-hidden className="w-14 shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-alert-red">
                  if not
                </span>
                <span className="font-serif text-[14px] leading-relaxed text-gray-3">
                  <T text={whys[i] ?? ""} />
                </span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// D4c · KEY FIRST. Inverts the row: the tick label is what you should SEE, and
// the reasoning drops to a smaller context line. A trace list is a list of
// observations, so leading with the observation is the honest ordering.
export function D4c({ headline, items, proofs = [] }: TraceProps) {
  return (
    <section className="border-l-2 border-status-green pl-4">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-status-green">
        Eyeball it · {headline}
      </span>
      <ul className="mt-2.5 border-t border-panel-border/60">
        {items.map((s, i) => (
          <li key={i} className="border-b border-panel-border/60 py-2.5">
            <Tick tone="green">
              <span className="text-text">{proofs[i]}</span>
            </Tick>
            <p className="mt-1 pl-[26px] font-serif text-[13px] leading-relaxed text-gray-3">
              <T text={s} />
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ══ D8 family — tick to reveal ════════════════════════════════════════

// D8a · REVEAL THE FAILURE. Ticking opens what goes wrong if this one is wrong,
// which is the sentence the learner will need three stages later at bring-up.
export function D8a({ headline, items, whys = [] }: TraceProps) {
  return (
    <TickReveal
      label={`Eyeball it · ${headline}`}
      revealLabel="if wrong"
      items={items.map((text, i) => ({ text, why: whys[i] ?? "" }))}
    />
  );
}

// D8b · REVEAL WHY AND FIX. Two lines: why it matters, then what to change. A
// verify step that finds a fault and gives no next move is a dead end.
export function D8b({ headline, items, whys = [], proofs = [] }: TraceProps) {
  return (
    <TickReveal
      label={`Eyeball it · ${headline}`}
      revealLabel="why"
      secondLabel="fix"
      items={items.map((text, i) => ({ text, why: whys[i] ?? "", second: proofs[i] ?? "" }))}
    />
  );
}

// D8c · TRIAGE. Two answers per target: "looks right" moves on silently, "not
// sure" opens the help. A confident learner is never slowed by an explanation
// they did not ask for, and the unsure taps are a signal worth having.
export function D8c({ headline, items, proofs = [] }: TraceProps) {
  return (
    <TickTriage
      label={`Eyeball it · ${headline}`}
      items={items.map((text, i) => ({ text, help: proofs[i] ?? "" }))}
    />
  );
}

// ══ E6 family — the glyph verb ════════════════════════════════════════

export interface AsideGlyphProps {
  verb: string;
  headline: string;
  body: string;
}

const GLYPH: Record<string, React.ReactNode> = {
  Setup: <path d="M14.5 4.5a4.5 4.5 0 0 0-6 5.9L4 15v4h4l4.6-4.5a4.5 4.5 0 0 0 5.9-6l-2.8 2.8-2.2-2.2z" />,
  Keys: (
    <>
      <rect x="2.5" y="6.5" width="19" height="11" rx="1" />
      <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 14h9" />
    </>
  ),
  Alternative: (
    <>
      <path d="M5 3v6a4 4 0 0 0 4 4h10" />
      <path d="M16 10l3 3-3 3" />
      <path d="M5 21v-4" />
    </>
  ),
};

function Glyph({ verb, className = "h-4 w-4 shrink-0" }: { verb: string; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {GLYPH[verb] ?? null}
    </svg>
  );
}

// E6a · BOXED GLYPH. The mark sits in a square hairline, the same registration
// language as the badges, so the aside family is one recognisable object.
export function E6a({ verb, headline, body }: AsideGlyphProps) {
  return (
    <section className="flex gap-3.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-panel-border text-muted">
        <Glyph verb={verb} className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
          {verb} <span className="text-title">· {headline}</span>
        </p>
        <p className={`mt-1 ${BODY}`}>
          <T text={body} />
        </p>
      </div>
    </section>
  );
}

// E6b · GLYPH ONLY. The mark replaces the verb word entirely. Tests whether the
// glyph carries the meaning on its own, which is the question worth answering
// before committing to a glyph set at all.
export function E6b({ verb, headline, body }: AsideGlyphProps) {
  return (
    <section className="flex gap-3.5">
      <Glyph verb={verb} className="mt-1 h-4 w-4 shrink-0 text-command-gold" />
      <div className="min-w-0">
        <p className="font-serif text-[15px] font-semibold leading-snug text-title">{headline}</p>
        <p className={`mt-1 ${BODY}`}>
          <T text={body} />
        </p>
      </div>
    </section>
  );
}

// E6c · GLYPH IN THE MARGIN COLUMN. Merges E1's margin note with the glyph: mark
// above the verb in a narrow right-aligned column, body in the reading column.
export function E6c({ verb, headline, body }: AsideGlyphProps) {
  return (
    <section className="grid gap-x-5 gap-y-1 border-l border-panel-border pl-4 sm:grid-cols-[6rem_1fr] sm:border-l-0 sm:pl-0">
      <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-1 sm:pt-0.5">
        <Glyph verb={verb} className="h-4 w-4 shrink-0 text-muted" />
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">{verb}</span>
      </div>
      <div>
        <p className="font-serif text-[15px] font-semibold leading-snug text-title">{headline}</p>
        <p className={`mt-1 ${BODY}`}>
          <T text={body} />
        </p>
      </div>
    </section>
  );
}

// E6d · GLYPH ON A RULE. Mark and verb ride a hairline that closes the row, the
// same section-eyebrow grammar the lesson already uses for `**References**`.
export function E6d({ verb, headline, body }: AsideGlyphProps) {
  return (
    <section>
      <div className="flex items-center gap-2.5">
        <Glyph verb={verb} className="h-3.5 w-3.5 shrink-0 text-muted" />
        <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted">{verb}</span>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-title">{headline}</span>
        <span aria-hidden className="h-px flex-1 bg-panel-border" />
      </div>
      <p className={`mt-1.5 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// ══ F4 / F7 families — the flagged section head ═══════════════════════

const SEV_VAR = {
  info: "var(--color-panel-border)",
  warn: "var(--color-command-gold)",
  critical: "var(--color-alert-red)",
} as const;
const SEV_TEXT = { info: "text-command-gold", warn: "text-command-gold", critical: "text-alert-red" } as const;
const LADDER = { info: null, warn: "Caution", critical: "Warning" } as const;
const SEV_RUNG: Record<SectionProps["severity"], Rung> = { info: "note", warn: "caution", critical: "warning" };

// F4a · WORD IN THE HEAD ROW. No extra line: number, word, title on one row.
export function F4a({ num, title, body, severity }: SectionProps) {
  const word = LADDER[severity];
  return (
    <div className="border-t border-panel-border/60 pt-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`font-mono text-sm font-bold tabular-nums ${SEV_TEXT[severity]}`}>{num}</span>
        {word ? (
          <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.22em] ${SEV_TEXT[severity]}`}>
            {word} ·
          </span>
        ) : null}
        <h3 className="font-mono text-sm font-bold uppercase tracking-[0.12em] text-title">{title}</h3>
      </div>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </div>
  );
}

// F4b · WORD AS A RIGHT-HAND TAG, with the rung shape beside it so severity is
// not colour-only. The title keeps the left edge, which is where the eye starts.
export function F4b({ num, title, body, severity }: SectionProps) {
  const word = LADDER[severity];
  return (
    <div className="border-t border-panel-border/60 pt-5">
      <div className="flex items-baseline gap-3">
        <span className={`font-mono text-sm font-bold tabular-nums ${SEV_TEXT[severity]}`}>{num}</span>
        <h3 className="font-mono text-sm font-bold uppercase tracking-[0.12em] text-title">{title}</h3>
        <span aria-hidden className="h-px flex-1 bg-panel-border/60" />
        {word ? (
          <span
            className={`flex shrink-0 items-center gap-1.5 border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] ${SEV_TEXT[severity]}`}
            style={{ borderColor: `color-mix(in srgb, ${SEV_VAR[severity]} 55%, transparent)` }}
          >
            <RungGlyph rung={SEV_RUNG[severity]} />
            {word}
          </span>
        ) : null}
      </div>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </div>
  );
}

// F4c · WORD PLUS A COLOURED TOP RULE. The flag is legible from two channels at
// once: the rule catches the eye scrolling, the word says what it means.
export function F4c({ num, title, body, severity }: SectionProps) {
  const word = LADDER[severity];
  return (
    <div className="pt-5" style={{ borderTop: `${severity === "info" ? 1 : 2}px solid ${SEV_VAR[severity]}` }}>
      {word ? (
        <p className={`mb-1.5 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] ${SEV_TEXT[severity]}`}>
          <RungGlyph rung={SEV_RUNG[severity]} />
          {word}
        </p>
      ) : null}
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

const REASON = {
  info: null,
  warn: "Do this before you route, or you will redo it",
  critical: "Safety: read before you heat anything",
} as const;

// F7a · REASON AS A SUBHEAD. The learner reads WHAT the section is, then why it
// is flagged. Puts the title first, which is what a scanner is looking for.
export function F7a({ num, title, body, severity }: SectionProps) {
  const reason = REASON[severity];
  return (
    <div className="border-t border-panel-border/60 pt-5">
      <div className="flex items-baseline gap-3">
        <span className={`font-mono text-sm font-bold tabular-nums ${SEV_TEXT[severity]}`}>{num}</span>
        <h3 className="font-mono text-sm font-bold uppercase tracking-[0.12em] text-title">{title}</h3>
      </div>
      {reason ? (
        <p className={`mt-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] ${SEV_TEXT[severity]}`}>
          <RungGlyph rung={SEV_RUNG[severity]} />
          {reason}
        </p>
      ) : null}
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </div>
  );
}

// F7b · LADDER WORD PLUS REASON. The alert vocabulary names the rung, the
// sentence says why this particular section earns it.
export function F7b({ num, title, body, severity }: SectionProps) {
  const reason = REASON[severity];
  const word = LADDER[severity];
  return (
    <div>
      {reason ? (
        <p
          className={`flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-2 font-mono text-[10px] uppercase tracking-[0.16em] ${SEV_TEXT[severity]}`}
          style={{ borderColor: SEV_VAR[severity] }}
        >
          <RungGlyph rung={SEV_RUNG[severity]} />
          <span className="font-bold tracking-[0.22em]">{word}</span>
          <span aria-hidden className="text-gray-3">·</span>
          <span className="text-muted">{reason}</span>
        </p>
      ) : null}
      <div className={`flex items-baseline gap-3 ${reason ? "mt-3" : "border-t border-panel-border/60 pt-5"}`}>
        <span className={`font-mono text-sm font-bold tabular-nums ${SEV_TEXT[severity]}`}>{num}</span>
        <h3 className="font-mono text-sm font-bold uppercase tracking-[0.12em] text-title">{title}</h3>
      </div>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </div>
  );
}

// F7c · REASON IN THE MARGIN. The words move out of the reading column entirely,
// beside the change-bar mark. The spine never breaks, and a scroller still sees
// which sections are flagged and why.
export function F7c({ num, title, body, severity }: SectionProps) {
  const reason = REASON[severity];
  return (
    <div className="relative border-t border-panel-border/60 pt-5">
      {reason ? (
        <div className="mb-2 border-l-2 pl-3 lg:absolute lg:-left-52 lg:mb-0 lg:w-48 lg:border-l-0 lg:border-r-2 lg:pl-0 lg:pr-3 lg:pt-5 lg:text-right" style={{ borderColor: SEV_VAR[severity] }}>
          <p className={`font-mono text-[9px] uppercase leading-relaxed tracking-[0.16em] ${SEV_TEXT[severity]}`}>
            {reason}
          </p>
        </div>
      ) : null}
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
