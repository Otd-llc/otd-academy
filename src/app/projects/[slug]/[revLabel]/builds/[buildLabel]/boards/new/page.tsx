// /projects/[slug]/[revLabel]/builds/[buildLabel]/boards/new — server shell
// for the register-board form (design §9.3 routes table).
//
// Short-circuits with a friendly blocker message if the Build or its parent
// Revision is frozen — the createBoard action would refuse the write anyway,
// but bailing here gives the user the action-oriented message up front.
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { NewBoardForm } from "./_form";

type Params = { slug: string; revLabel: string; buildLabel: string };

export default async function NewBoardPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug, revLabel, buildLabel } = await params;
  const decodedRev = decodeURIComponent(revLabel);
  const decodedBuild = decodeURIComponent(buildLabel);

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

  const build = await db.build.findFirst({
    where: {
      revisionId: revision.id,
      label: { equals: decodedBuild, mode: "insensitive" },
    },
    select: { id: true, label: true, frozenAt: true },
  });
  if (!build) notFound();

  const revIsFrozen = revision.frozenAt !== null;
  const buildIsFrozen = build.frozenAt !== null;
  const blocker = revIsFrozen
    ? "Revision is frozen; cannot register new boards."
    : buildIsFrozen
      ? "Build is frozen; cannot register new boards."
      : null;

  const buildHref = `/projects/${project.slug}/${encodeURIComponent(
    revision.label,
  )}/builds/${encodeURIComponent(build.label)}`;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <nav className="mb-6 font-mono text-xs uppercase tracking-wider">
        <Link href={buildHref} className="text-signal-blue underline">
          ← {project.name} / {revision.label} / {build.label}
        </Link>
      </nav>

      <h1 className="font-display text-5xl tracking-wider text-white">
        REGISTER BOARD
      </h1>
      <p className="mt-2 font-mono text-xs uppercase tracking-wider text-muted">
        Capture serial and (optionally) the silkscreen git hash printed on the
        PCB.
      </p>

      <div className="mt-8 border border-panel-border bg-navy-dark p-6">
        {blocker ? (
          <p className="border-l-4 border-alert-red bg-navy-dark px-4 py-3 font-mono text-sm font-bold text-alert-red">
            {blocker}
          </p>
        ) : (
          <NewBoardForm buildId={build.id} />
        )}
      </div>
    </main>
  );
}
