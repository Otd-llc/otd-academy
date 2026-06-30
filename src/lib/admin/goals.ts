// Admin goals dashboard — live DB counts, plus the "what is what" detail rows
// each stat expands to (so a number is never a mystery). Pure server data; the
// board UI lives in components/admin/GoalsBoard.
//
// Two kinds of stat:
//   • a GOAL has a target → renders a progress rule (gold, green when met).
//   • a COUNTER has target: null → just a live number (blue, "no target").
//
// The only real goal is "courses published", whose target is dynamic (the full
// curriculum count). Everything else grows organically (library pages, glossary)
// or has no ceiling (waitlist, learners, certs), so they are counters.
import { db } from "@/lib/db";
import { GLOSSARY } from "@/lib/glossary";
import { TOOLS } from "@/lib/tools/registry";

export type GoalRow = {
  primary: string;
  secondary?: string;
  href?: string;
  tone?: "live" | "pending";
};

export type GoalStat = {
  key: string;
  label: string;
  live: number;
  /** null = a counter (no target, no progress bar). */
  target: number | null;
  rows: GoalRow[];
  /** A link to a fuller view (e.g. the waitlist export page). */
  moreHref?: string;
  moreLabel?: string;
  /** Note shown above the rows when the list was capped. */
  cap?: string;
};

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function loadGoals(): Promise<GoalStat[]> {
  const [courses, lessons, waitlist, enrollments, certs, allProjects] =
    await Promise.all([
    // Every non-archived curriculum board, ALL tiers (FREE/PUBLIC/PREMIUM), so
    // the denominator is the full curriculum (22), not just the paid ones.
    db.project.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        slug: true,
        name: true,
        publicTitle: true,
        publishedRevisionId: true,
      },
      orderBy: { slug: "asc" },
    }),
    db.miniLesson.findMany({
      where: { published: true, accessTier: "PUBLIC" },
      select: { slug: true, title: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.waitlistSignup.findMany({
      select: {
        email: true,
        createdAt: true,
        project: { select: { slug: true, name: true, publicTitle: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.enrollment.findMany({
      select: {
        userId: true,
        projectId: true,
        user: { select: { email: true } },
      },
    }),
    db.certificate.findMany({
      select: { name: true, slug: true, issuedAt: true },
      orderBy: { issuedAt: "desc" },
    }),
    // ALL projects incl. archived — name lookup for enrollments that point at a
    // since-archived course (the non-archived `courses` query would miss those).
    db.project.findMany({ select: { id: true, name: true, publicTitle: true } }),
  ]);

  // ── Courses: published vs the full curriculum (all tiers) ──
  const published = courses.filter((c) => c.publishedRevisionId);
  const courseRows: GoalRow[] = courses
    .map((c) => ({
      primary: c.publicTitle ?? c.name,
      secondary: c.publishedRevisionId ? "Live" : "Coming soon",
      href: `/courses/${c.slug}`,
      tone: (c.publishedRevisionId ? "live" : "pending") as "live" | "pending",
    }))
    .sort((a, b) => (a.tone === "live" ? 0 : 1) - (b.tone === "live" ? 0 : 1));

  // ── Library + tools + glossary ──
  const libRows: GoalRow[] = lessons.map((l) => ({
    primary: l.title,
    secondary: fmtDate(l.updatedAt),
    href: `/library/${l.slug}`,
  }));
  const toolRows: GoalRow[] = TOOLS.map((t) => ({
    primary: t.title,
    href: `/tools/${t.slug}`,
  }));
  const glossRows: GoalRow[] = Object.values(GLOSSARY).map((t) => ({
    primary: t.term,
    secondary: t.def.length > 90 ? `${t.def.slice(0, 90)}…` : t.def,
  }));

  // ── Waitlist: the captured emails (most recent first) ──
  const waitlistRows: GoalRow[] = waitlist.slice(0, 100).map((s) => ({
    primary: s.email,
    secondary: `${s.project.publicTitle ?? s.project.name} · ${fmtDate(s.createdAt)}`,
  }));

  // ── Learners: one row per distinct learner, listing the course(s) they are
  // enrolled in (admin-only, so the email is fine to surface, like the waitlist).
  const courseById = new Map(allProjects.map((p) => [p.id, p]));
  const byUser = new Map<string, { email: string; courses: string[] }>();
  for (const e of enrollments) {
    const c = courseById.get(e.projectId);
    const courseName = c ? (c.publicTitle ?? c.name) : e.projectId;
    const entry = byUser.get(e.userId);
    if (entry) {
      entry.courses.push(courseName);
    } else {
      byUser.set(e.userId, {
        email: e.user?.email ?? "(unknown)",
        courses: [courseName],
      });
    }
  }
  const learnerRows: GoalRow[] = [...byUser.values()]
    .sort((a, b) => b.courses.length - a.courses.length)
    .map((u) => ({ primary: u.email, secondary: u.courses.join(", ") }));

  // ── Certificates issued ──
  const certRows: GoalRow[] = certs.slice(0, 100).map((c) => ({
    primary: c.name,
    secondary: `${c.slug} · ${fmtDate(c.issuedAt)}`,
  }));

  return [
    {
      key: "courses",
      label: "Courses published",
      live: published.length,
      target: courses.length,
      rows: courseRows,
    },
    {
      key: "library",
      label: "Library pages",
      live: lessons.length,
      target: null,
      rows: libRows,
    },
    {
      key: "tools",
      label: "Calculators",
      live: TOOLS.length,
      target: TOOLS.length,
      rows: toolRows,
    },
    {
      key: "glossary",
      label: "Glossary terms",
      live: Object.keys(GLOSSARY).length,
      target: null,
      rows: glossRows,
    },
    {
      key: "waitlist",
      label: "Waitlist signups",
      live: waitlist.length,
      target: null,
      rows: waitlistRows,
      moreHref: "/admin/waitlist",
      moreLabel: "Full waitlist + CSV export",
      cap: waitlist.length > 100 ? "Showing the 100 most recent" : undefined,
    },
    {
      key: "learners",
      label: "Learners",
      live: byUser.size,
      target: null,
      rows: learnerRows,
    },
    {
      key: "certs",
      label: "Certificates issued",
      live: certs.length,
      target: null,
      rows: certRows,
      cap: certs.length > 100 ? "Showing the 100 most recent" : undefined,
    },
  ];
}
