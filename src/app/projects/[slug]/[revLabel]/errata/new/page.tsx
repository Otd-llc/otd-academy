// /projects/[slug]/[revLabel]/errata/new — server shell for the full-page
// Create-Erratum form (Task 11.3 / design §9 route table).
//
// Errata are the post-freeze write path (design §5.3), so this page renders
// the form whether the revision is frozen or not. No blocker banner; the
// REVISION stage itself is where errata get captured.
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { NewErratumForm } from "./_form";

type Params = { slug: string; revLabel: string };

export default async function NewErratumPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug, revLabel } = await params;
  const decodedRev = decodeURIComponent(revLabel);

  const project = await db.project.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
  if (!project) notFound();

  const revision = await db.revision.findFirst({
    where: {
      projectId: project.id,
      label: { equals: decodedRev, mode: "insensitive" },
    },
    select: { id: true, label: true, frozenAt: true },
  });
  if (!revision) notFound();

  // Same-project linkable revisions for the optional address-by dropdown.
  // The action layer re-checks the same-project constraint per design §12.1.
  const linkableRevisions = await db.revision.findMany({
    where: {
      projectId: project.id,
      NOT: { id: revision.id },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true },
  });

  const isFrozen = revision.frozenAt !== null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <nav className="mb-6 font-mono text-xs uppercase tracking-wider">
        <Link
          href={`/projects/${project.slug}/${encodeURIComponent(revision.label)}`}
          className="text-signal-blue underline"
        >
          ← {project.name} / {revision.label}
        </Link>
      </nav>

      <h1 className="font-display text-5xl tracking-wider text-white">
        NEW ERRATUM
      </h1>
      <p className="mt-2 font-mono text-xs uppercase tracking-wider text-muted">
        Errata can be logged at any time — including after the revision is
        frozen (the post-freeze write path).
        {isFrozen ? " This revision is currently frozen." : ""}
      </p>

      <div className="mt-8 border border-panel-border bg-navy-dark p-6">
        <NewErratumForm
          revisionId={revision.id}
          linkableRevisions={linkableRevisions}
        />
      </div>
    </main>
  );
}
