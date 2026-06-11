// Upload endpoint for the OTD Capture desktop app. NOT session-gated — the
// desktop app has no browser cookie. Instead it presents a short-lived signed
// token (minted by an admin via createCaptureSession, carried in the
// otd-capture:// deep link). The token is scoped to ONE guide block; we verify
// it, store the blob in R2, and point that block at the served URL.
//
// POST /api/capture?token=…&ext=webp|webm|mp4
//   body:    the raw capture bytes (image/webp or video/webm|mp4)
//   header:  x-caption (optional) — the block caption / description
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createId } from "@paralleldrive/cuid2";
import { env } from "@/env";
import { r2, guideShotKey } from "@/lib/r2";
import { verifyCaptureToken } from "@/lib/capture-token";
import { writeGuideBlockMedia } from "@/lib/guide-block-write";

const MAX_BYTES = 60_000_000; // 60 MB — a few-minute clip
const MIME: Record<string, string> = {
  webp: "image/webp",
  webm: "video/webm",
  mp4: "video/mp4",
};
// Which extensions each capture kind is allowed to upload.
const ALLOWED: Record<"image" | "video", string[]> = {
  image: ["webp"],
  video: ["webm", "mp4"],
};

export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const ext = url.searchParams.get("ext");

  if (!token || !ext || !(ext in MIME)) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const claims = verifyCaptureToken(token);
  if (!claims) {
    return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  }
  if (!ALLOWED[claims.kind].includes(ext)) {
    return Response.json(
      { error: `A ${claims.kind} capture can't be a .${ext}` },
      { status: 400 },
    );
  }
  if (!env.R2_ENABLED || !env.R2_BUCKET) {
    return Response.json({ error: "Storage not enabled" }, { status: 503 });
  }

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0) {
    return Response.json({ error: "Empty upload" }, { status: 400 });
  }
  if (bytes.byteLength > MAX_BYTES) {
    return Response.json({ error: "Upload too large" }, { status: 413 });
  }

  const captionRaw = req.headers.get("x-caption");
  const caption = captionRaw
    ? decodeURIComponent(captionRaw).slice(0, 200)
    : undefined;

  const shotId = createId();
  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: guideShotKey(shotId, ext),
        Body: bytes,
        ContentType: MIME[ext],
      }),
    );
    const { src } = await writeGuideBlockMedia(
      claims.cardId,
      claims.blockIndex,
      `/api/shot/${shotId}.${ext}`,
      caption,
    );
    return Response.json({ ok: true, src });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Upload failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
