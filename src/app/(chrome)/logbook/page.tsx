import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { loadLessonMeta, getLogbook } from "@/lib/logbook/load";
import { dueReviewCount } from "@/lib/logbook/review-load";
import { LEVELS } from "@/lib/logbook/economy";
import { ROADMAP_PATCHES, SKILL_PATCH_LABELS, patchLabel, artForBadge, HARDWARE_PATCHES } from "@/lib/logbook/patches";
import { StandingRail } from "@/components/logbook/StandingRail";
import { PatchWall, type PatchEntry } from "@/components/logbook/PatchWall";

// The Logbook (design §9.5; layout locked 2026-07-11 = sticky standing rail +
// patches-first accordion). Private, auth-gated by middleware (the redirect here
// is a defense-in-depth backstop). Per-request (session-scoped) — entirely per-user,
// so there is nothing here worth caching; under cacheComponents dynamic is the default.
export const metadata: Metadata = {
  title: "Logbook",
  robots: { index: false, follow: false },
};

const day = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" }).format(d);

// Native accordion section (server component; no client JS). Patches open first.
function Section({ title, count, defaultOpen, children }: { title: string; count?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} className="group border-b border-panel-border/60 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">▸ {title}</span>
        <span className="flex items-center gap-3">
          {count ? <span className="font-numeral text-sm tabular-nums text-muted">{count}</span> : null}
          <span aria-hidden className="font-mono text-[10px] text-gray-3 transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export default async function LogbookPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/sign-in");
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) redirect("/sign-in");

  const now = new Date();
  const lessons = await loadLessonMeta();
  const lb = await getLogbook(user.id, lessons, now);
  const reviewDue = await dueReviewCount(user.id, now);

  const earnedKeys = new Set(lb.badges.map((b) => b.badgeKey));
  const curMin = LEVELS[lb.level - 1]?.minXp ?? 0;
  const bandPct = lb.next ? Math.min(1, Math.max(0, (lb.xpTotal - curMin) / (lb.next.minXp - curMin))) : 1;

  const skillPatches = lb.badges.filter((b) => b.badgeKey in SKILL_PATCH_LABELS);
  const ratingPatches = lb.badges.filter((b) => b.badgeKey.startsWith("course:"));

  // Hardware/build family: shown as locked teasers (the visible ladder that shows
  // what's possible), like the cluster roadmap, until earned. Highest earned tier per
  // family from `hw:<name>:<n>` keys.
  const hwEntries: PatchEntry[] = HARDWARE_PATCHES.map((h) => {
    const t = [3, 2, 1].find((n) => earnedKeys.has(`${h.key}:${n}`)) ?? 0;
    return { key: h.key, label: h.label, howToEarn: h.howToEarn, earned: t > 0, art: h.art, tier: Math.max(0, t - 1), progression: { thresholds: h.thresholds, earnedTier: t - 1, unit: h.unit } };
  });
  const patchCount = ROADMAP_PATCHES.filter((p) => earnedKeys.has(p.key)).length + skillPatches.length + ratingPatches.length + hwEntries.filter((e) => e.earned).length;

  const SKILL_HOWTO: Record<string, string> = {
    "skill:first-flight": "Complete your first lesson.",
    "skill:shipped-it": "Have your feedback marked useful.",
  };
  const patchEntries: PatchEntry[] = [
    ...ROADMAP_PATCHES.map((p) => ({ key: p.key, label: p.label, howToEarn: p.howToEarn, earned: earnedKeys.has(p.key), art: artForBadge(p.key) })),
    ...skillPatches.map((b) => ({ key: b.badgeKey, label: patchLabel(b.badgeKey), howToEarn: SKILL_HOWTO[b.badgeKey] ?? "", earned: true, art: artForBadge(b.badgeKey) })),
    ...ratingPatches.map((b) => ({ key: b.badgeKey, label: patchLabel(b.badgeKey), howToEarn: "Pass the course exam.", earned: true, art: artForBadge(b.badgeKey) })),
    ...hwEntries,
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="title-rule mb-4" aria-hidden />
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">Account</p>
      <h1 className="mt-1 font-display text-4xl tracking-wide text-title">Logbook</h1>

      {reviewDue > 0 ? (
        <Link
          href="/review"
          className="mt-4 flex items-center justify-between rounded border border-command-gold/40 bg-command-gold/5 px-4 py-2.5 transition-colors hover:border-command-gold/70"
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-command-gold">
            {reviewDue} {reviewDue === 1 ? "item" : "items"} due for review
          </span>
          <span aria-hidden className="font-mono text-[11px] text-command-gold">
            →
          </span>
        </Link>
      ) : null}

      <div className="mt-8 grid gap-10 lg:grid-cols-[300px_1fr]">
        {/* LEFT — sticky standing rail: rank wing in the XP ring; click → rank ladder */}
        <aside className="self-start lg:sticky lg:top-24">
          <StandingRail
            level={lb.level}
            title={lb.title}
            xp={lb.xpTotal}
            nextMinXp={lb.next?.minXp ?? null}
            nextLevel={lb.next?.level ?? null}
            bandPct={bandPct}
          />
          <p className={`mt-4 font-mono text-[9px] uppercase tracking-[0.16em] ${lb.isCurrent ? "text-command-gold" : "text-gray-3"}`}>
            {lb.isCurrent && lb.currentThrough ? `Current through ${day(lb.currentThrough)}` : "Lapsed"}
          </p>
        </aside>

        {/* RIGHT — accordion sections; patches first + open */}
        <div>
          <Section title="Patches" count={`${patchCount} earned`} defaultOpen>
            <PatchWall entries={patchEntries} />
          </Section>

          <Section title="Clusters" count={`${lb.clusters.reduce((n, c) => n + c.done, 0)} / ${lb.clusters.reduce((n, c) => n + c.total, 0)}`} defaultOpen>
            <ul>
              {lb.clusters.map((c) => {
                const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
                return (
                  <li key={c.key} className="border-b border-panel-border/50 py-3">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="font-serif text-sm text-text">{c.label}</span>
                      <span className="font-numeral text-base tabular-nums text-command-gold">{c.done} / {c.total}</span>
                    </div>
                    <div className="mt-2 h-px w-full bg-panel-border/50"><div className="h-px bg-command-gold/70" style={{ width: `${pct}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          </Section>

          {lb.courses.length > 0 ? (
            <Section title="Courses" count={`${lb.courses.length}`}>
              <ul>
                {lb.courses.map((c) => (
                  <li key={c.slug} className="flex items-baseline justify-between gap-4 border-b border-panel-border/50 py-3">
                    <Link href={`/courses/${c.slug}`} className="min-w-0 truncate font-serif text-sm text-text transition-colors hover:text-command-gold">{c.title}</Link>
                    <span className="flex shrink-0 items-baseline gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                      {c.rating ? <span className="text-command-gold">Rating</span> : null}
                      <span>{c.status.replace(/_/g, " ")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title="Recent activity">
            {lb.recent.length === 0 ? (
              <p className="font-serif text-sm text-muted">
                No activity yet.{" "}
                <Link href="/library" className="text-command-gold hover:text-gold-light">Read a lesson</Link> to log your first XP.
              </p>
            ) : (
              <ul>
                {lb.recent.map((e, i) => {
                  const slug = e.source === "QUIZ_CORRECT" || e.source === "STAGE_QUIZ_CORRECT" ? e.refId?.split("#")[0] : e.refId;
                  const label = (slug ?? "").replace(/[:-]/g, " ").replace(/^guide /, "") || "library";
                  return (
                    <li key={i} className="flex items-baseline gap-3 border-b border-panel-border/40 py-2.5 font-mono text-[11px] tracking-[0.04em] text-muted">
                      <span className="font-numeral text-sm tabular-nums text-command-gold">+{e.amount}</span>
                      <span className="uppercase tracking-[0.14em] text-text">{e.source.replace(/_/g, " ")}</span>
                      <span className="truncate text-muted">{label}</span>
                      <span className="ml-auto shrink-0 text-gray-3">{day(e.createdAt)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </main>
  );
}
