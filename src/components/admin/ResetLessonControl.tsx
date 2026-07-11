"use client";

// Destructive per-lesson XP reset (design §14). A typed-confirm gate (the admin
// must type the slug) guards an all-users reset; on success the row's control
// reflects it. The heavy lifting + the level recompute live server-side in
// resetLessonXp (requireAdmin).
import { useState } from "react";
import { resetLessonXp } from "@/lib/actions/logbook";

export function ResetLessonControl({ slug }: { slug: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  async function onReset() {
    const typed = window.prompt(
      `Reset ALL users' practice XP for this lesson. Type the slug to confirm:\n${slug}`,
    );
    if (typed !== slug) return;
    setState("busy");
    const res = await resetLessonXp({ slug });
    setState(res && res.ok ? "done" : "idle");
  }

  return (
    <button
      type="button"
      onClick={onReset}
      disabled={state !== "idle"}
      className="font-mono text-[9px] uppercase tracking-[0.14em] text-gray-3 transition-colors hover:text-alert-red disabled:opacity-50"
    >
      {state === "done" ? "reset ✓" : state === "busy" ? "…" : "reset"}
    </button>
  );
}
