"use client";

// SANDBOX ONLY — the tickable primitives, so the owner can actually CLICK the
// checklist variants instead of judging a static picture of one. Session-only
// state; a real build would decide persistence separately (the stage gate already
// persists attestations, so a Do-list probably should not double-store them).

import { useState } from "react";
import { T } from "./specimens";

const BOX = "mt-[5px] h-3.5 w-3.5 shrink-0 border transition-colors";

/** A single self-contained tick row: square box + label, dims when ticked. */
export function Tick({
  children,
  tone = "gold",
}: {
  children: React.ReactNode;
  tone?: "gold" | "green";
}) {
  const [on, setOn] = useState(false);
  const border = tone === "green" ? "border-status-green/70" : "border-command-gold/60";
  const fill = tone === "green" ? "bg-status-green" : "bg-command-gold";
  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      aria-pressed={on}
      className="flex w-full gap-3 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gold-light/70"
    >
      <span aria-hidden className={`${BOX} ${border} ${on ? fill : ""}`} />
      <span
        className={`font-serif text-[15px] leading-relaxed transition-colors ${
          on ? "text-gray-3 line-through decoration-1" : "text-muted"
        }`}
      >
        {children}
      </span>
    </button>
  );
}

/** A tick list that reports its own progress in the house Saira readout. */
export function TickCounted({
  items,
  label,
  tone = "gold",
}: {
  items: string[];
  label: string;
  tone?: "gold" | "green";
}) {
  const [done, setDone] = useState<boolean[]>(() => items.map(() => false));
  const n = done.filter(Boolean).length;
  const accent = tone === "green" ? "text-status-green" : "text-command-gold";
  const rule = tone === "green" ? "bg-status-green" : "bg-command-gold";
  const border = tone === "green" ? "border-status-green/70" : "border-command-gold/60";

  return (
    <section>
      <div className="flex items-baseline gap-3">
        <span className={`shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${accent}`}>
          {label}
        </span>
        <span aria-hidden className="h-px flex-1 bg-panel-border" />
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          <span className={`font-numeral text-base tabular-nums ${n === items.length ? accent : "text-text"}`}>
            {n}
          </span>
          {" / "}
          <span className="font-numeral text-base tabular-nums">{items.length}</span> done
        </span>
      </div>
      {/* Progress as a hairline that fills, not a rounded bar. */}
      <div className="mt-2 h-px w-full bg-panel-border">
        <div
          className={`h-px ${rule} transition-all`}
          style={{ width: `${(n / items.length) * 100}%` }}
        />
      </div>
      <ul className="mt-3 space-y-2.5">
        {items.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}
              aria-pressed={done[i]}
              className="flex w-full gap-3 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gold-light/70"
            >
              <span
                aria-hidden
                className={`${BOX} ${border} ${done[i] ? (tone === "green" ? "bg-status-green" : "bg-command-gold") : ""}`}
              />
              <span
                className={`font-serif text-[15px] leading-relaxed transition-colors ${
                  done[i] ? "text-gray-3 line-through decoration-1" : "text-muted"
                }`}
              >
                <T text={s} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Ticking reveals WHY the item matters: the list stays short until engaged. */
export function TickReveal({
  items,
  label,
  tone = "green",
  revealLabel = "why",
  secondLabel,
}: {
  items: { text: string; why: string; second?: string }[];
  label: string;
  tone?: "gold" | "green";
  /** Mono kicker on the revealed line. */
  revealLabel?: string;
  /** When set, a SECOND revealed line (e.g. why + how to fix). */
  secondLabel?: string;
}) {
  const [done, setDone] = useState<boolean[]>(() => items.map(() => false));
  const accent = tone === "green" ? "text-status-green" : "text-command-gold";
  const spine = tone === "green" ? "border-status-green" : "border-command-gold";
  const box = tone === "green" ? "border-status-green/70" : "border-command-gold/60";
  const fill = tone === "green" ? "bg-status-green" : "bg-command-gold";
  return (
    <section className={`border-l-2 ${spine} pl-4`}>
      <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${accent}`}>{label}</span>
      <ul className="mt-2.5 border-t border-panel-border/60">
        {items.map((it, i) => (
          <li key={i} className="border-b border-panel-border/60 py-2.5">
            <button
              type="button"
              onClick={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}
              aria-pressed={done[i]}
              aria-expanded={done[i]}
              className="flex w-full gap-3 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gold-light/70"
            >
              <span aria-hidden className={`${BOX} ${box} ${done[i] ? fill : ""}`} />
              <span className="font-serif text-[15px] leading-relaxed text-muted">
                <T text={it.text} />
              </span>
            </button>
            {done[i] ? (
              <>
                <p className="mt-1.5 flex gap-2.5 pl-[26px]">
                  <span aria-hidden className={`shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] ${accent}`}>
                    {revealLabel}
                  </span>
                  <span className="font-serif text-[14px] leading-relaxed text-gray-3">
                    <T text={it.why} />
                  </span>
                </p>
                {secondLabel && it.second ? (
                  <p className="mt-1 flex gap-2.5 pl-[26px]">
                    <span aria-hidden className={`shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] ${accent}`}>
                      {secondLabel}
                    </span>
                    <span className="font-serif text-[14px] leading-relaxed text-gray-3">
                      <T text={it.second} />
                    </span>
                  </p>
                ) : null}
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Triage tick: two answers per item, "looks right" and "not sure". Only the
 * second opens the help text, so a confident learner is never slowed down by an
 * explanation they did not ask for. The unsure state is a signal worth having.
 */
export function TickTriage({
  items,
  label,
}: {
  items: { text: string; help: string }[];
  label: string;
}) {
  const [state, setState] = useState<("ok" | "unsure" | null)[]>(() => items.map(() => null));
  const set = (i: number, v: "ok" | "unsure") =>
    setState((s) => s.map((cur, j) => (j === i ? (cur === v ? null : v) : cur)));

  const BTN =
    "border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gold-light/70";

  return (
    <section className="border-l-2 border-status-green pl-4">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-status-green">{label}</span>
      <ul className="mt-2.5 border-t border-panel-border/60">
        {items.map((it, i) => (
          <li key={i} className="border-b border-panel-border/60 py-2.5">
            <p
              className={`font-serif text-[15px] leading-relaxed transition-colors ${
                state[i] === "ok" ? "text-gray-3" : "text-muted"
              }`}
            >
              <T text={it.text} />
            </p>
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                onClick={() => set(i, "ok")}
                aria-pressed={state[i] === "ok"}
                className={`${BTN} ${
                  state[i] === "ok"
                    ? "border-status-green bg-status-green/15 text-status-green"
                    : "border-panel-border text-muted hover:border-status-green/60"
                }`}
              >
                traced, looks right
              </button>
              <button
                type="button"
                onClick={() => set(i, "unsure")}
                aria-pressed={state[i] === "unsure"}
                className={`${BTN} ${
                  state[i] === "unsure"
                    ? "border-command-gold bg-command-gold/15 text-command-gold"
                    : "border-panel-border text-muted hover:border-command-gold/60"
                }`}
              >
                not sure
              </button>
            </div>
            {state[i] === "unsure" ? (
              <p className="mt-2 flex gap-2.5">
                <span aria-hidden className="shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-command-gold">
                  look for
                </span>
                <span className="font-serif text-[14px] leading-relaxed text-text">
                  <T text={it.help} />
                </span>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
