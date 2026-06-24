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
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { summarizePrintableBom } from "@/lib/printable-bom";
import { PrintButton } from "@/components/guide/PrintButton";
import { PageHeader } from "@/components/PageHeader";
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
  const accentWord = title.trim().split(/\s+/).pop();

  // The academy's own page language: the bench-hero PageHeader + the table-tech
  // data table on the deep-space field. Print keeps the dark theme (forced through
  // the print pipeline) so the saved PDF reads as the same branded sheet.
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <style
        dangerouslySetInnerHTML={{
          __html:
            "@media print{@page{margin:10mm}html,body{background:#08090d!important}" +
            "*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}",
        }}
      />
      <PageHeader
        backHref={hubHref}
        backLabel="Build guide"
        eyebrow="BILL OF MATERIALS"
        title={title}
        accentWord={accentWord}
        lead="The bench shopping sheet — print it or save a PDF for your parts run."
        meta={[
          { label: "Revision", value: revision.label },
          { label: "Lines", value: bom.lineCount },
          { label: "Parts", value: bom.totalParts },
        ]}
      />

      <div className="mb-6 flex items-center gap-3 print:hidden">
        <PrintButton />
      </div>

      {bom.lineCount === 0 ? (
        <p className="font-mono text-sm uppercase tracking-wider text-muted">
          This lesson&apos;s BOM isn&apos;t locked yet.
        </p>
      ) : (
        <div className="glass-card overflow-x-auto px-3 py-2 sm:px-5 sm:py-3">
          <table className="table-tech min-w-full">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Qty</th>
                <th>Manufacturer Part No.</th>
                <th>Manufacturer</th>
                <th>Description</th>
                <th>Datasheet</th>
              </tr>
            </thead>
            <tbody>
              {bom.lines.map((l, i) => (
                <tr key={i}>
                  <td data-label="Ref">
                    <span className="ref">{l.refDes}</span>
                  </td>
                  <td data-label="Qty">{l.qty}×</td>
                  <td data-label="Mfr Part No.">
                    <span className="mpn">{l.mpn ?? "—"}</span>
                    {l.lifecycle !== "ACTIVE" ? (
                      <span className="badge critical ml-2 align-middle">{l.lifecycle}</span>
                    ) : null}
                  </td>
                  <td data-label="Manufacturer">{l.manufacturer ?? "—"}</td>
                  <td data-label="Description">{l.description ?? ""}</td>
                  <td data-label="Datasheet">
                    {l.datasheetUrl ? (
                      <a
                        href={l.datasheetUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1 text-signal-blue hover:underline"
                      >
                        PDF
                        <ExternalLinkIcon className="h-3 w-3 shrink-0 print:hidden" />
                      </a>
                    ) : (
                      <span className="text-gray-3">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-8 font-mono text-[10px] uppercase leading-relaxed tracking-[0.2em] text-gray-3">
        One Thousand Drones, LLC · academy.onethousanddrones.com · verify availability &amp; specs
        against the datasheet before ordering.
      </p>
    </main>
  );
}
