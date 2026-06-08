// Server component: the paywall a non-entitled visitor sees on a locked PREMIUM
// lesson (Task B2). It is a sales surface, not a leak — it shows only public
// facts (the project name and, when handed them, the lesson titles) plus the
// anonymous waitlist form. It NEVER renders locked lesson body content.
//
// Rendered by the guide card page on a `paywall` access decision, in place of
// the lesson.
import { WaitlistForm } from "@/components/learn/WaitlistForm";

export function Paywall({
  projectId,
  projectName,
  lessonTitles,
}: {
  projectId: string;
  projectName: string;
  lessonTitles?: string[];
}) {
  const titles = lessonTitles?.filter(Boolean) ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="glass-card border-l-4 border-l-command-gold p-8">
        <p className="font-mono text-xs uppercase tracking-wider text-command-gold">
          🔒 Premium course
        </p>
        <h1 className="mt-3 font-display text-2xl tracking-wider text-white">
          {projectName}
        </h1>
        <p className="mt-3 font-serif text-sm text-gray-2">
          The first lesson is free. The rest of the build unlocks with access —
          join the waitlist and we&apos;ll let you know the moment it opens.
        </p>

        <div className="mt-6">
          <p className="font-mono text-xs uppercase tracking-wider text-muted">
            What&apos;s inside
          </p>
          {titles.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {titles.map((title, i) => (
                <li
                  key={i}
                  className="flex items-baseline gap-2 font-serif text-sm text-gray-1"
                >
                  <span className="font-mono text-xs text-command-gold/70">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 font-serif text-sm text-gray-2">
              A complete, hands-on build walked end to end — from requirements
              through bring-up — with comprehension checks and proof artifacts at
              every stage.
            </p>
          )}
        </div>

        <div className="mt-8 border-t border-panel-border pt-6">
          <WaitlistForm projectId={projectId} />
        </div>
      </div>
    </main>
  );
}
