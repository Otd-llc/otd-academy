// Admin: lesson-feedback triage (design §9.4). The private inbox for the per-page
// feedback channel. Admin-gated two ways: middleware bounces a LEARNER off
// /admin/* and requireAdmin() is the authoritative server gate.
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { FeedbackTriage, type FeedbackRow } from "@/components/admin/FeedbackTriage";
export const metadata: Metadata = {
  title: "Feedback",
  robots: { index: false, follow: false },
};

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Chicago",
  }).format(d);

export default async function FeedbackAdminPage() {
  await requireAdmin();
  const rows = await db.lessonFeedback.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      pageRef: true,
      body: true,
      status: true,
      createdAt: true,
      user: { select: { email: true, name: true } },
    },
  });

  const data: FeedbackRow[] = rows.map((r) => ({
    id: r.id,
    pageRef: r.pageRef,
    slug: r.pageRef.replace(/^library\//, ""),
    body: r.body,
    status: r.status,
    date: fmtDate(r.createdAt),
    author: r.user.name?.trim() || r.user.email,
  }));

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="OPERATOR"
        title="Feedback"
        lead="Reader suggestions from the lessons. Mark the useful ones to reward the author."
      />
      <FeedbackTriage rows={data} />
    </main>
  );
}
