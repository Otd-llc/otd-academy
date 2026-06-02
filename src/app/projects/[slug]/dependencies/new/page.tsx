// /projects/[slug]/dependencies/new — server shell.
// Resolves the current (dependent) project and the non-archived candidate
// targets it can depend on, then hands the lists to the client form. Auth
// is enforced at the proxy edge (per 12.9), so no requireUser here.
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ChevronLeftIcon } from "@/components/icons";
import { NewDependencyForm } from "./_form";

export default async function NewDependencyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const currentProject = await db.project.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
  if (!currentProject) notFound();

  // Self-edges are nonsensical (a project can't depend on itself), so the
  // candidate list excludes the current project up front. Archived projects
  // are filtered out — they can't legitimately gate active work.
  const candidates = await db.project.findMany({
    where: { archivedAt: null, id: { not: currentProject.id } },
    select: { id: true, slug: true, name: true },
    orderBy: { slug: "asc" },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <nav className="mb-6 font-mono text-xs uppercase tracking-wider">
        <Link
          href={`/projects/${currentProject.slug}`}
          className="inline-flex items-center gap-1.5 text-signal-blue underline"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          {currentProject.name}
        </Link>
      </nav>

      <h1 className="font-display text-5xl tracking-wider text-white">
        NEW DEPENDENCY
      </h1>
      <p className="mt-2 font-mono text-xs uppercase tracking-wider text-muted">
        Declare what {currentProject.name} depends on. Cycles are rejected at
        write time.
      </p>

      <div className="mt-8 glass-card p-4 sm:p-6">
        <NewDependencyForm
          currentProject={currentProject}
          candidates={candidates}
        />
      </div>
    </main>
  );
}
