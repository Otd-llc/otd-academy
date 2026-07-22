"use server";

// Feedback server actions (design §9.4). submitLessonFeedback is auth-gated (the
// signed-out UI shows a "sign in to suggest an improvement" prompt instead of
// calling this); markFeedback is admin-only triage. Result TYPES live in the core
// module and reach the client via `import type` (use-server-export-rule: this file
// exports ONLY async functions).
import { z } from "zod";
import { capture } from "@/lib/analytics";
import { requireAdmin, currentUserId } from "@/lib/auth-helpers";
import {
  submitFeedback,
  markFeedback as markFeedbackCore,
  type SubmitFeedbackResult,
  type MarkFeedbackResult,
} from "@/lib/logbook/feedback";

type NeedsAuth = { ok: false; needsAuth: true };

const submitSchema = z.object({
  pageRef: z.string().trim().min(1).max(200),
  body: z.string().trim().min(10).max(2000),
});

export async function submitLessonFeedback(
  input: unknown,
): Promise<SubmitFeedbackResult | NeedsAuth> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, needsAuth: true };
  const parsed = submitSchema.parse(input);
  const result = await submitFeedback(parsed, userId, new Date());
  if (result.ok) {
    capture("feedback_submitted", { pageRef: parsed.pageRef, xp: result.xp }, userId);
  }
  return result;
}

const markSchema = z.object({
  id: z.cuid(),
  status: z.enum(["USEFUL", "DISMISSED"]),
});

export async function markFeedback(input: unknown): Promise<MarkFeedbackResult> {
  await requireAdmin();
  const parsed = markSchema.parse(input);
  return markFeedbackCore(parsed, new Date());
}
