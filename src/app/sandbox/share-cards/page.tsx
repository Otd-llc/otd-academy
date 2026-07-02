// Share-card sandbox — the gallery (Task 2, the design GATE).
//
// Renders all six base-card families, each twice (short + long title), as real
// PNGs at 600×315 with a click-through to full 1200×630. Josh picks the family
// (and any mix-and-match notes) before any variant is built.
//
// Dev-only: notFound() in production. Graduates to the permanent dev-only
// visual-regression gallery in Task 9 (repointed at the real shipped cards),
// so it is guarded here, not deleted.

import { notFound } from "next/navigation";
import { OPTIONS, type TitleLen } from "./meta";

export const dynamic = "force-dynamic";

const LENS: { len: TitleLen; label: string }[] = [
  { len: "short", label: "Short title" },
  { len: "long", label: "Long title" },
];

export default function ShareCardsSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="border-b border-panel-border/60 pb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Sandbox
        </p>
        <h1 className="title-hero mt-3">Share cards</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Six base-card families for the academy share-card system. Pick a family
          (mix-and-match notes welcome) and I build the per-surface variants from
          it. Each is shown with a short and a long title so wrap behavior is
          visible. Click any card for full 1200&times;630.
        </p>
        {/* Baked-dark note: the usual sandbox dark/light toggle does NOT apply. */}
        <p className="mt-6 border-l-2 border-command-gold pl-4 font-mono text-[11px] uppercase leading-relaxed tracking-[0.18em] text-gold-light">
          Cards are baked dark artifacts · the sandbox dark / light toggle
          convention does not apply here · they render dark in every client.
        </p>
      </header>

      {OPTIONS.map((opt) => (
        <section key={opt.id} className="mt-12 border-b border-panel-border/60 pb-12">
          <div className="flex items-baseline gap-3">
            <span className="font-numeral text-3xl tabular-nums text-command-gold">
              {opt.id}
            </span>
            <h2 className="title-card">{opt.label}</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted">{opt.blurb}</p>

          <div className="mt-5 flex flex-wrap gap-8">
            {LENS.map(({ len, label }) => (
              <figure key={len} className="flex flex-col gap-2">
                <figcaption className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
                  {label}
                </figcaption>
                <a
                  href={`/sandbox/share-cards/img/${opt.id}-${len}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block border border-panel-border/60 transition-colors hover:border-command-gold focus-visible:border-command-gold focus-visible:outline-none"
                >
                  {/* Plain img: the route is a dynamic PNG handler, not a static
                      asset, so we skip next/image optimization here. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/sandbox/share-cards/img/${opt.id}-${len}`}
                    alt={`Option ${opt.id} (${opt.label}), ${label.toLowerCase()}`}
                    width={600}
                    height={315}
                    className="block"
                  />
                </a>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
