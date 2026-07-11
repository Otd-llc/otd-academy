import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { loadLessonMeta, getLogbook } from "@/lib/logbook/load";
import { ROADMAP_PATCHES, SKILL_PATCH_LABELS, patchLabel } from "@/lib/logbook/patches";

// The Logbook (design §9.5): a private, hairline-grouped record of your standing,
// per-cluster completion, patches, and recent XP. Auth-gated by middleware (the
// redirect here is a defense-in-depth backstop). Per-request (session-scoped).
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Logbook",
  robots: { index: false, follow: false },
};

const day = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  }).format(d);

const num = (n: number) => n.toLocaleString("en-US");

// A square hex tile — the v1 patch treatment (full mission-patch art is a later
// sandbox round). Earned reads gold; locked is a dim silhouette with how-to-earn.
function Patch({
  label,
  earned,
  howToEarn,
}: {
  label: string;
  earned: boolean;
  howToEarn?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <svg
        viewBox="0 0 48 48"
        className="h-12 w-12"
        fill="none"
        stroke={earned ? "var(--color-command-gold)" : "var(--color-gray-3)"}
        strokeWidth={1.4}
        aria-hidden
      >
        <path d="M24 3l18 10.4v20.8L24 45 6 34.2V13.4z" />
        <path
          d="M24 14l9 5.2v10.4L24 35l-9-5.2V19.2z"
          stroke={earned ? "var(--color-gold-light)" : "var(--color-gray-3)"}
        />
      </svg>
      <span
        className={`font-mono text-[9px] uppercase tracking-[0.14em] ${
          earned ? "text-gold-light" : "text-muted"
        }`}
      >
        {label}
      </span>
      {!earned && howToEarn ? (
        <span className="max-w-[8rem] font-serif text-[11px] leading-tight text-gray-3">
          {howToEarn}
        </span>
      ) : null}
    </div>
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
  const earnedSkills = lb.badges.filter((b) => b.badgeKey in SKILL_PATCH_LABELS);
  const nextPct = lb.next
    ? Math.min(100, Math.round((lb.xpTotal / lb.next.minXp) * 100))
    : 100;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="ACCOUNT"
        title="Logbook"
        lead="Your standing, completion, and patches."
        meta={[
          { label: "RATING", value: `FL${lb.level} ${lb.title}` },
          {
            label: "CURRENT",
            value: lb.isCurrent ? (
              `through ${day(lb.currentThrough!)}`
            ) : (
              <span className="text-gray-3">lapsed</span>
            ),
          },
        ]}
      />

      {/* Standing — the signature Saira readout */}
      <section className="mt-8 border-t border-panel-border/60 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Standing
        </p>
        <p className="mt-3 font-numeral text-5xl tracking-wide tabular-nums text-command-gold sm:text-6xl">
          {num(lb.xpTotal)}{" "}
          <span className="text-2xl text-muted sm:text-3xl">XP</span>
        </p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          FL{lb.level} · {lb.title}
        </p>

        {lb.next ? (
          <div className="mt-5">
            <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              <span>Next rating · FL{lb.next.level} {lb.next.title}</span>
              <span className="font-numeral text-sm tabular-nums text-text">
                {num(lb.xpTotal)} / {num(lb.next.minXp)}
              </span>
            </div>
            <div className="mt-2 h-px w-full bg-panel-border/60">
              <div
                className="h-px bg-command-gold"
                style={{ width: `${nextPct}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-command-gold">
            Top rating reached
          </p>
        )}
      </section>

      {/* Clusters — done / total with a thin gold rule */}
      <section className="mt-10 border-t border-panel-border/60 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Clusters
        </p>
        <ul className="mt-3">
          {lb.clusters.map((c) => {
            const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
            return (
              <li key={c.key} className="border-b border-panel-border/50 py-3.5">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-serif text-sm text-text">{c.label}</span>
                  <span className="font-numeral text-base tabular-nums text-command-gold">
                    {c.done} / {c.total}
                  </span>
                </div>
                <div className="mt-2 h-px w-full bg-panel-border/50">
                  <div className="h-px bg-command-gold/70" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Patches — roadmap teasers always shown; skill patches once earned */}
      <section className="mt-10 border-t border-panel-border/60 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Patches
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ROADMAP_PATCHES.map((p) => (
            <Patch
              key={p.key}
              label={p.label}
              earned={earnedKeys.has(p.key)}
              howToEarn={p.howToEarn}
            />
          ))}
          {earnedSkills.map((b) => (
            <Patch key={b.badgeKey} label={patchLabel(b.badgeKey)} earned />
          ))}
        </div>
      </section>

      {/* Recent activity — mono ledger rows */}
      <section className="mt-10 border-t border-panel-border/60 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Recent activity
        </p>
        {lb.recent.length === 0 ? (
          <p className="mt-3 font-serif text-sm text-muted">
            No activity yet.{" "}
            <Link href="/library" className="text-command-gold hover:text-gold-light">
              Read a lesson
            </Link>{" "}
            to log your first XP.
          </p>
        ) : (
          <ul className="mt-2">
            {lb.recent.map((e, i) => {
              const slug = e.source === "QUIZ_CORRECT" ? e.refId?.split("#")[0] : e.refId;
              const label = (slug ?? "").replace(/-/g, " ") || "library";
              return (
                <li
                  key={i}
                  className="flex items-baseline gap-3 border-b border-panel-border/40 py-2.5 font-mono text-[11px] tracking-[0.04em] text-muted"
                >
                  <span className="font-numeral text-sm tabular-nums text-command-gold">
                    +{e.amount}
                  </span>
                  <span className="uppercase tracking-[0.14em] text-text">
                    {e.source.replace(/_/g, " ")}
                  </span>
                  <span className="truncate text-muted">{label}</span>
                  <span className="ml-auto shrink-0 text-gray-3">{day(e.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
