// Public, long-cached serving of admin-captured guide media (screenshots / clips).
// The blob lives in R2 under guide-shots/{cuid}.{ext}; this streams it with
// immutable cache headers — the cuid is content-addressed, so the URL never
// changes. Restricted to the guide-shots/ prefix + a strict id pattern, so it
// can't be used to read arbitrary R2 objects. No auth: lesson media is public.
//
// Range requests are honoured (passed through to R2) so the browser can SEEK
// video properly with 206 partial responses. The R2 body is pumped through a
// guarded ReadableStream: when a client disconnects mid-stream — video seek,
// pause, navigation, or a dev HMR reload — the response controller is cancelled
// and we stop reading R2. Piping the R2 stream straight through (the old code)
// let it enqueue into an already-closed controller, which throws an uncaught
// `ERR_INVALID_STATE: Controller is already closed` and crashes the request.
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@/env";
import { r2, guideShotKey } from "@/lib/r2";

const MIME: Record<string, string> = {
  webp: "image/webp",
  webm: "video/webm",
  mp4: "video/mp4",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const match = /^([a-z0-9]+)\.(webp|webm|mp4)$/.exec(key);
  if (!match) return new Response("Not found", { status: 404 });
  const [, shotId, ext] = match;

  if (!env.R2_ENABLED || !env.R2_BUCKET) {
    return new Response("Not found", { status: 404 });
  }

  const range = req.headers.get("range") ?? undefined;

  let obj;
  try {
    obj = await r2.send(
      new GetObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: guideShotKey(shotId, ext),
        Range: range,
      }),
    );
  } catch {
    // An unsatisfiable range (416) or a missing object both resolve to "gone".
    return new Response("Not found", { status: 404 });
  }
  if (!obj.Body) return new Response("Not found", { status: 404 });

  const isPartial = Boolean(range) && obj.ContentRange != null;

  // Guarded pump: cancel the R2 read on client disconnect and swallow the
  // close race, so an aborted stream can never throw an uncaught exception.
  const reader = obj.Body.transformToWebStream().getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        await reader.cancel().catch(() => {});
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  const headers: Record<string, string> = {
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
  };
  if (obj.ContentLength != null) headers["Content-Length"] = String(obj.ContentLength);
  if (isPartial && obj.ContentRange) headers["Content-Range"] = obj.ContentRange;

  return new Response(body, { status: isPartial ? 206 : 200, headers });
}
