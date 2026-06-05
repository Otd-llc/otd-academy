// Parts library list page (design §9 routes table).
//
// Phase A scope: query-driven list — search (`?q=`), lifecycle filter, MAINS
// filter, and sort, all built via `partsHref` and served by `listParts`.
// URL params are normalized through `partsListParamsSchema` (every field
// `.catch`es to a safe default, so a hand-edited querystring degrades rather
// than 500ing). Pagination + the responsive card/table split land in later
// tasks. The filter chip pattern mirrors `src/app/page.tsx`'s FilterChip helper.
import Link from "next/link";
import { PartLifecycle } from "@prisma/client";
import { db } from "@/lib/db";
import { ChevronLeftIcon, PlusIcon } from "@/components/icons";
import { PartGlanceTrigger } from "@/components/parts/PartGlanceTrigger";
import { PartsSearch } from "@/components/parts/PartsSearch";
import { PartsPagination } from "@/components/parts/PartsPagination";
import { partsListParamsSchema, PART_SORTS } from "@/lib/schemas/part";
import { listParts } from "@/lib/parts-list";
import { partsHref } from "@/lib/parts-list-url";

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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = partsListParamsSchema.parse(raw);
  const { parts, total, page, totalPages } = await listParts(db, params);
  // `current` for partsHref: only the string-valued params we honor.
  const current = {
    q: params.q,
    lifecycle: params.lifecycle,
    mains: params.mains ? "1" : undefined,
    sort: params.sort === "manufacturer" ? undefined : params.sort,
    page: page > 1 ? String(page) : undefined,
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-5xl tracking-wider text-white">
          PARTS LIBRARY
        </h1>
        <div className="flex items-center gap-4 font-mono text-xs uppercase">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-signal-blue underline"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Projects
          </Link>
          <Link
            href="/parts/new"
            className="inline-flex items-center gap-1.5 rounded border border-panel-border bg-navy-dark px-4 py-2 text-command-gold transition-colors hover:border-command-gold"
          >
            <PlusIcon className="h-4 w-4" />
            New part
          </Link>
        </div>
      </div>

      <PartsSearch initialQ={params.q ?? ""} current={current} />

      {/* Filter chips: ALL / MAINS + per-lifecycle. Each chip toggles its own
          facet off when active (links back through partsHref, which resets the
          page param on any filter change). */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <FilterChip
          label="ALL PARTS"
          active={!params.mains && !params.lifecycle}
          href={partsHref(current, { mains: undefined, lifecycle: undefined })}
        />
        <FilterChip
          label="MAINS PARTS"
          active={params.mains}
          href={partsHref(current, {
            mains: params.mains ? undefined : "1",
          })}
        />
        <span className="mx-1 hidden text-muted sm:inline">·</span>
        {Object.values(PartLifecycle).map((lc) => (
          <FilterChip
            key={lc}
            label={lc}
            active={params.lifecycle === lc}
            href={partsHref(current, {
              lifecycle: params.lifecycle === lc ? undefined : lc,
            })}
          />
        ))}
      </div>

      {/* Sort control: chips mirroring the filter pattern; right-aligned count. */}
      <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-xs uppercase text-muted">
        <span>Sort</span>
        {PART_SORTS.map((s) => (
          <FilterChip
            key={s}
            label={s}
            active={params.sort === s}
            href={partsHref(current, {
              sort: s === "manufacturer" ? undefined : s,
            })}
          />
        ))}
        <span className="ml-auto normal-case">
          {total} part{total === 1 ? "" : "s"}
        </span>
      </div>

      {total === 0 ? (
        <p className="mt-10 font-mono text-sm uppercase tracking-wider text-muted">
          {params.q || params.lifecycle || params.mains
            ? "NO PARTS MATCH THESE FILTERS."
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
              <th className="py-3 pr-4 text-right font-normal">
                <span className="sr-only">Quick glance</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {parts.map((p) => (
              <tr key={p.id} className="border-b border-panel-border align-top">
                <td className="py-3 pr-4 text-link-muted">{p.manufacturer}</td>
                <td className="py-3 pr-4">
                  <Link
                    href={`/parts/${p.id}`}
                    className="text-command-gold underline-offset-2 hover:underline"
                  >
                    {p.mpn}
                  </Link>
                </td>
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
                <td className="py-3 pr-0 text-right">
                  <PartGlanceTrigger partId={p.id} mpn={p.mpn} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <PartsPagination page={page} totalPages={totalPages} current={current} />
    </main>
  );
}
