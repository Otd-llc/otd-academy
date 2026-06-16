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
import { SkillTreePath } from "@/components/skill-tree/SkillTreePath";
import { PathCard } from "@/components/skill-tree/PathCard";
import { resolvePath, SKILL_PATHS } from "@/lib/skill-paths";
import { PageHeader } from "@/components/PageHeader";
import { courseListJsonLd, siteUrl } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";

// SEO. The courses index is a stable funnel landing page.
const title = "Courses — One Thousand Drones Academy";
const description =
  "A skill tree from your first board to an EEG brain-computer interface that commands a swarm of IoT devices. Build each subsystem start to finish — schematic, layout, fabrication, and bring-up.";

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

export default async function CoursesPage({
  searchParams,
}: {
  // `?path=<key>` selects the learning path (default: the primary EEG build).
  searchParams: Promise<{ path?: string }>;
}) {
  const { path: pathParam } = await searchParams;

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

  // The viewer shape the grid/spine/SkillNodeCard consume (HrefViewer). `isAdmin`
  // gates the inline tier toggle rendered inside SkillNodeCard (Task 10).
  const viewer = { signedIn: userId != null, isAdmin };

  // Resolve the selected learning path: a build goal + its auto-derived
  // prerequisite chain (or the bench category), topo-ordered. The page is
  // organised around ONE path at a time — mobile-first, and honest about which
  // courses a given build actually needs.
  const selected = resolvePath(pathParam, tree);

  // The OTHER builds (everything but the one being featured) — resolved for the
  // "Go further" card gallery so each card can show its own course count/progress.
  const otherPaths = SKILL_PATHS.filter((p) => p.key !== selected.def.key).map(
    (p) => resolvePath(p.key, tree),
  );

  // Per-PATH progress (not whole-curriculum): how far the learner is along the
  // selected build. `done`/`total` count only the path's nodes.
  const total = selected.total;
  const done = selected.done;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const showProgress = viewer.signedIn && done > 0;

  // Path-local "next" — the first still-available step in this path's order —
  // for the no-JS "jump to your next step" anchor. SkillNodeCard sets
  // `id="node-${slug}"` on its outer element.
  const nextNode = selected.nodes.find((n) => n.state === "available");

  // ItemList JSON-LD — sourced from ALL published, non-archived projects (Task
  // 10 broadened this from PUBLIC-only). Built from `tree.nodes` to avoid a
  // second query: a `coming-soon` state ⇔ an unpublished project, so
  // `state !== "coming-soon"` identifies the published set. Each item uses
  // `node.title` (publicTitle ?? name) and an absolute outline-guide URL; nodes
  // with no published label can't form a URL and are skipped.
  //
  // Note: the design's `isAccessibleForFree` flag is NOT expressible on an
  // ItemList ListItem (it lives on a WebPage/paywall shape) — intentionally
  // omitted here; the ItemList shape is unchanged, just a broader source set.
  const base = siteUrl();
  const courseListLd = courseListJsonLd(
    tree.nodes.flatMap((node) =>
      node.state !== "coming-soon" && node.publishedLabel
        ? [
            {
              name: node.title,
              url: `${base}/projects/${node.slug}/${encodeURIComponent(
                node.publishedLabel,
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
          {/* Per-path banner — frames the selected build + progress along IT. */}
          <section className="glass-card mb-6 flex flex-col gap-3 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
              {selected.def.kind === "bench"
                ? "Bench tools"
                : selected.def.kind === "primary"
                  ? "Flagship path"
                  : "Mastery path"}
            </p>
            <p className="font-display text-3xl tracking-wide text-white">
              {selected.def.label}
            </p>
            <p className="font-serif text-sm italic text-muted">
              {selected.def.blurb}
            </p>
            <p className="font-mono text-xs uppercase tracking-wider text-muted">
              {showProgress
                ? `${done} of ${total} courses complete`
                : `${total} courses${selected.def.kind === "bench" ? "" : ", start to finish"}`}
            </p>

            {/* Endowed-progress bar — signed-in AND ≥1 done, along this path. */}
            {showProgress ? (
              <div className="mt-1">
                <div
                  className="h-2 w-full overflow-hidden rounded-full border border-panel-border bg-deep-space/60"
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progress: ${selected.def.label}`}
                >
                  <div
                    className="h-full rounded-full bg-command-gold"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-1.5 font-mono text-xs font-bold uppercase tracking-wider text-command-gold">
                  ~{percent}% there
                </p>
              </div>
            ) : null}

            {/* No-JS anchor to the path-local next step (signed-in only). */}
            {viewer.signedIn && nextNode ? (
              <a
                href={`#node-${nextNode.slug}`}
                className="mt-1 inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-command-gold"
              >
                Jump to your next step
                <span aria-hidden="true">→</span>
              </a>
            ) : null}
          </section>

          {/* The selected path: its goal + prerequisite chain, topo-ordered. */}
          <SkillTreePath
            nodes={selected.nodes}
            goalSlug={selected.goalSlug}
            viewer={viewer}
          />

          {/* Go further — the other builds as self-explanatory cards. The
              featured path above is the page; these are the opt-in alternatives
              (incl. a card back to the ★ primary build). */}
          {otherPaths.length > 0 ? (
            <section className="mt-14 border-t border-panel-border pt-8">
              <p className="mb-1 font-mono text-xs uppercase tracking-[0.2em] text-command-gold">
                Go further
              </p>
              <p className="mb-5 font-serif text-sm italic text-muted">
                Other paths you can take on — each shows only the courses it
                needs.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {otherPaths.map((o) => (
                  <PathCard
                    key={o.def.key}
                    def={o.def}
                    total={o.total}
                    done={o.done}
                    signedIn={viewer.signedIn}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
