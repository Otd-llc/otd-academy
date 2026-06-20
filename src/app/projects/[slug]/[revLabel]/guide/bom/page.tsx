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

  return (
    <main className="mx-auto max-w-4xl bg-white px-6 py-8 text-black print:py-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-neutral-600">
            Bill of materials · revision {revision.label} ·{" "}
            {bom.lineCount} line{bom.lineCount === 1 ? "" : "s"} · {bom.totalParts}{" "}
            part{bom.totalParts === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-3 print:hidden">
          <Link href={hubHref} className="text-sm text-blue-700 underline">
            ← Back to lesson
          </Link>
          <PrintButton />
        </div>
      </div>

      {bom.lineCount === 0 ? (
        <p className="text-neutral-600">This lesson&apos;s BOM isn&apos;t locked yet.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-1 pr-3">Ref</th>
              <th className="py-1 pr-3">Qty</th>
              <th className="py-1 pr-3">Manufacturer Part No.</th>
              <th className="py-1 pr-3">Manufacturer</th>
              <th className="py-1 pr-3">Description</th>
              <th className="py-1">Datasheet</th>
            </tr>
          </thead>
          <tbody>
            {bom.lines.map((l, i) => (
              <tr key={i} className="border-b border-neutral-300 align-top">
                <td className="py-1 pr-3 font-mono">{l.refDes}</td>
                <td className="py-1 pr-3">{l.qty}</td>
                <td className="py-1 pr-3 font-mono">
                  {l.mpn ?? "—"}
                  {l.lifecycle !== "ACTIVE" ? (
                    <span className="ml-1 font-sans text-xs font-bold uppercase text-red-700">
                      {l.lifecycle}
                    </span>
                  ) : null}
                </td>
                <td className="py-1 pr-3">{l.manufacturer ?? "—"}</td>
                <td className="py-1 pr-3">{l.description ?? ""}</td>
                <td className="py-1">
                  {l.datasheetUrl ? (
                    <a
                      href={l.datasheetUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 text-blue-700 underline"
                    >
                      PDF
                      <ExternalLinkIcon className="h-3 w-3 shrink-0 print:hidden" />
                    </a>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="mt-6 text-xs text-neutral-500">
        One Thousand Drones Academy · academy.onethousanddrones.com
      </p>
    </main>
  );
}
