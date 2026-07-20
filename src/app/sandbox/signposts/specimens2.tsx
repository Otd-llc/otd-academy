// SANDBOX ONLY — round 2 variants. Delete with the route before the PR.
//
// Sources drawn on for the fresh options (cited so the choices are arguable, not
// just taste):
//   • Degani, "On the Typography of Flight-Deck Documentation" (NASA TM, 1992) —
//     enlarge the initial letter when a word must be set in caps (rec. 5);
//     reverse type is for EXCEPTIONAL cases only, and then must be short, larger
//     and sans (recs. 13/14). A9 takes that exception on purpose so the owner can
//     see whether a three-word band earns it.
//   • MIL-STD-38784B §4.8.10 — technical manuals run a three-rung alert ladder
//     (NOTE / CAUTION / WARNING), each rung visually distinct. Our severity field
//     already has three values and renders one. C9 and F4 apply the ladder.
//   • Editorial practice — "recurring furniture" (running heads, folios, thumb
//     tabs) is what keeps a reader oriented in a long document. A7/A8 apply it:
//     L1.01's SCHEMATIC card is 128 blocks, which is a chapter, not a page.
//   • LEGO instruction convention — every step opens with a parts callout showing
//     exactly what that step consumes. B7 applies it to the KiCad keys/parts a Do
//     step uses.

import { MODE_VAR, MODE_TEXT, ModeIcon, T, type BandProps, type DoProps, type GotchaProps, type EyeballProps, type AsideProps, type SectionProps } from "./specimens";
import { Tick, TickCounted, TickReveal } from "./interactive";

const BODY = "font-serif text-[15px] leading-relaxed text-muted";

// ══ ROUND A (round 2) ═════════════════════════════════════════════════

// A7 · THUMB TAB. Editorial running furniture: the mode rides a tab pinned to
// the right edge of the column, so mode is findable while scrolling a 128-block
// card, not just at the moment you pass the band.
export function A7({ mode, venue, title, body }: BandProps) {
  return (
    <section className="relative pr-16">
      <span
        className={`absolute right-0 top-0 border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] ${MODE_TEXT[mode]}`}
        style={{ borderColor: `color-mix(in srgb, ${MODE_VAR[mode]} 50%, transparent)` }}
      >
        {mode}
      </span>
      <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        {venue ?? "read only"}
      </span>
      <h2 className="mt-1 font-display text-3xl leading-none tracking-wide text-title">{title}</h2>
      <div aria-hidden className="mt-2 h-px w-full" style={{ background: `color-mix(in srgb, ${MODE_VAR[mode]} 45%, transparent)` }} />
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// A8 · RUNNING HEAD. The band states WHERE YOU ARE the way a manual's running
// head does: stage, section, mode, venue on one mono line above the title.
export function A8({ mode, venue, title, body, ord = 1 }: BandProps) {
  return (
    <section>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        <span>Schematic</span>
        <span aria-hidden className="text-gray-3">·</span>
        <span>
          Band <span className="font-numeral text-sm tabular-nums text-text">{String(ord).padStart(2, "0")}</span>
        </span>
        <span aria-hidden className="text-gray-3">·</span>
        <span className={`font-bold ${MODE_TEXT[mode]}`}>{mode}</span>
        {venue ? (
          <>
            <span aria-hidden className="text-gray-3">·</span>
            <span>{venue}</span>
          </>
        ) : null}
      </p>
      <div aria-hidden className="mt-1.5 h-px w-full" style={{ background: `color-mix(in srgb, ${MODE_VAR[mode]} 55%, transparent)` }} />
      <h2 className="mt-2.5 font-display text-3xl leading-none tracking-wide text-title">{title}</h2>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// A9 · REVERSED PLATE. Knocked-out type on a solid mode bar. NASA reserves
// reverse for exceptional, SHORT, larger, sans text: a three-word band is
// exactly that case, and nothing else on the page competes with it. The loudest
// option here on purpose. Note this is a RULE/masthead, not a content card.
export function A9({ mode, venue, title, body }: BandProps) {
  return (
    <section>
      <div className="flex items-center justify-between gap-4 px-3 py-2" style={{ background: MODE_VAR[mode] }}>
        <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-deep-space">
          <ModeIcon mode={mode} />
          {mode}
        </span>
        {venue ? (
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-deep-space/75">{venue}</span>
        ) : null}
      </div>
      <h2 className="mt-2.5 font-display text-3xl leading-none tracking-wide text-title">{title}</h2>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// A10 · ENLARGED INITIAL (Degani rec. 5). Our band titles are set in all-caps
// Bebas; the rule says enlarge the first letter so the WORD SHAPE returns. The
// initial takes the mode colour, which doubles as the mode marker.
export function A10({ mode, venue, title, body }: BandProps) {
  const [first, ...rest] = title;
  return (
    <section className="border-t border-panel-border pt-3">
      <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        {mode}
        {venue ? <span aria-hidden className="text-gray-3">· {venue}</span> : null}
      </span>
      <h2 className="mt-1 flex items-baseline font-display text-3xl leading-none tracking-wide text-title">
        <span className="text-[1.45em] leading-[0.8]" style={{ color: MODE_VAR[mode] }}>
          {first}
        </span>
        <span>{rest.join("")}</span>
      </h2>
      <p className={`mt-2.5 ${BODY}`}>
        <T text={body} />
      </p>
    </section>
  );
}

// A11 · LEDGER HEAD. A spec-sheet header: a narrow mono column (mode / venue /
// ordinal) behind a vertical rule, the title and lead to its right. Reads like
// the meta-strip the rest of the site already opens documents with.
export function A11({ mode, venue, title, body, ord = 1 }: BandProps) {
  return (
    <section className="grid gap-x-4 sm:grid-cols-[8.5rem_1fr]">
      <div className="border-l-2 pl-3 sm:border-l-0 sm:border-r sm:pl-0 sm:pr-3 sm:text-right" style={{ borderColor: MODE_VAR[mode] }}>
        <p className={`font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${MODE_TEXT[mode]}`}>{mode}</p>
        {venue ? <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">{venue}</p> : null}
        <p className="mt-1 font-numeral text-2xl leading-none tabular-nums text-gray-3">{String(ord).padStart(2, "0")}</p>
      </div>
      <div className="mt-3 sm:mt-0">
        <h2 className="font-display text-2xl leading-none tracking-wide text-title">{title}</h2>
        <p className={`mt-2 ${BODY}`}>
          <T text={body} />
        </p>
      </div>
    </section>
  );
}

// A12 · GATE TAG. Borrows the vocabulary the product already uses at the stage
// gate: a bracketed mono tag on a rule. Cheapest to build, and it makes bands
// and gates obviously the same system.
export function A12({ mode, venue, title, body }: BandProps) {
  return (
    <section>
      <div className="flex items-center gap-3">
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

// ══ ROUND B (round 2) — every option is tickable ══════════════════════

// B5 · GUTTER + TICKS. B1's column, with the steps tickable.
export function B5({ title, body, steps }: DoProps) {
  return (
    <div className="border-l-2 border-command-gold/70 pl-4">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-command-gold">Do · {title}</span>
      <p className={`mt-1.5 ${BODY}`}>
        <T text={body} />
      </p>
      <ul className="mt-2.5 space-y-2.5">
        {steps.map((s, i) => (
          <li key={i}>
            <Tick>
              <T text={s} />
            </Tick>
          </li>
        ))}
      </ul>
    </div>
  );
}

// B6 · NUMBERED TICKS. The step keeps its ordinal AND gets a box, so a returning
// learner can see both "which step" and "how far I got".
export function B6({ title, body, steps }: DoProps) {
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
      <ul className="mt-3 border-t border-panel-border/60">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3 border-b border-panel-border/60 py-2.5">
            <span className="mt-0.5 shrink-0 font-numeral text-lg leading-none tabular-nums text-command-gold">
              {i + 1}
            </span>
            <Tick>
              <T text={s} />
            </Tick>
          </li>
        ))}
      </ul>
    </div>
  );
}

// B7 · CALLOUT STRIP (the LEGO move). Before the steps, a strip naming exactly
// what this Do consumes: the keys and the refdes. The learner can stage the
// work before starting, and it makes the step list shorter.
export function B7({ title, body, steps, uses = [] }: DoProps & { uses?: string[] }) {
  return (
    <div className="border-l-2 border-command-gold/70 pl-4">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-command-gold">Do · {title}</span>
      <p className={`mt-1.5 ${BODY}`}>
        <T text={body} />
      </p>
      {uses.length ? (
        <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">You&apos;ll use</span>
          {uses.map((u) => (
            <span key={u} className="border border-panel-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text">
              {u}
            </span>
          ))}
        </p>
      ) : null}
      <ul className="mt-3 space-y-2.5">
        {steps.map((s, i) => (
          <li key={i}>
            <Tick>
              <T text={s} />
            </Tick>
          </li>
        ))}
      </ul>
    </div>
  );
}

// B8 · COUNTED DO. The Do reports its own progress in the house Saira readout,
// with a hairline that fills. Makes a long stage feel finite.
export function B8({ title, body, steps }: DoProps) {
  return (
    <div>
      <p className={`mb-3 ${BODY}`}>
        <T text={body} />
      </p>
      <TickCounted label={`Do · ${title}`} items={steps} />
    </div>
  );
}

// B9 · TICK + PROOF. Each step carries what you should SEE when it worked, in a
// mono proof line. Turns a Do list into a self-verifying one and removes the
// need for a separate Eyeball it after short Dos.
export function B9({ title, body, steps, proofs = [] }: DoProps & { proofs?: string[] }) {
  return (
    <div className="border-l-2 border-command-gold/70 pl-4">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-command-gold">Do · {title}</span>
      <p className={`mt-1.5 ${BODY}`}>
        <T text={body} />
      </p>
      <ul className="mt-3 border-t border-panel-border/60">
        {steps.map((s, i) => (
          <li key={i} className="border-b border-panel-border/60 py-2.5">
            <Tick>
              <T text={s} />
            </Tick>
            {proofs[i] ? (
              <p className="mt-1 flex gap-2.5 pl-[26px]">
                <span aria-hidden className="shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-status-green">
                  you see
                </span>
                <span className="font-serif text-[14px] leading-relaxed text-gray-3">{proofs[i]}</span>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ══ ROUND C (round 2) — variations on the consequence ledger ══════════

export interface LedgerProps extends GotchaProps {
  /** What goes wrong. */
  trap: string;
  /** What it costs you. */
  cost: string;
  /** What to do instead. Present in three of the five. */
  fix?: string;
}

// C5 · LABELLED HALVES. The two halves get named mono labels on their own rules,
// so the structure is legible before the words are read.
export function C5({ headline, trap, cost }: LedgerProps) {
  return (
    <section className="border-l-2 border-command-gold pl-4">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-command-gold">
        Gotcha · {headline}
      </span>
      <div className="mt-2.5 border-t border-panel-border/60 pt-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">The trap</span>
        <p className={`mt-0.5 ${BODY}`}>
          <T text={trap} />
        </p>
      </div>
      <div className="mt-2.5 border-t border-panel-border/60 pt-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-alert-red">What it costs</span>
        <p className={`mt-0.5 ${BODY}`}>
          <T text={cost} />
        </p>
      </div>
    </section>
  );
}

// C6 · THREE RUNGS. Adds the rung the current Gotcha never states: what to DO
// instead. Trap, cost, fix. A warning without a fix leaves the learner stuck.
export function C6({ headline, trap, cost, fix }: LedgerProps) {
  const rows: [string, string, string][] = [
    ["trap", trap, "text-muted"],
    ["costs", cost, "text-muted"],
    ...(fix ? ([["do this", fix, "text-text"]] as [string, string, string][]) : []),
  ];
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-command-gold">
          Gotcha
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-title">{headline}</span>
        <span aria-hidden className="h-px flex-1 bg-command-gold/30" />
      </div>
      <dl className="mt-2.5">
        {rows.map(([k, v, tone]) => (
          <div key={k} className="grid grid-cols-[5.5rem_1fr] gap-x-3 border-b border-panel-border/60 py-2">
            <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-command-gold">{k}</dt>
            <dd className={`font-serif text-[15px] leading-relaxed ${tone}`}>
              <T text={v} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// C7 · INLINE CONSEQUENCE. The cost rides the headline rule as a right-aligned
// mono tag, so the whole gotcha is scannable in one line before you read a word
// of the body.
export function C7({ headline, trap, cost }: LedgerProps) {
  return (
    <section className="border-t border-command-gold/40 pt-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-command-gold">
          Gotcha · {headline}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-alert-red">▸ rail becomes noise</span>
      </div>
      <p className={`mt-1.5 ${BODY}`}>
        <T text={trap} /> <T text={cost} />
      </p>
    </section>
  );
}

// C8 · LEDGER ROWS. The `.table-tech` language without a filled table: two
// hairline rows, mono keys, Lora values. Scales if a gotcha ever needs a third
// row, and matches how the rest of the lesson renders data.
export function C8({ headline, trap, cost, fix }: LedgerProps) {
  return (
    <section>
      <p className="font-serif text-base font-semibold leading-snug text-title">{headline}</p>
      <div className="mt-2 border-t border-panel-border/60">
        {(
          [
            ["if you skip it", trap],
            ["it costs", cost],
            ...(fix ? [["do this instead", fix]] : []),
          ] as [string, string][]
        ).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-x-3 border-b border-panel-border/60 py-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">{k}</span>
            <span className="font-serif text-[15px] leading-relaxed text-muted">
              <T text={v} />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// C9 · ALERT LADDER (MIL-STD-38784 §4.8.10). Our severity field already has
// three values; this renders them as a real ladder, with the consequence line
// built in. NOTE is quiet, CAUTION is gold, WARNING is red and boxed. A Gotcha
// is the middle rung, which is why bare "Gotcha" reads as weightless today.
const RUNG = {
  note: { word: "Note", accent: "text-muted", var: "var(--color-panel-border)" },
  caution: { word: "Gotcha", accent: "text-command-gold", var: "var(--color-command-gold)" },
  warning: { word: "Warning", accent: "text-alert-red", var: "var(--color-alert-red)" },
} as const;

export function C9({
  headline,
  trap,
  cost,
  rung = "caution",
}: LedgerProps & { rung?: keyof typeof RUNG }) {
  const R = RUNG[rung];
  const boxed = rung === "warning";
  return (
    <section
      className={boxed ? "px-4 py-3" : "border-l-2 pl-4"}
      style={
        boxed
          ? { border: `1px solid ${R.var}`, borderRadius: "6px" }
          : { borderColor: R.var }
      }
    >
      <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.22em] ${R.accent}`}>
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

// ══ ROUND D (round 2) — tickable verify ═══════════════════════════════

export interface TraceProps extends EyeballProps {
  proofs?: string[];
  whys?: string[];
}

// D4 · TICK + PROOF COLUMN. Each trace target states what you should SEE, so a
// learner who is unsure has an answer key inline instead of scrolling to the
// reference image.
export function D4({ headline, items, proofs = [] }: TraceProps) {
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
            {proofs[i] ? (
              <p className="mt-1 flex gap-2.5 pl-[26px]">
                <span aria-hidden className="shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-status-green">
                  looks like
                </span>
                <span className="font-serif text-[14px] leading-relaxed text-gray-3">{proofs[i]}</span>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

// D5 · COUNTED TRACE. The verify block reports progress the same way a Do does
// (B8), so the two modes share one instrument and only the colour differs.
export function D5({ headline, items }: TraceProps) {
  return <TickCounted tone="green" label={`Eyeball it · ${headline}`} items={items} />;
}

// D6 · GATE REHEARSAL. Styled as the stage gate's attestation, because that is
// literally what this list becomes three blocks later. Ticking here is a
// rehearsal of the gate, which is the argument for making it tickable at all.
export function D6({ headline, items }: TraceProps) {
  return (
    <section className="border border-status-green/35 px-4 py-3.5" style={{ borderRadius: "6px" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-status-green">
          Eyeball it · {headline}
        </span>
        <span className="border border-status-green/50 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-status-green">
          gate rehearsal
        </span>
      </div>
      <ul className="mt-3 space-y-2.5">
        {items.map((s, i) => (
          <li key={i}>
            <Tick tone="green">
              <T text={s} />
            </Tick>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-panel-border/60 pt-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
        The stage gate asks for these same three before it accepts your upload.
      </p>
    </section>
  );
}

// D7 · TICK RAIL. The boxes sit on a continuous vertical run, so the list reads
// as one instrument rather than three separate rows. Closest to the island rail
// the guide already uses for navigation.
export function D7({ headline, items }: TraceProps) {
  return (
    <section>
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-status-green">
        Eyeball it · {headline}
      </span>
      <ul className="relative mt-3 space-y-3.5 pl-1">
        <span aria-hidden className="absolute bottom-2 left-[7px] top-2 w-px bg-status-green/30" />
        {items.map((s, i) => (
          <li key={i} className="relative">
            <Tick tone="green">
              <T text={s} />
            </Tick>
          </li>
        ))}
      </ul>
    </section>
  );
}

// D8 · TICK TO REVEAL. The list stays short until engaged: ticking an item opens
// WHY it matters. Forces the trace to happen before the explanation, which is
// the same retrieval-first bet SelfCheckBlock already makes.
export function D8({ headline, items, whys = [] }: TraceProps) {
  return (
    <TickReveal
      label={`Eyeball it · ${headline}`}
      items={items.map((text, i) => ({ text, why: whys[i] ?? "" }))}
    />
  );
}

// ══ ROUND E (round 2) ═════════════════════════════════════════════════

// E3 · BRACKET TAG. The aside opens with a bracketed mono verb inline with its
// first line, so it costs no vertical space at all.
export function E3({ verb, headline, body }: AsideProps) {
  return (
    <p className={BODY}>
      <span className="mr-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted">[ {verb} ]</span>
      <span className="font-semibold text-title">{headline}. </span>
      <T text={body} />
    </p>
  );
}

// E4 · INDENT + CONNECTOR. The aside is indented off a short hairline elbow, the
// way a footnote hangs off its host paragraph. Visibly subordinate, no box.
export function E4({ verb, headline, body }: AsideProps) {
  return (
    <div className="ml-3 border-l border-panel-border pl-4">
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">{verb}</span>
      <p className="mt-0.5 font-serif text-[14px] font-semibold leading-snug text-text">{headline}</p>
      <p className="mt-1 font-serif text-[14px] leading-relaxed text-muted">
        <T text={body} />
      </p>
    </div>
  );
}

// E5 · COLLAPSED. Reference asides (keys, alternatives) are lookup material, not
// reading material: same <details> treatment DeepDive already uses, so the spine
// stays clean and the reference is one click away.
export function E5({ verb, headline, body }: AsideProps) {
  return (
    <details className="group border-t border-panel-border/60">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-2 font-mono text-[10px] font-bold uppercase tracking-wider [&::-webkit-details-marker]:hidden">
        <span className="text-gold-dim transition-transform group-open:rotate-90">▸</span>
        <span className="text-gold-dim">{verb}</span>
        <span className="text-command-gold">· {headline}</span>
      </summary>
      <p className="pb-3 font-serif text-[15px] leading-relaxed text-muted">
        <T text={body} />
      </p>
    </details>
  );
}

// E6 · GLYPH VERB. A thin-line mark per verb, the same language the mode icons
// use, so the aside family is recognisable at a glance across stages.
const ASIDE_GLYPH: Record<string, React.ReactNode> = {
  Setup: (
    <>
      <path d="M14.5 4.5a4.5 4.5 0 0 0-6 5.9L4 15v4h4l4.6-4.5a4.5 4.5 0 0 0 5.9-6l-2.8 2.8-2.2-2.2z" />
    </>
  ),
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

export function E6({ verb, headline, body }: AsideProps) {
  return (
    <section className="flex gap-3.5">
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 text-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {ASIDE_GLYPH[verb] ?? null}
      </svg>
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

// E7 · TRUE SIDENOTE. On a wide viewport the aside leaves the reading column
// entirely and sits in the margin, the way a well-set technical book does. The
// spine never breaks. Falls back to E4's indent below `lg`.
export function E7({ verb, headline, body }: AsideProps) {
  return (
    <section className="relative lg:ml-0">
      <div className="ml-3 border-l border-panel-border pl-4 lg:absolute lg:-left-44 lg:ml-0 lg:w-40 lg:border-l-0 lg:border-r lg:pl-0 lg:pr-4 lg:text-right">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">{verb}</span>
        <p className="mt-0.5 font-serif text-[13px] font-semibold leading-snug text-text">{headline}</p>
        <p className="mt-1 font-serif text-[13px] leading-relaxed text-muted">
          <T text={body} />
        </p>
      </div>
      <p className="hidden font-mono text-[9px] uppercase tracking-[0.18em] text-gray-3 lg:block">
        (the reading spine continues here, uninterrupted)
      </p>
    </section>
  );
}

// ══ ROUND F (round 2) ═════════════════════════════════════════════════

const SEV_VAR = {
  info: "var(--color-panel-border)",
  warn: "var(--color-command-gold)",
  critical: "var(--color-alert-red)",
} as const;
const SEV_TEXT = { info: "text-command-gold", warn: "text-command-gold", critical: "text-alert-red" } as const;

// F4 · ALERT-LADDER WORD (MIL-STD-38784). The severity gets a NAME, in the same
// three-rung vocabulary technical manuals have used for decades, placed above
// the section head so it is read before the section is entered.
const LADDER = { info: null, warn: "Caution", critical: "Warning" } as const;

export function F4({ num, title, body, severity }: SectionProps) {
  const word = LADDER[severity];
  return (
    <div className="border-t border-panel-border/60 pt-5">
      {word ? (
        <p className={`mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.24em] ${SEV_TEXT[severity]}`}>
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

// F5 · NUMERAL CARRIES IT. The section number is already the strongest mark in
// the row; give it the Saira face and the severity colour and nothing else has
// to change. Quietest option that still reads at a glance.
export function F5({ num, title, body, severity }: SectionProps) {
  return (
    <div className="border-t border-panel-border/60 pt-5">
      <div className="flex items-baseline gap-3">
        <span
          className="font-numeral text-3xl leading-none tabular-nums"
          style={{ color: severity === "info" ? "var(--color-gold-dim)" : SEV_VAR[severity] }}
        >
          {num}
        </span>
        <h3 className="font-mono text-sm font-bold uppercase tracking-[0.12em] text-title">{title}</h3>
      </div>
      <p className={`mt-2 ${BODY}`}>
        <T text={body} />
      </p>
    </div>
  );
}

// F6 · MARGIN MARK. A severity square in the left margin, outside the text
// column, so a learner scrolling fast sees WHICH sections are flagged without
// reading any of them. The change-bar convention from engineering drawings.
export function F6({ num, title, body, severity }: SectionProps) {
  return (
    <div className="relative border-t border-panel-border/60 pt-5">
      {severity !== "info" ? (
        <span
          aria-hidden
          className="absolute -left-5 top-5 h-2.5 w-2.5"
          style={{ background: SEV_VAR[severity] }}
        />
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

// F7 · REASON BANNER. The flag states WHY in words on its own rule above the
// section. Costs a line, but it is the only option where the learner learns
// something from the flag rather than just being coloured at.
const REASON = {
  info: null,
  warn: "Do this before you route, or you will redo it",
  critical: "Safety: read before you heat anything",
} as const;

export function F7({ num, title, body, severity }: SectionProps) {
  const reason = REASON[severity];
  return (
    <div>
      {reason ? (
        <p
          className={`flex items-center gap-3 border-t pt-2 font-mono text-[10px] uppercase tracking-[0.18em] ${SEV_TEXT[severity]}`}
          style={{ borderColor: SEV_VAR[severity] }}
        >
          <span aria-hidden>▸</span>
          {reason}
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
