// Admin: student roster. Search + a hairline list of every account, linking to
// the per-student manager. Admin-gated two ways: the middleware bounces a LEARNER
// off /admin/* (isAdminOnlyPath), and requireAdmin() here is the server gate.
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";

export default async function StudentsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const users = await db.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: { select: { enrollments: true, entitlements: true } },
    },
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="OPERATOR"
        title="Students"
        accentWord="Students"
        meta={[{ label: "ACCOUNTS", value: users.length }]}
        lead="Manage learner accounts: profile, access, progress, and deletion."
      />

      <form method="get" className="mt-6">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search email or name"
          aria-label="Search students"
          className="w-full max-w-md rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-text focus:border-command-gold focus:outline-none"
        />
      </form>

      {users.length === 0 ? (
        <p className="mt-8 font-mono text-sm uppercase tracking-wider text-muted">
          No accounts{query ? " match that search" : " yet"}.
        </p>
      ) : (
        <ul className="mt-8 border-t border-panel-border/60">
          {users.map((u) => (
            <li key={u.id}>
              <Link
                href={`/admin/students/${u.id}`}
                className="group flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-panel-border/60 py-4 transition-colors hover:bg-command-gold/[0.04] focus-visible:bg-command-gold/[0.06] focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-base text-text group-hover:text-gold-light">
                    {u.name || u.email}
                  </span>
                  {u.name ? (
                    <span className="block truncate font-mono text-[11px] text-muted">
                      {u.email}
                    </span>
                  ) : null}
                </span>
                {u.role === "ADMIN" ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-command-gold">
                    admin
                  </span>
                ) : null}
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  <span className="font-numeral tabular-nums text-text">
                    {u._count.enrollments}
                  </span>{" "}
                  enrolled ·{" "}
                  <span className="font-numeral tabular-nums text-text">
                    {u._count.entitlements}
                  </span>{" "}
                  access
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3">
                  {u.createdAt.toISOString().slice(0, 10)}
                </span>
                <span aria-hidden className="text-gray-3">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
