// Public avatar proxy — streams the signed-in user's custom avatar from R2 at the
// deterministic key avatars/{userId}.webp. Public (exempted from the auth
// middleware in src/proxy.ts) so a signed-OUT returning visitor's C1 "welcome
// back" avatar loads too. Mirrors /api/shot: stable URL, cache-friendly, no
// presign. A ?v cache-bust rides in from User.avatarUpdatedAt. 404 when the user
// has no custom avatar or R2 is off.
import type { NextRequest } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/lib/db";
import { env } from "@/env";
import { r2, userAvatarKey } from "@/lib/r2";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  if (!env.R2_ENABLED || !env.R2_BUCKET) {
    return new Response("Not found", { status: 404 });
  }
  const user = await db.user
    .findUnique({ where: { id: userId }, select: { avatarUpdatedAt: true } })
    .catch(() => null);
  if (!user?.avatarUpdatedAt) {
    return new Response("Not found", { status: 404 });
  }

  let obj;
  try {
    obj = await r2.send(
      new GetObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: userAvatarKey(userId),
      }),
    );
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const bytes = await obj.Body!.transformToByteArray();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": obj.ContentType ?? "image/webp",
      // ?v busts on change, so a modest cache is safe.
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
}
