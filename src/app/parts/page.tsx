// Parts library list page (design §9 routes table).
//
// Phase 1 scope: list every Part with a single MAINS PARTS filter chip
// (m18, proposal §3 #5). When `?mains=1`, narrow to certified-module parts
// only. The filter chip pattern mirrors `src/app/page.tsx`'s FilterChip
// helper (Wave 1 review-fix: URL params are pre-validated against a known
// allowlist rather than passed raw into `where`).
import Link from "next/link";
import { db } from "@/lib/db";

function FilterChip({
  label,
  active,
  href,
}: {
  label: string;
  active: boolean;
  href: string;
}) {
  const base =
    "inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs uppercase tracking-wider transition-colors";
  const activeCls = "border-command-gold bg-command-gold text-navy-dark";
  const inactiveCls =
    "border-panel-border bg-navy-dark text-muted hover:border-command-gold hover:text-command-gold";
  return (
    <Link href={href} className={`${base} ${active ? activeCls : inactiveCls}`}>
      {label}
    </Link>
  );
}

export default async function PartsListPage({
  searchParams,
}: {
  searchParams: Promise<{ mains?: string }>;
}) {
  const params = await searchParams;
  // URL-param validation: explicit `=== "1"` check so any other value
  // (including the empty string) falls through to the un-filtered list
  // (Wave 1 review-fix pattern).
  const mainsOnly = params.mains === "1";

  const parts = await db.part.findMany({
    where: mainsOnly ? { isCertifiedModule: true } : {},
    orderBy: [{ manufacturer: "asc" }, { mpn: "asc" }],
    select: {
      id: true,
      mpn: true,
      manufacturer: true,
      description: true,
      category: true,
      lifecycle: true,
      isCertifiedModule: true,
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-5xl tracking-wider text-white">
          PARTS LIBRARY
        </h1>
        <div className="flex items-center gap-4 font-mono text-xs uppercase">
          <Link
            href="/"
            className="text-signal-blue underline"
          >
            ← Projects
          </Link>
          <Link
            href="/parts/new"
            className="rounded border border-panel-border bg-navy-dark px-4 py-2 text-command-gold transition-colors hover:border-command-gold"
          >
            + New part
          </Link>
        </div>
      </div>

      {/* m18: MAINS PARTS filter chip — narrows to certified-module parts.
          Toggle is round-trip stable: clicking the active chip clears the
          facet by linking back to `/parts`. */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <FilterChip
          label="ALL PARTS"
          active={!mainsOnly}
          href="/parts"
        />
        <FilterChip
          label="MAINS PARTS"
          active={mainsOnly}
          href={mainsOnly ? "/parts" : "/parts?mains=1"}
        />
      </div>

      {parts.length === 0 ? (
        <p className="mt-10 font-mono text-sm uppercase tracking-wider text-muted">
          {mainsOnly
            ? "NO CERTIFIED-MODULE PARTS YET."
            : "NO PARTS — CREATE ONE TO BEGIN."}
        </p>
      ) : (
        <table className="mt-10 w-full border-collapse font-mono text-sm">
          <thead>
            <tr className="border-b border-panel-border text-left text-xs uppercase tracking-wider text-muted">
              <th className="py-3 pr-4 font-normal">Manufacturer</th>
              <th className="py-3 pr-4 font-normal">MPN</th>
              <th className="py-3 pr-4 font-normal">Description</th>
              <th className="hidden py-3 pr-4 font-normal md:table-cell">
                Category
              </th>
              <th className="py-3 pr-4 font-normal">Lifecycle</th>
              <th className="py-3 pr-4 font-normal">Flags</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((p) => (
              <tr key={p.id} className="border-b border-panel-border align-top">
                <td className="py-3 pr-4 text-link-muted">{p.manufacturer}</td>
                <td className="py-3 pr-4 text-command-gold">{p.mpn}</td>
                <td className="py-3 pr-4 text-link-muted">{p.description}</td>
                <td className="hidden py-3 pr-4 text-muted md:table-cell">
                  {p.category ?? "—"}
                </td>
                <td className="py-3 pr-4 text-muted">{p.lifecycle}</td>
                <td className="py-3 pr-4">
                  {p.isCertifiedModule && (
                    <span className="inline-flex items-center rounded border border-panel-border bg-navy-dark px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-alert-red">
                      CERTIFIED MODULE
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
