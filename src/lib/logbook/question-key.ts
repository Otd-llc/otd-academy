// Stable identity for a quiz question, for the XP ledger + locks (design §3).
// Prefer an authored `id` (new content); fall back to a hash of the question
// text (the 69 existing lessons — no backfill needed). Editing a question's text
// without an id makes it a NEW question, which matches grandfathering (§7).
import { createHash } from "node:crypto";

export function questionKey(
  lessonSlug: string,
  question: { id?: string; q: string },
): string {
  if (question.id) return `${lessonSlug}#${question.id}`;
  const h = createHash("sha256").update(question.q).digest("hex").slice(0, 8);
  return `${lessonSlug}#h${h}`;
}
