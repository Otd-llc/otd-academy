// Admin goals dashboard — live DB counts against hand-set targets, plus the
// "what is what" detail rows each stat expands to (so a number is never a
// mystery). Pure server data; the board UI lives in components/admin/GoalsBoard.
//
// Two kinds of stat:
//   • a GOAL has a target → renders a progress rule (gold, green when met).
//   • a COUNTER has target: null → just a live number (blue, "no target").
import { db } from "@/lib/db";
import { GLOSSARY } from "@/lib/glossary";
import { TOOLS } from "@/lib/tools/registry";

// Hand-set targets. Live counts come from the DB / registries below; only these
// ceilings are editorial. Courses target is dynamic (the full curriculum count);
// glossary is a counter (it grows organically, no fixed ceiling).
const TARGETS = {
  libraryPages: 20,
} as const;

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
  const [courses, lessons, waitlist, enrollments, certs] = await Promise.all([
    db.project.findMany({
      where: { accessTier: { in: ["PUBLIC", "PREMIUM"] }, archivedAt: null },
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
    db.enrollment.findMany({ select: { userId: true, projectId: true } }),
    db.certificate.findMany({
      select: { name: true, slug: true, issuedAt: true },
      orderBy: { issuedAt: "desc" },
    }),
  ]);

  // ── Courses: published vs the full curriculum ──
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

  // ── Learners: distinct enrolled users, broken out per course ──
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const learnerIds = new Set(enrollments.map((e) => e.userId));
  const perCourse = new Map<string, number>();
  for (const e of enrollments) {
    perCourse.set(e.projectId, (perCourse.get(e.projectId) ?? 0) + 1);
  }
  const learnerRows: GoalRow[] = [...perCourse.entries()]
    .map(([pid, n]) => {
      const c = courseById.get(pid);
      return {
        primary: c ? (c.publicTitle ?? c.name) : pid,
        secondary: `${n} enrolled`,
        href: c ? `/courses/${c.slug}` : undefined,
      };
    })
    .sort((a, b) => parseInt(b.secondary ?? "0", 10) - parseInt(a.secondary ?? "0", 10));

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
      target: TARGETS.libraryPages,
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
      live: learnerIds.size,
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
