"use server";

// Custom avatar upload for the signed-in user. Mirrors the part-asset flow:
// presign a PUT, the client uploads the (already cropped→webp) blob straight to
// R2 at the deterministic key avatars/{userId}.webp, then we HEAD-verify the size
// and stamp User.avatarUpdatedAt (presence = "has custom avatar", value =
// cache-bust). removeAvatar clears the flag + deletes the object. The avatar is
// served publicly via /api/avatar/{userId}.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { env } from "@/env";
import {
  ensureR2Enabled,
  presignPut,
  headVerifySize,
  deleteR2Object,
} from "@/lib/part-r2";
import { userAvatarKey } from "@/lib/r2";

// The client crops to a 256px square webp, which is a few tens of KB; cap well
// above that but small enough to reject a raw drop-in.
const MAX_AVATAR_BYTES = 512 * 1024;
const byteSchema = z.number().int().positive().max(MAX_AVATAR_BYTES);

/** Presign a browser PUT to the user's avatar object. */
export async function createAvatarUploadUrl(input: {
  byteSize: number;
}): Promise<{ uploadUrl: string; contentType: string }> {
  const user = await requireUser();
  ensureR2Enabled();
  const byteSize = byteSchema.parse(input.byteSize);
  const contentType = "image/webp";
  const uploadUrl = await presignPut(userAvatarKey(user.id), contentType, byteSize);
  return { uploadUrl, contentType };
}

/** Confirm the object landed, then mark the user as having a custom avatar. */
export async function saveAvatar(input: { byteSize: number }): Promise<void> {
  const user = await requireUser();
  ensureR2Enabled();
  const byteSize = byteSchema.parse(input.byteSize);
  // Verify the uploaded object exists at (or under) the declared size; an
  // oversize orphan is deleted by headVerifySize.
  await headVerifySize(userAvatarKey(user.id), byteSize, MAX_AVATAR_BYTES);
  await db.user.update({
    where: { id: user.id },
    data: { avatarUpdatedAt: new Date() },
  });
  revalidatePath("/", "layout");
}

/** Drop the custom avatar (fall back to the provider image / initial). */
export async function removeAvatar(): Promise<void> {
  const user = await requireUser();
  await db.user.update({
    where: { id: user.id },
    data: { avatarUpdatedAt: null },
  });
  if (env.R2_ENABLED && env.R2_BUCKET) {
    await deleteR2Object(userAvatarKey(user.id)).catch(() => {});
  }
  revalidatePath("/", "layout");
}
