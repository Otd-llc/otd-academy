"use client";

// SANDBOX ONLY — round 4 interactive primitives. Delete with the route.
//
// Round 3 established that the triage move (D8c) is worth generalising: instead
// of one binary tick, the learner states WHICH answer they have, and only the
// uncertain answer costs them an explanation. This file makes that reusable so a
// Do step and a trace target can share one instrument.

import { useState } from "react";
import { T } from "./specimens";

export type Tone = "gold" | "green";

const TONE = {
  gold: {
    text: "text-command-gold",
    spine: "border-command-gold",
    soft: "border-command-gold/60",
    fill: "bg-command-gold/15",
    solid: "border-command-gold",
  },
  green: {
    text: "text-status-green",
    spine: "border-status-green",
    soft: "border-status-green/60",
    fill: "bg-status-green/15",
    solid: "border-status-green",
  },
} as const;

const BTN =
  "border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gold-light/70";

export interface Verdict {
  key: string;
  label: string;
  /** Which tone the button takes when selected. */
  tone: Tone | "red";
  /** Verdicts with `reveals` open the matching help text on the item. */
  reveals?: "help" | "fix";
}

export interface TriageItem {
  text: string;
  help?: string;
  fix?: string;
}

const SELECTED: Record<Tone | "red", string> = {
  gold: "border-command-gold bg-command-gold/15 text-command-gold",
  green: "border-status-green bg-status-green/15 text-status-green",
  red: "border-alert-red bg-alert-red/15 text-alert-red",
};

/**
 * Verdict-per-item list. `layout: "inline"` puts the verdicts at the right of
 * the row (compact); "stack" puts them beneath (roomier, easier on mobile).
 * `summary` receives the tallies so a variant can close with a gate readout.
 */
export function Triage({
  items,
  label,
  verdicts,
  tone = "green",
  layout = "stack",
  helpLabel = "look for",
  fixLabel = "fix",
  summary,
}: {
  items: TriageItem[];
  label: string;
  verdicts: Verdict[];
  tone?: Tone;
  layout?: "stack" | "inline";
  helpLabel?: string;
  fixLabel?: string;
  summary?: (t: { total: number; answered: number; byKey: Record<string, number> }) => React.ReactNode;
}) {
  const [state, setState] = useState<(string | null)[]>(() => items.map(() => null));
  const C = TONE[tone];

  const set = (i: number, v: string) =>
    setState((s) => s.map((cur, j) => (j === i ? (cur === v ? null : v) : cur)));

  const byKey: Record<string, number> = {};
  for (const v of verdicts) byKey[v.key] = state.filter((s) => s === v.key).length;
  const answered = state.filter(Boolean).length;

  const buttons = (i: number) => (
    <div className={`flex flex-wrap gap-2 ${layout === "inline" ? "" : "mt-1.5"}`}>
      {verdicts.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => set(i, v.key)}
          aria-pressed={state[i] === v.key}
          className={`${BTN} ${
            state[i] === v.key ? SELECTED[v.tone] : "border-panel-border text-muted hover:border-command-gold/60"
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );

  return (
    <section className={`border-l-2 ${C.spine} pl-4`}>
      <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${C.text}`}>{label}</span>
      <ul className="mt-2.5 border-t border-panel-border/60">
        {items.map((it, i) => {
          const chosen = verdicts.find((v) => v.key === state[i]);
          const reveal = chosen?.reveals;
          const done = state[i] !== null && !reveal;
          return (
            <li key={i} className="border-b border-panel-border/60 py-2.5">
              <div className={layout === "inline" ? "flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5" : ""}>
                <p
                  className={`font-serif text-[15px] leading-relaxed transition-colors ${
                    done ? "text-gray-3" : "text-muted"
                  } ${layout === "inline" ? "min-w-0 flex-1" : ""}`}
                >
                  <T text={it.text} />
                </p>
                {buttons(i)}
              </div>
              {reveal === "help" && it.help ? (
                <p className="mt-2 flex gap-2.5">
                  <span aria-hidden className="shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-command-gold">
                    {helpLabel}
                  </span>
                  <span className="font-serif text-[14px] leading-relaxed text-text">
                    <T text={it.help} />
                  </span>
                </p>
              ) : null}
              {reveal === "fix" && it.fix ? (
                <p className="mt-2 flex gap-2.5">
                  <span aria-hidden className="shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-alert-red">
                    {fixLabel}
                  </span>
                  <span className="font-serif text-[14px] leading-relaxed text-text">
                    <T text={it.fix} />
                  </span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {summary ? <div className="mt-2.5">{summary({ total: items.length, answered, byKey })}</div> : null}
    </section>
  );
}

/**
 * A plain tick with a quiet on-demand "what should I see?" disclosure. The
 * lowest-chrome way to carry an answer key: nothing appears unless asked for.
 */
export function TickAsk({
  items,
  label,
  tone = "gold",
  askLabel = "what should I see?",
  proofLabel = "you should see",
}: {
  items: { text: string; proof: string }[];
  label: string;
  tone?: Tone;
  askLabel?: string;
  proofLabel?: string;
}) {
  const [done, setDone] = useState<boolean[]>(() => items.map(() => false));
  const [open, setOpen] = useState<boolean[]>(() => items.map(() => false));
  const C = TONE[tone];
  return (
    <section className={`border-l-2 ${C.spine} pl-4`}>
      <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${C.text}`}>{label}</span>
      <ul className="mt-2.5 space-y-3">
        {items.map((it, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}
              aria-pressed={done[i]}
              className="flex w-full gap-3 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gold-light/70"
            >
              <span
                aria-hidden
                className={`mt-[5px] h-3.5 w-3.5 shrink-0 border transition-colors ${C.soft} ${
                  done[i] ? (tone === "green" ? "bg-status-green" : "bg-command-gold") : ""
                }`}
              />
              <span
                className={`font-serif text-[15px] leading-relaxed transition-colors ${
                  done[i] ? "text-gray-3 line-through decoration-1" : "text-muted"
                }`}
              >
                <T text={it.text} />
              </span>
            </button>
            <div className="pl-[26px]">
              <button
                type="button"
                onClick={() => setOpen((o) => o.map((v, j) => (j === i ? !v : v)))}
                aria-expanded={open[i]}
                className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-gray-3 underline-offset-4 hover:text-command-gold focus-visible:text-command-gold focus-visible:outline-none"
              >
                {open[i] ? "hide" : askLabel}
              </button>
              {open[i] ? (
                <p className="mt-1 flex gap-2.5">
                  <span aria-hidden className="shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-status-green">
                    {proofLabel}
                  </span>
                  <span className="font-serif text-[14px] leading-relaxed text-gray-3">{it.proof}</span>
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Two-stage: ticking shows the proof automatically; a "didn't work" button then
 * opens the fix. The happy path costs one click and the failure path is one more.
 */
export function TickThenFail({
  items,
  label,
}: {
  items: { text: string; proof: string; fix: string }[];
  label: string;
}) {
  const [done, setDone] = useState<boolean[]>(() => items.map(() => false));
  const [failed, setFailed] = useState<boolean[]>(() => items.map(() => false));
  return (
    <section className="border-l-2 border-command-gold pl-4">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-command-gold">{label}</span>
      <ul className="mt-2.5 border-t border-panel-border/60">
        {items.map((it, i) => (
          <li key={i} className="border-b border-panel-border/60 py-2.5">
            <button
              type="button"
              onClick={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}
              aria-pressed={done[i]}
              className="flex w-full gap-3 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gold-light/70"
            >
              <span
                aria-hidden
                className={`mt-[5px] h-3.5 w-3.5 shrink-0 border border-command-gold/60 transition-colors ${
                  done[i] ? "bg-command-gold" : ""
                }`}
              />
              <span className={`font-serif text-[15px] leading-relaxed ${done[i] ? "text-gray-3" : "text-muted"}`}>
                <T text={it.text} />
              </span>
            </button>
            {done[i] ? (
              <div className="mt-1.5 pl-[26px]">
                <p className="flex gap-2.5">
                  <span aria-hidden className="shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-status-green">
                    you should see
                  </span>
                  <span className="font-serif text-[14px] leading-relaxed text-gray-3">{it.proof}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setFailed((f) => f.map((v, j) => (j === i ? !v : v)))}
                  aria-expanded={failed[i]}
                  className={`${BTN} mt-1.5 ${
                    failed[i] ? SELECTED.red : "border-panel-border text-muted hover:border-alert-red/60"
                  }`}
                >
                  {failed[i] ? "hide" : "didn't work"}
                </button>
                {failed[i] ? (
                  <p className="mt-1.5 flex gap-2.5">
                    <span aria-hidden className="shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-alert-red">
                      fix
                    </span>
                    <span className="font-serif text-[14px] leading-relaxed text-text">{it.fix}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
