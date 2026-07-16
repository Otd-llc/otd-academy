// Admin: waitlist demand view. Per-course signup counts (most-wanted first) +
// the captured emails, with a CSV export. The demand signal that tells us which
// unbuilt board to design/build next.
//
// Admin-gated two ways: the middleware bounces a LEARNER off /admin/* (it's in
// isAdminOnlyPath), and `requireAdmin()` here is the authoritative server gate.

import Link from "next/link";
import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function WaitlistAdminPage() {
  await requireAdmin();

  const signups = await db.waitlistSignup.findMany({
    select: {
      email: true,
      createdAt: true,
      project: { select: { slug: true, name: true, publicTitle: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Group by course, most-wanted first.
  const byCourse = new Map<
    string,
    { title: string; slug: string; emails: { email: string; createdAt: Date }[] }
  >();
  for (const s of signups) {
    const slug = s.project.slug;
    const entry = byCourse.get(slug);
    if (entry) {
      entry.emails.push({ email: s.email, createdAt: s.createdAt });
    } else {
      byCourse.set(slug, {
        slug,
        title: s.project.publicTitle ?? s.project.name,
        emails: [{ email: s.email, createdAt: s.createdAt }],
      });
    }
  }
  const courses = [...byCourse.values()].sort(
    (a, b) => b.emails.length - a.emails.length,
  );
  const total = signups.length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="OPERATOR"
        title="Waitlist demand"
        accentWord="demand"
        meta={[
          { label: "SIGNUPS", value: total },
          { label: "COURSES", value: courses.length },
        ]}
        lead="Who's waiting on which unbuilt course, most-wanted first. The signal for which board to design next."
      />

      {total > 0 ? (
        <a
          href="/admin/waitlist/export"
          className="mt-5 inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
        >
          <span aria-hidden="true">↓</span> Export all (CSV)
        </a>
      ) : null}

      {total === 0 ? (
        <p className="mt-8 font-mono text-sm uppercase tracking-wider text-muted">
          No waitlist signups yet.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {courses.map((c) => (
            <li key={c.slug} className="glass-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                  href={`/courses/${c.slug}`}
                  className="title-card hover:text-command-gold"
                >
                  {c.title}
                </Link>
                <span className="inline-flex items-center rounded-full border border-command-gold/40 bg-command-gold/10 px-3 py-1 font-mono text-sm font-bold uppercase tracking-wider text-command-gold">
                  {c.emails.length}{" "}
                  {c.emails.length === 1 ? "signup" : "signups"}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                {c.slug}
              </p>

              {/* Copyable email list (no client JS — select-all in the textarea). */}
              <details className="mt-3">
                <summary className="cursor-pointer select-none font-mono text-xs uppercase tracking-wider text-signal-blue">
                  Show {c.emails.length}{" "}
                  {c.emails.length === 1 ? "email" : "emails"}
                </summary>
                <div className="mt-2 space-y-2">
                  <textarea
                    readOnly
                    rows={Math.min(c.emails.length, 8)}
                    className="w-full rounded-md border border-panel-border bg-deep-space px-3 py-2 font-mono text-xs text-text"
                    value={c.emails.map((e) => e.email).join("\n")}
                  />
                  <ul className="font-mono text-[11px] text-muted">
                    {c.emails.map((e) => (
                      <li key={e.email}>
                        {e.email}{" "}
                        <span className="text-gray-3">· {fmtDate(e.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
