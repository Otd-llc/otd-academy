// Share-card sandbox — the image route (Task 2).
//
// GET /sandbox/share-cards/img/<id>-<len>  →  a real 1200×630 PNG rendered
// through the Task 1 kit, e.g. /sandbox/share-cards/img/A-short. The gallery
// page embeds these at 600×315 with a click-through to full size.
//
// Dev-only: returns 404 in production (this sandbox graduates to a permanent
// dev-only visual-regression surface in Task 9, so it is guarded, not deleted).
// nodejs runtime because the kit reads vendored font buffers from disk.

import { renderCard } from "@/lib/og/card";
import { renderOption } from "../../options";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ variant: string }> },
): Promise<Response> {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }
  const { variant } = await ctx.params;
  const [id, len] = variant.split("-");
  return renderCard(renderOption(id ?? "A", len ?? "short"));
}
