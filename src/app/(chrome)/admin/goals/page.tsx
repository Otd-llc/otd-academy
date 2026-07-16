// Admin: goals dashboard. Live DB counts vs hand-set targets, each stat
// expandable to the records behind the number (the waitlist stat to the captured
// emails). The at-a-glance "where do we stand" view.
//
// Admin-gated two ways: the middleware bounces a LEARNER off /admin/* (it's in
// isAdminOnlyPath), and `requireAdmin()` here is the authoritative server gate.
import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth-helpers";
import { loadGoals } from "@/lib/admin/goals";
import { PageHeader } from "@/components/PageHeader";
import { GoalsBoard } from "@/components/admin/GoalsBoard";

export const metadata: Metadata = {
  title: "Goals",
  robots: { index: false, follow: false },
};

export default async function GoalsAdminPage() {
  await requireAdmin();
  const stats = await loadGoals();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="OPERATOR"
        title="Goals"
        lead="Where we stand: live counts against the targets. Tap a stat to see what is what."
      />
      <GoalsBoard stats={stats} />
    </main>
  );
}
