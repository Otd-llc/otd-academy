// Admin: Library mini-lesson authoring index. Lists every mini-lesson (published
// + draft) with an edit link each, plus a "New" affordance.
//
// Admin-gated two ways: middleware bounces a non-admin off /admin/* (top ===
// "admin" in isAdminOnlyPath), and `requireAdmin()` here is the authoritative
// server gate — same pattern as /admin/waitlist.
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function LibraryAdminPage() {
  await requireAdmin();

  const lessons = await db.miniLesson.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      published: true,
      updatedAt: true,
      _count: { select: { relatedProjects: true } },
    },
    orderBy: [{ published: "asc" }, { updatedAt: "desc" }],
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="OPERATOR"
        title="Library authoring"
        accentWord="authoring"
        meta={[{ label: "LESSONS", value: lessons.length }]}
        lead="Public, gate-less Library mini-lessons — the SEO content moat. Create, edit, and publish here."
      />

      <Link
        href="/admin/library/new"
        className="mt-5 inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
      >
        <span aria-hidden="true">+</span> New mini-lesson
      </Link>

      {lessons.length === 0 ? (
        <p className="mt-8 font-mono text-sm uppercase tracking-wider text-muted">
          No mini-lessons yet.
        </p>
      ) : (
        <ul className="mt-8 border-t border-panel-border/60">
          {lessons.map((l) => (
            <li key={l.id} className="border-b border-panel-border/60 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                  href={`/admin/library/${l.id}`}
                  className="title-card hover:text-command-gold"
                >
                  {l.title}
                </Link>
                <span
                  className={
                    l.published
                      ? "inline-flex items-center rounded-full border border-command-gold/40 bg-command-gold/10 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-command-gold"
                      : "inline-flex items-center rounded-full border border-panel-border bg-deep-space px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-muted"
                  }
                >
                  {l.published ? "Published" : "Draft"}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                /library/{l.slug}
                <span className="text-gray-3">
                  {" "}
                  · {l._count.relatedProjects}{" "}
                  {l._count.relatedProjects === 1 ? "link" : "links"} · updated{" "}
                  {fmtDate(l.updatedAt)}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
