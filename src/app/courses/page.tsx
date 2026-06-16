// Public skill-tree (Task 9 / skill-tree plan).
//
// /courses — the role-aware skill tree. Anonymous-readable (admitted by
// `isPublicPath`); signed-in learners see their own progress overlaid. The page
// frames the whole curriculum as the path to one destination: an EEG
// brain-computer interface that commands a swarm of IoT devices.
//
// Server component (RSC): the session is resolved once via `auth()` WITHOUT a
// redirect (no `requireUser` — that throws; this route must render for anon
// visitors). Data is fetched directly via Prisma in `buildSkillTree`.
//
// SEO metadata + JSON-LD (ItemList) are preserved here; Task 10 broadens the
// JSON-LD source set. Keep `force-dynamic` so the CI build (stub DATABASE_URL)
// doesn't prerender the DB query.

import type { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { buildSkillTree } from "@/lib/skill-tree";
import { SkillTreeGrid } from "@/components/skill-tree/SkillTreeGrid";
import { SkillTreeSpine } from "@/components/skill-tree/SkillTreeSpine";
import { PageHeader } from "@/components/PageHeader";
import { courseListJsonLd, siteUrl } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";

// SEO. The courses index is a stable funnel landing page.
const title = "Courses — One Thousand Drones Academy";
const description =
  "A skill tree from your first board to an EEG brain-computer interface that commands a swarm of IoT devices. Follow each subsystem start to finish — no account required to read along.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/courses" },
  openGraph: { title, description, type: "website", url: "/courses" },
  twitter: { card: "summary_large_image", title, description },
};

// DB-backed; resolves the session at request time — force request-time
// rendering so the CI build (stub DATABASE_URL) doesn't prerender the DB query.
export const dynamic = "force-dynamic";

// The one destination the whole curriculum builds toward.
const DESTINATION =
  "Build an EEG brain-computer interface that commands a swarm of IoT devices";

export default async function CoursesPage() {
  // Resolve the session once. No `requireUser` — that throws on anon; this
  // route is admitted by `isPublicPath` and MUST render signed-out. Treat a
  // missing session as anonymous.
  const session = await auth();
  const email = session?.user?.email ?? null;

  // Derive the userId (buildSkillTree takes a userId or null) and admin flag.
  // We look the user up by email — the session carries the email, not the row id
  // we need for buildSkillTree. Admin = DB role ADMIN, or on the admin roster.
  let userId: string | null = null;
  let isAdmin = false;
  if (email) {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });
    userId = user?.id ?? null;
    isAdmin = user?.role === "ADMIN" || isAdminEmail(email);
  }

  const tree = await buildSkillTree(userId);

  // The minimal viewer shape the grid/spine/SkillNodeCard consume (HrefViewer).
  const viewer = { signedIn: userId != null };

  // Destination progress. `total` is the curriculum size (tree node count, not a
  // hardcoded 22); `done` is the learner's completed/mastered nodes. For anon
  // there is no progress — the banner frames the path ahead instead.
  const total = tree.nodes.length;
  const done = tree.nodes.filter((n) => n.state === "done").length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const showProgress = viewer.signedIn && done > 0;

  // Anchor target — the learner's single `isNext` node (set by the core). Used
  // for a no-JS "jump to your next step" link in the banner. SkillNodeCard sets
  // `id="node-${slug}"` on its outer element.
  const nextNode = tree.nodes.find((n) => n.isNext);

  // ItemList JSON-LD — preserved as-is (Task 10 broadens its source set). The
  // PUBLIC course index as an ordered list, each item an absolute URL to that
  // course's published guide hub.
  const base = siteUrl();
  const publicCourses = await db.project.findMany({
    where: {
      accessTier: "PUBLIC",
      publishedRevisionId: { not: null },
      archivedAt: null,
    },
    select: {
      slug: true,
      name: true,
      publishedRevision: { select: { label: true } },
    },
    orderBy: [{ level: "asc" }, { name: "asc" }],
  });
  const courseListLd = courseListJsonLd(
    publicCourses.flatMap((course) =>
      course.publishedRevision?.label
        ? [
            {
              name: course.name,
              url: `${base}/projects/${course.slug}/${encodeURIComponent(
                course.publishedRevision.label,
              )}/guide`,
            },
          ]
        : [],
    ),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd data={courseListLd} />
      <PageHeader
        eyebrow="SKILL TREE"
        title="Build it for real"
        accentWord="real"
        lead="One destination, one subsystem at a time — schematic, layout, fabrication, and bring-up. Follow the path from your first board to a brain-computer interface."
      />

      {total === 0 ? (
        <p className="font-mono text-sm uppercase tracking-wider text-muted">
          Courses are coming soon.
        </p>
      ) : (
        <>
          {/* Destination banner — always shown. Frames the whole tree against
              the one build it ladders up to, with a quantified count. */}
          <section className="glass-card mb-6 flex flex-col gap-3 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
              The destination
            </p>
            <p className="font-display text-2xl tracking-wide text-white">
              {DESTINATION}
            </p>
            <p className="font-mono text-xs uppercase tracking-wider text-muted">
              {showProgress
                ? `${done} of ${total} projects complete — keep building.`
                : viewer.signedIn
                  ? `${total} projects from your first board to the BCI.`
                  : `${total} projects from first board to the BCI.`}
            </p>

            {/* Endowed-progress bar — signed-in AND ≥1 done only. */}
            {showProgress ? (
              <div className="mt-1">
                <div
                  className="h-2 w-full overflow-hidden rounded-full border border-panel-border bg-deep-space/60"
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progress toward the BCI"
                >
                  <div
                    className="h-full rounded-full bg-command-gold"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-1.5 font-mono text-xs font-bold uppercase tracking-wider text-command-gold">
                  ~{percent}% toward the BCI
                </p>
              </div>
            ) : null}

            {/* No-JS anchor to the learner's next step. Signed-in only — anon has
                no `isNext` overlay. SkillNodeCard sets `id="node-${slug}"`. */}
            {viewer.signedIn && nextNode ? (
              <a
                href={`#node-${nextNode.slug}`}
                className="mt-1 inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-signal-blue"
              >
                Jump to your next step
                <span aria-hidden="true">→</span>
              </a>
            ) : null}
          </section>

          {/* Both views render; CSS shows the right one (grid is
              `hidden lg:block`, spine is `lg:hidden`). */}
          <SkillTreeGrid tree={tree} viewer={viewer} />
          <SkillTreeSpine tree={tree} viewer={viewer} />
        </>
      )}
    </main>
  );
}
