// Session-detail read for the OTD Capture desktop app. The app holds the same
// slot-scoped signed token it will upload with; it GETs this AFTER the deep-link
// hand-off to pull the slot's metadata — crucially the narration `script`, which
// is too long (and too log-leaky) to ride the otd-capture:// URL. Pure read, no
// side effects. Token-gated (no cookie), like /api/capture and /api/capture/status.
import { db } from "@/lib/db";
import { verifyCaptureToken } from "@/lib/capture-token";
import { guideContentBlocksSchema } from "@/lib/schemas/guide";

// Token-dependent response — never static-optimize/cache it.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const claims = verifyCaptureToken(token);
  if (!claims) {
    return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const card = await db.guideCard.findUnique({
    where: { id: claims.cardId },
    select: { contentBlocks: true },
  });

  // Defaults mirror createCaptureSession (src/lib/actions/guide-images.ts).
  let hint = "";
  let caption = "";
  let aspect = claims.kind === "video" ? "16:9" : "16:10";
  let script = "";
  if (card) {
    try {
      const blocks = guideContentBlocksSchema.parse(card.contentBlocks);
      const block = blocks[claims.blockIndex];
      if (block && (block.type === "image" || block.type === "video")) {
        hint = block.captureHint ?? "";
        caption = block.caption ?? "";
        aspect = block.aspect ?? aspect;
        if (block.type === "video") script = block.script ?? "";
      }
    } catch {
      // fall through to defaults (same defensive posture as /status)
    }
  }
  return Response.json({ kind: claims.kind, hint, caption, aspect, script });
}
