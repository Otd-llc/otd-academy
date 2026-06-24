// Printable BOM — a clean, print-friendly parts list / bench shopping sheet for a
// lesson's bill of materials (refDes · qty · MPN · manufacturer · datasheet). A
// light "document" layout that prints to paper or saves as PDF, a static companion
// to the interactive in-lesson BOM.
//
// PUBLIC for a project's PUBLIC published lesson (anyone can print it); PREMIUM /
// draft / non-published revisions are notFound() to anyone but an ADMIN, so no
// paywalled or unpublished BOM leaks. The route sits at the literal `guide/bom`
// segment (a static override of `guide/[stage]`), which the middleware already
// treats as public.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { summarizePrintableBom } from "@/lib/printable-bom";
import { PrintButton } from "@/components/guide/PrintButton";
import { ExternalLinkIcon } from "@/components/icons";

// Print views are a utility surface, not a landing page — keep them out of the
// index. A local const folded into generateMetadata below (Next forbids
// exporting both a `metadata` const and `generateMetadata` from one route).
const META: Metadata = { robots: { index: false, follow: true } };

type Params = Promise<{ slug: string; revLabel: string }>;

async function resolve(slug: string, revLabel: string) {
  const project = await db.project.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      publicTitle: true,
      accessTier: true,
      archivedAt: true,
      publishedRevisionId: true,
    },
  });
  if (!project || project.archivedAt) return null;
  const revision = await db.revision.findFirst({
    where: { projectId: project.id, label: revLabel },
    select: { id: true, label: true },
  });
  if (!revision) return null;
  return { project, revision };
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug, revLabel } = await params;
  const r = await resolve(slug, revLabel);
  if (!r) return META;
  const title = `BOM — ${r.project.publicTitle ?? r.project.name} (${r.revision.label})`;
  return { ...META, title };
}

export default async function PrintableBomPage({ params }: { params: Params }) {
  const { slug, revLabel } = await params;
  const r = await resolve(slug, revLabel);
  if (!r) notFound();
  const { project, revision } = r;

  // Gate: the PUBLIC published lesson is printable by anyone; everything else is
  // ADMIN-only (don't leak a PREMIUM / draft / superseded-revision BOM).
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const isPublicLesson =
    project.accessTier === "PUBLIC" &&
    project.publishedRevisionId === revision.id;
  if (!isPublicLesson && !isAdmin) notFound();

  const lines = await db.bomLine.findMany({
    where: { revisionId: revision.id },
    orderBy: { refDes: "asc" },
    select: {
      refDes: true,
      quantity: true,
      part: {
        select: {
          mpn: true,
          manufacturer: true,
          description: true,
          datasheetUrl: true,
          lifecycle: true,
        },
      },
    },
  });

  const bom = summarizePrintableBom(
    lines.map((l) => ({
      refDes: l.refDes,
      qty: l.quantity,
      mpn: l.part.mpn,
      manufacturer: l.part.manufacturer,
      description: l.part.description,
      datasheetUrl: l.part.datasheetUrl,
      lifecycle: l.part.lifecycle,
    })),
  );

  const title = project.publicTitle ?? project.name;
  const hubHref = `/projects/${slug}/${encodeURIComponent(revision.label)}/guide`;
  const date = new Date().toISOString().slice(0, 10);

  // A branded "paper" build sheet, modeled on the bioscale-viz hex PDF export
  // (dark title-block band · Bebas titles · gold meta labels · zebra table ·
  // legal footer) rendered in the academy palette. Print-friendly: white paper,
  // the site nav/footer drop out via `print:hidden` in the root layout.
  return (
    <main className="bg-deep-space px-4 py-8 print:bg-white print:p-0">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-xl bg-white text-[#14141e] shadow-[0_20px_60px_rgba(0,0,0,0.5)] print:max-w-none print:rounded-none print:shadow-none">
        {/* ── title-block band: brand · meta · actions ── */}
        <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 bg-navy-dark px-7 py-5 print:px-6">
          <div className="min-w-0">
            <div className="font-display text-2xl leading-none tracking-[0.12em] text-white">
              <span className="text-command-gold">OTD</span> ACADEMY
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-7 gap-y-1.5 sm:grid-cols-4">
              <Meta label="Revision" value={revision.label} />
              <Meta label="Lines" value={String(bom.lineCount)} />
              <Meta label="Parts" value={String(bom.totalParts)} />
              <Meta label="Date" value={date} />
            </dl>
          </div>
          <div className="flex items-center gap-3 print:hidden">
            <Link
              href={hubHref}
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-gray-2 transition-colors hover:text-command-gold"
            >
              ← Back
            </Link>
            <PrintButton />
          </div>
        </header>

        {/* ── paper body ── */}
        <div className="px-7 py-7 print:px-6 print:py-5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-gold-dim">
            Bill of Materials
          </p>
          <h1 className="mt-1.5 font-display text-[34px] leading-[1.04] tracking-[0.04em] text-[#14141e]">
            {title}
          </h1>

          {bom.lineCount === 0 ? (
            <p className="mt-8 font-serif italic text-[#555]">
              This lesson&apos;s BOM isn&apos;t locked yet.
            </p>
          ) : (
            <table className="mt-7 w-full border-collapse text-[11.5px]">
              <thead>
                <tr>
                  {["Ref", "Qty", "Manufacturer Part No.", "Manufacturer", "Description", "Datasheet"].map(
                    (h) => (
                      <th
                        key={h}
                        className="border-b-[1.5px] border-[#14141e] px-2.5 py-2 text-left font-display text-[12px] font-normal uppercase tracking-[0.16em] text-gold-dim first:pl-0"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {bom.lines.map((l, i) => (
                  <tr key={i} className="align-top even:bg-[#ecedf2]">
                    <td className="border-b border-[#d8d8d8] px-2.5 py-2 pl-0 font-mono font-bold text-[#14141e]">
                      {l.refDes}
                    </td>
                    <td className="border-b border-[#d8d8d8] px-2.5 py-2 font-bold">{l.qty}×</td>
                    <td className="border-b border-[#d8d8d8] px-2.5 py-2 font-mono text-[#14141e]">
                      {l.mpn ?? "—"}
                      {l.lifecycle !== "ACTIVE" ? (
                        <span className="ml-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#c0392b]">
                          {l.lifecycle}
                        </span>
                      ) : null}
                    </td>
                    <td className="border-b border-[#d8d8d8] px-2.5 py-2 text-[#14141e]">
                      {l.manufacturer ?? "—"}
                    </td>
                    <td className="border-b border-[#d8d8d8] px-2.5 py-2 text-[#444]">
                      {l.description ?? ""}
                    </td>
                    <td className="border-b border-[#d8d8d8] px-2.5 py-2">
                      {l.datasheetUrl ? (
                        <a
                          href={l.datasheetUrl}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex items-center gap-1 font-mono text-[10.5px] text-[#2a5fcc] hover:underline"
                        >
                          PDF
                          <ExternalLinkIcon className="h-3 w-3 shrink-0 print:hidden" />
                        </a>
                      ) : (
                        <span className="text-[#999]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* ── title-block footer: legal colophon ── */}
          <footer className="mt-9 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t-2 border-[#14141e] pt-3">
            <span className="font-display text-[14px] tracking-[0.18em] text-[#14141e]">
              ONE THOUSAND DRONES, LLC
            </span>
            <a
              href="https://academy.onethousanddrones.com"
              className="font-mono text-[10.5px] tracking-wider text-gold-dim no-underline"
            >
              academy.onethousanddrones.com
            </a>
            <p className="mt-1 w-full font-serif text-[10.5px] italic leading-relaxed text-[#555]">
              Auto-generated bench shopping sheet · verify availability, pricing, and specs against
              the datasheet before ordering.
            </p>
            <p className="mt-0.5 w-full font-mono text-[8.5px] leading-relaxed tracking-wide text-[#888]">
              © {new Date().getFullYear()} One Thousand Drones, LLC. All rights reserved.
            </p>
          </footer>
        </div>
      </article>
    </main>
  );
}

// A gold-label / light-value meta cell for the dark title-block band.
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 font-mono">
      <dt className="text-[9px] font-bold uppercase tracking-[0.18em] text-command-gold">
        {label}
      </dt>
      <dd className="truncate text-[12px] tracking-wide text-gray-1">{value}</dd>
    </div>
  );
}
