// Admin: waitlist CSV export. Every signup as a row (email, course slug, course
// title, signed-up date). Admin-gated by middleware (/admin/* ) + requireAdmin
// here; a non-admin gets 403 rather than a thrown 500.

import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value: string): string {
  // Quote + escape if the value contains a comma, quote, or newline.
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function GET(): Promise<Response> {
  try {
    await requireAdmin();
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const rows = await db.waitlistSignup.findMany({
    select: {
      email: true,
      createdAt: true,
      project: { select: { slug: true, name: true, publicTitle: true } },
    },
    orderBy: [{ projectId: "asc" }, { createdAt: "asc" }],
  });

  const header = "email,course_slug,course_title,signed_up_at\n";
  const body = rows
    .map((r) =>
      [
        csvCell(r.email),
        csvCell(r.project.slug),
        csvCell(r.project.publicTitle ?? r.project.name),
        r.createdAt.toISOString(),
      ].join(","),
    )
    .join("\n");

  return new Response(header + body + (body ? "\n" : ""), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="otd-waitlist.csv"',
    },
  });
}
