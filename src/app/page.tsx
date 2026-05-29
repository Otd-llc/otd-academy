// Project list page. Default shows only un-archived projects; `?archived=1`
// includes archived rows too. Manifest-style table per design §8.3 / §9 —
// Bebas Neue title, Space Mono columns, command-gold project names.
//
// Server component: data fetched directly via Prisma. searchParams is async
// in Next.js 16 (must be awaited).
import Link from "next/link";
import { db } from "@/lib/db";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const params = await searchParams;
  const showArchived = params.archived === "1";

  const projects = await db.project.findMany({
    where: showArchived ? {} : { archivedAt: null },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-5xl tracking-wider text-white">
          PROJECT FOUNDRY
        </h1>
        <div className="flex items-center gap-4 font-mono text-xs uppercase">
          <Link
            href={showArchived ? "/" : "/?archived=1"}
            className="text-signal-blue underline"
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </Link>
          <Link
            href="/projects/new"
            className="rounded border border-panel-border bg-navy-dark px-4 py-2 text-command-gold transition-colors hover:border-command-gold"
          >
            + New project
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <p className="mt-10 font-mono text-sm uppercase tracking-wider text-muted">
          NO PROJECTS — CREATE ONE TO BEGIN.
        </p>
      ) : (
        <table className="mt-10 w-full border-collapse font-mono text-sm">
          <thead>
            <tr className="border-b border-panel-border text-left text-xs uppercase tracking-wider text-muted">
              <th className="py-3 pr-4 font-normal">Name</th>
              <th className="py-3 pr-4 font-normal">Slug</th>
              <th className="py-3 pr-4 font-normal">Updated</th>
              <th className="py-3 pr-4 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr
                key={p.id}
                className="border-b border-panel-border align-top"
              >
                <td className="py-3 pr-4">
                  <Link
                    href={`/projects/${p.slug}`}
                    className="text-command-gold hover:underline"
                  >
                    {p.name}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-muted">{p.slug}</td>
                <td className="py-3 pr-4 text-muted">
                  {p.updatedAt.toISOString().slice(0, 10)}
                </td>
                <td className="py-3 pr-4 text-muted">
                  {p.archivedAt ? "ARCHIVED" : "ACTIVE"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
