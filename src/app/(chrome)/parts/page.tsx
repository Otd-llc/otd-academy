// Parts library list page (design §9 routes table).
//
// Phase A scope: query-driven list — search (`?q=`), lifecycle filter, MAINS
// filter, and sort, all built via `partsHref` and served by `listParts`.
// URL params are normalized through `partsListParamsSchema` (every field
// `.catch`es to a safe default, so a hand-edited querystring degrades rather
// than 500ing). Pagination + the responsive card/table split land in later
// tasks. The filter chip pattern mirrors `src/app/page.tsx`'s FilterChip helper.
import type { Metadata } from "next";
import Link from "next/link";
import { PartLifecycle } from "@prisma/client";
import { auth } from "@/auth";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/lib/db";
import { ONE_HOUR, TAG_PARTS } from "@/lib/cache-profile";
import { ChevronLeftIcon, PlusIcon } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { PartCard } from "@/components/parts/PartCard";
import { PartGlanceTrigger } from "@/components/parts/PartGlanceTrigger";
import { DkAvailabilityCell } from "@/components/parts/DkAvailabilityCell";
import { PartsSearch } from "@/components/parts/PartsSearch";
import { PartsPagination } from "@/components/parts/PartsPagination";
import { CategoryTreePicker } from "@/components/parts/CategoryTreePicker";
import { partsListParamsSchema, PART_SORTS } from "@/lib/schemas/part";
import { listParts } from "@/lib/parts-list";
import { partsHref } from "@/lib/parts-list-url";
import { categoryLabel } from "@/lib/categories";

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

// SEO. The list is query-driven (search/filter/sort via ?params) but the
// indexable surface is the canonical, param-free catalog landing.
const title = "Parts library — One Thousand Drones Academy";
const description =
  "Browse the One Thousand Drones Academy parts catalog — manufacturer part numbers, datasheets, lifecycle status, and KiCad symbols/footprints.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/parts" },
  openGraph: { title, description, type: "website", url: "/parts" },
  twitter: { card: "summary_large_image", title, description },
};

// The DEFAULT catalog view — no filters, page 1. Cached with a CONSTANT key.
//
// Taking no arguments is the whole point. /parts carries user-controlled ?q= and
// ?cat= (free text, per src/lib/schemas/part.ts), so a cached function keyed on the
// params would mint an entry per distinct search string — traffic-scaled DB reads and
// a poisoned LRU, which is what caching here is meant to prevent. Only the unfiltered
// view is cached, and that is exactly the URL the sitemap emits and crawlers hit; a
// real user's search falls through to the live query below, where freshness matters
// more than the read.
//
// PartsListRow is plain scalars + Dates (no Decimal — the schema's only one is
// Project.targetCost, which is not in LIST_SELECT), so it crosses the boundary safely.
async function cachedDefaultPartsPage() {
  "use cache";
  cacheLife(ONE_HOUR);
  cacheTag(TAG_PARTS);
  return listParts(db, partsListParamsSchema.parse({}));
}

export default async function PartsListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = partsListParamsSchema.parse(raw);
  const isDefaultView =
    !params.q &&
    !params.cat &&
    !params.lifecycle &&
    !params.mains &&
    params.sort === "manufacturer" &&
    params.page === 1;
  const { parts, total, page, totalPages } = isDefaultView
    ? await cachedDefaultPartsPage()
    : await listParts(db, params);
  // The catalog is public (read-only) — the author affordances (New part, the
  // operator dashboard back-link) render for ADMINs only. `auth()` is null for
  // a signed-out visitor, so they simply get the read-only catalog.
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  // `current` for partsHref: only the string-valued params we honor.
  const current = {
    q: params.q,
    lifecycle: params.lifecycle,
    mains: params.mains ? "1" : undefined,
    cat: params.cat,
    sort: params.sort === "manufacturer" ? undefined : params.sort,
    page: page > 1 ? String(page) : undefined,
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {isAdmin && (
        <div className="mb-5 flex items-center justify-end gap-4 font-mono text-xs uppercase">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-signal-blue underline"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Projects
          </Link>
          <Link
            href="/parts/new"
            className="inline-flex items-center gap-1.5 rounded-md border border-panel-border bg-navy-dark px-4 py-2 text-command-gold transition-colors hover:border-command-gold"
          >
            <PlusIcon className="h-4 w-4" />
            New part
          </Link>
        </div>
      )}
      <PageHeader
        eyebrow="COMPONENT CATALOG"
        title="Parts library"
        accentWord="library"
        lead="Every component behind the curriculum boards: real manufacturer part numbers, datasheets, lifecycle status, and KiCad symbols and footprints, priced against live DigiKey stock."
      />

      {/* Control bar — search, facets, and sort as one instrument panel, with
          the live catalog count as the readout. */}
      <section className="mt-8 rounded-2xl border border-panel-border bg-bg-2/30 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 pb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-command-gold">
            Search the catalog
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            <span className="text-title">{total}</span>{" "}
            {total === 1 ? "part" : "parts"}
          </span>
        </div>

        <PartsSearch initialQ={params.q ?? ""} current={current} />

        {/* Filter chips: ALL / MAINS + per-lifecycle. Each chip toggles its own
            facet off when active (links back through partsHref, which resets the
            page param on any filter change). */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
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

        {/* Sort control: chips mirroring the filter pattern. */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-panel-border/60 pt-3 font-mono text-xs uppercase text-muted">
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
        </div>
      </section>

      {/* Category subtree navigation (Phase B): tree of links setting ?cat=, an
          active-node breadcrumb, and per-node subtree counts. */}
      <CategoryTreePicker activePath={params.cat} current={current} />

      {total === 0 ? (
        <p className="mt-10 font-mono text-sm uppercase tracking-wider text-muted">
          {params.q || params.lifecycle || params.mains || params.cat
            ? "NO PARTS MATCH THESE FILTERS."
            : isAdmin
              ? "NO PARTS — CREATE ONE TO BEGIN."
              : "NO PARTS YET."}
        </p>
      ) : (
        <>
          {/* Desktop: table at md+ (overflow guard mirrors BoardsTable). */}
          <div className="mt-10 hidden overflow-x-auto md:block">
            <table className="w-full border-collapse font-mono text-sm">
              <thead>
                <tr className="border-b-2 border-command-gold/60 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-command-gold">
                  <th className="py-3 pr-4 font-normal">Manufacturer</th>
                  <th className="py-3 pr-4 font-normal">MPN</th>
                  <th className="py-3 pr-4 font-normal">Description</th>
                  <th className="hidden py-3 pr-4 font-normal md:table-cell">
                    Category
                  </th>
                  <th className="py-3 pr-4 font-normal">Lifecycle</th>
                  <th className="hidden py-3 pr-4 font-normal lg:table-cell">
                    DigiKey
                  </th>
                  <th className="py-3 pr-4 font-normal">Flags</th>
                  <th className="py-3 pr-4 text-right font-normal">
                    <span className="sr-only">Quick glance</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-panel-border align-top"
                  >
                    <td className="py-3 pr-4 text-link-muted">
                      {p.manufacturer}
                    </td>
                    <td className="py-3 pr-4">
                      <Link
                        href={`/parts/${p.id}`}
                        className="text-command-gold underline-offset-2 hover:underline"
                      >
                        {p.mpn}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-link-muted">
                      {p.description}
                    </td>
                    <td className="hidden py-3 pr-4 text-muted md:table-cell">
                      {categoryLabel(p)}
                    </td>
                    <td className="py-3 pr-4 text-muted">{p.lifecycle}</td>
                    <td className="hidden py-3 pr-4 lg:table-cell">
                      <DkAvailabilityCell part={p} />
                    </td>
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
          </div>
          {/* Mobile: stacked cards below md. */}
          <ul className="mt-8 flex flex-col gap-3 md:hidden">
            {parts.map((p) => (
              <PartCard key={p.id} part={p} />
            ))}
          </ul>
        </>
      )}

      <PartsPagination page={page} totalPages={totalPages} current={current} />
    </main>
  );
}
