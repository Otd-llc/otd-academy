// IndexRows — a list of links as hairline rows on the bare field, with the arrow out
// at the right margin (sandbox round "F", 2026-07-20).
//
// It replaces a card grid that had been copy-pasted to five call sites: each link was
// `rounded border border-panel-border bg-deep-space/40 px-4 py-3` inside a
// `grid sm:grid-cols-2` — bordered AND filled AND rounded, three ways of drawing a
// boundary on a field that needed none. A list of content items is exactly the case
// the house system reserves for hairlines, and the same courses page already proved
// the point further down, where its FAQ uses `divide-y divide-panel-border`.
//
// The arrow is the reason this is a component rather than a className. In the old
// markup it was punctuation glued to the end of the title string ("Capacitors and
// decoupling →"), which made it part of the sentence and left it wherever the text
// happened to end. Pulled out to the right margin it terminates the rule instead, sits
// on a predictable axis down the list, and has somewhere to travel on hover.

import Link from "next/link";

export interface IndexRow {
  /** react key + the row's identity; usually a slug. */
  key: string;
  href: string;
  title: string;
  /** optional: rows render fine as a bare title list without it. */
  summary?: string | null;
}

export function IndexRows({
  rows,
  className = "mt-5",
}: {
  rows: IndexRow[];
  className?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <ul className={`${className} border-t border-panel-border/60`}>
      {rows.map((r) => (
        <li key={r.key}>
          <Link
            href={r.href}
            // The row's affordance is the hover/focus wash plus a gold-light title —
            // never a static underline or a blue resting colour. Focus gets its own
            // treatment because a keyboard user has to see where they are on the
            // deep-space field, and hover alone does not tell them.
            className="group flex items-baseline gap-4 border-b border-panel-border/60 py-4 transition-colors hover:bg-command-gold/[0.04] focus-visible:bg-command-gold/[0.06] focus-visible:outline-none"
          >
            <span className="flex min-w-0 flex-col gap-1">
              <span className="font-mono text-sm text-text group-hover:text-gold-light">
                {r.title}
              </span>
              {r.summary ? (
                <span className="max-w-2xl font-serif text-xs leading-snug text-muted">
                  {r.summary}
                </span>
              ) : null}
            </span>
            {/* motion-safe: the drift is decoration, so it does not run for a reader
                who has asked for less movement. The arrow itself still marks the row. */}
            <span
              aria-hidden="true"
              className="ml-auto shrink-0 font-mono text-sm text-command-gold motion-safe:transition-transform motion-safe:group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
