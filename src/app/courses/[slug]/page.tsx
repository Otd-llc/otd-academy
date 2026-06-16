// Per-course preview / waitlist landing — `/courses/<slug>`.
//
// Public, indexable page for a course that isn't built yet ("coming soon"). It
// is BOTH the SEO asset (unique crawlable content per course) AND the demand-
// capture point (the anonymous WaitlistForm writes a per-course WaitlistSignup).
// Coming-soon skill-tree nodes link here.
//
// Aesthetic: an engineering SPEC-SHEET / mission dossier for a board in
// fabrication — blueprint-grid field, command-gold HUD accents, oversized Bebas
// title, a spec readout strip, a terminal-style "register interest" panel, and
// a build-pipeline. (frontend-design skill: a committed, distinctive direction
// in OTD's mission-control identity — not a generic stacked landing page.)
//
// A published course redirects to its guide outline (the canonical home for a
// built course). Archived / unknown → 404. Public + crawlable via isPublicPath.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { WaitlistForm } from "@/components/learn/WaitlistForm";
import { JsonLd } from "@/components/seo/JsonLd";
import { courseJsonLd, breadcrumbJsonLd, siteUrl } from "@/lib/seo/jsonld";
import { ChevronLeftIcon } from "@/components/icons";
import { STAGE_ORDER, STAGE_LABELS, type StageName } from "@/lib/stages";
import { SKILL_PATHS, prereqClosure } from "@/lib/skill-paths";

export const dynamic = "force-dynamic";

// Plain-language framing per track / level — adds genuine, course-specific copy
// (and the keywords learners search) instead of boilerplate.
const TRACK_BLURB: Record<string, string> = {
  SENSE: "reading real-world signals — turning voltages, currents and biopotentials into clean digital data",
  ACT: "driving the physical world — motors, servos, and high-power lighting under precise control",
  COMMS: "wireless links and meshes — getting boards to talk to each other and to a hub",
  POWER: "power delivery — batteries, charging, protection, and clean rails everything else depends on",
};
const LEVEL_BLURB: Record<string, string> = {
  L1: "a foundational L1 board — approachable if you can read a schematic",
  L2: "an intermediate L2 subsystem — it builds on the foundations",
  L3: "an advanced L3 capstone — the deep end, where the subsystems come together",
};

async function loadCourse(slug: string) {
  return db.project.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      publicTitle: true,
      tagline: true,
      description: true,
      track: true,
      level: true,
      accessTier: true,
      archivedAt: true,
      publishedRevisionId: true,
      publishedRevision: { select: { label: true } },
      dependentEdges: {
        select: {
          dependsOnProject: {
            select: { slug: true, name: true, publicTitle: true },
          },
        },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await db.project.findUnique({
    where: { slug },
    select: { publicTitle: true, name: true, tagline: true, archivedAt: true },
  });
  if (!project || project.archivedAt) {
    return { title: "Course — One Thousand Drones Academy" };
  }
  const name = project.publicTitle ?? project.name;
  const title = `${name} — One Thousand Drones Academy`;
  const description =
    project.tagline ??
    `${name}: a hands-on ESP32 hardware course — schematic, layout, fabrication, and bring-up.`;
  return {
    title,
    description,
    alternates: { canonical: `/courses/${slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/courses/${slug}`,
      siteName: "One Thousand Drones Academy",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

// Small presentational primitives, kept local to this template.
function SectionHead({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.25em] text-command-gold">
      <span className="h-px w-6 bg-command-gold/50" />
      {children}
    </h2>
  );
}

export default async function CoursePreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await loadCourse(slug);
  if (!project || project.archivedAt) notFound();

  if (project.publishedRevisionId && project.publishedRevision?.label) {
    redirect(
      `/projects/${slug}/${encodeURIComponent(
        project.publishedRevision.label,
      )}/guide`,
    );
  }

  const name = project.publicTitle ?? project.name;
  const prereqs = project.dependentEdges
    .map((e) => e.dependsOnProject)
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const session = await auth();
  const sessionEmail = session?.user?.email ?? undefined;

  const allEdges = (
    await db.projectDependency.findMany({
      select: {
        dependsOnProject: { select: { slug: true } },
        dependentProject: { select: { slug: true } },
      },
    })
  ).map((e) => ({
    fromSlug: e.dependsOnProject.slug,
    toSlug: e.dependentProject.slug,
  }));
  const inPaths = SKILL_PATHS.filter(
    (p) => p.goalSlug && prereqClosure(p.goalSlug, allEdges).has(slug),
  );

  const trackBlurb = project.track ? TRACK_BLURB[project.track] : null;
  const levelBlurb = project.level ? LEVEL_BLURB[project.level] : null;

  // Reading access by tier — accurate per course. PUBLIC reads free, FREE needs
  // a (free) account, PREMIUM is a one-time purchase (overview previews free).
  const accessSentence =
    project.accessTier === "PUBLIC"
      ? "This course will be free to read — no account needed."
      : project.accessTier === "PREMIUM"
        ? "The course overview will preview for free; the full course is a one-time purchase (no subscription)."
        : "Reading the course is free with a free account.";

  // FAQ — useful for readers AND emitted as FAQPage structured data. Answers
  // are course-specific where the data allows (tier / level / track / prereqs).
  const faqs: { q: string; a: string }[] = [
    {
      q: "When does this course open?",
      a: "It's in active production. Join the waitlist and we'll email you the moment it goes live — and the demand signal helps us decide what to build next.",
    },
    {
      q: "Is it beginner-friendly?",
      a: levelBlurb
        ? `This is ${levelBlurb}. Every stage is explained from first principles, so you can follow along as long as you're comfortable reading a schematic.`
        : "Every stage is explained from first principles — if you can read a schematic, you can follow along.",
    },
    {
      q: "What will I need to build it?",
      a: `${accessSentence} Building the board for real also needs its bill of materials (listed in the course) and a small PCB order from a fab house — the course walks you through both.`,
    },
    {
      q: "What will I actually learn?",
      a: `You'll learn ${trackBlurb ?? "the subsystem this board covers"} — plus the full board workflow: schematic capture, layout, DRC, gerber export, ordering, assembly, and bring-up.`,
    },
  ];

  const base = siteUrl();
  const courseLd = courseJsonLd({
    name,
    description: project.tagline,
    level: project.level,
  });
  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Courses", url: `${base}/courses` },
    { name, url: `${base}/courses/${slug}` },
  ]);
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="relative overflow-hidden">
      <JsonLd data={courseLd} />
      <JsonLd data={breadcrumbLd} />
      <JsonLd data={faqLd} />

      {/* Atmosphere: blueprint grid field + a gold glow bleeding from the top —
          the "board on the bench under the lamp" feel. Decorative, behind all. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(900px 380px at 50% -8%, rgba(200,150,62,0.10), transparent 62%), linear-gradient(rgba(58,63,80,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(58,63,80,0.16) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 32px 32px, 32px 32px",
        }}
      />

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <nav className="font-mono text-xs uppercase tracking-wider">
          <Link
            href="/courses"
            className="inline-flex items-center gap-1.5 text-muted underline-offset-4 hover:text-command-gold hover:underline"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            All courses
          </Link>
        </nav>

        {/* ── HERO ─────────────────────────────────────────────── */}
        <header className="mt-8">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-command-gold/50 bg-command-gold/10 px-2.5 py-1 text-command-gold">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-command-gold" />
              In fabrication
            </span>
            {project.track ? (
              <span className="rounded-full border border-panel-border px-2.5 py-1 text-muted">
                {project.track}
              </span>
            ) : null}
            {project.level ? (
              <span className="rounded-full border border-panel-border px-2.5 py-1 text-muted">
                {project.level}
              </span>
            ) : null}
          </div>

          <h1 className="mt-5 font-display text-5xl leading-[0.95] tracking-wide text-white sm:text-7xl">
            {name}
          </h1>
          {project.tagline ? (
            <p className="mt-5 max-w-2xl font-serif text-xl italic leading-snug text-gray-1 sm:text-2xl">
              {project.tagline}
            </p>
          ) : null}

          {/* Spec readout strip — instrument-panel facts. */}
          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-panel-border bg-panel-border/40 sm:grid-cols-4">
            {[
              ["Track", project.track ?? "—"],
              ["Level", project.level ?? "—"],
              ["Prerequisites", String(prereqs.length)],
              ["Status", "Coming soon"],
            ].map(([k, v]) => (
              <div key={k} className="bg-deep-space/80 px-4 py-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  {k}
                </dt>
                <dd className="mt-1 font-mono text-sm uppercase tracking-wider text-command-gold">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </header>

        {/* ── REGISTER INTEREST (terminal panel) ───────────────── */}
        <section className="glass-card mt-10 border-command-gold/30 p-6 shadow-[0_0_40px_-12px_rgba(200,150,62,0.5)] sm:p-7">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-command-gold">
            ▸ Register interest
          </p>
          <p className="mt-2 max-w-2xl font-serif text-base text-gray-1">
            This board is on the bench. Leave your email and you&apos;ll be first
            in when it ships — and your interest helps decide what we build next.
          </p>
          <div className="mt-5">
            <WaitlistForm projectId={project.id} defaultEmail={sessionEmail} />
          </div>
        </section>

        {/* ── BODY ─────────────────────────────────────────────── */}
        <div className="mt-14 space-y-12">
          <section>
            <SectionHead>What you&apos;ll build</SectionHead>
            <p className="mt-4 max-w-2xl font-serif text-lg leading-relaxed text-gray-1">
              {project.description ??
                `${name} is a hands-on ESP32 hardware course. You design and build a real, manufacturable board — not a breadboard mock-up — and carry it from a blank schematic all the way to a working assembly you can hold in your hand.`}
            </p>
            {trackBlurb ? (
              <p className="mt-3 max-w-2xl font-serif text-base leading-relaxed text-muted">
                It sits on the{" "}
                <span className="text-command-gold">{project.track}</span> track
                — {trackBlurb}.
              </p>
            ) : null}
          </section>

          <section>
            <SectionHead>The build pipeline</SectionHead>
            <p className="mt-4 max-w-2xl font-serif text-base leading-relaxed text-muted">
              No steps skipped, no black boxes. Each stage is gated on real proof
              of work — a clean ERC, valid gerbers, a passing bring-up — so you
              finish having actually done the engineering, not just watched it.
            </p>
            <ol className="mt-5 flex flex-wrap gap-2">
              {STAGE_ORDER.map((s: StageName, i) => (
                <li
                  key={s}
                  className="inline-flex items-baseline gap-2 rounded border border-panel-border bg-deep-space/60 px-3 py-1.5"
                >
                  <span className="font-mono text-[11px] font-bold text-command-gold">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-gray-1">
                    {STAGE_LABELS[s]}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {prereqs.length > 0 ? (
            <section>
              <SectionHead>Builds on</SectionHead>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {prereqs.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/courses/${p.slug}`}
                      className="group flex items-center justify-between gap-2 rounded border border-panel-border bg-deep-space/40 px-4 py-3 transition-colors hover:border-command-gold/50"
                    >
                      <span className="font-mono text-sm text-gray-1 group-hover:text-command-gold">
                        {p.publicTitle ?? p.name}
                      </span>
                      <span aria-hidden="true" className="text-command-gold">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {inPaths.length > 0 ? (
            <section>
              <SectionHead>Part of these builds</SectionHead>
              <div className="mt-4 flex flex-wrap gap-2">
                {inPaths.map((p) => (
                  <Link
                    key={p.key}
                    href={`/courses?path=${p.key}`}
                    className="rounded-full border border-panel-border bg-deep-space/60 px-4 py-1.5 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:border-command-gold/50"
                  >
                    {p.kind === "primary" ? "★ " : ""}
                    {p.label}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <SectionHead>Questions</SectionHead>
            <dl className="mt-4 divide-y divide-panel-border border-y border-panel-border">
              {faqs.map((f) => (
                <div key={f.q} className="py-4">
                  <dt className="font-mono text-sm uppercase tracking-wider text-white">
                    {f.q}
                  </dt>
                  <dd className="mt-2 max-w-2xl font-serif text-base leading-relaxed text-muted">
                    {f.a}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <section className="mt-14 border-t border-panel-border pt-6">
          <p className="font-serif text-sm italic text-muted">
            Part of the path from your first board to a brain-computer
            interface.{" "}
            <Link
              href="/courses"
              className="text-command-gold underline underline-offset-4"
            >
              See the full skill tree →
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
