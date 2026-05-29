// /projects/[slug]/revisions/new — server shell.
// Loads the project + its existing revisions so the form can offer a
// copy-forward source. Redirects to /projects on a missing slug via
// notFound() (matches the project detail behavior).
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { NewRevisionForm } from "./_form";

export default async function NewRevisionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await db.project.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      revisions: {
        orderBy: { createdAt: "desc" },
        select: { id: true, label: true },
      },
    },
  });
  if (!project) notFound();

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <nav className="mb-6 font-mono text-xs uppercase tracking-wider">
        <Link href={`/projects/${project.slug}`} className="text-signal-blue underline">
          ← {project.name}
        </Link>
      </nav>

      <h1 className="font-display text-5xl tracking-wider text-white">
        NEW REVISION
      </h1>
      <p className="mt-2 font-mono text-xs uppercase tracking-wider text-muted">
        Every new revision starts at REQUIREMENTS, regardless of copy-forward.
      </p>

      <div className="mt-8 border border-panel-border bg-navy-dark p-6">
        <NewRevisionForm
          projectId={project.id}
          existingRevisions={project.revisions}
        />
      </div>
    </main>
  );
}
