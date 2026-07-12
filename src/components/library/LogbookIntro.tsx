"use client";

// The one-time /library Logbook intro (design §9.1). A deep-space + gold-hairline
// panel (NOT a modal, NOT a game popup): a gold left-accent bar on the bare field,
// two sentences, a "got it" that stamps logbookIntroSeenAt so it never shows again.
// Optimistic dismiss (hides immediately; the stamp fires async).
import { useEffect, useState } from "react";
import { dismissLogbookIntro } from "@/lib/actions/logbook";
import { trackLogbookIntroSeen } from "@/lib/analytics-client";

export function LogbookIntro({ goalPhrase }: { goalPhrase?: string | null }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    trackLogbookIntroSeen();
  }, []);
  if (dismissed) return null;
  return (
    <div className="mb-8 border-l-2 border-l-command-gold py-4 pl-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ Your Logbook
      </p>
      <p className="mt-2 max-w-2xl font-serif text-sm leading-relaxed text-text">
        Reading lessons and passing quizzes logs XP to your Logbook
        {goalPhrase ? ` as you work toward ${goalPhrase}` : ""}. XP earns ratings
        and patches as you go.
      </p>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          void dismissLogbookIntro();
        }}
        className="glass-button mt-3 inline-flex items-center px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em]"
      >
        Got it
      </button>
    </div>
  );
}
