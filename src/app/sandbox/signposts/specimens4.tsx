"use client";

// SANDBOX ONLY — round 4, second convergence. Delete with the route.
//
// This module is a CLIENT module on purpose. Several variants pass a `summary`
// render function into <Triage>, and a function prop cannot cross the server to
// client boundary: from a server module that throws at request time, not build
// time, which is exactly how it presented (the route 500'd while every other
// route stayed up). Everything here is presentational, so the directive costs
// nothing.
//
// C9a is LOCKED (shape-per-rung alert ladder). Round C is closed; the remaining
// families narrow to A12b, B9b-with-triage, D8c, E6d and F7c.

import {
  MODE_VAR,
  MODE_TEXT,
  T,
  type BandProps,
  type DoProps,
  type SectionProps,
} from "./specimens";
import { type TraceProps } from "./specimens2";
import { Triage, TickAsk, TickThenFail, type Verdict } from "./interactive2";

const BODY = "font-serif text-[15px] leading-relaxed text-muted";

// ══ A12b family — the tag that counts ═════════════════════════════════
// The shared question: what should the NUMBER be doing? A label, a position, or
// a measure of what is left.

// A12b1 · NUMERAL OUTSIDE THE TAG. The count leaves the mono label and becomes a
// Saira instrument value, which is what the house reserves that face for. The
// tag stays a tag; the number stays a number.
export function A12b1({ mode, venue, title, body, ord = 1 }: BandProps) {
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className={`shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.2em] ${MODE_TEXT[mode]}`}>
          [ {mode} ]
        </span>
        <span className={`shrink-0 font-numeral text-2xl leading-none tabular-nums ${MODE_TEXT[mode]}`}>
          {String(ord).padStart(2, "0")}
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

// A12b2 · FRACTION. `[ DO 02 / 06 ]` answers the question a learner three hours
// into SCHEMATIC is actually asking, which is not "which band is this" but "how
// much of this stage is left".
export function A12b2({ mode, venue, title, body, ord = 1, of = 6 }: BandProps & { of?: number }) {
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className={`shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.2em] ${MODE_TEXT[mode]}`}>
          [ {mode}{" "}
          <span className="font-numeral text-sm tabular-nums">{String(ord).padStart(2, "0")}</span>
          <span className="text-muted"> / </span>
          <span className="font-numeral text-sm tabular-nums text-muted">{String(of).padStart(2, "0")}</span> ]
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

// A12b3 · NUMBER TAKES THE LEFT EDGE. Section headers already open `02 · Title`.
// Putting the band ordinal in that same column makes bands and sections one
// numbering system instead of two competing ones.
export function A12b3({ mode, venue, title, body, ord = 1 }: BandProps) {
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className={`shrink-0 font-numeral text-2xl leading-none tabular-nums ${MODE_TEXT[mode]}`}>
          {String(ord).padStart(2, "0")}
        </span>
        <span className={`shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.2em] ${MODE_TEXT[mode]}`}>
          [ {mode} ]
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

// A12b4 · THE RULE MEASURES PROGRESS. Same tag, but the hairline between it and
// the edge fills to the band's position in the stage. The rule stops being
// decoration and starts carrying the only number that matters.
export function A12b4({ mode, venue, title, body, ord = 1, of = 6 }: BandProps & { of?: number }) {
  const pct = Math.round((ord / of) * 100);
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className={`shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.2em] ${MODE_TEXT[mode]}`}>
          [ {mode} <span className="font-numeral text-sm tabular-nums">{String(ord).padStart(2, "0")}</span> ]
        </span>
        {venue ? <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">{venue}</span> : null}
        <span aria-hidden className="h-px flex-1 bg-panel-border">
          <span aria-hidden className="block h-px" style={{ width: `${pct}%`, background: MODE_VAR[mode] }} />
        </span>
      </div>
      <h2 className="mt-2 font-display text-3xl leading-none tracking-wide text-title">{title}</h2>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// ══ B9b + D8c hybrid — the Do step that asks which answer you have ════
// B9b revealed the proof on tick. D8c asked WHICH verdict the learner has. These
// four combine them: the Do step is where "it didn't work" actually happens, so
// the uncertain path is worth first-class treatment here more than anywhere.

export interface ProofDoProps extends DoProps {
  proofs: string[];
  fixes?: string[];
}

const DO_VERDICTS: Verdict[] = [
  { key: "done", label: "done", tone: "gold" },
  { key: "unsure", label: "not sure", tone: "green", reveals: "help" },
];

// BT1 · DONE OR NOT SURE. The direct port of D8c onto a Do step: two verdicts,
// and only "not sure" spends a line on the answer key.
export function BT1({ title, body, steps, proofs }: ProofDoProps) {
  return (
    <div>
      <p className={`mb-3 ${BODY}`}>
        <T text={body} />
      </p>
      <Triage
        tone="gold"
        label={`Do · ${title}`}
        helpLabel="you should see"
        verdicts={DO_VERDICTS}
        items={steps.map((text, i) => ({ text, help: proofs[i] ?? "" }))}
      />
    </div>
  );
}

// BT2 · TICK, WITH THE KEY ON REQUEST. Lowest chrome in the family: a normal
// tick, plus a quiet link that only the stuck learner ever presses. Nothing
// appears unless asked for, so a confident run looks like a plain checklist.
export function BT2({ title, body, steps, proofs }: ProofDoProps) {
  return (
    <div>
      <p className={`mb-3 ${BODY}`}>
        <T text={body} />
      </p>
      <TickAsk
        tone="gold"
        label={`Do · ${title}`}
        items={steps.map((text, i) => ({ text, proof: proofs[i] ?? "" }))}
      />
    </div>
  );
}

// BT3 · TWO STAGE. Ticking shows the proof automatically, and a "didn't work"
// button then opens the fix. The happy path is one click; the failure path is
// one more, and it ends somewhere useful instead of at a dead end.
export function BT3({ title, body, steps, proofs, fixes = [] }: ProofDoProps) {
  return (
    <div>
      <p className={`mb-3 ${BODY}`}>
        <T text={body} />
      </p>
      <TickThenFail
        label={`Do · ${title}`}
        items={steps.map((text, i) => ({ text, proof: proofs[i] ?? "", fix: fixes[i] ?? "" }))}
      />
    </div>
  );
}

// BT4 · FLAGS THAT AGGREGATE. Same two verdicts, but the block closes with what
// the flags MEAN for the stage. An unsure tap stops being a private moment and
// becomes something the learner is told to resolve before the gate.
export function BT4({ title, body, steps, proofs }: ProofDoProps) {
  return (
    <div>
      <p className={`mb-3 ${BODY}`}>
        <T text={body} />
      </p>
      <Triage
        tone="gold"
        layout="inline"
        label={`Do · ${title}`}
        helpLabel="you should see"
        verdicts={DO_VERDICTS}
        items={steps.map((text, i) => ({ text, help: proofs[i] ?? "" }))}
        summary={({ total, byKey }) => {
          const flagged = byKey.unsure ?? 0;
          const done = byKey.done ?? 0;
          return (
            <p className="flex flex-wrap items-baseline gap-x-2 border-t border-panel-border/60 pt-2 font-mono text-[10px] uppercase tracking-[0.16em]">
              <span className="font-numeral text-base tabular-nums text-command-gold">{done}</span>
              <span className="text-muted">of</span>
              <span className="font-numeral text-base tabular-nums text-text">{total}</span>
              <span className="text-muted">done</span>
              {flagged ? (
                <>
                  <span aria-hidden className="text-gray-3">·</span>
                  <span className="font-numeral text-base tabular-nums text-alert-red">{flagged}</span>
                  <span className="text-alert-red">to resolve before you export</span>
                </>
              ) : null}
            </p>
          );
        }}
      />
    </div>
  );
}

// ══ D8c family — triage on the trace list ═════════════════════════════

const TRACE_VERDICTS: Verdict[] = [
  { key: "ok", label: "traced, looks right", tone: "green" },
  { key: "unsure", label: "not sure", tone: "gold", reveals: "help" },
];

const TRACE_VERDICTS_3: Verdict[] = [
  { key: "ok", label: "looks right", tone: "green" },
  { key: "unsure", label: "not sure", tone: "gold", reveals: "help" },
  { key: "bad", label: "found a problem", tone: "red", reveals: "fix" },
];

// D8c1 · TRIAGE WITH A TALLY. The baseline plus a count, so the learner can see
// they have answered all three without re-reading them.
export function D8c1({ headline, items, proofs = [] }: TraceProps) {
  return (
    <Triage
      label={`Eyeball it · ${headline}`}
      verdicts={TRACE_VERDICTS}
      items={items.map((text, i) => ({ text, help: proofs[i] ?? "" }))}
      summary={({ total, answered }) => (
        <p className="border-t border-panel-border/60 pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          <span className={`font-numeral text-base tabular-nums ${answered === total ? "text-status-green" : "text-text"}`}>
            {answered}
          </span>{" "}
          of <span className="font-numeral text-base tabular-nums">{total}</span> answered
        </p>
      )}
    />
  );
}

// D8c2 · THREE VERDICTS. "Not sure" and "found a problem" are different states
// and want different answers: one wants the answer key, the other wants the fix.
// Collapsing them loses the distinction the learner already made.
export function D8c2({ headline, items, proofs = [], whys = [] }: TraceProps) {
  return (
    <Triage
      label={`Eyeball it · ${headline}`}
      verdicts={TRACE_VERDICTS_3}
      items={items.map((text, i) => ({ text, help: proofs[i] ?? "", fix: whys[i] ?? "" }))}
    />
  );
}

// D8c3 · COMPACT. Verdicts move to the right of the row, so the list keeps the
// density of a checklist instead of stacking to three lines per item.
export function D8c3({ headline, items, proofs = [] }: TraceProps) {
  return (
    <Triage
      layout="inline"
      label={`Eyeball it · ${headline}`}
      verdicts={TRACE_VERDICTS}
      items={items.map((text, i) => ({ text, help: proofs[i] ?? "" }))}
    />
  );
}

// D8c4 · GATE VERDICT. The footer states what the answers mean for the gate, in
// the gate's own language. This is the option that makes triage worth building:
// the learner learns their trace has consequences before they hit the upload.
export function D8c4({ headline, items, proofs = [] }: TraceProps) {
  return (
    <Triage
      label={`Eyeball it · ${headline}`}
      verdicts={TRACE_VERDICTS}
      items={items.map((text, i) => ({ text, help: proofs[i] ?? "" }))}
      summary={({ total, byKey }) => {
        const ok = byKey.ok ?? 0;
        const unsure = byKey.unsure ?? 0;
        const clear = ok === total;
        return (
          <p
            className={`flex flex-wrap items-baseline gap-x-2 border-t pt-2 font-mono text-[10px] uppercase tracking-[0.16em] ${
              clear ? "text-status-green" : "text-muted"
            }`}
            style={{
              borderColor: clear ? "var(--color-status-green)" : "var(--color-panel-border)",
            }}
          >
            <span className="font-numeral text-base tabular-nums">{ok}</span>
            <span>of</span>
            <span className="font-numeral text-base tabular-nums">{total}</span>
            <span>traced</span>
            <span aria-hidden className="text-gray-3">·</span>
            {clear ? (
              <span className="font-bold">the gate will accept this</span>
            ) : unsure ? (
              <span className="text-command-gold">
                <span className="font-numeral text-base tabular-nums">{unsure}</span> to look at again
              </span>
            ) : (
              <span>the gate asks for all three</span>
            )}
          </p>
        );
      }}
    />
  );
}

// ══ E6d family — the glyph on a rule ══════════════════════════════════

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

function Glyph({ verb, className = "h-3.5 w-3.5 shrink-0" }: { verb: string; className?: string }) {
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

export interface AsideProps4 {
  verb: string;
  headline: string;
  body: string;
}

// E6d1 · GLYPH IN A BREAK IN THE RULE. The hairline runs the full column and the
// mark sits in a gap in it: the classic manual divider, and it makes the aside
// read as a break in the spine rather than a new block on it.
export function E6d1({ verb, headline, body }: AsideProps4) {
  return (
    <section>
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="h-px w-6 bg-panel-border" />
        <Glyph verb={verb} className="h-3.5 w-3.5 shrink-0 text-muted" />
        <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted">{verb}</span>
        <span aria-hidden className="h-px flex-1 bg-panel-border" />
      </div>
      <p className="mt-2 font-serif text-[15px] font-semibold leading-snug text-title">{headline}</p>
      <p className={`mt-1 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// E6d2 · RULE IS PURE FURNITURE. Only the glyph and the verb ride the rule; the
// headline drops into the reading face where a headline belongs. Keeps mono for
// labels and serif for language, which is the type law.
export function E6d2({ verb, headline, body }: AsideProps4) {
  return (
    <section>
      <div className="flex items-center gap-2.5">
        <Glyph verb={verb} className="h-3.5 w-3.5 shrink-0 text-muted" />
        <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted">{verb}</span>
        <span aria-hidden className="h-px flex-1 bg-panel-border" />
      </div>
      <p className="mt-2 font-serif text-base leading-relaxed text-text">
        <span className="font-semibold">{headline}. </span>
        <T text={body} />
      </p>
    </section>
  );
}

// E6d3 · RULE UNDERNEATH. The hairline closes the row instead of trailing off
// it, which is exactly how the lesson's existing `**Bold**` section eyebrow
// behaves. One divider grammar for the whole page.
export function E6d3({ verb, headline, body }: AsideProps4) {
  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-panel-border pb-1.5">
        <Glyph verb={verb} className="h-3.5 w-3.5 shrink-0 self-center text-muted" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted">{verb}</span>
        <span aria-hidden className="text-gray-3">·</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-title">{headline}</span>
      </div>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// E6d4 · TAG AT THE END. Headline leads at the left, mark and verb stamp the
// right end of the rule. Matches C9d and F4b, so "the label goes at the end of
// the rule" becomes one habit across callouts, asides and section heads.
export function E6d4({ verb, headline, body }: AsideProps4) {
  return (
    <section>
      <div className="flex items-center gap-2.5">
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-title">{headline}</span>
        <span aria-hidden className="h-px flex-1 bg-panel-border" />
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
          <Glyph verb={verb} />
          {verb}
        </span>
      </div>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// ══ F7c family — the reason in the margin ═════════════════════════════

const SEV_VAR = {
  info: "var(--color-panel-border)",
  warn: "var(--color-command-gold)",
  critical: "var(--color-alert-red)",
} as const;
const SEV_TEXT = { info: "text-command-gold", warn: "text-command-gold", critical: "text-alert-red" } as const;
const LADDER = { info: null, warn: "Caution", critical: "Warning" } as const;
const REASON = {
  info: null,
  warn: "Do this before you route, or you will redo it",
  critical: "Safety: read before you heat anything",
} as const;

type Rung = "note" | "caution" | "warning";
const SEV_RUNG: Record<SectionProps["severity"], Rung> = { info: "note", warn: "caution", critical: "warning" };

// The locked C9a shape set, reused so the margin flag and the callout ladder
// speak the same language.
function RungGlyph({ rung, className = "h-3.5 w-3.5 shrink-0" }: { rung: Rung; className?: string }) {
  const p = {
    className,
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

const MARGIN =
  "mb-2 border-l-2 pl-3 lg:absolute lg:-left-52 lg:mb-0 lg:w-48 lg:border-l-0 lg:border-r-2 lg:pl-0 lg:pr-3 lg:text-right";

// F7c1 · RUNG WORD PLUS REASON. The margin carries both the alert vocabulary and
// the sentence, so the flag is complete without entering the reading column.
export function F7c1({ num, title, body, severity }: SectionProps) {
  const reason = REASON[severity];
  const word = LADDER[severity];
  return (
    <div className="relative border-t border-panel-border/60 pt-5">
      {reason ? (
        <div className={`${MARGIN} lg:pt-5`} style={{ borderColor: SEV_VAR[severity] }}>
          <p className={`font-mono text-[10px] font-bold uppercase tracking-[0.22em] ${SEV_TEXT[severity]}`}>{word}</p>
          <p className="mt-1 font-mono text-[9px] uppercase leading-relaxed tracking-[0.14em] text-muted">{reason}</p>
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

// F7c2 · MARK ABOVE THE WORDS. The rung shape leads the margin block, so the
// flag is recognisable from the shape alone at scroll speed and only resolves
// into words when the reader stops.
export function F7c2({ num, title, body, severity }: SectionProps) {
  const reason = REASON[severity];
  return (
    <div className="relative border-t border-panel-border/60 pt-5">
      {reason ? (
        <div className={`${MARGIN} lg:pt-5`} style={{ borderColor: SEV_VAR[severity] }}>
          <span className={`inline-flex ${SEV_TEXT[severity]} lg:justify-end`}>
            <RungGlyph rung={SEV_RUNG[severity]} className="h-5 w-5 shrink-0" />
          </span>
          <p className="mt-1.5 font-mono text-[9px] uppercase leading-relaxed tracking-[0.14em] text-muted">{reason}</p>
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

// F7c3 · THE WHOLE APPARATUS LEAVES. Number, rung and reason all move to the
// margin, so the reading column holds nothing but the title and the prose. The
// cleanest spine in the sandbox, and the one that breaks worst below `lg`.
export function F7c3({ num, title, body, severity }: SectionProps) {
  const reason = REASON[severity];
  return (
    <div className="relative border-t border-panel-border/60 pt-5">
      <div className={`${MARGIN} lg:pt-5`} style={{ borderColor: reason ? SEV_VAR[severity] : "var(--color-panel-border)" }}>
        <p className={`font-numeral text-2xl leading-none tabular-nums ${SEV_TEXT[severity]}`}>{num}</p>
        {reason ? (
          <>
            <span className={`mt-1 inline-flex ${SEV_TEXT[severity]}`}>
              <RungGlyph rung={SEV_RUNG[severity]} />
            </span>
            <p className="mt-1 font-mono text-[9px] uppercase leading-relaxed tracking-[0.14em] text-muted">{reason}</p>
          </>
        ) : null}
      </div>
      <h3 className="font-mono text-sm font-bold uppercase tracking-[0.12em] text-title">{title}</h3>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </div>
  );
}

// F7c4 · STICKY. The flag pins while the flagged section scrolls past, so the
// warning is present for the WHOLE section rather than only at its top. This is
// the argument for using the margin at all: a banner you scroll past has stopped
// warning you, and the safety section is the one you are inside for ten minutes.
export function F7c4({ num, title, body, severity }: SectionProps) {
  const reason = REASON[severity];
  const word = LADDER[severity];
  return (
    <div className="relative border-t border-panel-border/60 pt-5">
      {reason ? (
        <div
          className={`${MARGIN} lg:sticky lg:top-4 lg:float-left lg:-ml-52 lg:mt-0 lg:pt-0`}
          style={{ borderColor: SEV_VAR[severity] }}
        >
          <span className={`inline-flex ${SEV_TEXT[severity]}`}>
            <RungGlyph rung={SEV_RUNG[severity]} className="h-4 w-4 shrink-0" />
          </span>
          <p className={`mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${SEV_TEXT[severity]}`}>{word}</p>
          <p className="mt-1 font-mono text-[9px] uppercase leading-relaxed tracking-[0.14em] text-muted">{reason}</p>
        </div>
      ) : null}
      <div className="flex items-baseline gap-3">
        <span className={`font-mono text-sm font-bold tabular-nums ${SEV_TEXT[severity]}`}>{num}</span>
        <h3 className="font-mono text-sm font-bold uppercase tracking-[0.12em] text-title">{title}</h3>
      </div>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
      {/* Filler so the sticky behaviour is visible in the sandbox. */}
      {reason ? (
        <p className={`mt-2 ${BODY}`}>
          Keep scrolling: the margin flag should stay level with your eye for the whole section, which
          is the behaviour a banner at the top cannot give you.
        </p>
      ) : null}
    </div>
  );
}
