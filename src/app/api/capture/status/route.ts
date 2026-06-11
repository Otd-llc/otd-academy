// Has the capture landed yet? The lesson page polls this after launching the
// desktop app, so it can soft-refresh the moment the slot fills — no manual reload.
// Token-scoped (same token as the upload), so it only reveals the one block's src.
import { db } from "@/lib/db";
import { verifyCaptureToken } from "@/lib/capture-token";
import { guideContentBlocksSchema } from "@/lib/schemas/guide";

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
  let src = "";
  if (card) {
    try {
      const blocks = guideContentBlocksSchema.parse(card.contentBlocks);
      const block = blocks[claims.blockIndex];
      if (block && (block.type === "image" || block.type === "video")) {
        src = block.src || "";
      }
    } catch {
      // fall through to "not filled"
    }
  }
  return Response.json({ filled: src !== "", src });
}
