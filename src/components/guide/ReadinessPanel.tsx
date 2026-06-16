// Admin-only "definition of done" panel for the guide hub. Renders the two-tier
// readiness verdict (assessLessonReadiness): the publishable (free/SEO) bar and
// the vetted (premium) bar, plus the per-check breakdown so an author sees
// exactly what's left. Presentational — the page computes the readiness.

import type { LessonReadiness, ReadinessTier } from "@/lib/lesson-readiness";

function Bar({ label, ok, hint }: { label: string; ok: boolean; hint: string }) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-lg border px-4 py-3 ${
        ok
          ? "border-status-green/50 bg-status-green/5"
          : "border-panel-border bg-panel-border/5"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`font-mono text-sm font-bold ${
            ok ? "text-status-green" : "text-muted"
          }`}
        >
          {ok ? "✓" : "○"}
        </span>
        <span
          className={`font-mono text-xs font-bold uppercase tracking-[0.18em] ${
            ok ? "text-status-green" : "text-gray-2"
          }`}
        >
          {label}
        </span>
      </div>
      <span className="font-serif text-xs italic text-muted">{hint}</span>
    </div>
  );
}

const TIER_TAG: Record<ReadinessTier, string> = {
  publishable: "",
  vetted: "vetted",
  info: "info",
};

export function ReadinessPanel({ readiness }: { readiness: LessonReadiness }) {
  return (
    <section className="mb-8 rounded-xl border border-panel-border p-5 [background:linear-gradient(180deg,#13131f_0%,#0d0e14_100%)]">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-gold-dim">
          Lesson readiness
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          definition of done
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Bar
          label="Publishable"
          ok={readiness.publishable}
          hint="Free / SEO floor — content complete"
        />
        <Bar
          label="Vetted"
          ok={readiness.vetted}
          hint="Premium bar — real media + a built board"
        />
      </div>

      <ul className="mt-4 space-y-1.5">
        {readiness.checks.map((c) => {
          const mark = c.tier === "info" ? "·" : c.ok ? "✓" : "✗";
          const markClass =
            c.tier === "info"
              ? "text-muted"
              : c.ok
                ? "text-status-green"
                : "text-alert-red";
          const tag = TIER_TAG[c.tier];
          return (
            <li
              key={c.label}
              className="flex items-baseline gap-2 font-mono text-xs"
            >
              <span className={`w-3 shrink-0 font-bold ${markClass}`}>
                {mark}
              </span>
              <span className="text-gray-1">{c.label}</span>
              {tag ? (
                <span className="rounded bg-panel-border/40 px-1 py-px text-[9px] uppercase tracking-wider text-gray-3">
                  {tag}
                </span>
              ) : null}
              {c.detail ? (
                <span className="text-muted">— {c.detail}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
