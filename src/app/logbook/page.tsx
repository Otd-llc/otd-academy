import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { loadLessonMeta, getLogbook } from "@/lib/logbook/load";
import { LEVELS } from "@/lib/logbook/economy";
import { ROADMAP_PATCHES, SKILL_PATCH_LABELS, patchLabel } from "@/lib/logbook/patches";
import { RankWing } from "@/components/logbook/RankWing";
import { Patch, type PatchKind } from "@/components/logbook/Patch";

// The Logbook (design §9.5; layout locked 2026-07-11 = sticky standing rail +
// patches-first accordion). Private, auth-gated by middleware (the redirect here
// is a defense-in-depth backstop). Per-request (session-scoped).
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Logbook",
  robots: { index: false, follow: false },
};

const day = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" }).format(d);
const num = (n: number) => n.toLocaleString("en-US");

// The segmented tick gauge with the XP total inside (standing B1 #2). `pct` is the
// progress through the CURRENT rank band.
function RingGauge({ pct, xp }: { pct: number; xp: number }) {
  return (
    <div className="relative grid place-items-center">
      <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
        {Array.from({ length: 44 }).map((_, i) => {
          const a = (i / 44) * Math.PI * 2;
          const on = i / 44 <= pct;
          return (
            <line key={i} x1={40 + Math.cos(a) * 30} y1={40 + Math.sin(a) * 30} x2={40 + Math.cos(a) * 36} y2={40 + Math.sin(a) * 36} stroke={on ? "var(--color-command-gold)" : "var(--color-panel-border)"} strokeWidth="1.5" />
          );
        })}
      </svg>
      <div className="absolute text-center">
        <p className="font-numeral text-2xl leading-none tabular-nums text-command-gold">{num(xp)}</p>
        <p className="font-mono text-[7px] uppercase tracking-[0.14em] text-muted">XP</p>
      </div>
    </div>
  );
}

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

  const earnedKeys = new Set(lb.badges.map((b) => b.badgeKey));
  const curMin = LEVELS[lb.level - 1]?.minXp ?? 0;
  const bandPct = lb.next ? Math.min(1, Math.max(0, (lb.xpTotal - curMin) / (lb.next.minXp - curMin))) : 1;

  const skillPatches = lb.badges.filter((b) => b.badgeKey in SKILL_PATCH_LABELS);
  const ratingPatches = lb.badges.filter((b) => b.badgeKey.startsWith("course:"));
  const patchCount = ROADMAP_PATCHES.filter((p) => earnedKeys.has(p.key)).length + skillPatches.length + ratingPatches.length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="title-rule mb-4" aria-hidden />
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">Account</p>
      <h1 className="mt-1 font-display text-4xl tracking-wide text-title">Logbook</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[300px_1fr]">
        {/* LEFT — sticky standing rail (standing B1 #2: gauge + wing over rank) */}
        <aside className="self-start lg:sticky lg:top-24">
          <div className="flex items-center gap-5">
            <RingGauge pct={bandPct} xp={lb.xpTotal} />
            <div className="flex flex-col gap-1">
              <RankWing level={lb.level} size={40} />
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-command-gold">
                FL{lb.level} · {lb.title}
              </p>
              {lb.next ? (
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
                  <span className="font-numeral tabular-nums text-text">{num(lb.xpTotal)}</span> / {num(lb.next.minXp)} to FL{lb.next.level}
                </p>
              ) : (
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-command-gold">Top rank reached</p>
              )}
            </div>
          </div>
          <p className={`mt-4 font-mono text-[9px] uppercase tracking-[0.16em] ${lb.isCurrent ? "text-command-gold" : "text-gray-3"}`}>
            {lb.isCurrent && lb.currentThrough ? `Current through ${day(lb.currentThrough)}` : "Lapsed"}
          </p>
        </aside>

        {/* RIGHT — accordion sections; patches first + open */}
        <div>
          <Section title="Patches" count={`${patchCount} earned`} defaultOpen>
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
              {ROADMAP_PATCHES.map((p) => (
                <Patch
                  key={p.key}
                  kind={p.key.startsWith("wings:") ? "wings" : "cluster"}
                  label={p.label}
                  earned={earnedKeys.has(p.key)}
                  howToEarn={p.howToEarn}
                />
              ))}
              {skillPatches.map((b) => (
                <Patch key={b.badgeKey} kind="skill" label={patchLabel(b.badgeKey)} earned />
              ))}
              {ratingPatches.map((b) => (
                <Patch key={b.badgeKey} kind="rating" label={patchLabel(b.badgeKey)} earned />
              ))}
            </div>
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
