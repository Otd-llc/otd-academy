// A learning-path card for the "Go further" gallery on /courses (server cmpt).
//
// Each card is a self-explanatory entry to another build: kind tag + name +
// one-line outcome + course count (and progress, signed-in). Links to
// `/courses?path=<key>`, which features that path as the page. The primary
// build gets a gold ★ accent so the hierarchy is obvious at a glance.

import type { PathDef } from "@/lib/skill-paths";

export interface PathCardProps {
  def: PathDef;
  total: number;
  done: number;
  signedIn: boolean;
}

const KIND_LABEL: Record<string, string> = {
  primary: "★ Primary build",
  mastery: "Mastery",
  bench: "Bench",
};

export function PathCard({ def, total, done, signedIn }: PathCardProps) {
  const isPrimary = def.kind === "primary";
  return (
    <a
      href={`/courses?path=${def.key}`}
      className={`glass-card group flex flex-col gap-2 p-5 transition-colors hover:bg-command-gold/5 ${
        isPrimary ? "ring-1 ring-command-gold/40" : ""
      }`}
    >
      <span
        className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
          isPrimary ? "text-command-gold" : "text-gold-dim"
        }`}
      >
        {KIND_LABEL[def.kind] ?? def.kind}
      </span>
      <span className="font-display text-2xl tracking-wide text-white">
        {def.label}
      </span>
      <span className="font-serif text-sm italic text-muted">{def.blurb}</span>
      <span className="mt-auto inline-flex items-center justify-between gap-2 pt-1 font-mono text-xs uppercase tracking-wider">
        <span className="text-muted">
          {signedIn && done > 0 ? `${done} / ${total} done` : `${total} courses`}
        </span>
        <span className="font-bold text-command-gold">
          View build <span aria-hidden="true">→</span>
        </span>
      </span>
    </a>
  );
}
