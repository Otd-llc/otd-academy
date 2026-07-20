"use client";

// D8c3 — the trace list. Each thing to check by eye gets two verdicts, and only
// "not sure" opens the answer key. A confident learner is never slowed down by an
// explanation they did not ask for, and the uncertain answer is a signal worth
// having: it is the learner telling you which target the lesson under-explained.
//
// These items used to live as numbered clauses buried in a body paragraph, where
// they could not be counted, answered, or matched against the stage gate that
// asks for the same three.
//
// CLIENT component (verdict state is local) and SESSION-ONLY, matching
// DoStepsBlock and SelfCheckBlock. See the note there on why this does not
// persist.

import { useId, useState } from "react";
import { Inline } from "@/components/guide/InlineText";

type Verdict = "ok" | "unsure";

const BTN =
  "border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gold-light/70";

export function TraceListBlock({
  headline,
  body,
  items,
}: {
  headline: string;
  body: string;
  items: { text: string; help?: string }[];
}) {
  const [state, setState] = useState<(Verdict | null)[]>(() => items.map(() => null));
  const baseId = useId();

  const set = (i: number, v: Verdict) =>
    setState((s) => s.map((cur, j) => (j === i ? (cur === v ? null : v) : cur)));

  return (
    <div>
      {body ? (
        <p className="mb-3 whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-muted">
          <Inline text={body} />
        </p>
      ) : null}
      <section className="border-l-2 border-status-green pl-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-status-green">
          Eyeball it · {headline}
        </span>
        <ul className="mt-2.5 border-t border-panel-border/60">
          {items.map((it, i) => {
            const helpId = `${baseId}-help-${i}`;
            const unsure = state[i] === "unsure";
            const hasHelp = Boolean(it.help);
            return (
              <li key={i} className="border-b border-panel-border/60 py-2.5">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
                  {/* Deliberately NOT dimmed on "looks right": the selected verdict
                      already carries that state unmistakably, and the sandbox dimmed
                      it to gray-3, which fails WCAG AA in both themes. */}
                  <p className="min-w-0 flex-1 font-serif text-[15px] leading-relaxed text-muted">
                    <Inline text={it.text} />
                  </p>
                  {/* The two verdicts are two answers to ONE question, so they are
                      grouped and the group is named. Loose in a list they are
                      announced as two unrelated controls. */}
                  <div
                    role="group"
                    aria-label={`Verdict: ${it.text}`}
                    className="flex flex-wrap gap-2"
                  >
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
                    {/* This verdict OPENS a region, so it carries aria-expanded and
                        points at what it opens. aria-pressed alone tells a screen
                        reader the button is on and never that something appeared. */}
                    <button
                      type="button"
                      onClick={() => set(i, "unsure")}
                      aria-pressed={unsure}
                      {...(hasHelp
                        ? { "aria-expanded": unsure, "aria-controls": helpId }
                        : {})}
                      className={`${BTN} ${
                        unsure
                          ? "border-command-gold bg-command-gold/15 text-command-gold"
                          : "border-panel-border text-muted hover:border-command-gold/60"
                      }`}
                    >
                      not sure
                    </button>
                  </div>
                </div>
                {unsure && it.help ? (
                  <p id={helpId} className="mt-2 flex gap-2.5">
                    <span
                      aria-hidden
                      className="shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-command-gold"
                    >
                      look for
                    </span>
                    <span className="font-serif text-[14px] leading-relaxed text-text">
                      <Inline text={it.help} />
                    </span>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
