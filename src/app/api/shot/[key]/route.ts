// Public, long-cached serving of admin-captured guide media (screenshots / clips).
// The blob lives in R2 under guide-shots/{cuid}.{ext}; this streams it with
// immutable cache headers — the cuid is content-addressed, so the URL never
// changes. Restricted to the guide-shots/ prefix + a strict id pattern, so it
// can't be used to read arbitrary R2 objects. No auth: lesson media is public.
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@/env";
import { r2, guideShotKey } from "@/lib/r2";

const MIME: Record<string, string> = {
  webp: "image/webp",
  webm: "video/webm",
  mp4: "video/mp4",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const match = /^([a-z0-9]+)\.(webp|webm|mp4)$/.exec(key);
  if (!match) return new Response("Not found", { status: 404 });
  const [, shotId, ext] = match;

  if (!env.R2_ENABLED || !env.R2_BUCKET) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const obj = await r2.send(
      new GetObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: guideShotKey(shotId, ext),
      }),
    );
    if (!obj.Body) return new Response("Not found", { status: 404 });
    const body = obj.Body.transformToWebStream();
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
